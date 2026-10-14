import { Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** MAP orb for the collapsed Party DM dock. Opens the shared Campaign Map for every party member;
 *  the map panel itself decides who may change anything. */
export function CampaignMapDockButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open campaign map"
      className={cn(
        'relative h-[112px] w-[112px] min-h-[44px] min-w-[44px] shrink-0 rounded-full transition-transform duration-150 active:scale-[0.93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80',
        className,
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <span aria-hidden className="pointer-events-none absolute -inset-1.5 rounded-full bg-amber-600/15 blur-md" />
      <span
        className="relative h-full w-full rounded-full flex flex-col items-center justify-center gap-0.5 border-2 border-[#caa05a]"
        style={{
          background: 'radial-gradient(circle at 50% 35%, #2a1a0a 0%, #120c06 60%, #07060a 100%)',
          boxShadow: 'inset 0 0 16px rgba(245,158,11,0.25), 0 6px 14px rgba(0,0,0,0.85)',
        }}
      >
        <MapIcon className="h-6 w-6 text-amber-300" />
        <span className="font-cinzel text-[12px] font-bold tracking-[0.14em] text-[#FFE4AA]">MAP</span>
      </span>
    </button>
  );
}
