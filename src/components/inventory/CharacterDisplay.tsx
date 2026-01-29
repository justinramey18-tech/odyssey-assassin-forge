import { useState } from 'react';
import { User, Heart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CharacterEquipment, EquipmentSlotType, getActiveSetBonuses, rarityConfig } from '@/lib/inventory';

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

  return (
    <div 
      className="relative h-full flex flex-col items-center justify-center p-4 select-none"
      onDoubleClick={handleDoubleTap}
    >
      {/* Character Name Badge */}
      <div className="absolute top-3 left-3 right-3 text-center">
        <h3 className="text-sm font-bold text-foreground truncate">{characterName}</h3>
      </div>

      {/* Level Badge */}
      <div className="absolute top-3 right-3 bg-primary/20 border border-primary/40 rounded-full px-2 py-0.5">
        <span className="text-xs font-bold text-primary">Lv {level}</span>
      </div>

      {/* Character Model Container */}
      <div 
        className={cn(
          "relative w-full max-w-[140px] aspect-[3/5] flex items-center justify-center transition-all duration-500",
          hasLegendarySet && "drop-shadow-[0_0_15px_rgba(251,191,36,0.4)]"
        )}
      >
        {/* Decorative Frame */}
        <div className={cn(
          "absolute inset-0 border-2 rounded-lg",
          highestRarity === 'legendary' || highestRarity === 'artifact' 
            ? "border-amber-400/50" 
            : "border-border/30",
          hasLegendarySet && "animate-pulse"
        )} />

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
          
          {/* View Indicator */}
          <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
            {viewAngle}
          </span>
        </div>

        {/* Equipped Weapon Indicators */}
        {equipment.slots.primary_weapon && (
          <div className="absolute right-0 top-1/3 w-1 h-12 bg-amber-400/60 rounded-full" />
        )}
        {equipment.slots.ranged_weapon && (
          <div className="absolute left-0 top-1/4 w-1 h-8 bg-blue-400/60 rounded-full" />
        )}
      </div>

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
      {activeSetBonuses.length > 0 && (
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
        Double-tap to rotate
      </p>
    </div>
  );
}
