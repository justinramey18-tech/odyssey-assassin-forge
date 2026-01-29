import { useState } from 'react';
import { Info, X, Star, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EquipmentItem, EquipmentSlotType, rarityConfig } from '@/lib/inventory';
import { getIconByName } from '@/lib/iconUtils';

interface EquipmentSlotCardProps {
  slotType: EquipmentSlotType;
  label: string;
  icon: string;
  item: EquipmentItem | null;
  isHighlighted?: boolean;
  onTap?: () => void;
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onInfoTap?: () => void;
}

export function EquipmentSlotCard({
  slotType,
  label,
  icon,
  item,
  isHighlighted,
  onTap,
  onLongPress,
  onSwipeLeft,
  onSwipeRight,
  onInfoTap,
}: EquipmentSlotCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const IconComponent = getIconByName(icon);
  const ItemIcon = item ? getIconByName(item.icon) : null;

  const rarity = item ? rarityConfig[item.rarity] : null;

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
    
    // Long press detection
    const timer = setTimeout(() => {
      onLongPress?.();
      setTouchStart(null);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    // Cancel long press if moving
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    }

    // Only track horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setSwipeOffset(Math.max(-80, Math.min(80, deltaX)));
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (swipeOffset < -50) {
      onSwipeLeft?.();
    } else if (swipeOffset > 50) {
      onSwipeRight?.();
    }
    
    setSwipeOffset(0);
    setTouchStart(null);
  };

  const renderStars = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="w-2.5 h-2.5 fill-current" />
    ));
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe Actions */}
      <div className="absolute inset-0 flex">
        {/* Left action (shown when swiping right) */}
        <div className={cn(
          "flex items-center justify-center bg-blue-600 transition-opacity",
          swipeOffset > 30 ? "opacity-100" : "opacity-0",
          "w-20"
        )}>
          <RotateCcw className="w-5 h-5 text-white" />
          <span className="text-xs text-white ml-1">SWAP</span>
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Right action (shown when swiping left) */}
        <div className={cn(
          "flex items-center justify-center bg-destructive transition-opacity",
          swipeOffset < -30 ? "opacity-100" : "opacity-0",
          "w-20"
        )}>
          <X className="w-5 h-5 text-white" />
          <span className="text-xs text-white ml-1">UNEQUIP</span>
        </div>
      </div>

      {/* Main Card */}
      <div
        className={cn(
          "relative border rounded-lg transition-all duration-200 touch-pan-y",
          item 
            ? "bg-card border-l-4 " + (rarity?.borderClass || "border-l-border")
            : "bg-muted/30 border-dashed border-muted-foreground/30",
          isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onTap}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <IconComponent className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          </div>
          <button
            className="p-1 rounded hover:bg-muted/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onInfoTap?.();
            }}
          >
            <Info className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-3">
          {item ? (
            <div className="flex items-start gap-3">
              {/* Item Icon */}
              <div className={cn(
                "w-14 h-14 rounded-lg flex items-center justify-center border",
                rarity?.borderClass?.replace('border-l-', 'border-') || "border-border",
                item.rarity === 'legendary' && "bg-amber-400/10",
                item.rarity === 'epic' && "bg-purple-400/10",
                item.rarity === 'rare' && "bg-blue-400/10",
              )}>
                {ItemIcon && <ItemIcon className={cn("w-8 h-8", rarity?.color)} />}
              </div>

              {/* Item Details */}
              <div className="flex-1 min-w-0">
                <h4 className={cn("font-semibold text-sm truncate", rarity?.color)}>
                  {item.name}
                </h4>
                
                {/* Primary Stat */}
                <div className="flex items-center gap-2 mt-1">
                  {item.stats.ac && (
                    <span className="text-xs text-muted-foreground">
                      🛡️ +{item.stats.ac} AC
                    </span>
                  )}
                  {item.stats.damage && (
                    <span className="text-xs text-muted-foreground">
                      ⚔️ {item.stats.damage}
                    </span>
                  )}
                  {item.stats.perception && (
                    <span className="text-xs text-muted-foreground">
                      👁️ +{item.stats.perception}
                    </span>
                  )}
                </div>

                {/* Rarity & Level */}
                <div className="flex items-center gap-2 mt-1">
                  <div className={cn("flex items-center gap-0.5", rarity?.color)}>
                    {rarity && renderStars(rarity.stars)}
                    <span className="text-xs ml-1">{rarity?.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Level {item.level}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Empty Slot */
            <div className="flex flex-col items-center justify-center py-4 opacity-60">
              <IconComponent className="w-10 h-10 text-muted-foreground/50 mb-2" />
              <span className="text-xs text-muted-foreground">Tap to equip</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
