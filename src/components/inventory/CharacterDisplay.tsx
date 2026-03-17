import { useState, useMemo } from 'react';
import { User, Heart, Sparkles, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CharacterEquipment, EquipmentSlotType, getActiveSetBonuses, rarityConfig } from '@/lib/inventory/index';
import { setImages, SetImagePair } from '@/lib/inventory/setImages';
import type { ViewMode } from './InventoryScreen';

interface CharacterDisplayProps {
  characterName: string;
  level: number;
  equipment: CharacterEquipment;
  highlightedSlot?: EquipmentSlotType | null;
  currentHP?: number;
  maxHP?: number;
  viewMode?: ViewMode;
}

export function CharacterDisplay({
  characterName,
  level,
  equipment,
  highlightedSlot,
  currentHP = 45,
  maxHP = 50,
  viewMode = 'compact',
}: CharacterDisplayProps) {
  const isCompact = viewMode === 'compact';
  const [viewAngle, setViewAngle] = useState<'front' | 'back'>('front');
  
  const activeSetBonuses = getActiveSetBonuses(equipment.slots);
  const hasLegendarySet = activeSetBonuses.some(
    bonus => bonus.activePieces >= 3
  );

  // Check for complete set (8 pieces)
  const completeSet = useMemo(() => {
    for (const bonus of activeSetBonuses) {
      if (bonus.activePieces >= 8 && setImages[bonus.setInfo.id]) {
        return {
          setInfo: bonus.setInfo,
          images: setImages[bonus.setInfo.id],
        };
      }
    }
    return null;
  }, [activeSetBonuses]);

  // Get the highest rarity equipped
  const equippedItems = Object.values(equipment.slots).filter(Boolean);
  const highestRarity = equippedItems.reduce((highest, item) => {
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'artifact'];
    if (!item) return highest;
    const currentIndex = rarityOrder.indexOf(item.rarity);
    const highestIndex = rarityOrder.indexOf(highest);
    return currentIndex > highestIndex ? item.rarity : highest;
  }, 'common' as string);

  const handleDoubleTap = () => {
    setViewAngle(prev => prev === 'front' ? 'back' : 'front');
  };

  // Body part highlight mapping
  const highlightPositions: Record<EquipmentSlotType, { top: string; height: string }> = {
    head: { top: '5%', height: '15%' },
    chest: { top: '22%', height: '20%' },
    arms: { top: '22%', height: '25%' },
    waist: { top: '42%', height: '10%' },
    cloak: { top: '18%', height: '30%' },
    legs: { top: '52%', height: '35%' },
    primary_weapon: { top: '30%', height: '40%' },
    secondary_weapon: { top: '30%', height: '40%' },
    ranged_weapon: { top: '25%', height: '30%' },
    amulet: { top: '20%', height: '8%' },
    ring1: { top: '45%', height: '8%' },
    ring2: { top: '45%', height: '8%' },
  };

  const currentImage = completeSet 
    ? (viewAngle === 'front' ? completeSet.images.front : completeSet.images.back)
    : null;

  return (
    <div 
      className={cn(
        "relative h-full flex flex-col items-center justify-center select-none",
        isCompact ? "p-2" : "p-4"
      )}
      onDoubleClick={handleDoubleTap}
    >
      {/* Character Name Badge */}
      <div className={cn("absolute left-2 right-2 text-center z-10", isCompact ? "top-2" : "top-3")}>
        <h3 className={cn("font-bold text-foreground truncate drop-shadow-lg", isCompact ? "text-xs" : "text-sm")}>{characterName}</h3>
      </div>

      {/* Level Badge */}
      <div className={cn(
        "absolute bg-primary/20 border border-primary/40 rounded-full z-10",
        isCompact ? "top-2 right-2 px-1.5 py-0.5" : "top-3 right-3 px-2 py-0.5"
      )}>
        <span className={cn("font-bold text-primary", isCompact ? "text-[10px]" : "text-xs")}>Lv {level}</span>
      </div>

      {/* Character Model Container */}
      <div 
        className={cn(
          "relative w-full flex items-center justify-center transition-all duration-500 overflow-hidden rounded-lg aspect-[3/5]",
          isCompact 
            ? (completeSet ? "max-w-[140px]" : "max-w-[120px]")
            : (completeSet ? "max-w-[180px]" : "max-w-[160px]")
        )}
        style={completeSet ? {
          boxShadow: `0 0 ${isCompact ? '20px' : '30px'} ${completeSet.images.glowColor}, 0 0 ${isCompact ? '40px' : '60px'} ${completeSet.images.glowColor}`,
        } : hasLegendarySet ? {
          filter: `drop-shadow(0 0 ${isCompact ? '10px' : '15px'} rgba(251,191,36,0.4))`,
        } : undefined}
      >
        {/* Decorative Frame */}
        <div className={cn(
          "absolute inset-0 border-2 rounded-lg z-20 pointer-events-none",
          completeSet 
            ? "border-amber-400/70" 
            : highestRarity === 'legendary' || highestRarity === 'artifact' 
              ? "border-amber-400/50" 
              : "border-border/30",
          (hasLegendarySet || completeSet) && "animate-pulse"
        )}>
          {/* Corner accents for complete set */}
          {completeSet && (
            <>
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-400" />
            </>
          )}
        </div>

        {/* Complete Set Image */}
        {currentImage ? (
          <img 
            src={currentImage}
            alt={`${completeSet?.setInfo.name} - ${viewAngle} view`}
            className="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-300"
          />
        ) : (
          <>
            {/* Background Gradient */}
            <div className="absolute inset-1 rounded-md bg-gradient-to-b from-background/80 via-background/60 to-background/90" />

            {/* Particle Effects for Legendary */}
            {hasLegendarySet && (
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                <Sparkles className="absolute top-2 right-2 w-3 h-3 text-amber-400/60 animate-pulse" />
                <Sparkles className="absolute bottom-4 left-2 w-2 h-2 text-amber-400/40 animate-pulse delay-300" />
              </div>
            )}

            {/* Highlighted Body Part Overlay */}
            {highlightedSlot && (
              <div 
                className="absolute left-2 right-2 bg-primary/30 border border-primary/60 rounded transition-all duration-300 animate-pulse"
                style={{
                  top: highlightPositions[highlightedSlot].top,
                  height: highlightPositions[highlightedSlot].height,
                }}
              />
            )}

            {/* Character Silhouette */}
            <div className="relative z-10 flex flex-col items-center justify-center">
              <User 
                className={cn(
                  "transition-transform duration-300",
                  viewAngle === 'back' && "scale-x-[-1]",
                  highlightedSlot ? "text-primary/80" : "text-foreground/70",
                  isCompact ? "w-14 h-14" : "w-20 h-20"
                )} 
                strokeWidth={1.5}
              />
            </div>

            {/* Equipped Weapon Indicators */}
            {equipment.slots.primary_weapon && (
              <div className="absolute right-0 top-1/3 w-1 h-12 bg-amber-400/60 rounded-full" />
            )}
            {equipment.slots.ranged_weapon && (
              <div className="absolute left-0 top-1/4 w-1 h-8 bg-blue-400/60 rounded-full" />
            )}
          </>
        )}
      </div>

      {/* Complete Set Name Badge */}
      {completeSet && (
        <div className="absolute left-2 right-2 text-center" style={{ top: isCompact ? '65px' : '85px' }}>
          <div className={cn(
            "inline-flex items-center rounded-full bg-black/60 backdrop-blur-sm border border-amber-400/50",
            isCompact ? "gap-0.5 px-1.5 py-0.5" : "gap-1 px-2 py-1"
          )}>
            <Sparkles className={cn("text-amber-400", isCompact ? "w-2.5 h-2.5" : "w-3 h-3")} />
            <span className={cn("font-bold text-amber-400 uppercase tracking-wider", isCompact ? "text-[8px]" : "text-[10px]")}>
              Full Set
            </span>
          </div>
        </div>
      )}

      {/* Rotate Button */}
      <button 
        onClick={handleDoubleTap}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 border border-border/30 transition-colors z-20",
          isCompact ? "right-1 p-1" : "right-2 p-1.5"
        )}
      >
        <RotateCw className={cn("text-muted-foreground", isCompact ? "w-2.5 h-2.5" : "w-3 h-3")} />
      </button>

      {/* View Indicator */}
      <span className={cn("text-muted-foreground uppercase tracking-wider", isCompact ? "text-[8px] mt-1" : "text-[10px] mt-2")}>
        {viewAngle}
      </span>

      {/* Health Bar */}
      <div className={cn("absolute left-2 right-2", isCompact ? "bottom-2" : "bottom-3")}>
        <div className={cn("flex items-center mb-0.5", isCompact ? "gap-1" : "gap-1.5")}>
          <Heart className={cn("text-red-400", isCompact ? "w-2.5 h-2.5" : "w-3 h-3")} />
          <span className={cn("text-muted-foreground", isCompact ? "text-[8px]" : "text-[10px]")}>{currentHP}/{maxHP}</span>
        </div>
        <div className={cn("bg-muted rounded-full overflow-hidden", isCompact ? "h-1" : "h-1.5")}>
          <div 
            className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
            style={{ width: `${(currentHP / maxHP) * 100}%` }}
          />
        </div>
      </div>

      {/* Active Set Bonus Indicator */}
      {activeSetBonuses.length > 0 && !completeSet && (
        <div className={cn("absolute left-2 right-2", isCompact ? "bottom-8" : "bottom-12")}>
          {activeSetBonuses.map(({ setInfo, activePieces }) => (
            <div 
              key={setInfo.id}
              className={cn("flex items-center text-amber-400", isCompact ? "gap-0.5 text-[8px]" : "gap-1 text-[9px]")}
            >
              <Sparkles className={isCompact ? "w-2 h-2" : "w-2.5 h-2.5"} />
              <span className="truncate">{setInfo.name} ({activePieces}/{setInfo.pieces.length})</span>
            </div>
          ))}
        </div>
      )}

      {/* Touch hint */}
      <p className={cn("absolute bottom-0 left-0 right-0 text-center text-muted-foreground/50", isCompact ? "text-[6px] pb-0.5" : "text-[8px] pb-1")}>
        {isCompact ? "Tap rotate" : "Tap rotate or double-tap"}
      </p>
    </div>
  );
}
