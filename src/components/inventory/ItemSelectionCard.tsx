import { Star, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EquipmentItem, rarityConfig } from '@/lib/inventory/types';
import { Achievement } from '@/lib/achievements';
import { getIconByName } from '@/lib/iconUtils';

interface ItemSelectionCardProps {
  item: EquipmentItem;
  onSelect: (item: EquipmentItem) => void;
  isLocked?: boolean;
  lockInfo?: {
    isLocked: boolean;
    achievement?: Achievement;
    requiredValue?: number;
    currentValue?: number;
  };
}

export function ItemSelectionCard({
  item,
  onSelect,
  isLocked = false,
  lockInfo,
}: ItemSelectionCardProps) {
  const rarity = rarityConfig[item.rarity];
  const ItemIcon = getIconByName(item.icon);

  const renderStars = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="w-2.5 h-2.5 fill-current" />
    ));
  };

  return (
    <button
      onClick={() => !isLocked && onSelect(item)}
      disabled={isLocked}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border border-amber-900/30 bg-card/50 text-left transition-all relative",
        isLocked 
          ? "opacity-60 cursor-not-allowed"
          : "hover:bg-white/5 active:scale-[0.98] active:bg-white/10",
        `border-l-4 ${rarity.borderClass}`
      )}
    >
      {/* Locked Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-10 flex items-center justify-end pr-3 bg-background/50 rounded-lg">
          <div className="flex flex-col items-end gap-1 max-w-[140px]">
            <div className="flex items-center gap-1.5 text-amber-500">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium truncate">
                {lockInfo?.achievement?.name || 'Locked'}
              </span>
            </div>
            {lockInfo?.achievement && (
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1 h-1 rounded-full bg-black/40 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, ((lockInfo.currentValue || 0) / (lockInfo.requiredValue || 1)) * 100)}%` 
                    }}
                  />
                </div>
                <span className="text-[10px] text-amber-400 font-medium tabular-nums">
                  {lockInfo.currentValue}/{lockInfo.requiredValue}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item Icon */}
      <div className={cn(
        "w-12 h-12 rounded-lg flex items-center justify-center border shrink-0",
        rarity.borderClass.replace('border-l-', 'border-'),
        item.rarity === 'legendary' && "bg-amber-400/10",
        item.rarity === 'epic' && "bg-purple-400/10",
        item.rarity === 'rare' && "bg-blue-400/10",
        item.rarity === 'uncommon' && "bg-green-400/10",
        item.rarity === 'artifact' && "bg-orange-400/10",
      )}>
        <ItemIcon className={cn("w-6 h-6", rarity.color)} />
      </div>

      {/* Item Details */}
      <div className="flex-1 min-w-0">
        <h4 className={cn("font-cinzel text-sm font-semibold uppercase tracking-wide truncate", rarity.color)}>
          {item.name}
        </h4>
        
        <div className="flex items-center gap-2 mt-0.5">
          {item.stats.ac && (
            <span className="text-xs text-muted-foreground">
              🛡️ +{item.stats.ac}
            </span>
          )}
          {item.stats.damage && (
            <span className="text-xs text-muted-foreground">
              ⚔️ {item.stats.damage}
            </span>
          )}
          {item.stats.attackBonus && (
            <span className="text-xs text-muted-foreground">
              🎯 +{item.stats.attackBonus}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          {rarity.stars > 0 && (
            <div className={cn("flex items-center gap-0.5", rarity.color)}>
              {renderStars(rarity.stars)}
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            Lv {item.level}
          </span>
        </div>
      </div>
    </button>
  );
}
