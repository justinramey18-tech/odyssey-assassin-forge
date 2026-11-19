// Solo Empyrean hall scene: one wide painted hall (three joined images) with the story over its
// dark middle wall. Drag sideways to look around, like the campaign map. Objects in the art are
// the buttons: tap the satchel for the bag, the dragon for the dragon, and so on.
// The scene is sized by its height and every tap area is a percentage of the scene, so the areas
// stay on their objects on any phone. Native sideways scrolling: nothing here uses a transform.
// With a seam panel (the dragon's chat) the hall is a ring: the panel joins the far right to the far
// left and the view goes round without an end.
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import hallLeft from '@/assets/empyrean-hall-left.jpg';
import hallCenter from '@/assets/empyrean-hall-center.jpg';
import hallRight from '@/assets/empyrean-hall-right.jpg';
import { SoloRoom } from '@/components/empyrean/SoloRoom';
import {
  HALL_SCENE_HEIGHT, HALL_SCENE_PARTS, HALL_SCENE_SEAMS, HALL_SCENE_WIDTH, HALL_SPOTS, hallSpotStyle, type HallSpotId,
} from '@/lib/empyrean-hall-scene';
import { cn } from '@/lib/utils';

const tap = { touchAction: 'manipulation' } as const;
const IMAGES: Record<(typeof HALL_SCENE_PARTS)[number]['key'], string> = { left: hallLeft, center: hallCenter, right: hallRight };
const pct = (v: number) => `${(v / HALL_SCENE_WIDTH) * 100}%`;

/** What one object in the scene does right now. Leave an object out and it is just scenery. */
export interface HallSpotAction {
  onTap: () => void;
  /** Replaces the caption (the dragon's name, the clock). */
  caption?: string;
  /** A count beside the caption. */
  badge?: number;
  /** A small warning dot beside the caption. */
  alert?: boolean;
}

interface SoloHallSceneProps {
  /** false: draw the older round room (story between two walls of big buttons) with the props below. */
  enabled: boolean;
  /** The story (over the scene's dark middle wall). */
  children: ReactNode;
  /** What each object does. */
  spots: Partial<Record<HallSpotId, HallSpotAction>>;
  /** Looks back at the story whenever this value changes (a new message, say). */
  homeKey?: string | number;
  /** A panel one screen wide that joins the far right of the hall to the far left. Given: the hall is a ring. */
  seam?: ReactNode;
  /** Told true once the view has stopped mostly on the seam panel, false once it has stopped mostly off it. */
  onSeamFacing?: (facing: boolean) => void;
  /** Turns the view to the story or the seam panel whenever tick changes. */
  lookAt?: { where: 'story' | 'seam'; tick: number };
  // The older round room's own props (used only while enabled is false).
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
  wallpaper?: string;
}

export function SoloHallScene({ enabled, children, spots, homeKey, seam, onSeamFacing, lookAt, left, right, leftLabel, rightLabel, wallpaper }: SoloHallSceneProps) {
  if (!enabled) {
    return (
      <SoloRoom left={left} right={right} leftLabel={leftLabel} rightLabel={rightLabel} wallpaper={wallpaper} homeKey={homeKey}>
        {children}
      </SoloRoom>
    );
  }
  if (seam != null && seam !== false) {
    return <HallRing spots={spots} homeKey={homeKey} seam={seam} onSeamFacing={onSeamFacing} lookAt={lookAt}>{children}</HallRing>;
  }
  return <HallScene spots={spots} homeKey={homeKey}>{children}</HallScene>;
}

function HallScene({ children, spots, homeKey }: Pick<SoloHallSceneProps, 'children' | 'spots' | 'homeKey'>) {
  const scroller = useRef<HTMLDivElement>(null);
  // How far along the hall the view sits: 0 = far left, 0.5 = the story, 1 = far right.
  // Remembered so a resize or a late first layout keeps the same view.
  const spotRef = useRef(0.5);

  const look = useCallback((where: number, smooth: boolean) => {
    spotRef.current = where;
    const el = scroller.current;
    if (!el) return;
    const range = el.scrollWidth - el.clientWidth;
    if (range <= 0) return;
    const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const leftPx = Math.round(range * where);
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: leftPx, behavior: smooth && !calm ? 'smooth' : 'auto' });
    else el.scrollLeft = leftPx;
  }, []);

  // Face the story before the first paint.
  useLayoutEffect(() => { look(0.5, false); }, [look]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    let height = el.clientHeight;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width && el.clientHeight === height) return;
      width = el.clientWidth;
      height = el.clientHeight;
      const range = el.scrollWidth - el.clientWidth;
      if (range > 0) el.scrollLeft = Math.round(range * spotRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wherever a drag leaves the view becomes the remembered spot.
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const range = el.scrollWidth - el.clientWidth;
    if (range > 0) spotRef.current = el.scrollLeft / range;
  }, []);

  const firstHome = useRef(true);
  useEffect(() => {
    if (firstHome.current) { firstHome.current = false; return; }
    look(0.5, true);
  }, [homeKey, look]);

  return (
    <div
      ref={scroller}
      data-solo-hall=""
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-background [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ containerType: 'inline-size' }}
    >
      {/* The scene: as tall as the room, as wide as the art needs. */}
      <div className="relative h-full" style={{ aspectRatio: `${HALL_SCENE_WIDTH} / ${HALL_SCENE_HEIGHT}` }}>
        <HallScenery spots={spots} />

        {/* The story: one screen wide, over the middle of the hall. */}
        <section
          aria-label="Story"
          className="absolute top-0 h-full flex flex-col min-h-0"
          style={{ width: '100cqw', left: 'calc(50% - 50cqw)' }}
        >
          {children}
        </section>
      </div>
    </div>
  );
}

// ── The ring ────────────────────────────────────────────────────────────────────────────────────
// The hall is drawn three times in a row, each copy followed by a gap one screen wide for the seam
// panel. The story and the seam panel exist once and are moved to whichever copy is nearest the
// view. Whenever the view comes to rest it is put back in the middle copy, which looks identical,
// so the hall never runs out. Nothing jumps while a finger is down or the view is still moving.

const HALL_COPIES = 3;
const HALL_REST_MS = 140;

/** Sizes of the ring in screen pixels: the view, one painted hall, and one lap (hall + seam panel). */
export interface HallRingSize { view: number; scene: number; lap: number }
/** Where the view is, in a way that survives a resize: the middle of the view on the painted hall or on the seam panel. */
export interface HallRingSpot { zone: 'scene' | 'seam'; t: number }

const mod = (v: number, by: number) => ((v % by) + by) % by;
const clampCopy = (k: number) => Math.max(0, Math.min(HALL_COPIES - 1, k));

/** Which copy (0, 1 or 2) of something centred `offset` pixels into a lap sits nearest the point `center`. */
export function hallRingCopy(center: number, offset: number, lap: number): number {
  if (!(lap > 0)) return 1;
  return clampCopy(Math.round((center - offset) / lap));
}

/** The same view, moved into the middle copy. */
export function hallRingWrap(x: number, lap: number): number {
  if (!(lap > 0)) return x;
  return lap + mod(x - lap, lap);
}

/** Left edge of the story (one screen wide, centred on the painted hall) in copy k. */
export const hallRingStoryLeft = (k: number, s: HallRingSize) => k * s.lap + s.scene / 2 - s.view / 2;
/** Left edge of the seam panel (straight after the painted hall) in copy k. */
export const hallRingSeamLeft = (k: number, s: HallRingSize) => k * s.lap + s.scene;

export function hallRingSpotAt(x: number, s: HallRingSize): HallRingSpot {
  if (!(s.lap > 0) || !(s.scene > 0)) return { zone: 'scene', t: 0.5 };
  const c = mod(x + s.view / 2, s.lap);
  return c < s.scene ? { zone: 'scene', t: c / s.scene } : { zone: 'seam', t: s.view > 0 ? (c - s.scene) / s.view : 0.5 };
}

/** The scroll position, in the middle copy, that shows a remembered spot. */
export function hallRingLeftFor(spot: HallRingSpot, s: HallRingSize): number {
  const c = spot.zone === 'scene' ? spot.t * s.scene : s.scene + spot.t * s.view;
  return Math.max(0, s.lap + c - s.view / 2);
}

/** The nearest scroll position that faces the story or the seam panel. From the story the panel is equally far both ways: go right, past the dragon. */
export function hallRingTarget(where: 'story' | 'seam', x: number, s: HallRingSize): number {
  const max = HALL_COPIES * s.lap - s.view;
  let best = where === 'story' ? hallRingStoryLeft(1, s) : hallRingSeamLeft(1, s);
  let gap = Infinity;
  for (let k = 0; k < HALL_COPIES; k++) {
    const at = where === 'story' ? hallRingStoryLeft(k, s) : hallRingSeamLeft(k, s);
    if (at < 0 || at > max + 0.5) continue;
    const d = Math.abs(at - x);
    if (where === 'seam' ? d <= gap + 1 : d < gap - 1) { gap = d; best = at; }
  }
  return best;
}

/** How much of the seam panel is in view, 0 to 1. */
export function hallRingSeamShown(x: number, s: HallRingSize): number {
  if (!(s.view > 0) || !(s.lap > 0)) return 0;
  const left = hallRingSeamLeft(hallRingCopy(x + s.view / 2, s.scene + s.view / 2, s.lap), s);
  return Math.max(0, Math.min(x + s.view, left + s.view) - Math.max(x, left)) / s.view;
}

function HallRing({ children, spots, homeKey, seam, onSeamFacing, lookAt }: Pick<SoloHallSceneProps, 'children' | 'spots' | 'homeKey' | 'seam' | 'onSeamFacing' | 'lookAt'>) {
  const scroller = useRef<HTMLDivElement>(null);
  const firstLap = useRef<HTMLDivElement>(null);
  const firstScene = useRef<HTMLDivElement>(null);
  const story = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const size = useRef<HallRingSize>({ view: 0, scene: 0, lap: 0 });
  const spot = useRef<HallRingSpot>({ zone: 'scene', t: 0.5 });
  const placed = useRef({ story: -1, seam: -1 });
  const facing = useRef(false);
  const touching = useRef(false);
  const rest = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tellFacing = useRef(onSeamFacing);
  tellFacing.current = onSeamFacing;

  const measure = useCallback(() => {
    const el = scroller.current;
    const lapEl = firstLap.current;
    const sceneEl = firstScene.current;
    if (!el || !lapEl || !sceneEl) return false;
    const view = el.clientWidth;
    const lap = lapEl.getBoundingClientRect().width;
    const scene = sceneEl.getBoundingClientRect().width;
    if (!(view > 0) || !(lap > 0) || !(scene > 0)) return false;
    size.current = { view, scene, lap };
    placed.current = { story: -1, seam: -1 };
    return true;
  }, []);

  // Put the story and the seam panel on the copy nearest the view. Cheap: it only touches the page when a copy changes.
  const place = useCallback(() => {
    const el = scroller.current;
    const s = size.current;
    if (!el || !(s.lap > 0)) return;
    const center = el.scrollLeft + s.view / 2;
    const ks = hallRingCopy(center, s.scene / 2, s.lap);
    const kp = hallRingCopy(center, s.scene + s.view / 2, s.lap);
    if (ks !== placed.current.story && story.current) {
      story.current.style.left = `${hallRingStoryLeft(ks, s)}px`;
      placed.current.story = ks;
    }
    if (kp !== placed.current.seam && panel.current) {
      panel.current.style.left = `${hallRingSeamLeft(kp, s)}px`;
      placed.current.seam = kp;
    }
  }, []);

  // The view has stopped: go back to the middle copy, then say whether the seam panel is being faced.
  const settle = useCallback(() => {
    rest.current = null;
    const el = scroller.current;
    const s = size.current;
    if (!el || !(s.lap > 0) || touching.current) return;
    const x = el.scrollLeft;
    const home = hallRingWrap(x, s.lap);
    if (Math.abs(home - x) > 0.5) {
      el.scrollLeft = home;
      place();
    }
    const shown = hallRingSeamShown(el.scrollLeft, s);
    const now = shown >= 0.6 ? true : shown <= 0.4 ? false : facing.current;
    if (now !== facing.current) {
      facing.current = now;
      tellFacing.current?.(now);
    }
  }, [place]);

  const whenStill = useCallback(() => {
    if (rest.current) clearTimeout(rest.current);
    rest.current = setTimeout(settle, HALL_REST_MS);
  }, [settle]);

  const show = useCallback((left: number, smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const leftPx = Math.round(left);
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: leftPx, behavior: smooth && !calm ? 'smooth' : 'auto' });
    else el.scrollLeft = leftPx;
    place();
    whenStill();
  }, [place, whenStill]);

  // Face the story before the first paint.
  useLayoutEffect(() => {
    if (!measure()) return;
    show(hallRingLeftFor(spot.current, size.current), false);
  }, [measure, show]);

  // A resize (the keyboard, a rotation, a late first layout) keeps the same thing in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    let height = el.clientHeight;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width && el.clientHeight === height) return;
      width = el.clientWidth;
      height = el.clientHeight;
      if (!measure()) return;
      el.scrollLeft = Math.round(hallRingLeftFor(spot.current, size.current));
      place();
      whenStill();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, place, whenStill]);

  useEffect(() => () => { if (rest.current) clearTimeout(rest.current); }, []);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el || !(size.current.lap > 0)) return;
    place();
    spot.current = hallRingSpotAt(el.scrollLeft, size.current);
    whenStill();
  }, [place, whenStill]);

  const onTouchStart = useCallback(() => { touching.current = true; }, []);
  const onTouchEnd = useCallback(() => { touching.current = false; whenStill(); }, [whenStill]);

  // A new message looks back at the story, unless the rider is busy at the seam panel.
  const firstHome = useRef(true);
  useEffect(() => {
    if (firstHome.current) { firstHome.current = false; return; }
    const el = scroller.current;
    if (!el || facing.current || !(size.current.lap > 0)) return;
    show(hallRingTarget('story', el.scrollLeft, size.current), true);
  }, [homeKey, show]);

  const lookTick = lookAt?.tick;
  const lookWhere = lookAt?.where;
  const firstLook = useRef(true);
  useEffect(() => {
    if (firstLook.current) { firstLook.current = false; return; }
    const el = scroller.current;
    if (!el || !lookWhere || !(size.current.lap > 0)) return;
    show(hallRingTarget(lookWhere, el.scrollLeft, size.current), true);
  }, [lookTick, lookWhere, show]);

  return (
    <div
      ref={scroller}
      data-solo-hall=""
      data-hall-ring=""
      onScroll={onScroll}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-background [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ containerType: 'inline-size' }}
    >
      <div className="relative flex h-full">
        {Array.from({ length: HALL_COPIES }, (_, k) => (
          <div key={k} ref={k === 0 ? firstLap : undefined} className="flex h-full shrink-0" aria-hidden={k === 1 ? undefined : true}>
            <div ref={k === 0 ? firstScene : undefined} className="relative h-full shrink-0" style={{ aspectRatio: `${HALL_SCENE_WIDTH} / ${HALL_SCENE_HEIGHT}` }}>
              <HallScenery spots={spots} quiet={k !== 1} />
            </div>
            {/* The gap the seam panel sits in. Dark, so the hall reads as closed even before the panel is placed. */}
            <div className="h-full shrink-0 bg-[#0a0a1a]" style={{ width: '100cqw' }} />
          </div>
        ))}

        {/* The story: one screen wide, over the middle of the nearest hall. */}
        <section ref={story} aria-label="Story" className="absolute top-0 h-full flex flex-col min-h-0" style={{ width: '100cqw' }}>
          {children}
        </section>

        {/* The seam panel: one screen wide, between the far right of one hall and the far left of the next. */}
        <div ref={panel} data-hall-seam="" className="absolute top-0 h-full flex flex-col min-h-0 overflow-hidden bg-[#0a0a1a]" style={{ width: '100cqw' }}>
          {seam}
          <div aria-hidden="true" className="absolute inset-y-0 left-0 w-3 pointer-events-none bg-gradient-to-r from-black/70 to-transparent" />
          <div aria-hidden="true" className="absolute inset-y-0 right-0 w-3 pointer-events-none bg-gradient-to-l from-black/70 to-transparent" />
        </div>
      </div>
    </div>
  );
}

/** The painted hall itself: the three images, the join shadows and the tappable objects. */
function HallScenery({ spots, quiet }: { spots: SoloHallSceneProps['spots']; quiet?: boolean }) {
  return (
    <>
      {HALL_SCENE_PARTS.map(part => (
        <img
          key={part.key}
          src={IMAGES[part.key]}
          alt=""
          draggable={false}
          className="absolute top-0 h-full select-none pointer-events-none"
          style={{ left: pct(part.x), width: pct(part.width) }}
        />
      ))}
      {/* A soft shadow down each join, so the pillar where two images meet reads as one. */}
      {HALL_SCENE_SEAMS.map(x => (
        <div key={x} aria-hidden="true" className="absolute top-0 h-full pointer-events-none"
          style={{ left: pct(x - 45), width: pct(90), background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.55) 50%, transparent)' }} />
      ))}

      {/* The objects. */}
      {HALL_SPOTS.map(spot => {
        const action = spots[spot.id];
        if (!action) return null;
        const caption = action.caption || spot.label;
        const count = typeof action.badge === 'number' && action.badge > 0 ? action.badge : 0;
        return (
          <button
            key={spot.id}
            type="button"
            onClick={action.onTap}
          tabIndex={quiet ? -1 : undefined}
            style={{ ...tap, ...hallSpotStyle(spot.box) }}
            aria-label={count > 0 ? `${caption}, ${count}` : caption}
            className="group absolute rounded-xl outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary active:bg-primary/10 active:shadow-[0_0_0_2px_hsl(var(--primary)/0.7)]"
          >
            <span className={cn(
              'absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 max-w-[160%] whitespace-nowrap',
              'inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background/75 px-2 py-0.5',
              'font-cinzel text-[11px] leading-tight text-primary',
            )}>
              {caption}
              {count > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground inline-flex items-center justify-center">{count}</span>}
              {action.alert && count === 0 && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-destructive" />}
            </span>
          </button>
        );
      })}
    </>
  );
}
