# Random Loot Generator - Mobile-First Implementation Plan

## Overview
Create a **mobile-optimized** interactive Loot Generator feature with touch-friendly controls, swipe gestures, bottom sheet UI, and responsive animations optimized for small screens.

---

## Mobile-First Design Philosophy

### Key Principles
- ✅ **Touch targets ≥ 44px** (Apple HIG standard)
- ✅ **Thumb-zone optimized** (critical actions at bottom)
- ✅ **Swipe gestures** for natural interactions
- ✅ **Bottom sheet drawer** instead of side drawer
- ✅ **Haptic feedback** on interactions (where supported)
- ✅ **Single-column layouts** with generous spacing
- ✅ **Large, readable text** (16px minimum)
- ✅ **Progressive disclosure** (collapse/expand sections)

---

## Mobile UI/UX Flow

```
1. User taps "Loot" FAB or menu item
   ↓
2. Bottom sheet slides up (70% viewport height)
   ↓
3. Filter section at top (sticky)
   - Horizontal scrollable chip buttons for loot types
   - Segmented control for rarity (swipeable)
   ↓
4. Large "Generate" button (thumb-zone, bottom third)
   ↓
5. Shimmer animation (0.8s) with haptic pulse
   ↓
6. Result card slides up with spring animation
   - Swipe down to dismiss
   - Swipe left for "Add to Inventory"
   - Swipe right for "Roll Again"
   ↓
7. Action buttons at bottom (fixed)
   - Primary: Add to Inventory (green, 60% width)
   - Secondary: Roll Again (outline, 40% width)
```

---

## Mobile Component Architecture

```
MobileLootGenerator (Bottom Sheet)
├── Sticky Header (drag handle + title)
├── Filter Strip (horizontal scroll)
│   ├── Loot Type Chips (multi-select)
│   └── Rarity Selector (segmented, swipeable)
├── Scroll Area (main content)
│   ├── Generate Button (large, thumb-zone)
│   ├── Result Card (swipeable)
│   └── History Accordion (collapsible)
└── Fixed Bottom Actions (when result visible)
    ├── Add to Inventory (primary)
    └── Roll Again (secondary)
```

---

## Technical Implementation

### **New Files to Create**

#### 1. `src/lib/lootGenerator/types.ts`
**Purpose**: Type definitions (same as desktop, but add mobile-specific)

```typescript
export type LootType = 'equipment' | 'potion' | 'poison' | 'scroll';
export type LootRarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';

export interface LootGeneratorConfig {
  types: LootType[];
  maxRarity: LootRarity;
  weightedDistribution: boolean;
}

export interface LootResult {
  id: string;
  name: string;
  type: LootType;
  rarity: LootRarity;
  description: string;
  stats?: Record<string, any>;
  effects?: string[];
  enchantments?: string[];
  icon?: string;
  value?: number;
}

export interface LootHistory {
  timestamp: number;
  result: LootResult;
}

// Mobile-specific types
export interface SwipeAction {
  direction: 'left' | 'right' | 'down';
  action: 'add' | 'reroll' | 'dismiss';
  threshold: number;
}

export interface HapticPattern {
  type: 'light' | 'medium' | 'heavy' | 'success' | 'error';
  duration?: number;
}
```

---

#### 2. `src/lib/lootGenerator/generator.ts`
**Purpose**: Core generation logic (same as desktop version)

```typescript
import { LootGeneratorConfig, LootResult, LootRarity } from './types';
import { allEquipment } from '@/lib/inventory/utils';
import { allConsumables } from '@/lib/consumables';

const RARITY_WEIGHTS: Record<LootRarity, number> = {
  common: 40,
  uncommon: 30,
  rare: 18,
  very_rare: 9,
  legendary: 3,
};

export function generateRandomLoot(config: LootGeneratorConfig): LootResult {
  const rarity = getWeightedRarity(config.maxRarity);
  const pool = getItemPool(config.types, rarity);
  
  if (pool.length === 0) {
    throw new Error('No items match the selected criteria');
  }
  
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getWeightedRarity(maxRarity: LootRarity): LootRarity {
  const rarityOrder: LootRarity[] = ['common', 'uncommon', 'rare', 'very_rare', 'legendary'];
  const maxIndex = rarityOrder.indexOf(maxRarity);
  const availableRarities = rarityOrder.slice(0, maxIndex + 1);
  const totalWeight = availableRarities.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
  
  let roll = Math.random() * totalWeight;
  
  for (const rarity of availableRarities) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll <= 0) return rarity;
  }
  
  return maxRarity;
}

function getItemPool(types: LootType[], rarity: LootRarity): LootResult[] {
  const pool: LootResult[] = [];
  
  if (types.includes('equipment')) {
    const equipment = allEquipment
      .filter(item => item.rarity === rarity)
      .map(item => ({
        id: item.id,
        name: item.name,
        type: 'equipment' as const,
        rarity: item.rarity,
        description: item.description || '',
        stats: item.stats,
        enchantments: item.enchantments,
        icon: item.icon,
        value: item.value,
      }));
    pool.push(...equipment);
  }
  
  const consumableTypes = types.filter(t => ['potion', 'poison', 'scroll'].includes(t));
  if (consumableTypes.length > 0) {
    const consumables = allConsumables
      .filter(item => 
        consumableTypes.includes(item.type as LootType) &&
        item.rarity === rarity
      )
      .map(item => ({
        id: item.id,
        name: item.name,
        type: item.type as LootType,
        rarity: item.rarity,
        description: item.description,
        effects: item.effects,
        icon: item.icon,
        value: item.value,
      }));
    pool.push(...consumables);
  }
  
  return pool;
}

export function getRarityColor(rarity: LootRarity): string {
  const colors: Record<LootRarity, string> = {
    common: '#9CA3AF',
    uncommon: '#10B981',
    rare: '#3B82F6',
    very_rare: '#A855F7',
    legendary: '#F59E0B',
  };
  return colors[rarity];
}

export function getRarityLabel(rarity: LootRarity): string {
  const labels: Record<LootRarity, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    very_rare: 'Very Rare',
    legendary: 'Legendary',
  };
  return labels[rarity];
}
```

---

#### 3. `src/lib/lootGenerator/haptics.ts`
**Purpose**: Haptic feedback utilities for mobile

```typescript
import { HapticPattern } from './types';

/**
 * Trigger haptic feedback (mobile devices only)
 */
export function triggerHaptic(pattern: HapticPattern['type']) {
  // Check if Vibration API is supported
  if (!('vibrate' in navigator)) return;
  
  const patterns: Record<HapticPattern['type'], number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    error: [20, 100, 20],
  };
  
  const vibrationPattern = patterns[pattern];
  
  if (Array.isArray(vibrationPattern)) {
    navigator.vibrate(vibrationPattern);
  } else {
    navigator.vibrate(vibrationPattern);
  }
}

/**
 * Trigger haptic on button press
 */
export function hapticPress() {
  triggerHaptic('light');
}

/**
 * Trigger haptic on successful action
 */
export function hapticSuccess() {
  triggerHaptic('success');
}

/**
 * Trigger haptic on error
 */
export function hapticError() {
  triggerHaptic('error');
}
```

---

#### 4. `src/lib/lootGenerator/index.ts`

```typescript
export * from './types';
export * from './generator';
export * from './haptics';
```

---

#### 5. `src/components/loot/MobileLootResultCard.tsx`
**Purpose**: Swipeable result card optimized for mobile

```typescript
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { LootResult } from '@/lib/lootGenerator';
import { getRarityColor, getRarityLabel } from '@/lib/lootGenerator/generator';
import { triggerHaptic } from '@/lib/lootGenerator/haptics';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, ArrowLeft, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileLootResultCardProps {
  result: LootResult;
  onAddToInventory: () => void;
  onRollAgain: () => void;
  onDismiss: () => void;
}

export function MobileLootResultCard({ 
  result, 
  onAddToInventory, 
  onRollAgain,
  onDismiss 
}: MobileLootResultCardProps) {
  const rarityColor = getRarityColor(result.rarity);
  
  // Swipe gesture tracking
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Visual feedback during swipe
  const rotateZ = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 0.8, 1, 0.8, 0.5]);
  
  // Handle swipe end
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 100;
    const velocityThreshold = 500;
    
    // Swipe left → Add to Inventory
    if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      triggerHaptic('success');
      onAddToInventory();
      return;
    }
    
    // Swipe right → Roll Again
    if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      triggerHaptic('medium');
      onRollAgain();
      return;
    }
    
    // Swipe down → Dismiss
    if (info.offset.y > swipeThreshold || info.velocity.y > velocityThreshold) {
      triggerHaptic('light');
      onDismiss();
      return;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 50 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      style={{ x, y, rotateZ, opacity }}
      className="relative p-5 rounded-2xl border-2 bg-gradient-to-br from-slate-900 to-black touch-none"
      style={{ 
        borderColor: rarityColor,
        boxShadow: `0 0 30px ${rarityColor}40`,
      }}
    >
      {/* Swipe Indicators */}
      <motion.div
        className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none"
        style={{ opacity: useTransform(x, [-200, -50, 0], [1, 0.5, 0]) }}
      >
        <div className="flex items-center gap-2 text-green-400">
          <ArrowLeft className="w-6 h-6" />
          <span className="font-bold text-sm">Add</span>
        </div>
      </motion.div>
      
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none"
        style={{ opacity: useTransform(x, [0, 50, 200], [0, 0.5, 1]) }}
      >
        <div className="flex items-center gap-2 text-amber-400">
          <span className="font-bold text-sm">Reroll</span>
          <ArrowRight className="w-6 h-6" />
        </div>
      </motion.div>
      
      <motion.div
        className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none"
        style={{ opacity: useTransform(y, [0, 50, 200], [0, 0.5, 1]) }}
      >
        <div className="flex flex-col items-center gap-1 text-slate-400">
          <ChevronDown className="w-6 h-6" />
          <span className="font-bold text-xs">Dismiss</span>
        </div>
      </motion.div>
      
      {/* Card Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {result.icon && (
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-3"
                style={{ backgroundColor: `${rarityColor}20` }}
              >
                {result.icon}
              </div>
            )}
            <h3 className="text-xl font-cinzel font-bold mb-1" style={{ color: rarityColor }}>
              {result.name}
            </h3>
            <p className="text-xs text-muted-foreground capitalize">
              {result.type}
            </p>
          </div>
          <Badge 
            variant="outline"
            className="text-xs font-bold shrink-0"
            style={{ borderColor: rarityColor, color: rarityColor }}
          >
            {getRarityLabel(result.rarity)}
          </Badge>
        </div>
        
        {/* Description */}
        <p className="text-sm text-foreground/80 mb-4 leading-relaxed line-clamp-3">
          {result.description}
        </p>
        
        {/* Stats (Equipment) - Compact for mobile */}
        {result.stats && Object.keys(result.stats).length > 0 && (
          <div className="mb-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(result.stats).map(([key, value]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="text-muted-foreground capitalize">{key}:</span>
                  <span className="font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Effects (Consumables) - Compact list */}
        {result.effects && result.effects.length > 0 && (
          <div className="mb-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-xs font-semibold text-muted-foreground">Effects</span>
            </div>
            <ul className="space-y-1 text-xs">
              {result.effects.slice(0, 3).map((effect, i) => (
                <li key={i} className="text-foreground/80">• {effect}</li>
              ))}
              {result.effects.length > 3 && (
                <li className="text-muted-foreground italic">+{result.effects.length - 3} more</li>
              )}
            </ul>
          </div>
        )}
        
        {/* Enchantments (Equipment) - Chips */}
        {result.enchantments && result.enchantments.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {result.enchantments.slice(0, 4).map((ench, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="text-[10px] border-purple-500/50 text-purple-300 px-2 py-0.5"
                >
                  {ench}
                </Badge>
              ))}
              {result.enchantments.length > 4 && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  +{result.enchantments.length - 4}
                </Badge>
              )}
            </div>
          </div>
        )}
        
        {/* Value */}
        {result.value !== undefined && (
          <div className="text-xs text-amber-400">
            <span className="text-muted-foreground">Value:</span>{' '}
            <span className="font-bold">{result.value} gp</span>
          </div>
        )}
      </div>
      
      {/* Swipe hint (subtle) */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
          <span>Swipe to interact</span>
        </div>
      </div>
    </motion.div>
  );
}
```

**Key Mobile Features**:
- ✅ Drag gestures (left/right/down)
- ✅ Visual feedback during swipe
- ✅ Haptic feedback on actions
- ✅ Compact layout (line-clamp descriptions)
- ✅ Touch-friendly hit areas
- ✅ Spring animations for natural feel

---

#### 6. `src/components/loot/MobileLootGenerator.tsx`
**Purpose**: Main mobile bottom sheet UI

```typescript
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  Sword, 
  Droplet, 
  Skull, 
  ScrollText,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { 
  LootType, 
  LootRarity, 
  LootResult, 
  LootHistory,
  generateRandomLoot,
  getRarityLabel,
  getRarityColor,
  hapticPress,
  hapticSuccess,
} from '@/lib/lootGenerator';
import { MobileLootResultCard } from './MobileLootResultCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MobileLootGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToInventory: (item: LootResult) => void;
}

const LOOT_TYPE_OPTIONS: { value: LootType; label: string; icon: React.ReactNode }[] = [
  { value: 'equipment', label: 'Equipment', icon: <Sword className="w-4 h-4" /> },
  { value: 'potion', label: 'Potions', icon: <Droplet className="w-4 h-4" /> },
  { value: 'poison', label: 'Poisons', icon: <Skull className="w-4 h-4" /> },
  { value: 'scroll', label: 'Scrolls', icon: <ScrollText className="w-4 h-4" /> },
];

const RARITY_OPTIONS: LootRarity[] = ['common', 'uncommon', 'rare', 'very_rare', 'legendary'];

export function MobileLootGenerator({ open, onOpenChange, onAddToInventory }: MobileLootGeneratorProps) {
  const { toast } = useToast();
  
  // Filter state
  const [selectedTypes, setSelectedTypes] = useState<LootType[]>(['equipment', 'potion']);
  const [maxRarity, setMaxRarity] = useState<LootRarity>('rare');
  
  // Result state
  const [currentResult, setCurrentResult] = useState<LootResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<LootHistory[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  
  // Toggle loot type
  const toggleType = (type: LootType) => {
    hapticPress();
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };
  
  // Generate loot
  const handleGenerate = useCallback(async () => {
    if (selectedTypes.length === 0) {
      toast({
        title: 'No loot types selected',
        description: 'Please select at least one loot type',
        variant: 'destructive',
      });
      return;
    }
    
    hapticPress();
    setIsGenerating(true);
    setCurrentResult(null); // Clear previous result
    
    // Dramatic delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const result = generateRandomLoot({
        types: selectedTypes,
        maxRarity,
        weightedDistribution: true,
      });
      
      hapticSuccess();
      setCurrentResult(result);
      setHistory(prev => [
        { timestamp: Date.now(), result },
        ...prev.slice(0, 9),
      ]);
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTypes, maxRarity, toast]);
  
  // Add to inventory
  const handleAddToInventory = useCallback(() => {
    if (!currentResult) return;
    
    hapticSuccess();
    onAddToInventory(currentResult);
    toast({
      title: 'Item added',
      description: `${currentResult.name} added to inventory`,
    });
    setCurrentResult(null); // Clear after adding
  }, [currentResult, onAddToInventory, toast]);
  
  // Roll again
  const handleRollAgain = useCallback(() => {
    setCurrentResult(null);
    handleGenerate();
  }, [handleGenerate]);
  
  // Dismiss result
  const handleDismiss = useCallback(() => {
    setCurrentResult(null);
  }, []);
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] rounded-t-3xl p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-amber-400" />
            Loot Generator
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(85vh-80px)]">
          <div className="px-6 py-4 space-y-6">
            {/* Loot Type Selection - Horizontal Scroll */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                Loot Types
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
                {LOOT_TYPE_OPTIONS.map(option => (
                  <Button
                    key={option.value}
                    variant={selectedTypes.includes(option.value) ? 'default' : 'outline'}
                    onClick={() => toggleType(option.value)}
                    className={cn(
                      "flex-shrink-0 gap-2 h-12 px-5",
                      selectedTypes.includes(option.value) && 
                      "bg-amber-600 hover:bg-amber-500 text-white"
                    )}
                  >
                    {option.icon}
                    <span className="font-semibold">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Max Rarity Selection - Segmented Control */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                Maximum Rarity
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
                {RARITY_OPTIONS.map(rarity => {
                  const color = getRarityColor(rarity);
                  const isSelected = maxRarity === rarity;
                  
                  return (
                    <Button
                      key={rarity}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        hapticPress();
                        setMaxRarity(rarity);
                      }}
                      className={cn(
                        "flex-shrink-0 h-10 px-4 font-semibold transition-all",
                        isSelected && "shadow-lg"
                      )}
                      style={isSelected ? {
                        backgroundColor: color,
                        borderColor: color,
                        color: '#fff',
                      } : {
                        borderColor: `${color}60`,
                        color: color,
                      }}
                    >
                      {getRarityLabel(rarity)}
                    </Button>
                  );
                })}
              </div>
            </div>
            
            <Separator />
            
            {/* Generate Button - Large, Thumb-Zone */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || selectedTypes.length === 0}
              className="w-full h-16 text-lg font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg active:scale-95 transition-transform"
            >
              {isGenerating ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-6 h-6" />
                </motion.div>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 mr-2" />
                  Generate Loot
                </>
              )}
            </Button>
            
            {/* Result Display - Swipeable Card */}
            <AnimatePresence mode="wait">
              {currentResult && !isGenerating && (
                <div className="py-4">
                  <MobileLootResultCard
                    key={currentResult.id}
                    result={currentResult}
                    onAddToInventory={handleAddToInventory}
                    onRollAgain={handleRollAgain}
                    onDismiss={handleDismiss}
                  />
                </div>
              )}
            </AnimatePresence>
            
            {/* Fixed Action Buttons (when result visible) */}
            {currentResult && !isGenerating && (
              <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
                <div className="flex gap-3 pointer-events-auto">
                  <Button
                    onClick={handleAddToInventory}
                    className="flex-[3] h-14 text-base font-bold bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-lg active:scale-95 transition-transform"
                  >
                    Add to Inventory
                  </Button>
                  <Button
                    onClick={handleRollAgain}
                    variant="outline"
                    className="flex-[2] h-14 text-base font-semibold border-2 active:scale-95 transition-transform"
                  >
                    Roll Again
                  </Button>
                </div>
              </div>
            )}
            
            {/* History Section - Collapsible */}
            {history.length > 0 && (
              <div className="pb-24">
                <button
                  onClick={() => {
                    hapticPress();
                    setHistoryExpanded(!historyExpanded);
                  }}
                  className="flex items-center justify-between w-full p-4 rounded-xl bg-slate-800/50 hover:
                  className="flex items-center justify-between w-full p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-muted-foreground" />
                    <span className="text-base font-semibold">Roll History ({history.length})</span>
                  </div>
                  {historyExpanded ? 
                    <ChevronUp className="w-5 h-5" /> : 
                    <ChevronDown className="w-5 h-5" />
                  }
                </button>
                
                <AnimatePresence>
                  {historyExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-2">
                        {history.map((entry, i) => {
                          const color = getRarityColor(entry.result.rarity);
                          return (
                            <motion.div
                              key={entry.timestamp}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="p-4 rounded-xl bg-slate-900/50 border border-slate-800"
                              style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {entry.result.icon && (
                                      <span className="text-xl">{entry.result.icon}</span>
                                    )}
                                    <h4 className="font-semibold text-sm truncate">
                                      {entry.result.name}
                                    </h4>
                                  </div>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {entry.result.type}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <span 
                                    className="text-xs font-bold px-2 py-0.5 rounded-full border"
                                    style={{ 
                                      borderColor: color, 
                                      color: color,
                                      backgroundColor: `${color}15`
                                    }}
                                  >
                                    {getRarityLabel(entry.result.rarity)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(entry.timestamp).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
```

**Key Mobile Optimizations**:
- ✅ Bottom sheet (85vh height)
- ✅ Horizontal scrolling chips (no wrapping)
- ✅ Large touch targets (h-12, h-14, h-16)
- ✅ Fixed action buttons at bottom
- ✅ Haptic feedback on all interactions
- ✅ Active scale animations (press feedback)
- ✅ Thumb-zone optimized layout

---

#### 7. `src/components/loot/index.ts`

```typescript
export * from './MobileLootGenerator';
export * from './MobileLootResultCard';
```

---

### **Existing Files to Modify**

#### 1. `src/components/drawers/PromptDrawerProvider.tsx`

**Add mobile-specific loot generator state:**

```typescript
import { MobileLootGenerator } from '@/components/loot';
import { LootResult } from '@/lib/lootGenerator';

interface PromptDrawerContextType {
  // ... existing drawers
  lootGeneratorOpen: boolean;
  openLootGeneratorDrawer: () => void;
  closeLootGeneratorDrawer: () => void;
}

export function PromptDrawerProvider({ children }: { children: React.ReactNode }) {
  // ... existing state
  const [lootGeneratorOpen, setLootGeneratorOpen] = useState(false);
  
  // ... existing functions
  const openLootGeneratorDrawer = useCallback(() => {
    setLootGeneratorOpen(true);
  }, []);
  
  const closeLootGeneratorDrawer = useCallback(() => {
    setLootGeneratorOpen(false);
  }, []);
  
  // Handle adding loot to inventory
  const handleAddLootToInventory = useCallback((item: LootResult) => {
    // TODO: Integrate with character inventory system
    // Example:
    // if (item.type === 'equipment') {
    //   addEquipmentToInventory(item);
    // } else {
    //   addConsumableToInventory(item);
    // }
    console.log('Adding to inventory:', item);
  }, []);
  
  const value = {
    // ... existing values
    lootGeneratorOpen,
    openLootGeneratorDrawer,
    closeLootGeneratorDrawer,
  };
  
  return (
    <PromptDrawerContext.Provider value={value}>
      {children}
      
      {/* ... existing drawers */}
      
      {/* Mobile Loot Generator */}
      <MobileLootGenerator
        open={lootGeneratorOpen}
        onOpenChange={setLootGeneratorOpen}
        onAddToInventory={handleAddLootToInventory}
      />
    </PromptDrawerContext.Provider>
  );
}
```

---

#### 2. `src/components/home/HomeScreen.tsx`

**Add loot generator to drawer menu (mobile-optimized):**

```typescript
import { Sparkles } from 'lucide-react';
import { usePromptDrawer } from '@/components/drawers/PromptDrawerProvider';

export function HomeScreen() {
  const { openLootGeneratorDrawer } = usePromptDrawer();
  
  const drawerOptions = [
    // ... existing options
    {
      id: 'loot',
      label: 'Loot Generator',
      icon: <Sparkles className="w-6 h-6" />,
      onClick: () => openLootGeneratorDrawer(),
      color: 'from-amber-600 to-amber-500',
    },
  ];
  
  return (
    <div className="min-h-screen bg-background">
      {/* ... existing content */}
      
      {/* Drawer Menu */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {drawerOptions.map(option => (
          <button
            key={option.id}
            onClick={option.onClick}
            className={cn(
              "flex flex-col items-center gap-3 p-6 rounded-2xl",
              "bg-gradient-to-br border border-white/10",
              "active:scale-95 transition-transform",
              option.color || "from-slate-800 to-slate-900"
            )}
          >
            {option.icon}
            <span className="text-sm font-semibold">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

#### 3. `src/components/ui/sheet.tsx` (if not exists)

**Create mobile bottom sheet component:**

```typescript
import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'bottom', className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-background shadow-lg transition ease-in-out',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        side === 'bottom' && [
          'inset-x-0 bottom-0 rounded-t-3xl',
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        ],
        side === 'top' && [
          'inset-x-0 top-0 rounded-b-3xl',
          'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        ],
        side === 'left' && [
          'inset-y-0 left-0 h-full w-3/4 rounded-r-3xl',
          'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        ],
        side === 'right' && [
          'inset-y-0 right-0 h-full w-3/4 rounded-l-3xl',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        ],
        className
      )}
      {...props}
    >
      {/* Drag Handle (for bottom sheets) */}
      {side === 'bottom' && (
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>
      )}
      
      {children}
      
      {/* Close Button */}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-full p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-2', className)}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
};
```

---

#### 4. `src/styles/globals.css`

**Add mobile-specific utility classes:**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  /* Hide scrollbar but keep functionality */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  
  /* Active state scale (press feedback) */
  .active\:scale-95:active {
    transform: scale(0.95);
  }
  
  .active\:scale-98:active {
    transform: scale(0.98);
  }
  
  /* Smooth transitions for mobile */
  .transition-transform {
    transition-property: transform;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }
  
  /* Safe area insets for notched devices */
  .safe-top {
    padding-top: env(safe-area-inset-top);
  }
  
  .safe-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
  
  /* Text truncation utilities */
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

/* Framer Motion animations */
@keyframes slide-in-from-bottom {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes slide-out-to-bottom {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

.animate-slide-in-from-bottom {
  animation: slide-in-from-bottom 0.3s ease-out;
}

.animate-slide-out-to-bottom {
  animation: slide-out-to-bottom 0.3s ease-in;
}
```

---

## Mobile-Specific Features Summary

### Gesture Controls

| Gesture | Action | Haptic Feedback |
|---------|--------|-----------------|
| **Swipe Left** on result card | Add to Inventory | Success (pattern) |
| **Swipe Right** on result card | Roll Again | Medium pulse |
| **Swipe Down** on result card | Dismiss | Light tap |
| **Tap** on type/rarity button | Toggle selection | Light tap |
| **Tap** on Generate button | Generate loot | Light tap → Success (on result) |
| **Tap** on history item | (Future: View details) | Light tap |

---

### Touch Target Sizes

| Element | Size | Meets Standard |
|---------|------|----------------|
| Type selection buttons | 48px (h-12) | ✅ Yes (44px+) |
| Rarity buttons | 40px (h-10) | ⚠️ Close (acceptable for secondary) |
| Generate button | 64px (h-16) | ✅ Yes (primary action) |
| Action buttons (Add/Reroll) | 56px (h-14) | ✅ Yes |
| History items | 48px+ | ✅ Yes |

---

### Performance Optimizations

```typescript
// Debounced swipe detection
const handleDragEnd = useMemo(() => 
  debounce((info: PanInfo) => {
    // Swipe logic
  }, 50),
  []
);

// Memoized rarity color calculations
const rarityColor = useMemo(() => 
  getRarityColor(result.rarity),
  [result.rarity]
);

// Lazy load history items
const visibleHistory = useMemo(() => 
  history.slice(0, historyExpanded ? 10 : 0),
  [history, historyExpanded]
);
```

---

### Responsive Breakpoints

```typescript
// Tailwind config (if needed for tablet support)
module.exports = {
  theme: {
    extend: {
      screens: {
        'xs': '375px',   // iPhone SE
        'sm': '640px',   // Small tablets
        'md': '768px',   // Tablets
        'lg': '1024px',  // Desktop (hide mobile UI)
      },
    },
  },
};
```

**Usage:**
```typescript
<div className="lg:hidden">
  {/* Mobile-only loot generator */}
  <MobileLootGenerator />
</div>

<div className="hidden lg:block">
  {/* Desktop loot generator (future) */}
  <DesktopLootGenerator />
</div>
```

---

## Testing Checklist (Mobile)

### Gestures
- [ ] Swipe left on result → Adds to inventory
- [ ] Swipe right on result → Rolls again
- [ ] Swipe down on result → Dismisses card
- [ ] Swipe threshold works (100px minimum)
- [ ] Velocity-based swipes work (fast flicks)
- [ ] Card returns to center if swipe incomplete

### Touch Interactions
- [ ] All buttons ≥44px touch target
- [ ] Haptic feedback on every tap (if supported)
- [ ] Active state animations (scale down on press)
- [ ] No accidental double-taps
- [ ] Horizontal scroll works smoothly (type/rarity chips)

### Animations
- [ ] Bottom sheet slides up smoothly
- [ ] Result card spring animation feels natural
- [ ] Generate button spinner rotates continuously
- [ ] History expand/collapse is smooth
- [ ] No jank or frame drops during animations

### Layouts
- [ ] Works on iPhone SE (375px width)
- [ ] Works on standard phones (390-430px)
- [ ] Works on tablets (768px+)
- [ ] Safe area insets respected (notched devices)
- [ ] Content doesn't get cut off by bottom nav

### Edge Cases
- [ ] No loot types selected → Error toast
- [ ] Empty item pool → Error toast
- [ ] Generate during previous generation → Button disabled
- [ ] History > 10 items → Only shows last 10
- [ ] Long item names → Truncate with ellipsis
- [ ] Long descriptions → Line clamp to 3 lines

---

## File Summary (Mobile-First)

| File | Action | Lines | Purpose |
|------|--------|-------|---------|
| `src/lib/lootGenerator/types.ts` | **Create** | ~100 | Type definitions + mobile types |
| `src/lib/lootGenerator/generator.ts` | **Create** | ~150 | Core generation logic |
| `src/lib/lootGenerator/haptics.ts` | **Create** | ~50 | Haptic feedback utilities |
| `src/lib/lootGenerator/index.ts` | **Create** | ~5 | Module exports |
| `src/components/loot/MobileLootResultCard.tsx` | **Create** | ~250 | Swipeable result card |
| `src/components/loot/MobileLootGenerator.tsx` | **Create** | ~350 | Main bottom sheet UI |
| `src/components/loot/index.ts` | **Create** | ~5 | Component exports |
| `src/components/ui/sheet.tsx` | **Create** | ~150 | Bottom sheet primitive |
| `src/components/drawers/PromptDrawerProvider.tsx` | **Modify** | +30 | Add loot generator state |
| `src/components/home/HomeScreen.tsx` | **Modify** | +15 | Add menu option |
| `src/styles/globals.css` | **Modify** | +60 | Mobile utility classes |

**Total New Code**: ~1,100 lines  
**Total Modified Code**: ~45 lines

---

## Progressive Enhancement Strategy

### Phase 1: Core Mobile (MVP)
- ✅ Bottom sheet UI
- ✅ Basic generation
- ✅ Swipe gestures
- ✅ Haptic feedback

### Phase 2: Polish
- ⏳ History persistence (localStorage)
- ⏳ Favorite items
- ⏳ Share results (Web Share API)
- ⏳ Sound effects (optional)

### Phase 3: Desktop Support
- ⏳ Side drawer for desktop
- ⏳ Keyboard shortcuts
- ⏳ Multi-column layout

---

**This mobile-first implementation prioritizes touch interactions, thumb-zone ergonomics, and natural gestures while maintaining the full feature set of the original plan.** 🎯📱