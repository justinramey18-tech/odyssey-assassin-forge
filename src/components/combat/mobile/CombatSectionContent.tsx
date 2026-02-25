import { Ability } from '@/lib/types';
import { WeaponAttack } from '@/lib/combat/combatTypes';
import { ActiveConditionInfo, SetBonusInfo, TargetPromptInfo } from '@/lib/combat/promptContext';
import { Enemy } from '@/lib/combat/targetTypes';
import { QueuedAttack } from '@/lib/combat/attackQueue';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { DeathSavesTracker } from '@/components/character/DeathSavesTracker';
import { QuickCastPanel } from './QuickCastPanel';
import { AttackQueuePanel } from './AttackQueuePanel';
import { MobileWeaponCard } from './MobileWeaponCard';
import { OffhandAttackCard } from './OffhandAttackCard';
import { CombatAbilityCard } from './CombatAbilityCard';

interface CombatSectionContentProps {
  // Character basics
  characterName: string;
  characterLevel: number;

  // HP & Death Saves
  currentHP?: number;
  deathSaves?: { successes: number; failures: number };
  onDeathSavesChange?: (saves: { successes: number; failures: number }) => void;
  onRegainHP?: (amount: number) => void;

  // Spellcasting (for QuickCastPanel)
  spellcasting?: UseSpellcastingReturn;

  // Weapons
  equippedWeapons: WeaponAttack[];
  weaponsMap: { primary: WeaponAttack | null; secondary: WeaponAttack | null; ranged: WeaponAttack | null };
  expandedWeaponId: string | null;
  onToggleWeaponExpand: (id: string) => void;
  equipmentImages: Record<string, string>;

  // Combat state
  conditions: string[];
  hasPoisonedWeapon: boolean;
  sneakAttackDice: string;
  combatStats: { attackBonus: number; damageBonus: number; ac: number };
  combatSettings: { hasTwoWeaponFightingStyle: boolean; hasDualWielderFeat: boolean };
  bonusActionUsed: boolean;

  // Attack queue
  attackQueue: {
    sortedQueue: QueuedAttack[];
    defaultTargetId: string | null;
    actionEconomy: { actionCount: number; bonusActionCount: number; warnings: string[] };
    removeFromQueue: (id: string) => void;
    reorderAttack: (id: string, direction: 'up' | 'down') => void;
    updateAttackTarget: (id: string, targetId: string | null, targetName: string | null) => void;
    clearQueue: () => void;
  };

  // Targets
  enemies: Enemy[];
  getTargetForPrompt: () => TargetPromptInfo | null;

  // Stealth abilities
  stealthAbilities: (Ability & { tier: 1 | 2 | 3 })[];
  cooldownStateMap: Map<string, { isOnCooldown: boolean; remaining: number; total: number }>;
  abilityImages: Record<string, string>;
  globalConditions?: ActiveConditionInfo[];
  activeSetBonuses?: SetBonusInfo[];
  concentrationSpell?: string | null;

  // Callbacks
  onAddToTurn: (type: 'action' | 'bonus' | 'reaction', description: string, roll?: string) => void;
  onSetLastAction: (action: string) => void;
  onSpellCastResult: (spellName: string) => void;
  onWeaponRoll: (...args: any[]) => void;
  onOffhandRoll: (...args: any[]) => void;
  onExecuteQueue: () => void;
  onQueueAttack: (...args: any[]) => void;
  onUseAbility: (...args: any[]) => void;
  onUseBonus: () => void;
  onTriggerCooldown: (abilityId: string) => void;
}

export function CombatSectionContent({
  characterName,
  characterLevel,
  currentHP,
  deathSaves,
  onDeathSavesChange,
  onRegainHP,
  spellcasting,
  equippedWeapons,
  weaponsMap,
  expandedWeaponId,
  onToggleWeaponExpand,
  equipmentImages,
  conditions,
  hasPoisonedWeapon,
  sneakAttackDice,
  combatStats,
  combatSettings,
  bonusActionUsed,
  attackQueue,
  enemies,
  getTargetForPrompt,
  stealthAbilities,
  cooldownStateMap,
  abilityImages,
  globalConditions,
  activeSetBonuses,
  concentrationSpell,
  onAddToTurn,
  onSetLastAction,
  onSpellCastResult,
  onWeaponRoll,
  onOffhandRoll,
  onExecuteQueue,
  onQueueAttack,
  onUseAbility,
  onUseBonus,
  onTriggerCooldown,
}: CombatSectionContentProps): JSX.Element {
  return (
    <div className="p-4 space-y-4">
      {currentHP === 0 && deathSaves && onDeathSavesChange && onRegainHP && (
        <DeathSavesTracker
          deathSaves={deathSaves}
          onDeathSavesChange={onDeathSavesChange}
          onRegainHP={onRegainHP}
        />
      )}
      {spellcasting && spellcasting.state.path && (
        <QuickCastPanel
          spellcasting={spellcasting}
          characterName={characterName}
          characterLevel={characterLevel}
          onCast={(result) => {
            if (result.success) {
              onAddToTurn('action', `Cast ${result.spellName}`);
              onSetLastAction(`${result.spellName.toUpperCase()} CAST`);
              onSpellCastResult(result.spellName);
            }
          }}
        />
      )}
      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-green-400">SNEAK ATTACK</span>
          <span className="text-lg font-bold text-green-300">{sneakAttackDice}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Once per turn with advantage OR ally within 5ft (no disadvantage)
        </p>
      </div>
      <AttackQueuePanel
        queue={attackQueue.sortedQueue}
        enemies={enemies}
        actionEconomy={attackQueue.actionEconomy}
        onRemove={attackQueue.removeFromQueue}
        onReorder={attackQueue.reorderAttack}
        onUpdateTarget={attackQueue.updateAttackTarget}
        onExecute={onExecuteQueue}
        onClear={attackQueue.clearQueue}
      />
      <div className="space-y-3">
        <h3 className="text-xs font-mono text-destructive uppercase tracking-wide">⚔️ Weapons</h3>
        {equippedWeapons.map(weapon => (
          <MobileWeaponCard
            key={weapon.id}
            weapon={weapon}
            level={characterLevel}
            attackBonus={combatStats.attackBonus}
            damageBonus={combatStats.damageBonus}
            conditions={conditions}
            hasPoisonedWeapon={hasPoisonedWeapon}
            isExpanded={expandedWeaponId === weapon.id}
            onToggleExpand={() => onToggleWeaponExpand(weapon.id)}
            onRoll={onWeaponRoll}
            customImage={weapon.slotType ? equipmentImages[weapon.slotType] : undefined}
            enemies={enemies}
            selectedTargetId={attackQueue.defaultTargetId}
            onQueueAttack={onQueueAttack}
          />
        ))}
        {equippedWeapons.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No weapons equipped</p>
          </div>
        )}
      </div>
      {weaponsMap.secondary && (
        <OffhandAttackCard
          secondaryWeapon={weaponsMap.secondary}
          primaryWeapon={weaponsMap.primary}
          level={characterLevel}
          attackBonus={combatStats.attackBonus}
          hasTwoWeaponFightingStyle={combatSettings.hasTwoWeaponFightingStyle}
          hasDualWielderFeat={combatSettings.hasDualWielderFeat}
          damageBonus={combatStats.damageBonus}
          conditions={conditions}
          hasPoisonedWeapon={hasPoisonedWeapon}
          bonusActionUsed={bonusActionUsed}
          onRoll={onOffhandRoll}
          onUseBonus={onUseBonus}
          customImage={equipmentImages.secondary_weapon}
        />
      )}
      {stealthAbilities.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-muted/20">
          <h3 className="text-xs font-mono text-purple-400 uppercase tracking-wide">🌙 Stealth & Assassin</h3>
          {stealthAbilities.map(ability => {
            const cdState = cooldownStateMap.get(ability.id);
            return (
              <div key={ability.id}>
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
                  onUse={onUseAbility}
                  onTriggerCooldown={onTriggerCooldown}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
