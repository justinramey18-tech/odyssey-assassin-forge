import { useState, useCallback, useEffect } from 'react';
import { Package, Hammer, Shield, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  SLOT_META,
  RARITY_META,
  STAT_META,
  RARITY_STAT_BUDGET,
  ALL_RARITIES,
  ALL_STATS,
  createEmpyreanGearItem,
  commitForge,
  equipItem,
  unequipSlot,
  removeItemFromInventory,
  validateForge,
  getForgeCost,
  getEquippedItem,
  getInventoryBySlot,
  type EmpyreanSlot,
  type EmpyreanRarity,
  type EmpyreanStatKey,
  type EmpyreanStatBlock,
  type EmpyreanLoadoutState,
  type EmpyreanGearItem,
} from '@/lib/empyreanLoadout';

interface LoadoutSlotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: EmpyreanSlot | null;
  loadout: EmpyreanLoadoutState;
  gold: number;
  riderLevel: number;
  onStateChanged: () => void;
}

type SlotDrawerTab = 'equipped' | 'owned' | 'forge';

export function LoadoutSlotDrawer({ open, onOpenChange, slot, loadout, gold, riderLevel, onStateChanged }: LoadoutSlotDrawerProps) {
  const [activeTab, setActiveTab] = useState<SlotDrawerTab>('equipped');

  useEffect(() => {
    if (open) setActiveTab('equipped');
  }, [open, slot]);

  if (!slot) return null;

  const meta = SLOT_META[slot];
  const equipped = getEquippedItem(loadout, slot);
  const owned = getInventoryBySlot(loadout, slot).filter(i => i.id !== equipped?.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] p-0 bg-background/95 backdrop-blur-lg border-t border-amber-500/25 rounded-t-2xl overflow-hidden flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border/40">
          <SheetTitle className="text-base font-cinzel text-amber-300 flex items-center gap-2">
            <span>{meta.emoji}</span>
            {meta.label} Slot
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SlotDrawerTab)} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="shrink-0 grid grid-cols-3 mx-3 my-2">
            <TabsTrigger value="equipped" className="text-xs gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Equipped
            </TabsTrigger>
            <TabsTrigger value="owned" className="text-xs gap-1.5">
              <Package className="w-3.5 h-3.5" />
              Owned {owned.length > 0 && <span className="text-[10px] text-muted-foreground">({owned.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="forge" className="text-xs gap-1.5">
              <Hammer className="w-3.5 h-3.5" />
              Forge
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-4">
            <TabsContent value="equipped" className="mt-0">
              <EquippedPanel
                equipped={equipped}
                onUnequip={() => {
                  unequipSlot(slot);
                  toast.success(`${meta.label} unequipped`);
                  onStateChanged();
                }}
                onJumpToForge={() => setActiveTab('forge')}
                onJumpToOwned={() => setActiveTab('owned')}
                hasOwned={owned.length > 0}
              />
            </TabsContent>

            <TabsContent value="owned" className="mt-0 space-y-2">
              <OwnedPanel
                items={owned}
                onEquip={(id) => {
                  const result = equipItem(id);
                  if (result) {
                    toast.success('Equipped');
                    onStateChanged();
                  }
                }}
                onDelete={(id) => {
                  removeItemFromInventory(id);
                  toast.success('Item discarded');
                  onStateChanged();
                }}
                onJumpToForge={() => setActiveTab('forge')}
              />
            </TabsContent>

            <TabsContent value="forge" className="mt-0">
              <ForgePanel
                slot={slot}
                loadout={loadout}
                gold={gold}
                riderLevel={riderLevel}
                onForged={() => {
                  onStateChanged();
                  setActiveTab('owned');
                }}
              />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function EquippedPanel({ equipped, onUnequip, onJumpToForge, onJumpToOwned, hasOwned }: {
  equipped: EmpyreanGearItem | null;
  onUnequip: () => void;
  onJumpToForge: () => void;
  onJumpToOwned: () => void;
  hasOwned: boolean;
}) {
  if (!equipped) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">No item equipped in this slot.</p>
        <div className="flex flex-col items-center gap-2">
          <Button onClick={onJumpToForge} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
            <Hammer className="w-4 h-4" />
            Forge one
          </Button>
          {hasOwned && (
            <Button variant="ghost" onClick={onJumpToOwned} className="text-xs text-muted-foreground">
              ...or browse Owned
            </Button>
          )}
        </div>
      </div>
    );
  }
  return <ItemDetailCard item={equipped} action={{ label: 'Unequip', onClick: onUnequip, variant: 'outline' }} />;
}

function OwnedPanel({ items, onEquip, onDelete, onJumpToForge }: {
  items: EmpyreanGearItem[];
  onEquip: (id: string) => void;
  onDelete: (id: string) => void;
  onJumpToForge: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Nothing in your inventory for this slot.</p>
        <Button onClick={onJumpToForge} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
          <Hammer className="w-4 h-4" />
          Forge an item
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2 pt-1">
      {items.map(item => (
        <ItemDetailCard
          key={item.id}
          item={item}
          compact
          action={{ label: 'Equip', onClick: () => onEquip(item.id), variant: 'default' }}
          secondaryAction={{ label: 'Discard', onClick: () => onDelete(item.id), variant: 'ghost', icon: <Trash2 className="w-3.5 h-3.5" /> }}
        />
      ))}
    </div>
  );
}

function ForgePanel({ slot, loadout, gold, riderLevel, onForged }: {
  slot: EmpyreanSlot;
  loadout: EmpyreanLoadoutState;
  gold: number;
  riderLevel: number;
  onForged: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rarity, setRarity] = useState<EmpyreanRarity>('common');
  const [selectedStats, setSelectedStats] = useState<EmpyreanStatKey[]>([]);

  const budget = RARITY_STAT_BUDGET[rarity];
  const maxStats = budget.statCount;
  const cost = getForgeCost(slot, rarity, loadout);
  const isFirstForge = cost === 0;
  const validation = validateForge({ slot, rarity, riderLevel, currentGold: gold, state: loadout });

  const toggleStat = (stat: EmpyreanStatKey) => {
    setSelectedStats(prev => {
      if (prev.includes(stat)) return prev.filter(s => s !== stat);
      if (prev.length >= maxStats) return prev;
      return [...prev, stat];
    });
  };

  useEffect(() => {
    if (selectedStats.length > maxStats) {
      setSelectedStats(prev => prev.slice(0, maxStats));
    }
  }, [maxStats, selectedStats.length]);

  const canSubmit =
    name.trim().length > 0 &&
    selectedStats.length === budget.statCount &&
    !validation;

  const handleForge = useCallback(() => {
    if (!canSubmit) return;
    const stats: EmpyreanStatBlock = {};
    selectedStats.forEach((stat, i) => {
      stats[stat] = budget.values[i];
    });
    const item = createEmpyreanGearItem({
      name: name.trim(),
      slot,
      rarity,
      description: description.trim() || 'A forged item.',
      stats,
    });
    commitForge({ item, state: loadout });
    toast.success(`Forged: ${item.name}`);
    setName('');
    setDescription('');
    setSelectedStats([]);
    onForged();
  }, [canSubmit, name, description, rarity, slot, loadout, selectedStats, budget.values, onForged]);

  return (
    <div className="space-y-4 pt-2">
      <div className="px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/25">
        <p className="text-[11px] text-amber-200/80">
          <span className="font-semibold">Manual forge (G3):</span> G4 will replace this with AI-generated items based on prose descriptions.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="forge-name" className="text-xs">Item name</Label>
        <Input
          id="forge-name"
          placeholder="e.g. Venin's Shoulder"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="forge-desc" className="text-xs">Description (optional)</Label>
        <Textarea
          id="forge-desc"
          placeholder="Flavor text..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Rarity</Label>
        <div className="grid grid-cols-5 gap-1.5">
          {ALL_RARITIES.map(r => {
            const rm = RARITY_META[r];
            return (
              <button
                key={r}
                onClick={() => setRarity(r)}
                className={cn(
                  'py-2 px-1 rounded-md border text-[10px] font-semibold uppercase tracking-wider transition-colors',
                  rarity === r ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'
                )}
                style={{
                  borderColor: rarity === r ? rm.color : 'rgba(255,255,255,0.1)',
                  color: rm.color,
                }}
              >
                {rm.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">
          Stats (pick {budget.statCount})
          {selectedStats.length > 0 && <span className="text-muted-foreground ml-1">— bonuses: {budget.values.slice(0, selectedStats.length).map(v => `+${v}`).join(', ')}</span>}
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_STATS.map(stat => {
            const checked = selectedStats.includes(stat);
            const idx = selectedStats.indexOf(stat);
            const bonusForThis = checked ? budget.values[idx] : null;
            return (
              <button
                key={stat}
                onClick={() => toggleStat(stat)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors',
                  checked
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-100'
                    : 'border-white/10 bg-transparent hover:bg-white/5 text-white/70',
                  (!checked && selectedStats.length >= maxStats) && 'opacity-40 pointer-events-none'
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <span className="truncate">{STAT_META[stat].label}</span>
                {bonusForThis !== null && <span className="font-bold text-amber-300 shrink-0">+{bonusForThis}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {validation && (
        <p className="text-xs text-red-400">{validation}</p>
      )}

      <Button
        onClick={handleForge}
        disabled={!canSubmit}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2 h-12"
      >
        <Hammer className="w-4 h-4" />
        {isFirstForge ? 'Forge (free)' : `Forge (-${cost} gold)`}
      </Button>
    </div>
  );
}

function ItemDetailCard({ item, action, secondaryAction, compact }: {
  item: EmpyreanGearItem;
  action: { label: string; onClick: () => void; variant: 'default' | 'outline' | 'ghost'; icon?: React.ReactNode };
  secondaryAction?: { label: string; onClick: () => void; variant: 'default' | 'outline' | 'ghost'; icon?: React.ReactNode };
  compact?: boolean;
}) {
  const rm = RARITY_META[item.rarity];
  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        borderColor: `${rm.color}55`,
        background: `linear-gradient(180deg, ${rm.glow}, rgba(0,0,0,0.25))`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-cinzel font-bold text-base leading-tight" style={{ color: rm.color }}>
            {item.name}
          </h3>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mt-0.5">
            {rm.label} · {SLOT_META[item.slot].label}
          </p>
        </div>
      </div>

      {item.description && !compact && (
        <p className="text-xs leading-relaxed text-white/75 italic">
          {item.description}
        </p>
      )}

      {Object.keys(item.stats).length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_STATS.filter(s => item.stats[s]).map(stat => (
            <div key={stat} className="flex items-center justify-between px-2.5 py-1 rounded-md bg-black/30 border border-white/10">
              <span className="text-[11px] text-white/70">{STAT_META[stat].label}</span>
              <span className="text-xs font-bold text-amber-300">+{item.stats[stat]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button onClick={action.onClick} variant={action.variant} className="flex-1 gap-1.5">
          {action.icon}
          {!action.icon && <Check className="w-3.5 h-3.5" />}
          {action.label}
        </Button>
        {secondaryAction && (
          <Button onClick={secondaryAction.onClick} variant={secondaryAction.variant} size="icon" aria-label={secondaryAction.label}>
            {secondaryAction.icon}
          </Button>
        )}
      </div>
    </div>
  );
}
