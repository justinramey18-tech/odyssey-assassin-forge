import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

/**
 * Overlay ganglion.
 *
 * One small hub that relays "open" and "close" straight to each panel, so opening a
 * panel re-renders only that panel, never the (large) screen that owns it.
 *
 * - The screen WRITES to the hub (`open`, `close`) without subscribing to it.
 * - Each panel is wrapped in an <OverlaySlot>, which subscribes to its own key only.
 * - A panel can carry a payload when it opens (e.g. which tab or which sections to
 *   show). Closing keeps the last payload, so a closing animation shows the same content.
 *
 * `M` maps each panel name to the payload type it opens with (use `undefined` for none).
 */
export interface OverlaySnapshot<P> {
  open: boolean;
  payload: P | undefined;
}

export interface OverlayGanglion<M> {
  get<K extends keyof M>(key: K): OverlaySnapshot<M[K]>;
  isOpen(key: keyof M): boolean;
  /** Opens a panel with this payload (undefined when omitted). */
  open<K extends keyof M>(key: K, payload?: M[K]): void;
  close(key: keyof M): void;
  /** For a panel's own onOpenChange: opening keeps the current payload. */
  set(key: keyof M, open: boolean): void;
  subscribe(key: keyof M, listener: () => void): () => void;
}

const CLOSED: OverlaySnapshot<unknown> = { open: false, payload: undefined };

export function createOverlayGanglion<M>(): OverlayGanglion<M> {
  const state = new Map<keyof M, OverlaySnapshot<unknown>>();
  const listeners = new Map<keyof M, Set<() => void>>();

  const get = <K extends keyof M>(key: K) =>
    (state.get(key) ?? CLOSED) as OverlaySnapshot<M[K]>;

  const write = (key: keyof M, next: OverlaySnapshot<unknown>) => {
    state.set(key, next);
    listeners.get(key)?.forEach(listener => listener());
  };

  const close = (key: keyof M) => {
    const current = get(key);
    if (!current.open) return;
    write(key, { open: false, payload: current.payload });
  };

  return {
    get,
    isOpen: key => get(key).open,
    open: (key, payload) => write(key, { open: true, payload }),
    close,
    set: (key, open) => {
      if (!open) { close(key); return; }
      const current = get(key);
      if (!current.open) write(key, { open: true, payload: current.payload });
    },
    subscribe: (key, listener) => {
      let set = listeners.get(key);
      if (!set) { set = new Set(); listeners.set(key, set); }
      set.add(listener);
      return () => { set!.delete(listener); };
    },
  };
}

/** One ganglion per mounted screen, stable for the screen's lifetime. */
export function useOverlayGanglion<M>(): OverlayGanglion<M> {
  const ref = useRef<OverlayGanglion<M> | null>(null);
  if (!ref.current) ref.current = createOverlayGanglion<M>();
  return ref.current;
}

/** Subscribes to one panel. Re-renders the caller only when that panel changes. */
export function useOverlayState<M, K extends keyof M>(ganglion: OverlayGanglion<M>, key: K): OverlaySnapshot<M[K]> {
  const subscribe = useCallback((onChange: () => void) => ganglion.subscribe(key, onChange), [ganglion, key]);
  const getSnapshot = useCallback(() => ganglion.get(key), [ganglion, key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Runs a side effect when a panel opens or closes, WITHOUT re-rendering the caller.
 * (Use it for things like refreshing a badge count when a panel opens.)
 */
export function useOverlayChange<M, K extends keyof M>(
  ganglion: OverlayGanglion<M>,
  key: K,
  onChange: (open: boolean, payload: M[K] | undefined) => void,
) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;
  useEffect(() => {
    let wasOpen = ganglion.get(key).open;
    return ganglion.subscribe(key, () => {
      const snapshot = ganglion.get(key);
      if (snapshot.open === wasOpen) return;
      wasOpen = snapshot.open;
      callbackRef.current(snapshot.open, snapshot.payload);
    });
  }, [ganglion, key]);
}

/**
 * Wraps one panel. Only this slot re-renders when the panel opens or closes; the
 * render function receives the open flag, a setter for the panel's own onOpenChange /
 * onClose, and the payload it was opened with.
 */
export function OverlaySlot<M, K extends keyof M>({
  ganglion,
  name,
  children,
}: {
  ganglion: OverlayGanglion<M>;
  name: K;
  children: (open: boolean, setOpen: (open: boolean) => void, payload: M[K] | undefined) => ReactNode;
}) {
  const snapshot = useOverlayState(ganglion, name);
  const setOpen = useCallback((next: boolean) => ganglion.set(name, next), [ganglion, name]);
  return <>{children(snapshot.open, setOpen, snapshot.payload)}</>;
}
