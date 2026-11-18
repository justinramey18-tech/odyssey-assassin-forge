// Solo Empyrean hall scene: one wide painted hall (three joined images) with the story over its
// dark middle wall. Drag sideways to look around, like the campaign map. Objects in the art are
// the buttons: tap the satchel for the bag, the dragon for the dragon, and so on.
// The scene is sized by its height and every tap area is a percentage of the scene, so the areas
// stay on their objects on any phone. Native sideways scrolling: nothing here uses a transform.
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
  // The older round room's own props (used only while enabled is false).
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
  wallpaper?: string;
}

export function SoloHallScene({ enabled, children, spots, homeKey, left, right, leftLabel, rightLabel, wallpaper }: SoloHallSceneProps) {
  if (!enabled) {
    return (
      <SoloRoom left={left} right={right} leftLabel={leftLabel} rightLabel={rightLabel} wallpaper={wallpaper} homeKey={homeKey}>
        {children}
      </SoloRoom>
    );
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
