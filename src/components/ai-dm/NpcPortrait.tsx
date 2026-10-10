import { cn } from '@/lib/utils';

/** Live NPCs: an NPC's round portrait, or the first letter of its name. */
export function NpcPortrait({ url, name, className }: { url?: string | null; name: string; className?: string }) {
  return (
    <span className={cn('shrink-0 rounded-full overflow-hidden border border-amber-400/40 bg-amber-900/40 text-amber-100 font-semibold flex items-center justify-center', className)}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} /> : (name.trim().charAt(0).toUpperCase() || '?')}
    </span>
  );
}
