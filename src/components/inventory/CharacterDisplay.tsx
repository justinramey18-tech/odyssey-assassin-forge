import { useState, useMemo } from 'react';
import { User, Heart, Sparkles, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CharacterEquipment, EquipmentSlotType, getActiveSetBonuses, rarityConfig } from '@/lib/inventory/index';
import { setImages, SetImagePair } from '@/lib/inventory/setImages';

interface CharacterDisplayProps {
  characterName: string;
  level: number;
  equipment: CharacterEquipment;
  highlightedSlot?: EquipmentSlotType | null;
  currentHP?: number;
  maxHP?: number;
}

export function CharacterDisplay({
  characterName,
  level,
  equipment,
  highlightedSlot,
  currentHP = 45,
  maxHP = 50,
}: CharacterDisplayProps) {
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
      className="relative h-full flex flex-col items-center justify-center p-4 select-none"
      onDoubleClick={handleDoubleTap}
    >
      {/* Character Name Badge */}
      <div className="absolute top-3 left-3 right-3 text-center z-10">
        <h3 className="text-sm font-bold text-foreground truncate drop-shadow-lg">{characterName}</h3>
      </div>

      {/* Level Badge */}
      <div className="absolute top-3 right-3 bg-primary/20 border border-primary/40 rounded-full px-2 py-0.5 z-10">
        <span className="text-xs font-bold text-primary">Lv {level}</span>
      </div>

      {/* Character Model Container */}
      <div 
        className={cn(
          "relative w-full max-w-[160px] aspect-[3/5] flex items-center justify-center transition-all duration-500 overflow-hidden rounded-lg",
          completeSet && "max-w-[180px]"
        )}
        style={completeSet ? {
          boxShadow: `0 0 30px ${completeSet.images.glowColor}, 0 0 60px ${completeSet.images.glowColor}`,
        } : hasLegendarySet ? {
          filter: 'drop-shadow(0 0 15px rgba(251,191,36,0.4))',
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
                  "w-20 h-20 transition-transform duration-300",
                  viewAngle === 'back' && "scale-x-[-1]",
                  highlightedSlot ? "text-primary/80" : "text-foreground/70"
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
        <div className="absolute left-3 right-3 text-center" style={{ top: '85px' }}>
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-amber-400/50">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              Full Set
            </span>
          </div>
        </div>
      )}

      {/* Rotate Button */}
      <button 
        onClick={handleDoubleTap}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-border/30 transition-colors z-20"
      >
        <RotateCw className="w-3 h-3 text-muted-foreground" />
      </button>

      {/* View Indicator */}
      <span className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">
        {viewAngle}
      </span>

      {/* Health Bar */}
      <div className="absolute bottom-3 left-3 right-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Heart className="w-3 h-3 text-red-400" />
          <span className="text-[10px] text-muted-foreground">{currentHP}/{maxHP}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
            style={{ width: `${(currentHP / maxHP) * 100}%` }}
          />
        </div>
      </div>

      {/* Active Set Bonus Indicator */}
      {activeSetBonuses.length > 0 && !completeSet && (
        <div className="absolute bottom-12 left-3 right-3">
          {activeSetBonuses.map(({ setInfo, activePieces }) => (
            <div 
              key={setInfo.id}
              className="flex items-center gap-1 text-[9px] text-amber-400"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span className="truncate">{setInfo.name} ({activePieces}/{setInfo.pieces.length})</span>
            </div>
          ))}
        </div>
      )}

      {/* Touch hint */}
      <p className="absolute bottom-0 left-0 right-0 text-center text-[8px] text-muted-foreground/50 pb-1">
        Tap rotate or double-tap
      </p>
    </div>
  );
}
