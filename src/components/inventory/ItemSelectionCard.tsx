import { Star, Lock, Pencil, Trash2 } from 'lucide-react';
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
  isHomebrew?: boolean;
  onEdit?: (item: EquipmentItem) => void;
  onDelete?: (item: EquipmentItem) => void;
}

export function ItemSelectionCard({
  item,
  onSelect,
  isLocked = false,
  lockInfo,
  isHomebrew = false,
  onEdit,
  onDelete,
}: ItemSelectionCardProps) {
  const rarity = rarityConfig[item.rarity];
  const ItemIcon = getIconByName(item.icon);

  const renderStars = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="w-2.5 h-2.5 fill-current" />
    ));
  };

  return (
    <div className="relative group">
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
          <div className="flex items-center gap-1.5">
            <h4 className={cn("font-cinzel text-sm font-semibold uppercase tracking-wide truncate", rarity.color)}>
              {item.name}
            </h4>
            {isHomebrew && (
              <span className="shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Homebrew
              </span>
            )}
          </div>
          
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

      {/* Edit/Delete buttons for homebrew items */}
      {isHomebrew && !isLocked && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="w-7 h-7 rounded-md bg-muted/80 backdrop-blur-sm flex items-center justify-center hover:bg-muted transition-colors"
              title="Edit item"
            >
              <Pencil className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              className="w-7 h-7 rounded-md bg-destructive/20 backdrop-blur-sm flex items-center justify-center hover:bg-destructive/40 transition-colors"
              title="Delete item"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
