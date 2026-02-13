import { useState, useCallback } from 'react';
import { X, Coins, ScrollText, Sword, Package, Send, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { PartyMember } from '@/hooks/use-party-sync';
import type { InventoryItem } from '@/lib/consumables/types';
import type { EquipmentItem, CharacterEquipment } from '@/lib/inventory/types';
import type { LootItem } from '@/lib/loot/types';

type TradeCategory = 'gold' | 'consumables' | 'gear' | 'loot';

interface SendItemScreenProps {
  targetMember: PartyMember;
  currentGold: number;
  consumablesInventory: InventoryItem[];
  equipment: CharacterEquipment;
  lootItems: LootItem[];
  onSendGold: (amount: number) => void;
  onSendConsumable: (item: InventoryItem) => void;
  onSendGear: (item: EquipmentItem) => void;
  onSendLoot: (item: LootItem) => void;
  onClose: () => void;
}

const categoryTabs: { id: TradeCategory; label: string; icon: typeof Coins }[] = [
  { id: 'gold', label: 'Gold', icon: Coins },
  { id: 'consumables', label: 'Items', icon: ScrollText },
  { id: 'gear', label: 'Gear', icon: Sword },
  { id: 'loot', label: 'Loot', icon: Package },
];

export function SendItemScreen({
  targetMember,
  currentGold,
  consumablesInventory,
  equipment,
  lootItems,
  onSendGold,
  onSendConsumable,
  onSendGear,
  onSendLoot,
  onClose,
}: SendItemScreenProps) {
  const [activeCategory, setActiveCategory] = useState<TradeCategory>('gold');
  const [goldAmount, setGoldAmount] = useState(1);

  const profileImage = targetMember.character_status.profileImage;
  const unequippedGear = equipment.inventory || [];

  const handleSendGold = useCallback(() => {
    if (goldAmount > 0 && goldAmount <= currentGold) {
      onSendGold(goldAmount);
    }
  }, [goldAmount, currentGold, onSendGold]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            {profileImage ? <AvatarImage src={profileImage} alt={targetMember.character_name} /> : null}
            <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
              {targetMember.character_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-cinzel font-semibold text-sm text-foreground">
              Send to {targetMember.character_name}
            </h2>
            <p className="text-[10px] text-muted-foreground">Select items to trade</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted/20 transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-border/30 bg-card/40">
        {categoryTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-8">
        {/* Gold Tab */}
        {activeCategory === 'gold' && (
          <div className="p-4 space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-card/60 backdrop-blur-sm p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="font-cinzel font-semibold text-sm">Gold Transfer</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your balance: <span className="font-bold text-amber-400">{currentGold} gp</span>
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setGoldAmount(prev => Math.max(1, prev - 10))}
                  className="p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <Input
                  type="number"
                  min={1}
                  max={currentGold}
                  value={goldAmount}
                  onChange={(e) => setGoldAmount(Math.max(1, Math.min(currentGold, parseInt(e.target.value) || 1)))}
                  className="text-center font-bold text-lg w-24"
                />
                <button
                  onClick={() => setGoldAmount(prev => Math.min(currentGold, prev + 10))}
                  className="p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                {[10, 50, 100].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setGoldAmount(Math.min(currentGold, preset))}
                    className="px-3 py-1 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                    disabled={currentGold < preset}
                  >
                    {preset} gp
                  </button>
                ))}
                <button
                  onClick={() => setGoldAmount(currentGold)}
                  className="px-3 py-1 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                >
                  All
                </button>
              </div>
              <Button
                onClick={handleSendGold}
                disabled={goldAmount <= 0 || goldAmount > currentGold || currentGold === 0}
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Send className="w-4 h-4" />
                Send {goldAmount} Gold
              </Button>
            </div>
          </div>
        )}

        {/* Consumables Tab */}
        {activeCategory === 'consumables' && (
          <div className="p-4 space-y-2">
            {consumablesInventory.length === 0 ? (
              <EmptyState icon={ScrollText} label="No consumables in inventory" />
            ) : (
              consumablesInventory.map(item => (
                <ItemRow
                  key={item.consumable.id}
                  name={item.consumable.name}
                  subtitle={`${item.consumable.type} · Qty: ${item.quantity}`}
                  rarity={item.consumable.rarity}
                  onSend={() => onSendConsumable(item)}
                />
              ))
            )}
          </div>
        )}

        {/* Gear Tab */}
        {activeCategory === 'gear' && (
          <div className="p-4 space-y-2">
            {unequippedGear.length === 0 ? (
              <EmptyState icon={Sword} label="No unequipped gear in inventory" />
            ) : (
              unequippedGear.map(item => (
                <ItemRow
                  key={item.id}
                  name={item.name}
                  subtitle={`${item.slotType.replace('_', ' ')} · ${item.rarity}`}
                  rarity={item.rarity}
                  onSend={() => onSendGear(item)}
                />
              ))
            )}
          </div>
        )}

        {/* Loot Tab */}
        {activeCategory === 'loot' && (
          <div className="p-4 space-y-2">
            {lootItems.length === 0 ? (
              <EmptyState icon={Package} label="No loot items to send" />
            ) : (
              lootItems.map(item => (
                <ItemRow
                  key={item.id}
                  name={item.name}
                  subtitle={`${item.category} · ${item.goldValue} gp`}
                  rarity={item.rarity}
                  onSend={() => onSendLoot(item)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Shared sub-components

function EmptyState({ icon: Icon, label }: { icon: typeof Coins; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
      <Icon className="w-10 h-10 mb-2" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

const rarityColors: Record<string, string> = {
  common: 'border-l-zinc-500',
  uncommon: 'border-l-emerald-500',
  rare: 'border-l-blue-500',
  very_rare: 'border-l-purple-500',
  epic: 'border-l-purple-500',
  legendary: 'border-l-amber-500',
  artifact: 'border-l-orange-500',
};

function ItemRow({ name, subtitle, rarity, onSend }: { name: string; subtitle: string; rarity: string; onSend: () => void }) {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card/50 backdrop-blur-sm border-l-2",
      rarityColors[rarity] || 'border-l-zinc-500'
    )}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="ml-2 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0"
        onClick={onSend}
      >
        <Send className="w-3 h-3" />
        Send
      </Button>
    </div>
  );
}
