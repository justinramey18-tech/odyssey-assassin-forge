// Shop Item Card - Individual item display with purchase button

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coins, 
  ShoppingCart, 
  Lock, 
  Sparkles, 
  Sword, 
  Shield, 
  Beaker, 
  ScrollText,
  Skull,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShopItem, shopRarityConfig } from '@/lib/shop/types';

interface ShopItemCardProps {
  item: ShopItem;
  currentGold: number;
  onPurchase: (itemId: string) => void;
  isPurchasing?: boolean;
}

export function ShopItemCard({ 
  item, 
  currentGold, 
  onPurchase,
  isPurchasing = false,
}: ShopItemCardProps) {
  const [showLore, setShowLore] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const canAfford = currentGold >= item.costGold;
  const deficit = item.costGold - currentGold;
  const rarityConfig = shopRarityConfig[item.rarity] || shopRarityConfig.common;
  
  // Get item type icon
  const getTypeIcon = () => {
    if (item.itemType === 'consumable') {
      if (item.category?.includes('poison')) return <Skull className="w-4 h-4" />;
      if (item.category?.includes('scroll')) return <ScrollText className="w-4 h-4" />;
      return <Beaker className="w-4 h-4" />;
    }
    if (item.category?.includes('armor') || item.category?.includes('shield')) {
      return <Shield className="w-4 h-4" />;
    }
    return <Sword className="w-4 h-4" />;
  };

  const handlePurchase = () => {
    if (!canAfford || isPurchasing) return;
    setIsExiting(true);
    // Delay actual purchase to show animation
    setTimeout(() => {
      onPurchase(item.id);
    }, 300);
  };

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "relative rounded-lg border overflow-hidden",
            "bg-gradient-to-b from-card/80 to-card/40",
            "backdrop-blur-sm",
            rarityConfig.borderColor,
          )}
        >
          {/* Rarity glow effect */}
          <div className={cn(
            "absolute inset-0 opacity-20 pointer-events-none",
            rarityConfig.bgColor,
          )} />
          
          {/* Header */}
          <div className="relative p-4 border-b border-border/30">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-2 rounded-lg",
                  rarityConfig.bgColor,
                )}>
                  {getTypeIcon()}
                </div>
                <div>
                  <h3 className={cn(
                    "font-cinzel font-bold text-base leading-tight",
                    rarityConfig.color,
                  )}>
                    {item.name}
                  </h3>
                  <span className={cn(
                    "text-xs uppercase tracking-wider",
                    rarityConfig.color,
                    "opacity-70",
                  )}>
                    {rarityConfig.label}
                  </span>
                </div>
              </div>
              
              {/* AI Generated indicator */}
              {(item.aiGenerated.mechanics || item.aiGenerated.description) && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  <span>AI</span>
                </div>
              )}
            </div>
          </div>

          {/* Mechanics Section */}
          <div className="relative p-4 space-y-3">
            {/* Mechanics */}
            {(item.mechanics.damage || item.mechanics.ac || item.mechanics.effect || item.mechanics.properties?.length) && (
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Mechanics
                </span>
                <div className="space-y-1 text-sm">
                  {item.mechanics.damage && (
                    <p className="text-foreground">
                      <span className="text-red-400">Damage:</span> {item.mechanics.damage}
                    </p>
                  )}
                  {item.mechanics.ac && (
                    <p className="text-foreground">
                      <span className="text-blue-400">AC:</span> +{item.mechanics.ac}
                    </p>
                  )}
                  {item.mechanics.effect && (
                    <p className="text-foreground">
                      <span className="text-emerald-400">Effect:</span> {item.mechanics.effect}
                    </p>
                  )}
                  {item.mechanics.duration && (
                    <p className="text-muted-foreground text-xs">
                      Duration: {item.mechanics.duration}
                    </p>
                  )}
                  {item.mechanics.properties && item.mechanics.properties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.mechanics.properties.map((prop, i) => (
                        <span 
                          key={i}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-muted/50 text-muted-foreground"
                        >
                          {prop}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Description
              </span>
              <p className="text-sm text-foreground/90">
                {item.description}
              </p>
            </div>

            {/* Lore (collapsible) */}
            {item.lore && (
              <div className="space-y-1">
                <button
                  onClick={() => setShowLore(!showLore)}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showLore ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>Lore</span>
                  {item.aiGenerated.lore && (
                    <Sparkles className="w-3 h-3 text-violet-400 ml-1" />
                  )}
                </button>
                <AnimatePresence>
                  {showLore && (
                    <motion.p
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="text-xs text-muted-foreground italic overflow-hidden"
                    >
                      "{item.lore}"
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Purchase Section */}
          <div className="relative p-4 border-t border-border/30 bg-background/30">
            {/* Price */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <Coins className="w-5 h-5 text-amber-400" />
              <span className="font-cinzel text-xl font-bold text-amber-300">
                {item.costGold.toLocaleString()}
              </span>
              <span className="text-xs text-amber-400/70">GP</span>
            </div>

            {/* Buy Button */}
            <Button
              onClick={handlePurchase}
              disabled={!canAfford || isPurchasing}
              className={cn(
                "w-full font-cinzel",
                canAfford 
                  ? "bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isPurchasing ? (
                <span className="animate-pulse">Purchasing...</span>
              ) : canAfford ? (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Buy This Item
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Need More Gold
                </>
              )}
            </Button>

            {/* Gold status */}
            <p className={cn(
              "text-center text-xs mt-2",
              canAfford ? "text-emerald-400" : "text-muted-foreground",
            )}>
              {canAfford ? (
                <>Your Gold: {currentGold.toLocaleString()} GP ✓</>
              ) : (
                <>Need {deficit.toLocaleString()} more gold</>
              )}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
