import { cn } from '@/lib/utils';
import type { EmpyreanSlot, EmpyreanGearItem } from '@/lib/empyreanLoadout';
import { SLOT_META, RARITY_META } from '@/lib/empyreanLoadout';

interface LoadoutSlotCardProps {
  slot: EmpyreanSlot;
  item: EmpyreanGearItem | null;
  onClick: () => void;
  /** Optional size variant — some slot positions get more space than others. */
  size?: 'sm' | 'md';
}

export function LoadoutSlotCard({ slot, item, onClick, size = 'md' }: LoadoutSlotCardProps) {
  const meta = SLOT_META[slot];
  const rarityMeta = item ? RARITY_META[item.rarity] : null;
  const hasItem = !!item;

  const sizeClasses = size === 'sm'
    ? 'w-[88px] min-h-[64px] px-2 py-1.5'
    : 'w-[100px] min-h-[72px] px-2.5 py-2';

  return (
    <button
      onClick={onClick}
      className={cn(
        'group rounded-lg border backdrop-blur-sm transition-all text-left flex flex-col items-center justify-center gap-0.5',
        'active:scale-[0.97]',
        sizeClasses,
        hasItem
          ? 'border-[var(--rarity-color)]/60 bg-black/40 hover:bg-black/50'
          : 'border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05]'
      )}
      style={{
        touchAction: 'manipulation',
        ['--rarity-color' as any]: rarityMeta?.color,
        boxShadow: hasItem && rarityMeta
          ? `0 0 0 1px ${rarityMeta.glow} inset, 0 0 12px ${rarityMeta.glow}`
          : undefined,
      }}
    >
      <div className="flex items-center gap-1">
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{meta.emoji}</span>
        <span
          className={cn(
            'font-cinzel font-semibold uppercase tracking-wider',
            size === 'sm' ? 'text-[9px]' : 'text-[10px]',
            hasItem ? 'text-white/70' : 'text-white/40'
          )}
        >
          {meta.label}
        </span>
      </div>
      {hasItem ? (
        <span
          className={cn('font-cinzel font-semibold text-center line-clamp-1 w-full', size === 'sm' ? 'text-[10px]' : 'text-xs')}
          style={{ color: rarityMeta!.color }}
        >
          {item.name}
        </span>
      ) : (
        <span className={cn('italic text-white/30', size === 'sm' ? 'text-[9px]' : 'text-[10px]')}>Empty</span>
      )}
    </button>
  );
}
