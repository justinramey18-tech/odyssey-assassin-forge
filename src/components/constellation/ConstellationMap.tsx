import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { legendarySetDefinitions, allLegendaryItems, EquipmentItem, SetInfo } from '@/lib/inventory/index';
import { Star, ChevronLeft, ChevronRight, Lock, Sparkles, Unlock, Trophy, Check } from 'lucide-react';
import { getIconByName } from '@/lib/iconUtils';
import { itemPrerequisites, Achievement } from '@/lib/achievements';
import { useGearLock } from '@/hooks/use-gear-lock';
import { useGameMode } from '@/hooks/use-game-mode';
import { constellationBackgrounds } from '@/lib/inventory/constellationBackgrounds';

interface ConstellationMapProps {
  equippedItems: EquipmentItem[];
  achievements: Achievement[];
}

// Humanoid constellation positions for 8 pieces (head, chest, arms, waist, legs, 3 weapons)
const constellationPositions: Record<string, { x: number; y: number; label: string }> = {
  head: { x: 50, y: 8, label: 'Head' },
  chest: { x: 50, y: 28, label: 'Chest' },
  arms: { x: 25, y: 32, label: 'Arms' },
  waist: { x: 50, y: 48, label: 'Waist' },
  legs: { x: 50, y: 72, label: 'Legs' },
  primary_weapon: { x: 75, y: 32, label: 'Primary' },
  secondary_weapon: { x: 20, y: 55, label: 'Secondary' },
  ranged_weapon: { x: 80, y: 55, label: 'Ranged' },
};

// Connection lines for humanoid shape
const constellationLines = [
  ['head', 'chest'],
  ['chest', 'arms'],
  ['chest', 'primary_weapon'],
  ['chest', 'waist'],
  ['waist', 'legs'],
  ['waist', 'secondary_weapon'],
  ['waist', 'ranged_weapon'],
  ['arms', 'secondary_weapon'],
  ['primary_weapon', 'ranged_weapon'],
];

interface SetConstellationProps {
  setInfo: SetInfo;
  setItems: EquipmentItem[];
  equippedSetItems: EquipmentItem[];
  achievements: Achievement[];
  isActive: boolean;
}

function SetConstellation({ setInfo, setItems, equippedSetItems, achievements, isActive }: SetConstellationProps) {
  const [selectedStar, setSelectedStar] = useState<EquipmentItem | null>(null);
  const equippedIds = new Set(equippedSetItems.map(i => i.id));
  const equippedCount = equippedSetItems.length;
  const totalPieces = setItems.length;
  
  // Use gear lock hook for unlock status
  const { getItemLockInfoById, requiresGearUnlocks } = useGearLock(achievements);

  // Get set-specific glow color
  const getSetGlowColor = () => {
    switch (setInfo.id) {
      case 'merc-with-mouth': return 'rgba(239, 68, 68, 0.8)';
      case 'chaotic-contracts': return 'rgba(249, 115, 22, 0.8)';
      case 'regenerative-ridiculousness': return 'rgba(34, 197, 94, 0.8)';
      case 'self-aware-arsenal': return 'rgba(168, 85, 247, 0.8)';
      case 'violent-comedy': return 'rgba(236, 72, 153, 0.8)';
      case 'unkillable-merc': return 'rgba(59, 130, 246, 0.8)';
      case 'absolute-absurdity': return 'rgba(245, 158, 11, 0.8)';
      case 'self-aware-slayer': return 'rgba(139, 92, 246, 0.8)';
      default: return 'rgba(251, 191, 36, 0.8)';
    }
  };

  const glowColor = getSetGlowColor();
  const bgGlowColor = glowColor.replace('0.8', '0.1');

  // Count unlocked items in the set
  const unlockStats = useMemo(() => {
    let unlockedCount = 0;
    let totalWithRequirements = 0;
    
    setItems.forEach(item => {
      const lockInfo = getItemLockInfoById(item.id);
      if (lockInfo.hasRequirement) {
        totalWithRequirements++;
        if (!lockInfo.isLocked) {
          unlockedCount++;
        }
      }
    });
    
    return { unlockedCount, totalWithRequirements };
  }, [setItems, getItemLockInfoById]);

  return (
    <div 
      className={cn(
        "relative flex-shrink-0 w-[320px] h-[500px] mx-4 rounded-xl border-2 transition-all duration-500 overflow-hidden",
        isActive ? "scale-100 opacity-100" : "scale-95 opacity-60"
      )}
      style={{
        borderColor: glowColor,
        boxShadow: isActive ? `0 0 40px ${glowColor}, inset 0 0 60px ${bgGlowColor}` : 'none',
      }}
    >
      {/* Background Image Layer */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ 
          backgroundImage: `url(${constellationBackgrounds[setInfo.id]})`,
        }}
      />
      {/* Gradient overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      {/* Set glow overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, ${bgGlowColor} 0%, transparent 70%)`,
        }}
      />
      {/* Set Title */}
      <div className="absolute top-0 left-0 right-0 text-center pt-4 px-2">
        <h3 className="font-cinzel text-sm font-bold uppercase tracking-wider" style={{ color: glowColor }}>
          {setInfo.name}
        </h3>
        <div className="flex items-center justify-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">
            {equippedCount}/{totalPieces} Equipped
          </p>
          {requiresGearUnlocks && unlockStats.totalWithRequirements > 0 && (
            <p className="text-[10px] text-amber-400">
              • {unlockStats.unlockedCount}/{unlockStats.totalWithRequirements} Unlocked
            </p>
          )}
        </div>
      </div>

      {/* Constellation SVG */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {/* Connection lines */}
        {constellationLines.map(([from, to], idx) => {
          const fromPos = constellationPositions[from];
          const toPos = constellationPositions[to];
          if (!fromPos || !toPos) return null;

          const fromItem = setItems.find(i => i.slotType === from);
          const toItem = setItems.find(i => i.slotType === to);
          const isFromEquipped = fromItem && equippedIds.has(fromItem.id);
          const isToEquipped = toItem && equippedIds.has(toItem.id);
          const isLineActive = isFromEquipped && isToEquipped;

          return (
            <line
              key={idx}
              x1={fromPos.x}
              y1={fromPos.y + 12}
              x2={toPos.x}
              y2={toPos.y + 12}
              stroke={isLineActive ? glowColor : 'rgba(255,255,255,0.15)'}
              strokeWidth={isLineActive ? 0.8 : 0.4}
              strokeDasharray={isLineActive ? undefined : "2,2"}
              className={cn(isLineActive && "drop-shadow-lg")}
              style={isLineActive ? { filter: `drop-shadow(0 0 3px ${glowColor})` } : undefined}
            />
          );
        })}
      </svg>

      {/* Star nodes */}
      {setItems.map((item) => {
        const position = constellationPositions[item.slotType];
        if (!position) return null;

        const isEquipped = equippedIds.has(item.id);
        const isSelected = selectedStar?.id === item.id;
        const ItemIcon = getIconByName(item.icon);
        
        // Get lock status
        const lockInfo = getItemLockInfoById(item.id);
        const isLocked = requiresGearUnlocks && lockInfo.isLocked;
        const isUnlocked = !isLocked;
        const hasRequirement = lockInfo.hasRequirement;

        // Determine node state: equipped > unlocked > locked > no requirement
        let nodeStyle: 'equipped' | 'unlocked' | 'locked' | 'accessible' = 'accessible';
        if (isEquipped) {
          nodeStyle = 'equipped';
        } else if (hasRequirement && isUnlocked) {
          nodeStyle = 'unlocked';
        } else if (hasRequirement && isLocked) {
          nodeStyle = 'locked';
        }

        return (
          <button
            key={item.id}
            onClick={() => setSelectedStar(isSelected ? null : item)}
            className={cn(
              "absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 z-10",
              "w-10 h-10 rounded-full flex items-center justify-center",
              nodeStyle === 'equipped' && "bg-gradient-to-br from-amber-400/30 to-amber-600/20 border-2",
              nodeStyle === 'unlocked' && "bg-gradient-to-br from-green-400/20 to-emerald-600/10 border-2 border-green-500/60",
              nodeStyle === 'locked' && "bg-black/60 border border-amber-500/40",
              nodeStyle === 'accessible' && "bg-black/40 border border-white/20",
              isSelected && "scale-125 ring-2 ring-offset-2 ring-offset-background ring-amber-400"
            )}
            style={{
              left: `${position.x}%`,
              top: `calc(${position.y}% + 48px)`,
              borderColor: nodeStyle === 'equipped' ? glowColor : undefined,
              boxShadow: nodeStyle === 'equipped' 
                ? `0 0 20px ${glowColor}, 0 0 40px ${bgGlowColor}` 
                : nodeStyle === 'unlocked' 
                  ? '0 0 15px rgba(34, 197, 94, 0.4)' 
                  : undefined,
            }}
          >
            {nodeStyle === 'equipped' ? (
              <ItemIcon className="w-5 h-5 text-amber-400" />
            ) : nodeStyle === 'unlocked' ? (
              <div className="relative">
                <ItemIcon className="w-4 h-4 text-green-400" />
                <Check className="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-green-400" />
              </div>
            ) : nodeStyle === 'locked' ? (
              <Lock className="w-4 h-4 text-amber-500/70" />
            ) : (
              <ItemIcon className="w-4 h-4 text-muted-foreground/70" />
            )}
            
            {/* Pulse effect for equipped */}
            {nodeStyle === 'equipped' && (
              <span 
                className="absolute inset-0 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: glowColor }}
              />
            )}
            
            {/* Subtle glow for unlocked */}
            {nodeStyle === 'unlocked' && (
              <span 
                className="absolute inset-0 rounded-full animate-pulse opacity-20 bg-green-400"
              />
            )}
          </button>
        );
      })}

      {/* Selected Star Info Panel */}
      {selectedStar && (() => {
        const lockInfo = getItemLockInfoById(selectedStar.id);
        const isEquipped = equippedIds.has(selectedStar.id);
        const isLocked = requiresGearUnlocks && lockInfo.isLocked;
        const isUnlocked = !isLocked && lockInfo.hasRequirement;

        return (
          <div 
            className="absolute bottom-16 left-4 right-4 p-3 rounded-lg border backdrop-blur-md"
            style={{
              background: `linear-gradient(135deg, ${bgGlowColor}, rgba(0,0,0,0.8))`,
              borderColor: isLocked ? 'rgba(245, 158, 11, 0.5)' : isUnlocked ? 'rgba(34, 197, 94, 0.5)' : glowColor,
            }}
          >
            <div className="flex items-start gap-3">
              <div 
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center border",
                  isLocked && "border-amber-500/50 bg-amber-500/10",
                  isUnlocked && "border-green-500/50 bg-green-500/10",
                  isEquipped && "border-amber-500 bg-amber-500/20",
                  !isLocked && !isUnlocked && !isEquipped && "border-white/20 bg-white/5"
                )}
              >
                {(() => {
                  const Icon = getIconByName(selectedStar.icon);
                  return <Icon className={cn(
                    "w-5 h-5",
                    isEquipped ? "text-amber-400" : isUnlocked ? "text-green-400" : isLocked ? "text-amber-500/70" : "text-muted-foreground"
                  )} />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={cn(
                  "font-semibold text-sm truncate",
                  isEquipped ? "text-amber-400" : isUnlocked ? "text-green-400" : isLocked ? "text-amber-500" : "text-foreground"
                )}>{selectedStar.name}</h4>
                <p className="text-[10px] text-muted-foreground capitalize">{selectedStar.slotType.replace('_', ' ')}</p>
                
                {/* Status Badge */}
                {isEquipped ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-amber-400 font-medium">EQUIPPED</span>
                  </div>
                ) : isUnlocked ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Check className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] text-green-400 font-medium">UNLOCKED - Equip in Gear tab</span>
                  </div>
                ) : isLocked ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Lock className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] text-amber-500 font-medium">LOCKED</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">Equip in Gear tab</span>
                  </div>
                )}
              </div>
            </div>

            {/* Unlock Requirement Section */}
            {lockInfo.hasRequirement && lockInfo.achievement && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  {!isLocked ? (
                    <Unlock className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    !isLocked ? "text-green-400" : "text-amber-500"
                  )}>
                    {!isLocked ? 'Requirement Met' : 'Unlock Requirement'}
                  </span>
                </div>
                <p className="text-[11px] text-foreground/90 mb-1.5">"{lockInfo.achievement.name}"</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/40 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        !isLocked
                          ? "bg-gradient-to-r from-green-500 to-emerald-400" 
                          : "bg-gradient-to-r from-amber-600 to-amber-400"
                      )}
                      style={{ width: `${lockInfo.progressPercent || 0}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium tabular-nums",
                    !isLocked ? "text-green-400" : "text-amber-400"
                  )}>
                    {lockInfo.currentValue}/{lockInfo.requiredValue}
                  </span>
                </div>
              </div>
            )}

            {/* Enchantments preview */}
            {selectedStar.enchantments && selectedStar.enchantments.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide mb-1">Perks</p>
                {selectedStar.enchantments.slice(0, 2).map((ench, idx) => (
                  <p key={idx} className="text-[10px] text-muted-foreground truncate">
                    • {ench.name}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Set Bonuses at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
        <div className="space-y-1">
          {setInfo.bonuses.map((bonus, idx) => {
            const isActive = equippedCount >= bonus.piecesRequired;
            return (
              <div 
                key={idx}
                className={cn(
                  "flex items-center gap-2 text-[10px]",
                  isActive ? "text-amber-400" : "text-muted-foreground/50"
                )}
              >
                <span className="font-bold w-4">{bonus.piecesRequired}pc</span>
                <span className="truncate">{bonus.bonus.split(':')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ConstellationMap({ equippedItems, achievements }: ConstellationMapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Get all set items grouped by set
  const setsData = useMemo(() => {
    return legendarySetDefinitions.map(setInfo => {
      const setItems = allLegendaryItems.filter(item => item.setId === setInfo.id);
      const equippedSetItems = equippedItems.filter(item => item.setId === setInfo.id);
      return { setInfo, setItems, equippedSetItems };
    });
  }, [equippedItems]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 20);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
    
    // Calculate active index based on scroll position
    const cardWidth = 352; // 320px + 32px margin
    const newIndex = Math.round(scrollLeft / cardWidth);
    setActiveIndex(Math.min(newIndex, setsData.length - 1));
  };

  const scrollTo = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const cardWidth = 352;
    const newScrollLeft = direction === 'left' 
      ? scrollRef.current.scrollLeft - cardWidth 
      : scrollRef.current.scrollLeft + cardWidth;
    scrollRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
  };

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
      return () => scrollEl.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className="relative h-full flex flex-col bg-gradient-to-b from-background via-background/95 to-black/90">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 text-center border-b border-red-900/30">
        <h2 className="font-cinzel text-xl font-bold uppercase tracking-widest text-amber-400">
          <Star className="inline-block w-5 h-5 mr-2 fill-amber-400" />
          Legendary Constellations
          <Star className="inline-block w-5 h-5 ml-2 fill-amber-400" />
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Complete feats to unlock legendary gear
        </p>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={() => scrollTo('left')}
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 border border-amber-500/30 transition-all",
          canScrollLeft ? "opacity-100 hover:bg-amber-500/20" : "opacity-30 cursor-not-allowed"
        )}
        disabled={!canScrollLeft}
      >
        <ChevronLeft className="w-6 h-6 text-amber-400" />
      </button>
      <button
        onClick={() => scrollTo('right')}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 border border-amber-500/30 transition-all",
          canScrollRight ? "opacity-100 hover:bg-amber-500/20" : "opacity-30 cursor-not-allowed"
        )}
        disabled={!canScrollRight}
      >
        <ChevronRight className="w-6 h-6 text-amber-400" />
      </button>

      {/* Constellation Cards - Horizontal Scroll */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <div className="flex items-center h-full px-8 py-4" style={{ width: `${setsData.length * 352}px` }}>
          {setsData.map((data, idx) => (
            <div key={data.setInfo.id} className="snap-center">
              <SetConstellation
                setInfo={data.setInfo}
                setItems={data.setItems}
                equippedSetItems={data.equippedSetItems}
                achievements={achievements}
                isActive={idx === activeIndex}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination dots */}
      <div className="flex-shrink-0 flex justify-center gap-2 py-4">
        {setsData.map((data, idx) => (
          <button
            key={data.setInfo.id}
            onClick={() => {
              if (scrollRef.current) {
                scrollRef.current.scrollTo({ left: idx * 352, behavior: 'smooth' });
              }
            }}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              idx === activeIndex 
                ? "bg-amber-400 w-6" 
                : "bg-white/20 hover:bg-white/40"
            )}
          />
        ))}
      </div>

      {/* Background stars effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
