// Campaign map: pan and pinch-zoom (CL-071).
// The map starts large (it fills the viewport's height, so it is wider than the phone and pans
// sideways) and can zoom to 5×. Zooming changes the map's real width rather than scaling it, so
// pins, names and the "You are here" dot stay the same size on screen while the places spread
// apart. A drag or pinch never counts as a tap on a pin.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Crosshair, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
const TAP_SLOP_PX = 8;

export interface View { zoom: number; x: number; y: number }
export interface Size { w: number; h: number }

/** The map's width at zoom 1: at least the viewport's width, and tall enough to fill its height. */
export function baseWidth(viewport: Size, aspect: number): number {
  if (!viewport.w || !viewport.h || !(aspect > 0)) return viewport.w;
  return Math.max(viewport.w, viewport.h * aspect);
}

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(z) ? z : MIN_ZOOM));
}

/** Keep the map covering the viewport; a smaller side is centered. */
export function clampView(v: View, viewport: Size, content: Size): View {
  const fit = (off: number, view: number, size: number) => (size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, off)));
  return { zoom: v.zoom, x: fit(v.x, viewport.w, content.w), y: fit(v.y, viewport.h, content.h) };
}

/** Zoom to `zoom` while the map point under (px, py) on screen stays under it. */
export function zoomAround(v: View, zoom: number, px: number, py: number): View {
  const z = clampZoom(zoom);
  const k = z / v.zoom;
  return { zoom: z, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
}

/** Center a map point (0..1) in the viewport. */
export function centerOn(point: { x: number; y: number }, zoom: number, viewport: Size, content: Size): View {
  return { zoom, x: viewport.w / 2 - point.x * content.w, y: viewport.h / 2 - point.y * content.h };
}

export function MapPanZoom({ height, aspect, focus, children }: {
  /** CSS height of the viewport, e.g. '62vh'. */
  height: string;
  /** Map width / height (from the picture); measured from the content when unknown. */
  aspect?: number | null;
  /** Where to center when the map opens and on the re-center button (the party). */
  focus?: { x: number; y: number } | null;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size>({ w: 0, h: 0 });
  const [measuredAspect, setMeasuredAspect] = useState<number | null>(null);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const centered = useRef(false);

  const ar = aspect && aspect > 0 ? aspect : measuredAspect ?? 4 / 3;
  const w0 = baseWidth(viewport, ar);
  const content: Size = { w: w0 * view.zoom, h: (w0 * view.zoom) / ar };
  const viewRef = useRef(view); viewRef.current = view;
  const sizes = useRef({ viewport, content, w0, ar }); sizes.current = { viewport, content, w0, ar };

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setViewport({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // Without a known picture size, read the shape the map actually rendered at.
  useEffect(() => {
    if (aspect && aspect > 0) return;
    const el = innerRef.current;
    if (!el) return;
    const read = () => { if (el.offsetWidth && el.offsetHeight) setMeasuredAspect(el.offsetWidth / el.offsetHeight); };
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [aspect]);

  const apply = useCallback((next: View) => {
    const { viewport: vp, w0: base, ar: a } = sizes.current;
    const c = { w: base * next.zoom, h: (base * next.zoom) / a };
    setView(clampView(next, vp, c));
  }, []);

  const recenter = useCallback(() => {
    const { viewport: vp, w0: base, ar: a } = sizes.current;
    const z = viewRef.current.zoom;
    const c = { w: base * z, h: (base * z) / a };
    apply(focus ? centerOn(focus, z, vp, c) : { zoom: z, x: (vp.w - c.w) / 2, y: (vp.h - c.h) / 2 });
  }, [apply, focus]);

  // First layout: center on the party. Later (the phone turns, the map changes shape): keep the view valid.
  const recenterRef = useRef(recenter); recenterRef.current = recenter;
  useEffect(() => {
    if (!viewport.w || !viewport.h) return;
    if (!centered.current) { centered.current = true; recenterRef.current(); return; }
    apply(viewRef.current);
  }, [viewport.w, viewport.h, ar, apply]);

  // ── gestures ──
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; start: { x: number; y: number }; pinch: null | { d: number; zoom: number } }>({ moved: false, start: { x: 0, y: 0 }, pinch: null });

  const local = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pinchInfo = () => {
    const [a, b] = [...pointers.current.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) gesture.current = { moved: false, start: p, pinch: null };
    if (pointers.current.size === 2) { gesture.current.pinch = { d: pinchInfo().d, zoom: viewRef.current.zoom }; gesture.current.moved = true; }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    if (pointers.current.size >= 2 && gesture.current.pinch) {
      const before = pinchInfo();
      pointers.current.set(e.pointerId, p);
      const now = pinchInfo();
      const g = gesture.current.pinch;
      const zoomed = zoomAround(viewRef.current, (g.zoom * now.d) / g.d, now.mid.x, now.mid.y);
      apply({ ...zoomed, x: zoomed.x + (now.mid.x - before.mid.x), y: zoomed.y + (now.mid.y - before.mid.y) });
      return;
    }
    pointers.current.set(e.pointerId, p);
    if (!gesture.current.moved && Math.hypot(p.x - gesture.current.start.x, p.y - gesture.current.start.y) < TAP_SLOP_PX) return;
    gesture.current.moved = true;
    const v = viewRef.current;
    apply({ ...v, x: v.x + (p.x - prev.x), y: v.y + (p.y - prev.y) });
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current.pinch = null;
  };

  // A drag or pinch ends without tapping whatever pin it ended on.
  const onPointerUpCapture = (e: React.PointerEvent) => {
    if (gesture.current.moved) e.stopPropagation();
    onPointerEnd(e);
  };

  const onWheel = (e: React.WheelEvent) => {
    const p = local(e);
    apply(zoomAround(viewRef.current, viewRef.current.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y));
  };

  const step = (factor: number) => {
    const { viewport: vp } = sizes.current;
    apply(zoomAround(viewRef.current, viewRef.current.zoom * factor, vp.w / 2, vp.h / 2));
  };

  return (
    <div className="relative w-full">
      <div ref={boxRef} data-vaul-no-drag data-testid="map-viewport"
        className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 select-none"
        style={{ height, touchAction: 'none' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUpCapture={onPointerUpCapture}
        onPointerCancel={onPointerEnd} onPointerLeave={onPointerEnd} onWheel={onWheel}>
        <div ref={innerRef} data-testid="map-content" className="absolute left-0 top-0 will-change-transform"
          style={{ width: viewport.w ? `${content.w}px` : '100%', transform: `translate3d(${view.x}px, ${view.y}px, 0)` }}>
          {children}
        </div>
      </div>
      <div className="absolute right-2 top-2 flex flex-col gap-2">
        {([
          ['Zoom in', <Plus key="p" className="w-5 h-5" />, () => step(1.5), view.zoom >= MAX_ZOOM],
          ['Zoom out', <Minus key="m" className="w-5 h-5" />, () => step(1 / 1.5), view.zoom <= MIN_ZOOM],
          ['Center on the party', <Crosshair key="c" className="w-5 h-5" />, recenter, false],
        ] as const).map(([label, icon, run, off]) => (
          <button key={label} type="button" aria-label={label} title={label} disabled={off} onClick={run}
            className={cn('w-12 h-12 rounded-full bg-black/75 border border-white/20 text-amber-200 flex items-center justify-center shadow', off && 'opacity-40')}
            style={{ touchAction: 'manipulation' }}>
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
