// Solo Empyrean "round room": one wide surface with the story in the middle and a wall of big
// buttons on each side. Drag sideways anywhere to look around, like the campaign map: it follows
// the finger and stops where you leave it. No snapping, no tabs.
// Native sideways scrolling: no transform sits around the story, so sheets and the Live Table
// (position: fixed) are never affected. Only the walls' own button grids tilt.
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const tap = { touchAction: 'manipulation' } as const;

/** Each wall's width as a share of the screen's width. The story is one full screen wide. */
export const WALL_SHARE = 0.82;
const TOTAL = 1 + WALL_SHARE * 2;
const WALL_WIDTH = `calc(100% * ${WALL_SHARE} / ${TOTAL})`;
const STORY_WIDTH = `calc(100% / ${TOTAL})`;

/** Where the view sits, in screen widths from the far left: 0 = left wall, WALL_SHARE = the story, 2 × WALL_SHARE = right wall. */
export type RoomSpot = number;
export const STORY_SPOT: RoomSpot = WALL_SHARE;

interface SoloRoomProps {
  /** The story (middle of the room). */
  children: ReactNode;
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
  /** Looks back at the story whenever this value changes (a new message, say). */
  homeKey?: string | number;
  /** Where the view sits when the room first shows. */
  start?: RoomSpot;
  /** One wide picture behind the whole room; dragging moves across it. */
  wallpaper?: string;
}

export function SoloRoom({ children, left, right, leftLabel, rightLabel, homeKey, start = STORY_SPOT, wallpaper }: SoloRoomProps) {
  const scroller = useRef<HTMLDivElement>(null);
  // Remembered so a resize or a late first layout (the room had no width yet) keeps the same view.
  const spotRef = useRef<RoomSpot>(start);

  const look = useCallback((spot: RoomSpot, smooth: boolean) => {
    spotRef.current = spot;
    const el = scroller.current;
    if (!el) return;
    const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const leftPx = Math.round(el.clientWidth * spot);
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: leftPx, behavior: smooth && !calm ? 'smooth' : 'auto' });
    else el.scrollLeft = leftPx;
  }, []);

  // Look at the starting spot before the first paint.
  useLayoutEffect(() => { look(start, false); }, [look, start]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      el.scrollLeft = Math.round(width * spotRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wherever a drag leaves the view becomes the remembered spot.
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    spotRef.current = el.scrollLeft / el.clientWidth;
  }, []);

  const firstHome = useRef(true);
  useEffect(() => {
    if (firstHome.current) { firstHome.current = false; return; }
    look(STORY_SPOT, true);
  }, [homeKey, look]);

  return (
    <div
      ref={scroller}
      data-solo-room=""
      onScroll={onScroll}
      className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="relative flex h-full shrink-0" style={{ width: `${TOTAL * 100}%` }}>
        {wallpaper && (
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-cover bg-center" style={{ backgroundImage: `url(${wallpaper})` }} />
        )}
        <section aria-label={leftLabel} className="relative h-full shrink-0 flex flex-col min-h-0" style={{ width: WALL_WIDTH }}>
          <RoomWall side="left" bare={!!wallpaper}>{left}</RoomWall>
        </section>
        <section aria-label="Story" className="relative h-full shrink-0 flex flex-col min-h-0" style={{ width: STORY_WIDTH }}>
          {children}
        </section>
        <section aria-label={rightLabel} className="relative h-full shrink-0 flex flex-col min-h-0" style={{ width: WALL_WIDTH }}>
          <RoomWall side="right" bare={!!wallpaper}>{right}</RoomWall>
        </section>
      </div>
    </div>
  );
}

function RoomWall({ side, bare, children }: { side: 'left' | 'right'; bare: boolean; children: ReactNode }) {
  // The far edge of each wall is darker and the buttons lean slightly toward the story: the room reads as curved.
  const shade = side === 'left'
    ? 'linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.5) 40%, transparent 100%)'
    : 'linear-gradient(270deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.5) 40%, transparent 100%)';
  return (
    <div className={cn('relative flex-1 min-h-0 flex flex-col', !bare && 'bg-gradient-to-b from-muted/40 via-background to-background')}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: shade }} />
      <div className="relative flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-3" style={{ perspective: '900px' }}>
        <div
          className="grid grid-cols-2 gap-3 motion-reduce:!transform-none"
          style={{ transform: `rotateY(${side === 'left' ? 5 : -5}deg)`, transformOrigin: side === 'left' ? 'right center' : 'left center' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export interface RoomButtonProps {
  label: string;
  /** A short second line (the clock, a name). */
  detail?: string;
  icon: ReactNode;
  /** Optional button art; the icon shows when there is none. */
  art?: string;
  /** A count shown in the corner. */
  badge?: number;
  /** A small warning dot in the corner. */
  alert?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** One big wall button. */
export function RoomButton({ label, detail, icon, art, badge, alert, disabled, onClick }: RoomButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={tap}
      aria-label={detail ? `${label}. ${detail}` : label}
      className={cn(
        'relative min-h-[120px] rounded-2xl border border-primary/35 bg-card/70 overflow-hidden',
        'flex flex-col items-center justify-center gap-1.5 px-2 py-3 text-center',
        'shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12)] active:scale-[0.97] transition-transform',
        'disabled:opacity-40 disabled:active:scale-100',
      )}
    >
      {art && <img src={art} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
      {art && <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />}
      {!art && <span aria-hidden="true" className="text-primary [&>svg]:w-10 [&>svg]:h-10">{icon}</span>}
      <span className={cn('relative font-cinzel text-base font-semibold text-foreground leading-tight', art && 'mt-auto')}>{label}</span>
      {detail && <span className="relative text-xs text-muted-foreground leading-tight truncate max-w-full">{detail}</span>}
      {typeof badge === 'number' && badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-xs font-bold text-primary-foreground flex items-center justify-center">{badge}</span>
      )}
      {alert && !(typeof badge === 'number' && badge > 0) && <span aria-hidden="true" className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-destructive" />}
    </button>
  );
}
