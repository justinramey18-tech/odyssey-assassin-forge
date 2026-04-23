import { useState, useCallback, useEffect } from 'react';
import { X, Coins, Check, Lock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ALL_TREES,
  ALL_TIERS,
  TREE_META,
  TIER_META,
  TIER_GOLD_COST,
  getAbilitiesByTreeAndTier,
  purchaseAbility,
  loadUnlockedAbilityIds,
  validatePurchase,
  type EmpyreanAbility,
  type EmpyreanAbilityTree,
} from '@/lib/empyreanAbilities';
import { loadEmpyreanGold } from '@/lib/empyreanLoadout';

interface EmpyreanAbilitiesScreenProps {
  open: boolean;
  onClose: () => void;
}

export function EmpyreanAbilitiesScreen({ open, onClose }: EmpyreanAbilitiesScreenProps) {
  const [activeTree, setActiveTree] = useState<EmpyreanAbilityTree>('combat');
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => loadUnlockedAbilityIds());
  const [gold, setGold] = useState<number>(() => loadEmpyreanGold());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUnlockedIds(loadUnlockedAbilityIds());
      setGold(loadEmpyreanGold());
      setExpandedId(null);
    }
  }, [open]);

  const handleUnlock = useCallback((ability: EmpyreanAbility) => {
    const result = purchaseAbility(ability.id);
    if (!result.success) {
      toast.error(result.error || 'Failed to unlock.');
      return;
    }
    setUnlockedIds(loadUnlockedAbilityIds());
    setGold(result.goldRemaining ?? loadEmpyreanGold());
    setExpandedId(null);
    toast.success(`Unlocked: ${ability.name}`);
  }, []);

  const unlockedSet = new Set(unlockedIds);

  if (!open) return null;

  const activeMeta = TREE_META[activeTree];

  return (
    <div className="fixed inset-0 z-[78] flex flex-col bg-gradient-to-b from-[#080510] via-background to-background/95">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-cinzel font-semibold text-foreground truncate">
            Ability Trees
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-cinzel font-bold text-amber-200">{gold}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tree tabs (horizontal scroll) */}
      <div className="shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-sm">
        <div className="flex gap-1 px-2 py-1.5 overflow-x-auto scrollbar-none">
          {ALL_TREES.map(tree => {
            const meta = TREE_META[tree];
            const isActive = activeTree === tree;
            return (
              <button
                key={tree}
                onClick={() => { setActiveTree(tree); setExpandedId(null); }}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                  isActive ? 'bg-white/10' : 'border-transparent hover:bg-muted/30'
                )}
                style={{
                  touchAction: 'manipulation',
                  borderColor: isActive ? `${meta.color}80` : 'transparent',
                  color: isActive ? meta.color : undefined,
                }}
              >
                <span>{meta.emoji}</span>
                <span className="uppercase tracking-wider whitespace-nowrap">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tree description + tier content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="px-4 py-4">
          <p className="text-xs text-muted-foreground italic mb-4">
            {activeMeta.description}
          </p>

          <div className="space-y-5">
            {ALL_TIERS.map(tier => {
              const tierMeta = TIER_META[tier];
              const abilities = getAbilitiesByTreeAndTier(activeTree, tier);
              return (
                <section key={tier} className="space-y-2">
                  <div className="flex items-baseline justify-between px-1">
                    <div className="flex items-baseline gap-2">
                      <h3
                        className="text-xs font-cinzel font-bold uppercase tracking-wider"
                        style={{ color: tierMeta.color }}
                      >
                        {tierMeta.label}
                      </h3>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {tierMeta.year}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300/70">
                      <Coins className="w-3 h-3" />
                      {TIER_GOLD_COST[tier]}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {abilities.map(ability => (
                      <AbilityCard
                        key={ability.id}
                        ability={ability}
                        treeColor={activeMeta.color}
                        unlocked={unlockedSet.has(ability.id)}
                        expanded={expandedId === ability.id}
                        onExpand={() => setExpandedId(prev => prev === ability.id ? null : ability.id)}
                        currentGold={gold}
                        onUnlock={() => handleUnlock(ability)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ability Card ─────────────────────────────────────────────────────────

function AbilityCard({ ability, treeColor, unlocked, expanded, onExpand, currentGold, onUnlock }: {
  ability: EmpyreanAbility;
  treeColor: string;
  unlocked: boolean;
  expanded: boolean;
  onExpand: () => void;
  currentGold: number;
  onUnlock: () => void;
}) {
  const cost = TIER_GOLD_COST[ability.tier];
  const validationError = unlocked ? null : validatePurchase(ability.id, currentGold);

  return (
    <div
      className={cn(
        'rounded-lg border transition-all overflow-hidden',
        unlocked ? 'bg-emerald-500/5' : 'bg-white/[0.02] hover:bg-white/[0.05]'
      )}
      style={{
        borderColor: unlocked ? 'rgba(34,197,94,0.4)' : `${treeColor}30`,
      }}
    >
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="shrink-0">
          {unlocked ? (
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          ) : validationError ? (
            <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-white/30" />
            </div>
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center border"
              style={{
                borderColor: `${treeColor}60`,
                backgroundColor: `${treeColor}15`,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: treeColor }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-cinzel font-semibold', unlocked ? 'text-emerald-200' : 'text-foreground')}>
            {ability.name}
          </p>
          {!expanded && (
            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
              {ability.description}
            </p>
          )}
        </div>
        {!unlocked && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-amber-300/80">
            <Coins className="w-3 h-3" />
            {cost}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-0 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {ability.description}
          </p>
          {!unlocked && (
            <>
              {validationError && (
                <p className="text-[11px] text-red-400/80">{validationError}</p>
              )}
              <Button
                onClick={onUnlock}
                disabled={!!validationError}
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white h-10 text-sm"
              >
                <Coins className="w-3.5 h-3.5" />
                Unlock (-{cost} gold)
              </Button>
            </>
          )}
          {unlocked && (
            <p className="text-[11px] text-emerald-300/80 italic">
              Unlocked. Available in the Use Ability picker.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
