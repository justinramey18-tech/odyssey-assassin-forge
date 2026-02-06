// Chronicle Sync - Enemy Updates Panel
// Displays detected enemy damage/condition changes with real-time approval

import { useState, useCallback, useMemo } from 'react';
import {
  Zap,
  Heart,
  Skull,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Target,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ParsedEnemyUpdate } from '@/lib/chronicleSync/patterns/enemyUpdates';
import { Enemy, DamageType, EnemyCondition } from '@/lib/combat/targetTypes';
import { DAMAGE_TYPE_LABELS, ENEMY_CONDITION_INFO } from '@/lib/combat/creatureTypes';
import { ConfidenceBadge } from './ParseResultCard';

interface EnemyUpdatesPanelProps {
  updates: ParsedEnemyUpdate[];
  existingEnemies: Enemy[];
  onApplyDamage: (enemyId: string, amount: number, damageType?: DamageType) => void;
  onApplyHealing: (enemyId: string, amount: number) => void;
  onToggleCondition: (enemyId: string, condition: EnemyCondition) => void;
  onDefeatEnemy: (enemyId: string) => void;
}

interface UpdateApprovalState {
  update: ParsedEnemyUpdate;
  approved: boolean;
  matchedEnemy: Enemy | null;
}

export function EnemyUpdatesPanel({
  updates,
  existingEnemies,
  onApplyDamage,
  onApplyHealing,
  onToggleCondition,
  onDefeatEnemy,
}: EnemyUpdatesPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [applied, setApplied] = useState(false);

  // Build approval states with enemy matching
  const [approvalStates, setApprovalStates] = useState<UpdateApprovalState[]>(() =>
    updates.map(update => {
      const matchedEnemy = findMatchingEnemy(update.targetName, existingEnemies);
      return {
        update,
        approved: !!matchedEnemy && matchedEnemy.currentHP > 0,
        matchedEnemy,
      };
    })
  );

  // Stats
  const damageCount = updates.filter(u => u.updateType === 'damage').length;
  const healingCount = updates.filter(u => u.updateType === 'healing').length;
  const conditionCount = updates.filter(u => u.updateType === 'condition_add' || u.updateType === 'condition_remove').length;
  const defeatCount = updates.filter(u => u.updateType === 'defeat').length;
  const approvedCount = approvalStates.filter(s => s.approved && s.matchedEnemy).length;
  const unmatchedCount = approvalStates.filter(s => !s.matchedEnemy).length;

  // Toggle approval
  const toggleApproval = useCallback((id: string) => {
    setApprovalStates(prev => prev.map(s =>
      s.update.id === id ? { ...s, approved: !s.approved } : s
    ));
  }, []);

  // Select all matched
  const selectAllMatched = useCallback(() => {
    setApprovalStates(prev => prev.map(s => ({
      ...s,
      approved: !!s.matchedEnemy && s.matchedEnemy.currentHP > 0,
    })));
  }, []);

  // Apply approved updates (with resistance/vulnerability adjustments)
  const handleApply = useCallback(() => {
    const approved = approvalStates.filter(s => s.approved && s.matchedEnemy);
    let appliedCount = 0;

    approved.forEach(({ update, matchedEnemy }) => {
      if (!matchedEnemy) return;

      switch (update.updateType) {
        case 'damage':
          if (update.amount) {
            // Calculate adjusted damage based on resistances/vulnerabilities
            let finalDamage = update.amount;
            const damageType = update.damageType;
            
            if (damageType) {
              if (matchedEnemy.immunities?.includes(damageType)) {
                finalDamage = 0;
              } else if (matchedEnemy.resistances?.includes(damageType)) {
                finalDamage = Math.floor(update.amount / 2);
              } else if (matchedEnemy.vulnerabilities?.includes(damageType)) {
                finalDamage = update.amount * 2;
              }
            }
            
            if (finalDamage > 0) {
              onApplyDamage(matchedEnemy.id, finalDamage, update.damageType);
            }
            appliedCount++;
          }
          break;
        case 'healing':
          if (update.amount) {
            onApplyHealing(matchedEnemy.id, update.amount);
            appliedCount++;
          }
          break;
        case 'condition_add':
          if (update.condition && !matchedEnemy.conditions.includes(update.condition)) {
            onToggleCondition(matchedEnemy.id, update.condition);
            appliedCount++;
          }
          break;
        case 'condition_remove':
          if (update.condition && matchedEnemy.conditions.includes(update.condition)) {
            onToggleCondition(matchedEnemy.id, update.condition);
            appliedCount++;
          }
          break;
        case 'defeat':
          if (matchedEnemy.currentHP > 0) {
            onDefeatEnemy(matchedEnemy.id);
            appliedCount++;
          }
          break;
      }
    });

    setApplied(true);
    return appliedCount;
  }, [approvalStates, onApplyDamage, onApplyHealing, onToggleCondition, onDefeatEnemy]);

  if (updates.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Zap className="w-4 h-4" />
            <span>Enemy Updates Detected</span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            {damageCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30">
                {damageCount} dmg
              </Badge>
            )}
            {conditionCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">
                {conditionCount} cond
              </Badge>
            )}
            {defeatCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-zinc-500/10 text-zinc-400 border-zinc-500/30">
                {defeatCount} 💀
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {applied ? (
            <div className="text-center py-4">
              <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-emerald-400">Enemy updates applied!</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setApplied(false)}
                className="mt-2 text-muted-foreground"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Review Again
              </Button>
            </div>
          ) : (
            <>
              {/* Warning for unmatched enemies */}
              {unmatchedCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {unmatchedCount} update{unmatchedCount > 1 ? 's' : ''} couldn't match to tracked enemies
                  </span>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllMatched}
                  className="text-xs h-7"
                >
                  Select All Matched
                </Button>
              </div>

              {/* Update List */}
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {approvalStates.map(state => (
                    <UpdateApprovalCard
                      key={state.update.id}
                      state={state}
                      onToggle={() => toggleApproval(state.update.id)}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Apply Button */}
              <Button
                onClick={handleApply}
                disabled={approvedCount === 0}
                className="w-full gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white"
              >
                <Zap className="w-4 h-4" />
                Apply {approvedCount} Update{approvedCount !== 1 ? 's' : ''} to Tracker
              </Button>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Individual update approval card
interface UpdateApprovalCardProps {
  state: UpdateApprovalState;
  onToggle: () => void;
}

function UpdateApprovalCard({ state, onToggle }: UpdateApprovalCardProps) {
  const { update, approved, matchedEnemy } = state;

  const typeIcon = useMemo(() => {
    switch (update.updateType) {
      case 'damage':
        return <Zap className="w-4 h-4 text-red-400" />;
      case 'healing':
        return <Heart className="w-4 h-4 text-emerald-400" />;
      case 'condition_add':
      case 'condition_remove':
        return <AlertCircle className="w-4 h-4 text-purple-400" />;
      case 'defeat':
        return <Skull className="w-4 h-4 text-zinc-400" />;
    }
  }, [update.updateType]);

  const description = useMemo(() => {
    switch (update.updateType) {
      case 'damage':
        const dmgLabel = update.damageType ? DAMAGE_TYPE_LABELS[update.damageType]?.emoji || '' : '';
        return `${update.amount} ${dmgLabel} damage to ${update.targetName}`;
      case 'healing':
        return `Heal ${update.targetName} for ${update.amount} HP`;
      case 'condition_add':
        const addInfo = update.condition ? ENEMY_CONDITION_INFO[update.condition] : null;
        return `${update.targetName} becomes ${addInfo?.label || update.condition}`;
      case 'condition_remove':
        const removeInfo = update.condition ? ENEMY_CONDITION_INFO[update.condition] : null;
        return `${update.targetName} no longer ${removeInfo?.label || update.condition}`;
      case 'defeat':
        return `${update.targetName} is defeated`;
    }
  }, [update]);

  // Calculate adjusted damage based on resistances/vulnerabilities/immunities
  const adjustedDamage = useMemo(() => {
    if (update.updateType !== 'damage' || !update.amount || !matchedEnemy) {
      return { amount: update.amount || 0, modifier: null as 'resistant' | 'vulnerable' | 'immune' | null };
    }

    const damageType = update.damageType;
    if (!damageType) {
      return { amount: update.amount, modifier: null };
    }

    // Check immunities first (takes precedence)
    if (matchedEnemy.immunities?.includes(damageType)) {
      return { amount: 0, modifier: 'immune' as const };
    }

    // Check resistances (halve damage)
    if (matchedEnemy.resistances?.includes(damageType)) {
      return { amount: Math.floor(update.amount / 2), modifier: 'resistant' as const };
    }

    // Check vulnerabilities (double damage)
    if (matchedEnemy.vulnerabilities?.includes(damageType)) {
      return { amount: update.amount * 2, modifier: 'vulnerable' as const };
    }

    return { amount: update.amount, modifier: null };
  }, [update, matchedEnemy]);

  const effectPreview = useMemo(() => {
    if (!matchedEnemy) return null;

    switch (update.updateType) {
      case 'damage':
        if (!update.amount) return null;
        const newHP = Math.max(0, matchedEnemy.currentHP - adjustedDamage.amount);
        return (
          <span className="text-xs flex items-center gap-1">
            {matchedEnemy.currentHP} → <span className={cn(newHP <= 0 ? 'text-red-400' : 'text-amber-400')}>{newHP}</span> HP
            {adjustedDamage.modifier && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] px-1 py-0 h-4",
                  adjustedDamage.modifier === 'resistant' && "border-blue-500/50 text-blue-400 bg-blue-500/10",
                  adjustedDamage.modifier === 'vulnerable' && "border-orange-500/50 text-orange-400 bg-orange-500/10",
                  adjustedDamage.modifier === 'immune' && "border-zinc-500/50 text-zinc-400 bg-zinc-500/10"
                )}
              >
                {adjustedDamage.modifier === 'resistant' && '½'}
                {adjustedDamage.modifier === 'vulnerable' && '×2'}
                {adjustedDamage.modifier === 'immune' && 'IMMUNE'}
              </Badge>
            )}
          </span>
        );
      case 'healing':
        if (!update.amount) return null;
        const healedHP = Math.min(matchedEnemy.maxHP, matchedEnemy.currentHP + update.amount);
        return (
          <span className="text-xs">
            {matchedEnemy.currentHP} → <span className="text-emerald-400">{healedHP}</span> HP
          </span>
        );
      case 'defeat':
        return (
          <span className="text-xs text-red-400">
            → 0 HP 💀
          </span>
        );
      default:
        return null;
    }
  }, [update, matchedEnemy, adjustedDamage]);

  return (
    <div className={cn(
      "border rounded-lg p-3 transition-all",
      !matchedEnemy
        ? "border-zinc-700/50 bg-zinc-800/10 opacity-50"
        : approved
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-zinc-700/50 bg-zinc-800/20 opacity-60"
    )}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <Checkbox
          checked={approved}
          onCheckedChange={onToggle}
          disabled={!matchedEnemy}
          className="mt-0.5 border-amber-500/50 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {typeIcon}
            <span className="text-sm font-medium">{description}</span>
            <ConfidenceBadge confidence={update.confidence} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {matchedEnemy ? (
              <>
                <span className="flex items-center gap-1 bg-zinc-800 px-1.5 py-0.5 rounded">
                  <Target className="w-3 h-3" />
                  {matchedEnemy.name}
                </span>
                {effectPreview && (
                  <span className="bg-zinc-800 px-1.5 py-0.5 rounded">
                    {effectPreview}
                  </span>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <X className="w-3 h-3" />
                No matching enemy in tracker
              </span>
            )}
          </div>

          {update.sourceText && (
            <p className="text-[10px] text-muted-foreground mt-1 italic truncate">
              "{update.sourceText}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Utility: Find matching enemy by name (fuzzy match)
function findMatchingEnemy(targetName: string, enemies: Enemy[]): Enemy | null {
  const normalizedTarget = targetName.toLowerCase().replace(/\s+\d+$/, '').trim();

  // Exact match first
  const exactMatch = enemies.find(e =>
    e.name.toLowerCase() === normalizedTarget ||
    e.name.toLowerCase().replace(/\s+\d+$/, '').trim() === normalizedTarget
  );
  if (exactMatch) return exactMatch;

  // Partial match
  return enemies.find(e => {
    const existingName = e.name.toLowerCase().replace(/\s+\d+$/, '').trim();
    return existingName.includes(normalizedTarget) ||
      normalizedTarget.includes(existingName);
  }) ?? null;
}
