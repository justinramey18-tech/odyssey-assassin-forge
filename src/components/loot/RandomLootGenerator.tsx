// Random Loot Generator Component
// Drawer UI for generating random loot items

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dices,
  Plus,
  RefreshCw,
  Sword,
  Shield,
  Gem,
  Coins,
  Zap,
  Package,
  Sparkles,
} from 'lucide-react';
import { generateRandomLoot, generateLootDrop } from '@/lib/loot/generator';
import { LootItem, LootCategory, lootRarityConfig, lootCategoryConfig } from '@/lib/loot/types';

const CATEGORY_ICONS: Record<LootCategory, React.ElementType> = {
  weapon: Sword,
  armor: Shield,
  trinket: Gem,
  treasure: Coins,
  usable: Zap,
  miscellaneous: Package,
};

interface RandomLootGeneratorProps {
  onAddLoot: (items: LootItem[]) => void;
}

export function RandomLootGenerator({ onAddLoot }: RandomLootGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatedItems, setGeneratedItems] = useState<LootItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<LootCategory | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const handleGenerateSingle = () => {
    setIsRolling(true);
    setTimeout(() => {
      const item = generateRandomLoot(categoryFilter || undefined);
      setGeneratedItems([item]);
      setIsRolling(false);
    }, 300);
  };

  const handleGenerateDrop = () => {
    setIsRolling(true);
    setTimeout(() => {
      const items = generateLootDrop(3, categoryFilter || undefined);
      setGeneratedItems(items);
      setIsRolling(false);
    }, 300);
  };

  const handleReroll = (index: number) => {
    setIsRolling(true);
    setTimeout(() => {
      const newItem = generateRandomLoot(categoryFilter || undefined);
      setGeneratedItems(prev => {
        const updated = [...prev];
        updated[index] = newItem;
        return updated;
      });
      setIsRolling(false);
    }, 200);
  };

  const handleAddToLoot = () => {
    if (generatedItems.length > 0) {
      onAddLoot(generatedItems);
      setGeneratedItems([]);
      setIsOpen(false);
    }
  };

  const handleAddSingle = (item: LootItem) => {
    onAddLoot([item]);
    setGeneratedItems(prev => prev.filter(i => i.id !== item.id));
    if (generatedItems.length === 1) {
      setIsOpen(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Dices className="w-4 h-4" />
          Random Loot
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="bottom" 
        className="h-[80vh] rounded-t-2xl overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
        
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="flex items-center gap-2 font-cinzel">
            <Dices className="w-6 h-6 text-amber-400" />
            Random Loot Generator
          </SheetTitle>
          <SheetDescription>
            Generate random treasure drops for your adventures
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 h-[calc(100%-8rem)] overflow-hidden">
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              size="sm"
              variant={categoryFilter === null ? 'default' : 'outline'}
              onClick={() => setCategoryFilter(null)}
              className="flex-shrink-0"
            >
              All
            </Button>
            {(Object.keys(lootCategoryConfig) as LootCategory[]).map(cat => {
              const config = lootCategoryConfig[cat];
              const Icon = CATEGORY_ICONS[cat];
              return (
                <Button
                  key={cat}
                  size="sm"
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn("flex-shrink-0 gap-1", categoryFilter === cat && config.color)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </Button>
              );
            })}
          </div>

          {/* Generate Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleGenerateSingle}
              disabled={isRolling}
              className="flex-1 h-12 gap-2 bg-gradient-to-r from-amber-600 to-amber-500"
            >
              <Dices className={cn("w-5 h-5", isRolling && "animate-spin")} />
              Roll Single
            </Button>
            <Button
              onClick={handleGenerateDrop}
              disabled={isRolling}
              className="flex-1 h-12 gap-2 bg-gradient-to-r from-purple-600 to-purple-500"
            >
              <Sparkles className={cn("w-5 h-5", isRolling && "animate-pulse")} />
              Loot Drop (3)
            </Button>
          </div>

          {/* Generated Items */}
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-3 pb-20">
            <AnimatePresence mode="popLayout">
              {generatedItems.map((item, index) => {
                const rarityConf = lootRarityConfig[item.rarity];
                const categoryConf = lootCategoryConfig[item.category];
                const Icon = CATEGORY_ICONS[item.category];
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, x: 100 }}
                    className={cn(
                      "p-4 rounded-xl border-l-4 bg-card/80 border border-border/50",
                      rarityConf.borderColor
                    )}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        categoryConf.bgColor,
                        categoryConf.color
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground line-clamp-1">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <Badge 
                            variant="outline" 
                            className={cn("text-[10px]", rarityConf.color, rarityConf.borderColor)}
                          >
                            {rarityConf.label}
                          </Badge>
                          <span className="text-xs text-amber-400 font-mono">
                            {item.goldValue}g
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {item.description}
                    </p>
                    
                    {item.mechanics && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.mechanics.damage && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                            {item.mechanics.damage}
                          </span>
                        )}
                        {item.mechanics.effect && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 line-clamp-1">
                            {item.mechanics.effect}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReroll(index)}
                        className="h-8 gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reroll
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAddSingle(item)}
                        className="h-8 gap-1 flex-1 bg-emerald-600 hover:bg-emerald-500"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add to Loot
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {generatedItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                  <Dices className="w-8 h-8 text-amber-400/50" />
                </div>
                <p className="text-muted-foreground">
                  Roll the dice to generate random loot
                </p>
              </div>
            )}
          </div>

          {/* Add All Button */}
          {generatedItems.length > 1 && (
            <div className="absolute bottom-4 left-4 right-4">
              <Button
                onClick={handleAddToLoot}
                className="w-full h-12 gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500"
              >
                <Plus className="w-5 h-5" />
                Add All to Loot ({generatedItems.length})
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
