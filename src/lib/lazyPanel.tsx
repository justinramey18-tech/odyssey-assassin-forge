import { lazy, Suspense, type ComponentProps, type ComponentType, type ReactNode } from 'react';

const RELOAD_KEY = 'odyssey-lazy-reload-at';

/**
 * Loads a piece of the app on demand. If the file can't be fetched (usually because a new
 * version was published while the app was open, so the old file is gone), the page reloads
 * once to pick up the new version. A second failure within 30 seconds is passed on to the
 * error screen instead of reloading in a loop.
 */
export function loadOrReload<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((err) => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { /* storage blocked */ }
    if (Date.now() - last > 30_000) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* storage blocked */ }
      window.location.reload();
      return new Promise<T>(() => {});
    }
    throw err;
  });
}

/**
 * Wraps a component so its code downloads only when it is first drawn. Until then it draws
 * `fallback` (nothing, by default). Each panel gets its own loading boundary, so a panel that
 * is still loading never hides the rest of the screen. `preload()` fetches the code early,
 * in the background, without drawing anything.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any component; its own props are still type-checked at each use
export function lazyPanel<C extends ComponentType<any>>(load: () => Promise<C>, fallback: ReactNode = null) {
  const Lazy = lazy(() => loadOrReload(load).then((component) => ({ default: component })));
  function LazyPanel(props: ComponentProps<C>) {
    return (
      <Suspense fallback={fallback}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- same props, passed straight through */}
        <Lazy {...(props as any)} />
      </Suspense>
    );
  }
  LazyPanel.preload = () => { load().catch(() => { /* drawn later, retried then */ }); };
  return LazyPanel;
}
