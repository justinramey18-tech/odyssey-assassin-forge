import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Ability } from '@/lib/types';
import { WeaponAttack } from '@/lib/combat/combatTypes';
import { ActiveConditionInfo, SetBonusInfo, TargetPromptInfo } from '@/lib/combat/promptContext';
import { DiceRoll } from '@/lib/diceRoller';
import { CombatAbilityCard } from './CombatAbilityCard';
import { MobileReactionsList } from './MobileReactionsList';

interface ActionsSectionContentProps {
  // Character
  characterName: string;

  // Abilities
  specialAbilities: (Ability & { tier: 1 | 2 | 3 })[];
  unlockedAbilities: (Ability & { tier: 1 | 2 | 3 })[];

  // Weapons (for CombatAbilityCard synergy)
  weaponsMap: { primary: WeaponAttack | null; secondary: WeaponAttack | null; ranged: WeaponAttack | null };

  // Cooldowns
  cooldownStateMap: Map<string, { isOnCooldown: boolean; remaining: number; total: number }>;
  abilityImages: Record<string, string>;

  // Combat context
  reactionUsed: boolean;
  globalConditions?: ActiveConditionInfo[];
  activeSetBonuses?: SetBonusInfo[];
  concentrationSpell?: string | null;
  getTargetForPrompt: () => TargetPromptInfo | null;

  // Callbacks
  onUseAbility: (ability: Ability & { tier: 1 | 2 | 3 }, roll: DiceRoll, prompt: string, combinedDamage: string) => void;
  onUseReaction: () => void;
  onTriggerCooldown: (abilityId: string) => void;
  onSetLastAction: (action: string) => void;
  onAddToTurn: (type: 'action' | 'bonus' | 'reaction', description: string, roll?: string) => void;
  onLogReaction: (reaction: { name: string; trigger: string; effect: string; dmPrompt?: string }) => void;
}

export function ActionsSectionContent({
  characterName,
  specialAbilities,
  unlockedAbilities,
  weaponsMap,
  cooldownStateMap,
  abilityImages,
  reactionUsed,
  globalConditions,
  activeSetBonuses,
  concentrationSpell,
  getTargetForPrompt,
  onUseAbility,
  onUseReaction,
  onTriggerCooldown,
  onSetLastAction,
  onAddToTurn,
  onLogReaction,
}: ActionsSectionContentProps): JSX.Element {
  const [actionsFilter, setActionsFilter] = useState<'all' | 'action' | 'bonus_action' | 'reaction'>('all');

  const filteredAbilities = useMemo(() => {
    if (actionsFilter === 'all') {
      return [...specialAbilities, ...unlockedAbilities.filter(a => a.actionType === 'reaction')];
    }
    if (actionsFilter === 'reaction') {
      return unlockedAbilities.filter(a => a.actionType === 'reaction');
    }
    return specialAbilities.filter(a => a.actionType === actionsFilter);
  }, [actionsFilter, specialAbilities, unlockedAbilities]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'action', 'bonus_action', 'reaction'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => setActionsFilter(filter)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-mono whitespace-nowrap transition-all active:scale-95",
              actionsFilter === filter
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                : "bg-muted/20 text-muted-foreground border border-muted/30"
            )}
          >
            {filter === 'all' ? 'All' : 
             filter === 'action' ? '⚔️ Action' : 
             filter === 'bonus_action' ? '⚡ Bonus' : 
             '🛡️ Reaction'}
          </button>
        ))}
      </div>
      {actionsFilter === 'reaction' && reactionUsed && (
        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
          <span className="text-xs text-red-400 font-mono">⚠️ REACTION USED THIS ROUND</span>
        </div>
      )}
      {filteredAbilities.length > 0 ? (
        <div className="space-y-3">
          {filteredAbilities.map(ability => {
            const cdState = cooldownStateMap.get(ability.id);
            const isReaction = ability.actionType === 'reaction';
            return (
              <div key={ability.id} className={cn(
                isReaction && "border-l-2 border-cyan-500 pl-2"
              )}>
                <CombatAbilityCard
                  ability={ability}
                  characterName={characterName}
                  weapons={weaponsMap}
                  cooldownState={cdState ? {
                    isOnCooldown: cdState.isOnCooldown,
                    remaining: cdState.remaining,
                    total: cdState.total,
                  } : undefined}
                  customImage={abilityImages[ability.id]}
                  activeConditions={globalConditions}
                  activeSetBonuses={activeSetBonuses}
                  concentrationSpell={concentrationSpell}
                  currentTarget={getTargetForPrompt()}
                  onUse={(ability, roll, prompt, combinedDamage) => {
                    onUseAbility(ability, roll, prompt, combinedDamage);
                    if (ability.actionType === 'reaction') {
                      onUseReaction();
                    }
                  }}
                  onTriggerCooldown={onTriggerCooldown}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No {actionsFilter === 'all' ? 'abilities' : actionsFilter.replace('_', ' ') + 's'} unlocked</p>
        </div>
      )}
      {(actionsFilter === 'all' || actionsFilter === 'reaction') && (
        <div className="pt-2 border-t border-muted/20">
          <MobileReactionsList
            reactionUsed={reactionUsed}
            onUseReaction={(reaction) => {
              onUseReaction();
              onSetLastAction(`⚡ ${reaction.name.toUpperCase()}`);
              onAddToTurn('reaction', reaction.name);
              onLogReaction(reaction);
            }}
          />
        </div>
      )}
    </div>
  );
}
