// Shop Item Card - Individual item display with purchase button

import { useState, useCallback } from 'react';
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
  Axe,
  Crosshair,
  Wand2,
  Gem,
  Shirt,
  Footprints,
  Eye,
  Flame,
  Droplet,
  Heart,
  Zap,
  Moon,
  Wind,
  Package,
  CircleDot,
  Glasses,
  Crown,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShopItem, shopRarityConfig } from '@/lib/shop/types';
import { ItemExpirationTimer } from './ItemExpirationTimer';

interface ShopItemCardProps {
  item: ShopItem;
  currentGold: number;
  onPurchase: (itemId: string) => void;
  onExpired?: (itemId: string) => void;
  isPurchasing?: boolean;
}

// Category to icon mapping
const CATEGORY_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  // Weapons
  weapon: { icon: Sword, color: 'text-red-400' },
  sword: { icon: Sword, color: 'text-red-400' },
  blade: { icon: Sword, color: 'text-red-400' },
  dagger: { icon: Crosshair, color: 'text-red-400' },
  axe: { icon: Axe, color: 'text-orange-400' },
  bow: { icon: Crosshair, color: 'text-amber-400' },
  crossbow: { icon: Crosshair, color: 'text-amber-400' },
  staff: { icon: Wand2, color: 'text-purple-400' },
  wand: { icon: Wand2, color: 'text-violet-400' },
  
  // Armor & Equipment
  armor: { icon: Shield, color: 'text-blue-400' },
  shield: { icon: Shield, color: 'text-blue-400' },
  helm: { icon: Crown, color: 'text-blue-300' },
  helmet: { icon: Crown, color: 'text-blue-300' },
  cloak: { icon: Wind, color: 'text-cyan-400' },
  boots: { icon: Footprints, color: 'text-amber-300' },
  gloves: { icon: Zap, color: 'text-yellow-400' },
  ring: { icon: CircleDot, color: 'text-purple-400' },
  amulet: { icon: Gem, color: 'text-emerald-400' },
  necklace: { icon: Gem, color: 'text-emerald-400' },
  robe: { icon: Shirt, color: 'text-indigo-400' },
  vest: { icon: Shirt, color: 'text-stone-400' },
  
  // Consumables
  potion: { icon: Beaker, color: 'text-emerald-400' },
  elixir: { icon: Droplet, color: 'text-cyan-400' },
  poison: { icon: Skull, color: 'text-green-500' },
  scroll: { icon: ScrollText, color: 'text-amber-300' },
  oil: { icon: Flame, color: 'text-orange-400' },
  food: { icon: Heart, color: 'text-pink-400' },
  
  // Special
  gem: { icon: Gem, color: 'text-purple-400' },
  crystal: { icon: Gem, color: 'text-cyan-300' },
  orb: { icon: Moon, color: 'text-violet-400' },
  eye: { icon: Eye, color: 'text-amber-400' },
  glasses: { icon: Glasses, color: 'text-blue-300' },
  goggles: { icon: Glasses, color: 'text-amber-300' },
  
  // Fallbacks
  consumable: { icon: Beaker, color: 'text-emerald-400' },
  equipment: { icon: Sword, color: 'text-blue-400' },
  miscellaneous: { icon: Package, color: 'text-muted-foreground' },
};

function getCategoryIcon(item: ShopItem): { icon: LucideIcon; color: string } {
  // Check category first (more specific)
  if (item.category) {
    const categoryLower = item.category.toLowerCase();
    for (const [key, value] of Object.entries(CATEGORY_ICONS)) {
      if (categoryLower.includes(key)) {
        return value;
      }
    }
  }
  
  // Check item name for keywords
  const nameLower = item.name.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_ICONS)) {
    if (nameLower.includes(key)) {
      return value;
    }
  }
  
  // Fallback to item type
  return CATEGORY_ICONS[item.itemType] || CATEGORY_ICONS.miscellaneous;
}

export function ShopItemCard({ 
  item, 
  currentGold, 
  onPurchase,
  onExpired,
  isPurchasing = false,
}: ShopItemCardProps) {
  const [showLore, setShowLore] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [justPurchased, setJustPurchased] = useState(false);
  
  const canAfford = currentGold >= item.costGold;
  // Permanent catalog stock has no expiry. It must stay on the shelf after purchase.
  const isPermanentStock = !item.expiresAt;
  const deficit = item.costGold - currentGold;
  const rarityConfig = shopRarityConfig[item.rarity] || shopRarityConfig.common;
  const categoryIcon = getCategoryIcon(item);
  const IconComponent = categoryIcon.icon;

  const handlePurchase = () => {
    if (!canAfford || isPurchasing) return;

    if (isPermanentStock) {
      // Permanent stock: buy in place, keep the card visible, flash a confirmation
      onPurchase(item.id);
      setJustPurchased(true);
      setTimeout(() => setJustPurchased(false), 1500);
      return;
    }

    // One-off AI-detected item: animate the card away, then complete the purchase
    setIsExiting(true);
    setTimeout(() => {
      onPurchase(item.id);
    }, 300);
  };

  const handleExpired = useCallback(() => {
    if (!onExpired) return;
    setIsExiting(true);
    setTimeout(() => {
      onExpired(item.id);
    }, 300);
  }, [item.id, onExpired]);

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
              <div className="flex items-center gap-3">
                {/* Large Category Icon */}
                <div className={cn(
                  "relative p-3 rounded-xl",
                  rarityConfig.bgColor,
                  "border",
                  rarityConfig.borderColor,
                )}>
                  <IconComponent className={cn("w-6 h-6", categoryIcon.color)} />
                  {/* Subtle glow behind icon */}
                  <div className={cn(
                    "absolute inset-0 rounded-xl blur-sm opacity-50 -z-10",
                    rarityConfig.bgColor,
                  )} />
                </div>
                <div>
                  <h3 className={cn(
                    "font-cinzel font-bold text-base leading-tight",
                    rarityConfig.color,
                  )}>
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      "text-xs uppercase tracking-wider",
                      rarityConfig.color,
                      "opacity-70",
                    )}>
                      {rarityConfig.label}
                    </span>
                    {item.category && (
                      <span className="text-[10px] text-muted-foreground capitalize">
                        • {item.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Timer and AI indicator */}
              <div className="flex flex-col items-end gap-1.5">
                {item.expiresAt && (
                  <ItemExpirationTimer
                    expiresAt={item.expiresAt}
                    onExpired={handleExpired}
                  />
                )}
                {(item.aiGenerated?.mechanics || item.aiGenerated?.description) && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Sparkles className="w-3 h-3 text-violet-400" />
                    <span>AI</span>
                  </div>
                )}
              </div>
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

            {item.usage && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  How To Use
                </span>
                <p className="text-sm text-amber-200/90">
                  {item.usage}
                </p>
              </div>
            )}

            {/* Lore (collapsible) */}
            {item.lore && (
              <div className="space-y-1">
                <button
                  onClick={() => setShowLore(!showLore)}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showLore ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>Lore</span>
                  {item.aiGenerated?.lore && (
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
                justPurchased
                  ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                  : canAfford
                  ? "bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {justPurchased ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Purchased!
                </>
              ) : isPurchasing ? (
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