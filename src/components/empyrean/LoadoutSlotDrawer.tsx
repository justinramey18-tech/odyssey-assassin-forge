import { useState, useCallback, useEffect } from 'react';
import { Package, Hammer, Shield, Trash2, Check, Sparkles, Loader2, Check as CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
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
  RARITY_GOLD_COST,
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
  loadEmpyreanLoadout,
  saveEmpyreanLoadout,
  addEmpyreanGold,
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

interface ForgedPreview {
  name: string;
  description: string;
  stats: EmpyreanStatBlock;
  rarity: EmpyreanRarity;
  slot: EmpyreanSlot;
}

function ForgePanel({ slot, loadout, gold, riderLevel, onForged }: {
  slot: EmpyreanSlot;
  loadout: EmpyreanLoadoutState;
  gold: number;
  riderLevel: number;
  onForged: () => void;
}) {
  const [rarity, setRarity] = useState<EmpyreanRarity>('common');
  const [prose, setProse] = useState('');
  const [isForging, setIsForging] = useState(false);
  const [preview, setPreview] = useState<ForgedPreview | null>(null);
  const [sessionGoldCharged, setSessionGoldCharged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost = getForgeCost(slot, rarity, loadout);
  const isFirstForge = cost === 0;
  const validation = validateForge({ slot, rarity, riderLevel, currentGold: gold, state: loadout });

  const callForge = useCallback(async () => {
    setIsForging(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('empyrean-forge-item', {
        body: {
          prose: prose.trim(),
          slot,
          rarity,
          riderLevel,
          characterName: undefined,
        },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      if (!data?.item) throw new Error('No item returned');
      setPreview(data.item as ForgedPreview);
    } catch (e: any) {
      console.error('[Forge] invoke failed:', e);
      setError(e?.message || 'Forge failed. Try again.');
    } finally {
      setIsForging(false);
    }
  }, [prose, slot, rarity, riderLevel]);

  const handleInitialForge = useCallback(async () => {
    if (prose.trim().length === 0) return;
    if (validation) { setError(validation); return; }
    if (!isFirstForge) {
      addEmpyreanGold(-cost);
    }
    setSessionGoldCharged(true);
    await callForge();
  }, [prose, validation, isFirstForge, cost, callForge]);

  const handleRegenerate = useCallback(async () => {
    await callForge();
  }, [callForge]);

  const handleEquip = useCallback(() => {
    if (!preview) return;
    const item = createEmpyreanGearItem({
      name: preview.name,
      slot: preview.slot,
      rarity: preview.rarity,
      description: preview.description,
      stats: preview.stats,
      forgedFrom: prose.trim(),
    });
    const state = loadEmpyreanLoadout();
    const alreadyFree = state.freeForgesSpent.includes(slot);
    const updated: EmpyreanLoadoutState = {
      ...state,
      inventory: [...state.inventory, item],
      freeForgesSpent: alreadyFree ? state.freeForgesSpent : [...state.freeForgesSpent, slot],
    };
    saveEmpyreanLoadout(updated);
    equipItem(item.id);
    toast.success(`Forged: ${item.name}`);
    setPreview(null);
    setProse('');
    setSessionGoldCharged(false);
    setError(null);
    onForged();
  }, [preview, slot, prose, onForged]);

  const handleCancel = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  if (preview) {
    const rm = RARITY_META[preview.rarity];
    return (
      <div className="space-y-4 pt-2">
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{
            borderColor: `${rm.color}70`,
            background: `linear-gradient(180deg, ${rm.glow}, rgba(0,0,0,0.25))`,
            boxShadow: `0 0 20px ${rm.glow}`,
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: rm.color }} />
            <h3 className="font-cinzel font-bold text-base leading-tight min-w-0 flex-1" style={{ color: rm.color }}>
              {preview.name}
            </h3>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            {rm.label} · {SLOT_META[preview.slot].label}
          </p>
          <p className="text-xs leading-relaxed text-white/80 italic">
            {preview.description}
          </p>
          {Object.keys(preview.stats).length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {ALL_STATS.filter(s => preview.stats[s]).map(stat => (
                <div key={stat} className="flex items-center justify-between px-2.5 py-1 rounded-md bg-black/30 border border-white/10">
                  <span className="text-[11px] text-white/70">{STAT_META[stat].label}</span>
                  <span className="text-xs font-bold text-amber-300">+{preview.stats[stat]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleRegenerate}
            disabled={isForging}
            variant="outline"
            className="flex-1 gap-2"
          >
            {isForging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Regenerate
          </Button>
          <Button
            onClick={handleEquip}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-2"
          >
            <CheckIcon className="w-4 h-4" />
            Equip
          </Button>
        </div>
        <Button
          onClick={handleCancel}
          variant="ghost"
          className="w-full text-xs text-muted-foreground"
        >
          Cancel forge {sessionGoldCharged && !isFirstForge && `(—${cost} gold not refunded)`}
        </Button>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/25">
        <p className="text-[11px] text-amber-200/80 leading-relaxed">
          <span className="font-semibold">Forge:</span> Describe what you want. The AI will name it, write its lore, and assign stats within the rarity budget. You can regenerate freely until you equip.
        </p>
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
        <Label htmlFor="forge-prose" className="text-xs">Describe what you want to forge</Label>
        <Textarea
          id="forge-prose"
          placeholder="e.g. A scarred leather pauldron stripped from a fallen venin, still smelling of smoke..."
          value={prose}
          onChange={(e) => setProse(e.target.value)}
          rows={4}
          maxLength={400}
        />
        <p className="text-[10px] text-muted-foreground text-right">{prose.length}/400</p>
      </div>

      {validation && <p className="text-xs text-red-400">{validation}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <Button
        onClick={handleInitialForge}
        disabled={isForging || prose.trim().length === 0 || !!validation}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2 h-12"
      >
        {isForging ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Forging...</>
        ) : (
          <><Sparkles className="w-4 h-4" />{isFirstForge ? 'Forge (free)' : `Forge (-${cost} gold)`}</>
        )}
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
