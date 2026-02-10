// Loot Screen Component
// Main loot inventory interface with Chronicle sync, selling, and random generator

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import {
  Package,
  Coins,
  Sword,
  Shield,
  Gem,
  Zap,
  Trash2,
  History,
  Sparkles,
  Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LootItemCard } from './LootItemCard';
import { RandomLootGenerator } from './RandomLootGenerator';
import { LootItem, LootCategory, lootCategoryConfig, SoldLootRecord } from '@/lib/loot/types';
import { generateLootUsePrompt, LootPromptContext } from '@/lib/loot/prompts';
import shopBackground from '@/assets/shop-background.jpg';

const CATEGORY_ICONS: Record<LootCategory, React.ElementType> = {
  weapon: Sword,
  armor: Shield,
  trinket: Gem,
  treasure: Coins,
  usable: Zap,
  miscellaneous: Package,
};

interface LootScreenProps {
  lootItems: LootItem[];
  soldHistory: SoldLootRecord[];
  onAddLoot: (items: LootItem[]) => void;
  onDeleteLoot: (itemId: string) => void;
  onSellLoot: (itemId: string) => { success: boolean; goldReceived: number };
  onAddGold: (amount: number) => void;
  characterName: string;
  currentHP?: number;
  maxHP?: number;
  conditions?: Array<{ name: string; duration?: string }>;
  activeSetBonus?: { name: string; effect: string };
  totalLootValue: number;
  onShareToParty?: (item: LootItem) => void;
}

export function LootScreen({
  lootItems,
  soldHistory,
  onAddLoot,
  onDeleteLoot,
  onSellLoot,
  onAddGold,
  characterName,
  currentHP,
  maxHP,
  conditions,
  activeSetBonus,
  totalLootValue,
  onShareToParty,
}: LootScreenProps) {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<'items' | 'history'>('items');
  const [activeFilter, setActiveFilter] = useState<LootCategory | 'all'>('all');
  const [sellingId, setSellingId] = useState<string | null>(null);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return lootItems;
    return lootItems.filter(item => item.category === activeFilter);
  }, [lootItems, activeFilter]);

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: lootItems.length };
    for (const item of lootItems) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [lootItems]);

  // Handle sell with gold update
  const handleSell = useCallback((itemId: string) => {
    const item = lootItems.find(i => i.id === itemId);
    if (!item) return;

    setSellingId(itemId);
    
    // Brief delay for animation
    setTimeout(() => {
      const result = onSellLoot(itemId);
      if (result.success) {
        // Add gold to shop balance
        onAddGold(result.goldReceived);
        
        toast({
          title: `💰 Sold ${item.name}`,
          description: `+${result.goldReceived} gold added to your wallet`,
          className: "border-amber-500/50 bg-amber-500/10",
        });
      }
      setSellingId(null);
    }, 300);
  }, [lootItems, onSellLoot, onAddGold, toast]);

  // Handle use item
  const handleUse = useCallback((item: LootItem) => {
    // Generate and copy AI prompt
    const context: LootPromptContext = {
      characterName,
      currentHP,
      maxHP,
      conditions,
      activeSetBonus,
      storyContext: item.sourceText,
    };
    
    const prompt = generateLootUsePrompt(item, context);
    navigator.clipboard.writeText(prompt);
    
    toast({
      title: `⚡ Using ${item.name}`,
      description: "AI DM prompt copied to clipboard",
      className: "border-cyan-500/50 bg-cyan-500/10",
    });
  }, [characterName, currentHP, maxHP, conditions, activeSetBonus, toast]);

  // Handle copy prompt
  const handleCopyPrompt = useCallback((item: LootItem) => {
    const context: LootPromptContext = {
      characterName,
      currentHP,
      maxHP,
      conditions,
      activeSetBonus,
      storyContext: item.sourceText,
    };
    
    const prompt = generateLootUsePrompt(item, context);
    navigator.clipboard.writeText(prompt);
    
    toast({
      title: "Prompt Copied",
      description: `${item.name} prompt ready for AI DM`,
      duration: 2000,
    });
  }, [characterName, currentHP, maxHP, conditions, activeSetBonus, toast]);

  return (
    <BackgroundWrapper 
      imagePath={shopBackground} 
      overlayOpacity={75} 
      tintColor="purple" 
      tintOpacity={15}
      backgroundPosition="top center"
      className="min-h-[calc(100vh-10vh)]"
    >
      <div className="container max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-7 h-7 text-purple-400" />
            <h1 className="font-cinzel text-2xl text-foreground">
              Loot Stash
            </h1>
          </div>
          
          {/* Total Value Widget */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-card/50 border border-amber-500/30">
            <Coins className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Value</p>
              <p className="text-lg font-mono font-bold text-amber-400">{totalLootValue.toLocaleString()} gp</p>
            </div>
          </div>
        </div>

        {/* View Toggle + Actions */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={activeView === 'items' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('items')}
            className="font-cinzel"
          >
            <Package className="w-4 h-4 mr-2" />
            Loot ({lootItems.length})
          </Button>
          <Button
            variant={activeView === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('history')}
            className="font-cinzel"
          >
            <History className="w-4 h-4 mr-2" />
            Sold ({soldHistory.length})
          </Button>
          
          <div className="ml-auto">
            <RandomLootGenerator onAddLoot={onAddLoot} />
          </div>
        </div>

        {/* Category Filter Pills */}
        {activeView === 'items' && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            <FilterPill
              label="All"
              count={categoryCounts.all || 0}
              active={activeFilter === 'all'}
              onClick={() => setActiveFilter('all')}
            />
            {(Object.keys(lootCategoryConfig) as LootCategory[]).map(cat => {
              const config = lootCategoryConfig[cat];
              const Icon = CATEGORY_ICONS[cat];
              return (
                <FilterPill
                  key={cat}
                  label={config.label}
                  count={categoryCounts[cat] || 0}
                  active={activeFilter === cat}
                  onClick={() => setActiveFilter(cat)}
                  icon={Icon}
                  color={config.color}
                />
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto overscroll-contain max-h-[calc(100vh-22rem)]">
          {activeView === 'items' && (
            <>
              {filteredItems.length === 0 ? (
                <EmptyLootState hasAnyItems={lootItems.length > 0} />
              ) : (
                <div className="grid grid-cols-1 gap-4 pb-8">
                  <AnimatePresence mode="popLayout">
                    {filteredItems.map(item => (
                      <LootItemCard
                        key={item.id}
                        item={item}
                        characterName={characterName}
                        onDelete={onDeleteLoot}
                        onSell={handleSell}
                        onUse={handleUse}
                        onCopyPrompt={handleCopyPrompt}
                        onShareToParty={onShareToParty}
                        isSelling={sellingId === item.id}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}

          {activeView === 'history' && (
            <>
              {soldHistory.length === 0 ? (
                <EmptyHistoryState />
              ) : (
                <div className="space-y-2 pb-8">
                  {soldHistory.slice().reverse().map((record, index) => (
                    <motion.div
                      key={`${record.itemId}-${record.soldAt}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                          <Coins className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{record.itemName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(record.soldAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400 font-mono">
                        <span>+{record.goldReceived}</span>
                        <Coins className="w-3 h-3" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </BackgroundWrapper>
  );
}

// Filter Pill Component
interface FilterPillProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ElementType;
  color?: string;
}

function FilterPill({ label, count, active, onClick, icon: Icon, color }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
        active 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted/50 text-muted-foreground hover:bg-muted"
      )}
    >
      {Icon && <Icon className={cn("w-3.5 h-3.5", active ? "" : color)} />}
      <span>{label}</span>
      <Badge 
        variant="secondary" 
        className={cn(
          "h-5 min-w-5 px-1.5 text-[10px]",
          active && "bg-primary-foreground/20 text-primary-foreground"
        )}
      >
        {count}
      </Badge>
    </button>
  );
}

function EmptyLootState({ hasAnyItems }: { hasAnyItems: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-purple-500/10 mb-4">
        <Package className="w-12 h-12 text-purple-400/50" />
      </div>
      <h3 className="font-cinzel text-lg text-foreground mb-2">
        {hasAnyItems ? 'No Items in Category' : 'No Loot Found'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {hasAnyItems 
          ? 'Try selecting a different category filter.'
          : 'Use Chronicle Sync to parse session logs with loot mentions, or generate random loot.'}
      </p>
      {!hasAnyItems && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-muted/50 max-w-md">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground text-left">
            <strong>Tip:</strong> Session logs with phrases like "found", "looted", "picked up", 
            or treasure descriptions will auto-populate this tab.
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyHistoryState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-muted/30 mb-4">
        <History className="w-12 h-12 text-muted-foreground/50" />
      </div>
      <h3 className="font-cinzel text-lg text-foreground mb-2">
        No Sales History
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Items you sell will appear here. Gold from sales is added to your Shop wallet.
      </p>
    </div>
  );
}
