import { useState, useCallback } from 'react';
import { Ability } from '@/lib/types';
import { WeaponAttack, DEFAULT_WEAPONS, getSneakAttackDice } from '@/lib/combat/combatTypes';
import { ExecutedAttack } from '@/lib/combat/attackQueue';
import { generateMultiAttackPrompt, generateQueuedAttackPrompt } from '@/lib/combat/attackQueuePrompts';
import { generateMobileWeaponPrompt } from '@/lib/combat/weaponPrompts';
import { DiceRoll, rollDice, getAbilityDice, isCriticalHit, isCriticalMiss, inferRollMode } from '@/lib/diceRoller';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { UseCombatLogReturn } from '@/hooks/use-combat-log';
import { UseTargetsReturn } from '@/hooks/use-targets';
import { UseAttackQueueReturn } from '@/hooks/use-attack-queue';
import { useCooldowns } from '@/hooks/use-cooldowns';

type UseCooldownsReturn = ReturnType<typeof useCooldowns>;
import { CombatSettings } from '@/lib/combat/combatSettings';

interface CombatStatsInput {
  attackBonus: number;
  damageBonus: number;
  ac: number;
}

export interface UseCombatActionsProps {
  characterName: string;
  characterLevel: number;
  combatStats: CombatStatsInput;
  combatSettings: CombatSettings;
  conditions: string[];
  hasPoisonedWeapon: boolean;
  combatLog: UseCombatLogReturn;
  targetTracker: UseTargetsReturn;
  attackQueue: UseAttackQueueReturn;
  cooldownSystem: UseCooldownsReturn;
  onAddToTurn: (type: 'action' | 'bonus' | 'reaction', desc: string, roll?: string) => void;
}

export interface UseCombatActionsReturn {
  // Dice modal state
  diceRoll: DiceRoll | null;
  dicePrompt: string;
  activeAbility: Ability | null;
  activeTier: 1 | 2 | 3;
  showDiceModal: boolean;
  setShowDiceModal: (open: boolean) => void;
  lastAction: string;
  setLastAction: (action: string) => void;

  // Handlers
  handleAbilityUse: (ability: Ability & { tier: 1 | 2 | 3 }) => void;
  handleEnhancedAbilityUse: (ability: Ability & { tier: 1 | 2 | 3 }, roll: DiceRoll, prompt: string, combinedDamage: string) => void;
  handleWeaponRoll: (rollType: 'normal' | 'sneak' | 'assassinate', weapon: WeaponAttack, roll: DiceRoll, damage: string) => void;
  handleOffhandRoll: (weapon: WeaponAttack, roll: DiceRoll, damage: string, isOffhand: true) => void;
  handleQueueAttack: (weapon: WeaponAttack, rollType: 'normal' | 'sneak' | 'assassinate', targetId: string | null, targetName: string | null, isOffhand?: boolean) => void;
  handleExecuteQueue: () => void;
  handleQuickRoll: () => void;
  handleQuickAttack: () => void;
  handleQuickHide: () => void;
}

export function useCombatActions({
  characterName,
  characterLevel,
  combatStats,
  combatSettings,
  conditions,
  hasPoisonedWeapon,
  combatLog,
  targetTracker,
  attackQueue,
  cooldownSystem,
  onAddToTurn,
}: UseCombatActionsProps): UseCombatActionsReturn {
  // Dice modal state
  const [showDiceModal, setShowDiceModal] = useState(false);
  const [diceRoll, setDiceRoll] = useState<DiceRoll | null>(null);
  const [dicePrompt, setDicePrompt] = useState('');
  const [activeAbility, setActiveAbility] = useState<Ability | null>(null);
  const [activeTier, setActiveTier] = useState<1 | 2 | 3>(1);

  // UI state
  const [lastAction, setLastAction] = useState('SYSTEMS READY');

  // Handle ability use (legacy for stealth tab)
  const handleAbilityUse = useCallback((
    ability: Ability & { tier: 1 | 2 | 3 }
  ) => {
    const { die, count } = getAbilityDice(ability.tier);
    const roll = rollDice(die, count);
    const prompt = generateRPPrompt(ability, ability.tier, roll, characterName);

    setActiveAbility(ability);
    setActiveTier(ability.tier);
    setDiceRoll(roll);
    setDicePrompt(prompt);
    setShowDiceModal(true);
    setLastAction(`${ability.name.toUpperCase()} ACTIVATED`);

    // Log to combat log
    const logRollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
    combatLog.addEntry({
      actionType: 'ability',
      actionName: ability.name,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: isCriticalHit(roll.rolls, logRollMode, roll.die),
        isFumble: isCriticalMiss(roll.rolls, logRollMode, roll.die),
      },
      damage: `${count}${die}`,
    });

    // Trigger cooldown
    cooldownSystem.triggerCooldown(ability.id);

    const actionType = ability.actionType === 'bonus_action' ? 'bonus' :
                       ability.actionType === 'reaction' ? 'reaction' : 'action';
    onAddToTurn(actionType, ability.name, `${count}${die}`);
  }, [characterName, onAddToTurn, cooldownSystem, combatLog]);

  // Handle enhanced ability use (with weapon synergy + combined damage)
  const handleEnhancedAbilityUse = useCallback((
    ability: Ability & { tier: 1 | 2 | 3 },
    roll: DiceRoll,
    prompt: string,
    combinedDamage: string
  ) => {
    setActiveAbility(ability);
    setActiveTier(ability.tier);
    setDiceRoll(roll);
    setDicePrompt(prompt);
    setShowDiceModal(true);
    setLastAction(`${ability.name.toUpperCase()} + ${combinedDamage}`);

    // Log to combat log
    const enhancedRollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
    combatLog.addEntry({
      actionType: 'ability',
      actionName: `${ability.name} + Weapon`,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: isCriticalHit(roll.rolls, enhancedRollMode, roll.die),
        isFumble: isCriticalMiss(roll.rolls, enhancedRollMode, roll.die),
      },
      damage: combinedDamage,
    });

    const actionType = ability.actionType === 'bonus_action' ? 'bonus' :
                       ability.actionType === 'reaction' ? 'reaction' : 'action';
    const { die, count } = getAbilityDice(ability.tier);
    onAddToTurn(actionType, `${ability.name} (${combinedDamage})`, `${count}${die}`);
  }, [onAddToTurn, combatLog]);

  // Handle weapon roll
  const handleWeaponRoll = useCallback((
    rollType: 'normal' | 'sneak' | 'assassinate',
    weapon: WeaponAttack,
    roll: DiceRoll,
    damage: string
  ) => {
    const rollName = rollType === 'assassinate'
      ? `ASSASSINATE (${weapon.name})`
      : rollType === 'sneak'
        ? `${weapon.name} + Sneak Attack`
        : weapon.name;

    const currentTargetForPrompt = targetTracker.getTargetForPrompt();
    const prompt = generateMobileWeaponPrompt(rollType, weapon, roll, damage, characterName, currentTargetForPrompt);

    const targetSuffix = currentTargetForPrompt ? ` vs. ${currentTargetForPrompt.name}` : '';

    setDiceRoll(roll);
    setDicePrompt(prompt);
    setActiveAbility(null);
    setShowDiceModal(true);
    setLastAction(`${rollName.toUpperCase()} ROLL`);

    const weaponRollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
    combatLog.addEntry({
      actionType: 'weapon',
      actionName: `${rollName}${targetSuffix}`,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: isCriticalHit(roll.rolls, weaponRollMode, roll.die),
        isFumble: isCriticalMiss(roll.rolls, weaponRollMode, roll.die),
      },
      damage,
    });

    onAddToTurn('action', `${weapon.name} attack${rollType !== 'normal' ? ` (${rollType})` : ''}${targetSuffix}`);
  }, [characterName, onAddToTurn, combatLog, targetTracker]);

  // Handle offhand attack (bonus action with secondary weapon)
  const handleOffhandRoll = useCallback((
    weapon: WeaponAttack,
    roll: DiceRoll,
    damage: string,
    isOffhand: true
  ) => {
    const rollName = `Offhand (${weapon.name})`;

    const currentTargetForPrompt = targetTracker.getTargetForPrompt();
    const prompt = generateMobileWeaponPrompt('normal', weapon, roll, damage, characterName, currentTargetForPrompt, true);

    const targetSuffix = currentTargetForPrompt ? ` vs. ${currentTargetForPrompt.name}` : '';

    setDiceRoll(roll);
    setDicePrompt(prompt);
    setActiveAbility(null);
    setShowDiceModal(true);
    setLastAction(`OFFHAND ATTACK`);

    const offhandRollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
    combatLog.addEntry({
      actionType: 'weapon',
      actionName: `${rollName}${targetSuffix}`,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: isCriticalHit(roll.rolls, offhandRollMode, roll.die),
        isFumble: isCriticalMiss(roll.rolls, offhandRollMode, roll.die),
      },
      damage,
    });

    onAddToTurn('bonus', `Offhand attack${targetSuffix}`);
  }, [characterName, onAddToTurn, combatLog, targetTracker]);

  // Handle queueing an attack
  const handleQueueAttack = useCallback((
    weapon: WeaponAttack,
    rollType: 'normal' | 'sneak' | 'assassinate',
    targetId: string | null,
    targetName: string | null,
    isOffhand = false
  ) => {
    attackQueue.addToQueue(weapon, rollType, targetId, targetName, isOffhand);
  }, [attackQueue]);

  // Execute all queued attacks
  const handleExecuteQueue = useCallback(() => {
    if (attackQueue.isEmpty) return;

    const hasAdvantage = conditions.includes('advantage') || conditions.includes('hidden');
    const hasDisadvantage = conditions.includes('disadvantage');

    let rollCount = 1;
    if (hasAdvantage && !hasDisadvantage) rollCount = 2;
    else if (hasDisadvantage && !hasAdvantage) rollCount = 2;

    const executedAttacks: ExecutedAttack[] = [];

    for (const queuedAttack of attackQueue.sortedQueue) {
      const totalAttackBonus = combatStats.attackBonus + queuedAttack.weapon.attackBonus;
      const roll = rollDice('d20', rollCount, totalAttackBonus);

      let damage = queuedAttack.weapon.damage;
      if (!queuedAttack.isOffhand || combatSettings.hasTwoWeaponFightingStyle) {
        if (combatStats.damageBonus > 0) damage += `+${combatStats.damageBonus}`;
      }

      if (queuedAttack.rollType === 'sneak' || queuedAttack.rollType === 'assassinate') {
        damage += `+${getSneakAttackDice(characterLevel)}`;
      }

      if (hasPoisonedWeapon) {
        damage += '+2d6 poison';
      }

      if (queuedAttack.rollType === 'assassinate') {
        damage = `(${damage}) x2 dice [CRIT]`;
      }

      const targetInfo = queuedAttack.targetId
        ? targetTracker.enemies.find(e => e.id === queuedAttack.targetId)
        : null;

      const executed: ExecutedAttack = {
        ...queuedAttack,
        roll,
        damageBreakdown: damage,
        attackBonus: totalAttackBonus,
        targetInfo: targetInfo ? {
          name: targetInfo.name,
          ac: targetInfo.ac,
          currentHP: targetInfo.currentHP,
          maxHP: targetInfo.maxHP,
          notes: targetInfo.notes,
          creatureType: targetInfo.creatureType,
          size: targetInfo.size,
          conditions: targetInfo.conditions,
          resistances: targetInfo.resistances,
          vulnerabilities: targetInfo.vulnerabilities,
          immunities: targetInfo.immunities,
        } : null,
      };

      executedAttacks.push(executed);

      const rollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
      const singlePrompt = generateQueuedAttackPrompt(executed, characterName);
      combatLog.addEntry({
        actionType: 'weapon',
        actionName: `${queuedAttack.weapon.name}${queuedAttack.targetName ? ` → ${queuedAttack.targetName}` : ''}`,
        prompt: singlePrompt,
        roll: {
          total: roll.total,
          rolls: roll.rolls,
          modifier: roll.modifier,
          isCrit: isCriticalHit(roll.rolls, rollMode, roll.die),
          isFumble: isCriticalMiss(roll.rolls, rollMode, roll.die),
        },
        damage,
      });

      const actionType = queuedAttack.isOffhand ? 'bonus' : 'action';
      onAddToTurn(actionType, `${queuedAttack.weapon.name}${queuedAttack.targetName ? ` vs. ${queuedAttack.targetName}` : ''}`);
    }

    const combinedPrompt = generateMultiAttackPrompt(executedAttacks, characterName);
    setDiceRoll(executedAttacks[executedAttacks.length - 1].roll);
    setDicePrompt(combinedPrompt);
    setActiveAbility(null);
    setShowDiceModal(true);
    setLastAction(`${executedAttacks.length} ATTACKS EXECUTED`);

    attackQueue.clearQueue();
  }, [attackQueue, conditions, combatStats, combatSettings.hasTwoWeaponFightingStyle, characterLevel, characterName, hasPoisonedWeapon, targetTracker.enemies, combatLog, onAddToTurn]);

  // FAB quick actions
  const handleQuickRoll = useCallback(() => {
    const roll = rollDice('d20', 1);
    setDiceRoll(roll);
    setDicePrompt('Quick d20 roll');
    setActiveAbility(null);
    setShowDiceModal(true);
  }, []);

  const handleQuickAttack = useCallback(() => {
    const weapon = DEFAULT_WEAPONS[0];
    const roll = rollDice('d20', 1, combatStats.attackBonus);
    handleWeaponRoll('normal', weapon, roll, weapon.damage);
  }, [combatStats.attackBonus, handleWeaponRoll]);

  const handleQuickHide = useCallback(() => {
    const roll = rollDice('d20', 1, 11); // Stealth +11
    setDiceRoll(roll);
    setDicePrompt('Stealth Check to Hide');
    setActiveAbility(null);
    setShowDiceModal(true);
    onAddToTurn('bonus', 'Hide (Stealth +11)');
  }, [onAddToTurn]);

  return {
    diceRoll,
    dicePrompt,
    activeAbility,
    activeTier,
    showDiceModal,
    setShowDiceModal,
    lastAction,
    setLastAction,
    handleAbilityUse,
    handleEnhancedAbilityUse,
    handleWeaponRoll,
    handleOffhandRoll,
    handleQueueAttack,
    handleExecuteQueue,
    handleQuickRoll,
    handleQuickAttack,
    handleQuickHide,
  };
}
