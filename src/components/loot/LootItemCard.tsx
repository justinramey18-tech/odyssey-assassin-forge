// Loot Item Card Component
// Displays a single loot item with sell/delete/use actions

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Coins,
  Zap,
  Copy,
  Check,
  Sword,
  Shield,
  Gem,
  Package,
  Sparkles,
  DollarSign,
  Users,
  ChevronRight,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LootItem, lootRarityConfig, lootCategoryConfig, LootCategory } from '@/lib/loot/types';
import { LootItemDetailsSheet } from './LootItemDetailsSheet';

// Icon mapping
const CATEGORY_ICONS: Record<LootCategory, React.ElementType> = {
  weapon: Sword,
  armor: Shield,
  trinket: Gem,
  treasure: Coins,
  usable: Zap,
  miscellaneous: Package,
};

interface LootItemCardProps {
  item: LootItem;
  characterName: string;
  onDelete: (itemId: string) => void;
  onSell: (itemId: string) => void;
  onUse?: (item: LootItem) => void;
  onCopyPrompt?: (item: LootItem) => void;
  onShareToParty?: (item: LootItem) => void;
  isSelling?: boolean;
}

export function LootItemCard({
  item,
  characterName,
  onDelete,
  onSell,
  onUse,
  onCopyPrompt,
  onShareToParty,
  isSelling = false,
}: LootItemCardProps) {
  const [copied, setCopied] = useState(false);
  
  const rarityConf = lootRarityConfig[item.rarity];
  const categoryConf = lootCategoryConfig[item.category];
  const Icon = CATEGORY_ICONS[item.category];
  
  const handleCopy = () => {
    if (onCopyPrompt) {
      onCopyPrompt(item);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isUsable = item.category === 'usable' && item.mechanics?.effect;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
      className={cn(
        "relative p-4 rounded-xl border-l-4 bg-card/80 backdrop-blur-sm",
        "border border-border/50",
        rarityConf.borderColor,
        isSelling && "animate-pulse opacity-70"
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Category icon */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
          categoryConf.bgColor,
          categoryConf.color
        )}>
          <Icon className="w-6 h-6" />
        </div>
        
        {/* Title and badges */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground line-clamp-1 mb-1">
            {item.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge 
              variant="outline" 
              className={cn("text-[10px]", rarityConf.color, rarityConf.borderColor)}
            >
              {rarityConf.label}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {categoryConf.label}
            </Badge>
            {item.hasDiceMechanics && (
              <Badge className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                Dice
              </Badge>
            )}
          </div>
        </div>
        
        {/* Gold value */}
        <div className="flex items-center gap-1 text-amber-400 flex-shrink-0">
          <Coins className="w-4 h-4" />
          <span className="font-mono font-bold">{item.goldValue}</span>
        </div>
      </div>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {item.description}
      </p>
      
      {/* Mechanics */}
      {item.mechanics && (
        <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
          {item.mechanics.damage && (
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">
              {item.mechanics.damage}
            </span>
          )}
          {item.mechanics.ac && (
            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
              +{item.mechanics.ac} AC
            </span>
          )}
          {item.mechanics.effect && (
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 line-clamp-1">
              {item.mechanics.effect}
            </span>
          )}
        </div>
      )}
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Sell button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSell(item.id)}
          disabled={isSelling}
          className="flex-1 h-9 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
        >
          <DollarSign className="w-3.5 h-3.5 mr-1" />
          Sell {item.goldValue}g
        </Button>
        
        {/* Use button (for usable items) */}
        {isUsable && onUse && (
          <Button
            size="sm"
            onClick={() => onUse(item)}
            className="flex-1 h-9 text-xs bg-cyan-600 hover:bg-cyan-500"
          >
            <Zap className="w-3.5 h-3.5 mr-1" />
            Use
          </Button>
        )}
        
        {/* Share to Party */}
        {onShareToParty && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onShareToParty(item)}
            className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10"
            title="Share to Party"
          >
            <Users className="w-4 h-4" />
          </Button>
        )}

        {/* Copy AI prompt */}
        {onCopyPrompt && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        )}
        
        {/* Delete button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this item from your loot. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(item.id)}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
      {/* Source text indicator */}
      {item.sourceText && (
        <div className="mt-2 pt-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground italic line-clamp-1">
            📜 Chronicle: "{item.sourceText}"
          </p>
        </div>
      )}
    </motion.div>
  );
}
