// Chronicle Auto-Apply Panel
// Configuration and execution of smart auto-application

import { useState, useCallback, useMemo } from 'react';
import { 
  Zap, Coins, Heart, AlertCircle, Moon, Skull, Sparkles, Shield, Star,
  Check, X, ChevronDown, Settings2, Swords, RotateCw, Target, Eye, Focus,
  TrendingUp, Award, BookOpen
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AutoApplyConfig, 
  AutoApplyResult,
  CHRONICLE_AUTO_APPLY_KEY,
  ParsedSpellSlotUsage,
  ParsedTempHP,
  ParsedInspiration,
} from '@/lib/chronicleSync/enhancedTypes';
import { ChronicleParseResult, ParsedGoldChange, ParsedHPChange, ParsedCondition } from '@/lib/chronicleSync/types';
import { ParsedRestEvent, ParsedDeathSave } from '@/lib/chronicleSync/enhancedTypes';
import { InitiativeMatch, InitiativeEntry } from '@/lib/chronicleSync/patterns/initiative';
import { ParsedDamageModifier, ParsedConcentrationCheck } from '@/lib/chronicleSync/patterns/resistanceAndConcentration';
import { AbilityScoreIncreaseMatch } from '@/lib/chronicleSync/patterns/abilityScoreIncrease';
import { FeatAcquisitionMatch } from '@/lib/chronicleSync/patterns/featAcquisition';
import { ClassFeatureUnlockMatch } from '@/lib/chronicleSync/patterns/classFeatureUnlock';
import { DamageType, DAMAGE_TYPES } from '@/lib/combat/creatureTypes';
import { similarityScore } from '@/lib/chronicleSync/fuzzyMatch';
import { Enemy } from '@/lib/combat/targetTypes';

interface DeathSavesState {
  successes: number;
  failures: number;
}

interface SpellSlotState {
  [level: number]: { current: number; max: number };
}

interface InitiativeToApply {
  playerInitiative: number | null;
  enemyInitiatives: { enemyId: string; enemyName: string; roll: number; matchedName: string }[];
  unmatchedRolls: { name: string; roll: number }[];
}

// Kill detection matching result
interface KillToApply {
  killEvent: { targetName: string; sourceText: string };
  matchedEnemy: Enemy | null;
  confidence: number;
}

interface AutoApplyPanelProps {
  parseResult: ChronicleParseResult;
  enhancedResults?: {
    restEvents: ParsedRestEvent[];
    deathSaves: ParsedDeathSave[];
    spellSlotUsage: ParsedSpellSlotUsage[];
    tempHPGains: ParsedTempHP[];
    inspirationEvents: ParsedInspiration[];
    initiativeRolls?: InitiativeMatch[];
    combatRounds?: { roundNumber: number; sourceText: string }[];
    kills?: { targetName: string; sourceText: string }[];
    damageModifiers?: ParsedDamageModifier[];
    concentrationChecks?: ParsedConcentrationCheck[];
    abilityScoreIncreases?: AbilityScoreIncreaseMatch[];
    featAcquisitions?: FeatAcquisitionMatch[];
    classFeatureUnlocks?: ClassFeatureUnlockMatch[];
  };
  currentGold: number;
  currentHP: number;
  maxHP: number;
  currentTempHP: number;
  currentInspiration: boolean;
  activeConditions: string[];
  deathSaves?: DeathSavesState;
  spellSlots?: SpellSlotState;
  // Initiative state
  playerInitiative?: number | null;
  currentRound?: number;
  enemies?: Enemy[];
  onApplyGold: (netChange: number) => void;
  onApplyHP: (change: number, type: 'damage' | 'healing') => void;
  onApplyConditions: (toAdd: string[], toRemove: string[]) => void;
  onApplyRest: (type: 'short' | 'long') => void;
  onApplyDeathSaves?: (saves: DeathSavesState) => void;
  onRegainHP?: (amount: number) => void;
  onApplySpellSlots?: (slotsToExpend: Record<number, number>) => void;
  onApplyTempHP?: (amount: number) => void;
  onApplyInspiration?: (hasInspiration: boolean) => void;
  onApplyPlayerInitiative?: (value: number) => void;
  onApplyEnemyInitiative?: (enemyId: string, value: number) => void;
  onApplyRoundNumber?: (round: number) => void;
  onDefeatEnemy?: (enemyId: string) => void;
  onApplyEnemyResistances?: (enemyId: string, updates: Partial<{ resistances: DamageType[]; vulnerabilities: DamageType[]; immunities: DamageType[] }>) => void;
}

// Load/save config from localStorage
function loadConfig(): AutoApplyConfig {
  try {
    const stored = localStorage.getItem(CHRONICLE_AUTO_APPLY_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { gold: true, hp: true, conditions: true, restRecovery: true, deathSaves: true, spellSlots: true, tempHP: true, inspiration: true, initiative: true, round: true, kills: true, resistances: true, concentration: true };
}

function saveConfig(config: AutoApplyConfig) {
  try {
    localStorage.setItem(CHRONICLE_AUTO_APPLY_KEY, JSON.stringify(config));
  } catch {}
}

// Match detected initiative rolls to existing enemies using fuzzy matching
function matchInitiativeToEnemies(
  initiativeRolls: InitiativeMatch[],
  enemies: Enemy[],
  playerInitiative: number | null
): InitiativeToApply {
  const result: InitiativeToApply = {
    playerInitiative: null,
    enemyInitiatives: [],
    unmatchedRolls: [],
  };

  for (const match of initiativeRolls) {
    // Check for single player initiative roll (no named combatants)
    if (match.singleRoll !== undefined && match.rolls.length === 0) {
      // This is likely the player's initiative if no player initiative set
      if (playerInitiative === null || playerInitiative !== match.singleRoll) {
        result.playerInitiative = match.singleRoll;
      }
      continue;
    }

    // Process named rolls
    for (const roll of match.rolls) {
      // Check if this might be the player
      const nameLower = roll.name.toLowerCase();
      if (nameLower === 'you' || nameLower === 'player' || nameLower === 'me') {
        if (playerInitiative === null || playerInitiative !== roll.roll) {
          result.playerInitiative = roll.roll;
        }
        continue;
      }

      // Try to match to an enemy
      let bestMatch: { enemy: Enemy; score: number } | null = null;
      for (const enemy of enemies) {
        const score = similarityScore(roll.name, enemy.name);
        if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { enemy, score };
        }
      }

      if (bestMatch) {
        // Only add if enemy doesn't already have this initiative value
        if (bestMatch.enemy.initiative !== roll.roll) {
          result.enemyInitiatives.push({
            enemyId: bestMatch.enemy.id,
            enemyName: bestMatch.enemy.name,
            roll: roll.roll,
            matchedName: roll.name,
          });
        }
      } else {
        result.unmatchedRolls.push({ name: roll.name, roll: roll.roll });
      }
    }
  }

  return result;
}

export function AutoApplyPanel({
  parseResult,
  enhancedResults,
  currentGold,
  currentHP,
  maxHP,
  currentTempHP,
  currentInspiration,
  activeConditions,
  deathSaves,
  spellSlots,
  playerInitiative,
  currentRound = 1,
  enemies = [],
  onApplyGold,
  onApplyHP,
  onApplyConditions,
  onApplyRest,
  onApplyDeathSaves,
  onRegainHP,
  onApplySpellSlots,
  onApplyTempHP,
  onApplyInspiration,
  onApplyPlayerInitiative,
  onApplyEnemyInitiative,
  onApplyRoundNumber,
  onDefeatEnemy,
  onApplyEnemyResistances,
}: AutoApplyPanelProps) {
  const [config, setConfig] = useState<AutoApplyConfig>(loadConfig);
  const [isOpen, setIsOpen] = useState(false); // Start collapsed to show preview
  const [applied, setApplied] = useState<Partial<Record<keyof AutoApplyConfig, boolean>>>({});

  // Calculate pending changes
  const pendingChanges = useMemo(() => {
    const goldGained = parseResult.goldChanges
      .filter(g => g.action === 'gained')
      .reduce((sum, g) => sum + g.amount, 0);
    const goldSpent = parseResult.goldChanges
      .filter(g => g.action === 'spent')
      .reduce((sum, g) => sum + g.amount, 0);
    const netGold = goldGained - goldSpent;

    const damage = parseResult.hpChanges
      .filter(h => h.type === 'damage')
      .reduce((sum, h) => sum + Math.abs(h.amount), 0);
    const healing = parseResult.hpChanges
      .filter(h => h.type === 'healing')
      .reduce((sum, h) => sum + h.amount, 0);
    const netHP = healing - damage;

    const conditionsToAdd = parseResult.conditions
      .filter(c => c.action === 'applied')
      .map(c => c.name.toLowerCase())
      .filter(c => !activeConditions.includes(c));
    const conditionsToRemove = parseResult.conditions
      .filter(c => c.action === 'removed')
      .map(c => c.name.toLowerCase())
      .filter(c => activeConditions.includes(c));

    const rests = enhancedResults?.restEvents || [];
    const shortRests = rests.filter(r => r.type === 'short_rest').length;
    const longRests = rests.filter(r => r.type === 'long_rest').length;

    // Death saves from enhanced patterns
    const detectedDeathSaves = enhancedResults?.deathSaves || [];
    const deathSaveSuccesses = detectedDeathSaves.filter(
      ds => ds.type === 'success' || ds.type === 'critical_success'
    ).length;
    const deathSaveFailures = detectedDeathSaves.filter(
      ds => ds.type === 'failure'
    ).length;
    // Critical failures count as 2
    const criticalFailures = detectedDeathSaves.filter(
      ds => ds.type === 'critical_failure'
    ).length;
    const totalFailures = deathSaveFailures + (criticalFailures * 2);
    
    // Check for nat 20 (regain 1 HP)
    const hasNat20 = detectedDeathSaves.some(ds => ds.type === 'critical_success');

    // Spell slot usage aggregation
    const spellSlotUsage = enhancedResults?.spellSlotUsage || [];
    const slotsByLevel: Record<number, number> = {};
    spellSlotUsage.forEach(usage => {
      slotsByLevel[usage.level] = (slotsByLevel[usage.level] || 0) + 1;
    });
    const totalSlotsUsed = Object.values(slotsByLevel).reduce((sum, count) => sum + count, 0);

    // Temp HP gains - take the highest value detected
    const tempHPGains = enhancedResults?.tempHPGains || [];
    const maxTempHPDetected = tempHPGains.length > 0
      ? Math.max(...tempHPGains.map(t => t.amount))
      : 0;

    // Inspiration events - compute net result
    const inspirationEvents = enhancedResults?.inspirationEvents || [];
    const inspirationGained = inspirationEvents.filter(e => e.type === 'gained').length;
    const inspirationUsed = inspirationEvents.filter(e => e.type === 'used').length;
    // Net change: positive = gained, negative = used
    const inspirationNetChange = inspirationGained - inspirationUsed;
    // Final state: if currently have inspiration and used more than gained, lose it
    // If don't have and gained more than used, gain it
    const inspirationFinalState = currentInspiration 
      ? inspirationNetChange >= 0 // Keep if net is non-negative
      : inspirationGained > 0; // Gain if at least one gained

    // Initiative detection
    const initiativeRolls = enhancedResults?.initiativeRolls || [];
    const initiativeToApply = matchInitiativeToEnemies(initiativeRolls, enemies, playerInitiative ?? null);
    const hasInitiativeChanges = initiativeToApply.playerInitiative !== null || 
      initiativeToApply.enemyInitiatives.length > 0;

    // Combat round detection - get the highest round mentioned
    const combatRounds = enhancedResults?.combatRounds || [];
    const highestRound = combatRounds.length > 0
      ? Math.max(...combatRounds.map(r => r.roundNumber))
      : 0;
    const hasRoundChange = highestRound > 0 && highestRound !== currentRound;

    // Kill detection - match kill events to existing enemies using fuzzy matching
    const killEvents = enhancedResults?.kills || [];
    const killsToApply: KillToApply[] = [];
    
    for (const kill of killEvents) {
      // Find the best matching enemy that is still alive
      let bestMatch: { enemy: Enemy; score: number } | null = null;
      
      for (const enemy of enemies) {
        // Skip already defeated enemies
        if (enemy.currentHP <= 0) continue;
        
        const score = similarityScore(kill.targetName, enemy.name);
        if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { enemy, score };
        }
      }
      
      killsToApply.push({
        killEvent: kill,
        matchedEnemy: bestMatch?.enemy || null,
        confidence: bestMatch?.score || 0,
      });
    }
    
    const matchedKills = killsToApply.filter(k => k.matchedEnemy !== null);
    const hasKillChanges = matchedKills.length > 0;

    // Resistance/Vulnerability/Immunity detection
    const damageModifiers = enhancedResults?.damageModifiers || [];
    // Group by type for display
    const resistancesDetected = damageModifiers.filter(m => m.type === 'resistance');
    const vulnerabilitiesDetected = damageModifiers.filter(m => m.type === 'vulnerability');
    const immunitiesDetected = damageModifiers.filter(m => m.type === 'immunity');
    const hasDamageModifiers = damageModifiers.length > 0;

    // Match damage modifiers to enemies by looking for enemy names in context
    const resistancesByEnemy: Map<string, { 
      enemy: Enemy; 
      resistances: DamageType[]; 
      vulnerabilities: DamageType[]; 
      immunities: DamageType[];
    }> = new Map();

    for (const mod of damageModifiers) {
      // Try to match to an enemy from sourceText
      let bestMatch: { enemy: Enemy; score: number } | null = null;
      for (const enemy of enemies) {
        const score = similarityScore(enemy.name, mod.sourceText);
        if (score > 0.3 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { enemy, score };
        }
      }
      if (bestMatch) {
        const existing = resistancesByEnemy.get(bestMatch.enemy.id) || {
          enemy: bestMatch.enemy,
          resistances: [...(bestMatch.enemy.resistances || [])],
          vulnerabilities: [...(bestMatch.enemy.vulnerabilities || [])],
          immunities: [...(bestMatch.enemy.immunities || [])],
        };
        const dmgType = mod.damageType as DamageType;
        if (DAMAGE_TYPES.includes(dmgType as any)) {
          if (mod.type === 'resistance' && !existing.resistances.includes(dmgType)) {
            existing.resistances.push(dmgType);
          } else if (mod.type === 'vulnerability' && !existing.vulnerabilities.includes(dmgType)) {
            existing.vulnerabilities.push(dmgType);
          } else if (mod.type === 'immunity' && !existing.immunities.includes(dmgType)) {
            existing.immunities.push(dmgType);
          }
        }
        resistancesByEnemy.set(bestMatch.enemy.id, existing);
      }
    }
    const hasEnemyResistanceChanges = resistancesByEnemy.size > 0;

    // Concentration check detection
    const concentrationChecks = enhancedResults?.concentrationChecks || [];
    const concentrationMaintained = concentrationChecks.filter(c => c.result === 'maintained').length;
    const concentrationBroken = concentrationChecks.filter(c => c.result === 'broken').length;
    const concentrationSpells = concentrationChecks
      .filter(c => c.spellName)
      .map(c => c.spellName!)
      .filter((v, i, a) => a.indexOf(v) === i); // unique
    const hasConcentrationChanges = concentrationChecks.length > 0;

    // Progression detection: ASI, feats, class features
    const abilityScoreIncreases = enhancedResults?.abilityScoreIncreases || [];
    const featAcquisitions = enhancedResults?.featAcquisitions || [];
    const classFeatureUnlocks = enhancedResults?.classFeatureUnlocks || [];
    const hasProgressionChanges = abilityScoreIncreases.length > 0 || 
      featAcquisitions.length > 0 || classFeatureUnlocks.length > 0;

    return {
      netGold,
      goldGained,
      goldSpent,
      damage,
      healing,
      netHP,
      conditionsToAdd,
      conditionsToRemove,
      shortRests,
      longRests,
      deathSaveSuccesses,
      deathSaveFailures: totalFailures,
      hasNat20,
      detectedDeathSaves,
      slotsByLevel,
      totalSlotsUsed,
      spellSlotUsage,
      tempHPGains,
      maxTempHPDetected,
      inspirationEvents,
      inspirationGained,
      inspirationUsed,
      inspirationFinalState,
      initiativeToApply,
      hasInitiativeChanges,
      combatRounds,
      highestRound,
      hasRoundChange,
      killsToApply,
      matchedKills,
      hasKillChanges,
      // New categories
      damageModifiers,
      resistancesDetected,
      vulnerabilitiesDetected,
      immunitiesDetected,
      hasDamageModifiers,
      resistancesByEnemy,
      hasEnemyResistanceChanges,
      concentrationChecks,
      concentrationMaintained,
      concentrationBroken,
      concentrationSpells,
      hasConcentrationChanges,
      // Progression
      abilityScoreIncreases,
      featAcquisitions,
      classFeatureUnlocks,
      hasProgressionChanges,
      hasAnyChanges: netGold !== 0 || damage > 0 || healing > 0 || 
        conditionsToAdd.length > 0 || conditionsToRemove.length > 0 ||
        shortRests > 0 || longRests > 0 || detectedDeathSaves.length > 0 ||
        totalSlotsUsed > 0 || maxTempHPDetected > 0 || inspirationEvents.length > 0 ||
        hasInitiativeChanges || hasRoundChange || hasKillChanges ||
        hasDamageModifiers || hasConcentrationChanges || hasProgressionChanges,
    };
  }, [parseResult, enhancedResults, activeConditions, currentInspiration, enemies, playerInitiative, currentRound]);

  // Update config
  const updateConfig = useCallback((key: keyof AutoApplyConfig, value: boolean) => {
    setConfig(prev => {
      const updated = { ...prev, [key]: value };
      saveConfig(updated);
      return updated;
    });
  }, []);

  // Apply handlers
  const handleApplyGold = useCallback(() => {
    if (pendingChanges.netGold !== 0) {
      onApplyGold(pendingChanges.netGold);
      setApplied(prev => ({ ...prev, gold: true }));
    }
  }, [pendingChanges.netGold, onApplyGold]);

  const handleApplyHP = useCallback(() => {
    if (pendingChanges.damage > 0) {
      onApplyHP(-pendingChanges.damage, 'damage');
    }
    if (pendingChanges.healing > 0) {
      onApplyHP(pendingChanges.healing, 'healing');
    }
    setApplied(prev => ({ ...prev, hp: true }));
  }, [pendingChanges.damage, pendingChanges.healing, onApplyHP]);

  const handleApplyConditions = useCallback(() => {
    onApplyConditions(pendingChanges.conditionsToAdd, pendingChanges.conditionsToRemove);
    setApplied(prev => ({ ...prev, conditions: true }));
  }, [pendingChanges.conditionsToAdd, pendingChanges.conditionsToRemove, onApplyConditions]);

  const handleApplyRest = useCallback(() => {
    // Apply the most beneficial rest detected
    if (pendingChanges.longRests > 0) {
      onApplyRest('long');
    } else if (pendingChanges.shortRests > 0) {
      onApplyRest('short');
    }
    setApplied(prev => ({ ...prev, restRecovery: true }));
  }, [pendingChanges.longRests, pendingChanges.shortRests, onApplyRest]);

  const handleApplyDeathSaves = useCallback(() => {
    if (!onApplyDeathSaves) return;
    
    // Calculate new death save state by adding detected saves
    const currentSuccesses = deathSaves?.successes ?? 0;
    const currentFailures = deathSaves?.failures ?? 0;
    
    const newSuccesses = Math.min(3, currentSuccesses + pendingChanges.deathSaveSuccesses);
    const newFailures = Math.min(3, currentFailures + pendingChanges.deathSaveFailures);
    
    // If nat 20 was rolled, regain 1 HP and reset saves
    if (pendingChanges.hasNat20 && onRegainHP) {
      onRegainHP(1);
      onApplyDeathSaves({ successes: 0, failures: 0 });
    } else {
      onApplyDeathSaves({ successes: newSuccesses, failures: newFailures });
    }
    
    setApplied(prev => ({ ...prev, deathSaves: true }));
  }, [pendingChanges, deathSaves, onApplyDeathSaves, onRegainHP]);

  const handleApplySpellSlots = useCallback(() => {
    if (!onApplySpellSlots || pendingChanges.totalSlotsUsed === 0) return;
    onApplySpellSlots(pendingChanges.slotsByLevel);
    setApplied(prev => ({ ...prev, spellSlots: true }));
  }, [pendingChanges.slotsByLevel, pendingChanges.totalSlotsUsed, onApplySpellSlots]);

  const handleApplyTempHP = useCallback(() => {
    if (!onApplyTempHP || pendingChanges.maxTempHPDetected === 0) return;
    onApplyTempHP(pendingChanges.maxTempHPDetected);
    setApplied(prev => ({ ...prev, tempHP: true }));
  }, [pendingChanges.maxTempHPDetected, onApplyTempHP]);

  const handleApplyInspiration = useCallback(() => {
    if (!onApplyInspiration || pendingChanges.inspirationEvents.length === 0) return;
    onApplyInspiration(pendingChanges.inspirationFinalState);
    setApplied(prev => ({ ...prev, inspiration: true }));
  }, [pendingChanges.inspirationEvents, pendingChanges.inspirationFinalState, onApplyInspiration]);

  const handleApplyInitiative = useCallback(() => {
    if (!pendingChanges.hasInitiativeChanges) return;
    
    // Apply player initiative
    if (pendingChanges.initiativeToApply.playerInitiative !== null && onApplyPlayerInitiative) {
      onApplyPlayerInitiative(pendingChanges.initiativeToApply.playerInitiative);
    }
    
    // Apply enemy initiatives
    if (onApplyEnemyInitiative) {
      pendingChanges.initiativeToApply.enemyInitiatives.forEach(({ enemyId, roll }) => {
        onApplyEnemyInitiative(enemyId, roll);
      });
    }
    
    setApplied(prev => ({ ...prev, initiative: true }));
  }, [pendingChanges.hasInitiativeChanges, pendingChanges.initiativeToApply, onApplyPlayerInitiative, onApplyEnemyInitiative]);

  const handleApplyRound = useCallback(() => {
    if (!onApplyRoundNumber || !pendingChanges.hasRoundChange) return;
    onApplyRoundNumber(pendingChanges.highestRound);
    setApplied(prev => ({ ...prev, round: true }));
  }, [pendingChanges.hasRoundChange, pendingChanges.highestRound, onApplyRoundNumber]);

  const handleApplyKills = useCallback(() => {
    if (!onDefeatEnemy || !pendingChanges.hasKillChanges) return;
    
    // Defeat all matched enemies
    pendingChanges.matchedKills.forEach(({ matchedEnemy }) => {
      if (matchedEnemy) {
        onDefeatEnemy(matchedEnemy.id);
      }
    });
    
    setApplied(prev => ({ ...prev, kills: true }));
  }, [pendingChanges.hasKillChanges, pendingChanges.matchedKills, onDefeatEnemy]);

  const handleApplyResistances = useCallback(() => {
    if (!onApplyEnemyResistances || !pendingChanges.hasEnemyResistanceChanges) return;
    
    pendingChanges.resistancesByEnemy.forEach((data, enemyId) => {
      onApplyEnemyResistances(enemyId, {
        resistances: data.resistances,
        vulnerabilities: data.vulnerabilities,
        immunities: data.immunities,
      });
    });
    
    setApplied(prev => ({ ...prev, resistances: true }));
  }, [pendingChanges.hasEnemyResistanceChanges, pendingChanges.resistancesByEnemy, onApplyEnemyResistances]);

  // Apply all enabled
  const handleApplyAll = useCallback(() => {
    if (config.gold && pendingChanges.netGold !== 0 && !applied.gold) {
      handleApplyGold();
    }
    if (config.hp && (pendingChanges.damage > 0 || pendingChanges.healing > 0) && !applied.hp) {
      handleApplyHP();
    }
    if (config.conditions && (pendingChanges.conditionsToAdd.length > 0 || pendingChanges.conditionsToRemove.length > 0) && !applied.conditions) {
      handleApplyConditions();
    }
    if (config.restRecovery && (pendingChanges.shortRests > 0 || pendingChanges.longRests > 0) && !applied.restRecovery) {
      handleApplyRest();
    }
    // Death saves are always enabled when detected
    if (pendingChanges.detectedDeathSaves.length > 0 && !applied.deathSaves && onApplyDeathSaves) {
      handleApplyDeathSaves();
    }
    // Spell slots
    if (config.spellSlots && pendingChanges.totalSlotsUsed > 0 && !applied.spellSlots && onApplySpellSlots) {
      handleApplySpellSlots();
    }
    // Temp HP
    if (config.tempHP && pendingChanges.maxTempHPDetected > 0 && !applied.tempHP && onApplyTempHP) {
      handleApplyTempHP();
    }
    // Inspiration
    if (config.inspiration && pendingChanges.inspirationEvents.length > 0 && !applied.inspiration && onApplyInspiration) {
      handleApplyInspiration();
    }
    // Initiative
    if (config.initiative && pendingChanges.hasInitiativeChanges && !applied.initiative && (onApplyPlayerInitiative || onApplyEnemyInitiative)) {
      handleApplyInitiative();
    }
    // Combat round
    if (pendingChanges.hasRoundChange && !applied.round && onApplyRoundNumber) {
      handleApplyRound();
    }
    // Kills
    if (pendingChanges.hasKillChanges && !applied.kills && onDefeatEnemy) {
      handleApplyKills();
    }
    // Resistances
    if (config.resistances && pendingChanges.hasEnemyResistanceChanges && !applied.resistances && onApplyEnemyResistances) {
      handleApplyResistances();
    }
  }, [config, pendingChanges, applied, handleApplyGold, handleApplyHP, handleApplyConditions, handleApplyRest, handleApplyDeathSaves, handleApplySpellSlots, handleApplyTempHP, handleApplyInspiration, handleApplyInitiative, handleApplyRound, handleApplyKills, handleApplyResistances, onApplyDeathSaves, onApplySpellSlots, onApplyTempHP, onApplyInspiration, onApplyPlayerInitiative, onApplyEnemyInitiative, onApplyRoundNumber, onDefeatEnemy, onApplyEnemyResistances]);

  // Build compact summary items (must be before early return)
  const summaryItems = useMemo(() => {
    const items: { icon: React.ReactNode; label: string; colorClass: string }[] = [];
    
    if (pendingChanges.netGold !== 0) {
      items.push({
        icon: <Coins className="w-3 h-3" />,
        label: pendingChanges.netGold > 0 ? `+${pendingChanges.netGold}g` : `${pendingChanges.netGold}g`,
        colorClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      });
    }
    
    if (pendingChanges.damage > 0 || pendingChanges.healing > 0) {
      const hpLabel = pendingChanges.netHP >= 0 ? `+${pendingChanges.netHP}` : `${pendingChanges.netHP}`;
      items.push({
        icon: <Heart className="w-3 h-3" />,
        label: `${hpLabel} HP`,
        colorClass: pendingChanges.netHP >= 0 
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      });
    }
    
    if (pendingChanges.conditionsToAdd.length > 0 || pendingChanges.conditionsToRemove.length > 0) {
      const count = pendingChanges.conditionsToAdd.length + pendingChanges.conditionsToRemove.length;
      items.push({
        icon: <AlertCircle className="w-3 h-3" />,
        label: `${count} cond`,
        colorClass: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
      });
    }
    
    if (pendingChanges.shortRests > 0 || pendingChanges.longRests > 0) {
      items.push({
        icon: <Moon className="w-3 h-3" />,
        label: pendingChanges.longRests > 0 ? 'Long' : 'Short',
        colorClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
      });
    }
    
    if (pendingChanges.detectedDeathSaves.length > 0) {
      items.push({
        icon: <Skull className="w-3 h-3" />,
        label: pendingChanges.hasNat20 ? 'Nat20!' : `${pendingChanges.deathSaveSuccesses}✓ ${pendingChanges.deathSaveFailures}✗`,
        colorClass: pendingChanges.hasNat20 
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      });
    }
    
    if (pendingChanges.totalSlotsUsed > 0) {
      items.push({
        icon: <Sparkles className="w-3 h-3" />,
        label: `${pendingChanges.totalSlotsUsed} slots`,
        colorClass: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
      });
    }
    
    if (pendingChanges.maxTempHPDetected > 0) {
      items.push({
        icon: <Shield className="w-3 h-3" />,
        label: `+${pendingChanges.maxTempHPDetected} temp`,
        colorClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
      });
    }
    
    if (pendingChanges.inspirationEvents.length > 0) {
      items.push({
        icon: <Star className="w-3 h-3" />,
        label: pendingChanges.inspirationGained > 0 ? '+Insp' : '-Insp',
        colorClass: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
      });
    }
    
    if (pendingChanges.hasInitiativeChanges) {
      const playerInit = pendingChanges.initiativeToApply.playerInitiative;
      const enemyCount = pendingChanges.initiativeToApply.enemyInitiatives.length;
      let label = '';
      if (playerInit !== null && enemyCount > 0) {
        label = `Init ${playerInit} +${enemyCount}`;
      } else if (playerInit !== null) {
        label = `Init ${playerInit}`;
      } else {
        label = `${enemyCount} enemy init`;
      }
      items.push({
        icon: <Swords className="w-3 h-3" />,
        label,
        colorClass: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
      });
    }
    
    if (pendingChanges.hasRoundChange) {
      items.push({
        icon: <RotateCw className="w-3 h-3" />,
        label: `Rd ${pendingChanges.highestRound}`,
        colorClass: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
      });
    }
    
    if (pendingChanges.hasKillChanges) {
      items.push({
        icon: <Target className="w-3 h-3" />,
        label: `${pendingChanges.matchedKills.length} kill${pendingChanges.matchedKills.length !== 1 ? 's' : ''}`,
        colorClass: 'border-red-500/30 bg-red-500/10 text-red-300',
      });
    }

    if (pendingChanges.hasDamageModifiers) {
      const count = pendingChanges.damageModifiers.length;
      items.push({
        icon: <Eye className="w-3 h-3" />,
        label: `${count} R/V/I`,
        colorClass: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
      });
    }

    if (pendingChanges.hasConcentrationChanges) {
      const label = pendingChanges.concentrationBroken > 0 ? 'Conc ✗' : 'Conc ✓';
      items.push({
        icon: <Focus className="w-3 h-3" />,
        label,
        colorClass: pendingChanges.concentrationBroken > 0
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          : 'border-sky-500/30 bg-sky-500/10 text-sky-300',
      });
    }

    if (pendingChanges.abilityScoreIncreases.length > 0) {
      items.push({
        icon: <TrendingUp className="w-3 h-3" />,
        label: `${pendingChanges.abilityScoreIncreases.length} ASI`,
        colorClass: 'border-lime-500/30 bg-lime-500/10 text-lime-300',
      });
    }

    if (pendingChanges.featAcquisitions.length > 0) {
      items.push({
        icon: <Award className="w-3 h-3" />,
        label: `${pendingChanges.featAcquisitions.length} feat${pendingChanges.featAcquisitions.length !== 1 ? 's' : ''}`,
        colorClass: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300',
      });
    }

    if (pendingChanges.classFeatureUnlocks.length > 0) {
      items.push({
        icon: <BookOpen className="w-3 h-3" />,
        label: `${pendingChanges.classFeatureUnlocks.length} feature${pendingChanges.classFeatureUnlocks.length !== 1 ? 's' : ''}`,
        colorClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      });
    }
    
    return items;
  }, [pendingChanges]);

  if (!pendingChanges.hasAnyChanges) {
    return null;
  }

  return (
    <Card className="border-cyan-900/30 bg-cyan-500/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <button className="flex flex-col w-full gap-2 text-left">
              <div className="flex items-center justify-between w-full">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-cyan-400">
                  <Zap className="w-4 h-4" />
                  Smart Auto-Apply
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-cyan-500/20 text-cyan-300">
                    {summaryItems.length}
                  </Badge>
                </CardTitle>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
              
              {/* Compact preview when collapsed */}
              {!isOpen && summaryItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5 w-full">
                  {summaryItems.map((item, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0.5 h-5 flex items-center gap-1 ${item.colorClass}`}
                    >
                      {item.icon}
                      {item.label}
                    </Badge>
                  ))}
                </div>
              )}
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Gold Changes */}
            {pendingChanges.netGold !== 0 && (
              <AutoApplyRow
                icon={<Coins className="w-4 h-4 text-amber-400" />}
                label="Gold"
                description={
                  pendingChanges.netGold > 0 
                    ? `+${pendingChanges.netGold} GP gained` 
                    : `${pendingChanges.netGold} GP spent`
                }
                preview={`${currentGold} → ${currentGold + pendingChanges.netGold}`}
                enabled={config.gold}
                onToggle={(v) => updateConfig('gold', v)}
                applied={applied.gold}
                onApply={handleApplyGold}
                color="amber"
              />
            )}

            {/* HP Changes */}
            {(pendingChanges.damage > 0 || pendingChanges.healing > 0) && (
              <AutoApplyRow
                icon={<Heart className="w-4 h-4 text-rose-400" />}
                label="HP"
                description={
                  pendingChanges.damage > 0 && pendingChanges.healing > 0
                    ? `${pendingChanges.damage} damage, ${pendingChanges.healing} healing`
                    : pendingChanges.damage > 0
                    ? `${pendingChanges.damage} damage taken`
                    : `${pendingChanges.healing} HP healed`
                }
                preview={`${currentHP}/${maxHP} → ${Math.max(0, Math.min(maxHP, currentHP + pendingChanges.netHP))}/${maxHP}`}
                enabled={config.hp}
                onToggle={(v) => updateConfig('hp', v)}
                applied={applied.hp}
                onApply={handleApplyHP}
                color="rose"
              />
            )}

            {/* Conditions */}
            {(pendingChanges.conditionsToAdd.length > 0 || pendingChanges.conditionsToRemove.length > 0) && (
              <AutoApplyRow
                icon={<AlertCircle className="w-4 h-4 text-purple-400" />}
                label="Conditions"
                description={
                  <>
                    {pendingChanges.conditionsToAdd.length > 0 && (
                      <span className="text-rose-400">+{pendingChanges.conditionsToAdd.join(', ')}</span>
                    )}
                    {pendingChanges.conditionsToAdd.length > 0 && pendingChanges.conditionsToRemove.length > 0 && ', '}
                    {pendingChanges.conditionsToRemove.length > 0 && (
                      <span className="text-emerald-400">-{pendingChanges.conditionsToRemove.join(', ')}</span>
                    )}
                  </>
                }
                enabled={config.conditions}
                onToggle={(v) => updateConfig('conditions', v)}
                applied={applied.conditions}
                onApply={handleApplyConditions}
                color="purple"
              />
            )}

            {/* Rest Recovery */}
            {(pendingChanges.shortRests > 0 || pendingChanges.longRests > 0) && (
              <AutoApplyRow
                icon={<Moon className="w-4 h-4 text-indigo-400" />}
                label="Rest"
                description={
                  pendingChanges.longRests > 0
                    ? `Long rest detected (full recovery)`
                    : `Short rest detected (25% HP recovery)`
                }
                enabled={config.restRecovery}
                onToggle={(v) => updateConfig('restRecovery', v)}
                applied={applied.restRecovery}
                onApply={handleApplyRest}
                color="indigo"
              />
            )}

            {/* Death Saves */}
            {pendingChanges.detectedDeathSaves.length > 0 && onApplyDeathSaves && (
              <AutoApplyRow
                icon={<Skull className="w-4 h-4 text-rose-400" />}
                label="Death Saves"
                description={
                  pendingChanges.hasNat20
                    ? `🎉 Natural 20! Regain 1 HP and reset saves`
                    : `${pendingChanges.deathSaveSuccesses} success${pendingChanges.deathSaveSuccesses !== 1 ? 'es' : ''}, ${pendingChanges.deathSaveFailures} failure${pendingChanges.deathSaveFailures !== 1 ? 's' : ''}`
                }
                preview={
                  pendingChanges.hasNat20
                    ? 'Saves reset, +1 HP'
                    : `${deathSaves?.successes ?? 0}/${deathSaves?.failures ?? 0} → ${Math.min(3, (deathSaves?.successes ?? 0) + pendingChanges.deathSaveSuccesses)}/${Math.min(3, (deathSaves?.failures ?? 0) + pendingChanges.deathSaveFailures)}`
                }
                enabled={config.deathSaves}
                onToggle={(v) => updateConfig('deathSaves', v)}
                applied={applied.deathSaves}
                onApply={handleApplyDeathSaves}
                color="rose"
              />
            )}

            {/* Spell Slots */}
            {pendingChanges.totalSlotsUsed > 0 && onApplySpellSlots && (
              <AutoApplyRow
                icon={<Sparkles className="w-4 h-4 text-indigo-400" />}
                label="Spell Slots"
                description={
                  Object.entries(pendingChanges.slotsByLevel)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([level, count]) => `${count}× L${level}`)
                    .join(', ')
                }
                preview={
                  spellSlots 
                    ? Object.entries(pendingChanges.slotsByLevel)
                        .map(([level, count]) => {
                          const slot = spellSlots[Number(level)];
                          if (!slot) return `L${level}: -${count}`;
                          return `L${level}: ${slot.current}→${Math.max(0, slot.current - count)}`;
                        })
                        .join(', ')
                    : `${pendingChanges.totalSlotsUsed} slot(s) used`
                }
                enabled={config.spellSlots}
                onToggle={(v) => updateConfig('spellSlots', v)}
                applied={applied.spellSlots}
                onApply={handleApplySpellSlots}
                color="indigo"
              />
            )}

            {/* Temp HP */}
            {pendingChanges.maxTempHPDetected > 0 && onApplyTempHP && (
              <AutoApplyRow
                icon={<Shield className="w-4 h-4 text-cyan-400" />}
                label="Temp HP"
                description={
                  pendingChanges.tempHPGains.length === 1
                    ? `+${pendingChanges.maxTempHPDetected} temporary HP`
                    : `${pendingChanges.tempHPGains.length} gains detected (max: +${pendingChanges.maxTempHPDetected})`
                }
                preview={
                  currentTempHP > 0
                    ? currentTempHP >= pendingChanges.maxTempHPDetected
                      ? `Keep current (${currentTempHP} ≥ ${pendingChanges.maxTempHPDetected})`
                      : `${currentTempHP} → ${pendingChanges.maxTempHPDetected}`
                    : `0 → ${pendingChanges.maxTempHPDetected}`
                }
                enabled={config.tempHP}
                onToggle={(v) => updateConfig('tempHP', v)}
                applied={applied.tempHP}
                onApply={handleApplyTempHP}
                color="cyan"
              />
            )}

            {/* Inspiration */}
            {pendingChanges.inspirationEvents.length > 0 && onApplyInspiration && (
              <AutoApplyRow
                icon={<Star className="w-4 h-4 text-yellow-400" />}
                label="Inspiration"
                description={
                  pendingChanges.inspirationGained > 0 && pendingChanges.inspirationUsed > 0
                    ? `+${pendingChanges.inspirationGained} gained, -${pendingChanges.inspirationUsed} used`
                    : pendingChanges.inspirationGained > 0
                    ? `Gained inspiration`
                    : `Used inspiration`
                }
                preview={
                  currentInspiration
                    ? pendingChanges.inspirationFinalState ? 'Keep ✓' : '✓ → ✗'
                    : pendingChanges.inspirationFinalState ? '✗ → ✓' : 'Keep ✗'
                }
                enabled={config.inspiration}
                onToggle={(v) => updateConfig('inspiration', v)}
                applied={applied.inspiration}
                onApply={handleApplyInspiration}
                color="yellow"
              />
            )}

            {/* Initiative */}
            {pendingChanges.hasInitiativeChanges && (onApplyPlayerInitiative || onApplyEnemyInitiative) && (
              <AutoApplyRow
                icon={<Swords className="w-4 h-4 text-orange-400" />}
                label="Initiative"
                description={
                  <>
                    {pendingChanges.initiativeToApply.playerInitiative !== null && (
                      <span className="text-orange-300">You: {pendingChanges.initiativeToApply.playerInitiative}</span>
                    )}
                    {pendingChanges.initiativeToApply.playerInitiative !== null && 
                     pendingChanges.initiativeToApply.enemyInitiatives.length > 0 && ', '}
                    {pendingChanges.initiativeToApply.enemyInitiatives.length > 0 && (
                      <span className="text-muted-foreground">
                        {pendingChanges.initiativeToApply.enemyInitiatives.map(e => 
                          `${e.enemyName}: ${e.roll}`
                        ).join(', ')}
                      </span>
                    )}
                    {pendingChanges.initiativeToApply.unmatchedRolls.length > 0 && (
                      <span className="text-muted-foreground/60 ml-1">
                        ({pendingChanges.initiativeToApply.unmatchedRolls.length} unmatched)
                      </span>
                    )}
                  </>
                }
                preview={
                  pendingChanges.initiativeToApply.playerInitiative !== null
                    ? playerInitiative !== null 
                      ? `${playerInitiative} → ${pendingChanges.initiativeToApply.playerInitiative}`
                      : `You: ${pendingChanges.initiativeToApply.playerInitiative}`
                    : `${pendingChanges.initiativeToApply.enemyInitiatives.length} enemies`
                }
                enabled={config.initiative}
                onToggle={(v) => updateConfig('initiative', v)}
                applied={applied.initiative}
                onApply={handleApplyInitiative}
                color="orange"
              />
            )}

            {/* Combat Round */}
            {pendingChanges.hasRoundChange && onApplyRoundNumber && (
              <AutoApplyRow
                icon={<RotateCw className="w-4 h-4 text-violet-400" />}
                label="Combat Round"
                description={`Detected round ${pendingChanges.highestRound} in session log`}
                preview={`Rd ${currentRound} → ${pendingChanges.highestRound}`}
                enabled={config.round}
                onToggle={(v) => updateConfig('round', v)}
                applied={applied.round}
                onApply={handleApplyRound}
                color="violet"
              />
            )}

            {/* Kill Detection */}
            {pendingChanges.hasKillChanges && onDefeatEnemy && (
              <AutoApplyRow
                icon={<Target className="w-4 h-4 text-red-400" />}
                label="Defeated Enemies"
                description={pendingChanges.matchedKills.map(k => 
                  `"${k.killEvent.targetName}" → ${k.matchedEnemy?.name}`
                ).join(', ')}
                preview={`${pendingChanges.matchedKills.length} defeated`}
                enabled={config.kills}
                onToggle={(v) => updateConfig('kills', v)}
                applied={applied.kills}
                onApply={handleApplyKills}
                color="red"
              />
            )}

            {/* Resistance / Vulnerability / Immunity */}
            {pendingChanges.hasDamageModifiers && (
              <AutoApplyRow
                icon={<Eye className="w-4 h-4 text-teal-400" />}
                label="Resistances / Immunities"
                description={
                  <>
                    {pendingChanges.resistancesDetected.length > 0 && (
                      <span className="text-teal-300">R: {pendingChanges.resistancesDetected.map(m => m.damageType).join(', ')}</span>
                    )}
                    {pendingChanges.resistancesDetected.length > 0 && pendingChanges.vulnerabilitiesDetected.length > 0 && ' · '}
                    {pendingChanges.vulnerabilitiesDetected.length > 0 && (
                      <span className="text-amber-300">V: {pendingChanges.vulnerabilitiesDetected.map(m => m.damageType).join(', ')}</span>
                    )}
                    {(pendingChanges.resistancesDetected.length > 0 || pendingChanges.vulnerabilitiesDetected.length > 0) && pendingChanges.immunitiesDetected.length > 0 && ' · '}
                    {pendingChanges.immunitiesDetected.length > 0 && (
                      <span className="text-rose-300">I: {pendingChanges.immunitiesDetected.map(m => m.damageType).join(', ')}</span>
                    )}
                  </>
                }
                preview={
                  pendingChanges.hasEnemyResistanceChanges
                    ? `${pendingChanges.resistancesByEnemy.size} enem${pendingChanges.resistancesByEnemy.size !== 1 ? 'ies' : 'y'} matched`
                    : 'No enemies matched'
                }
                enabled={config.resistances}
                onToggle={(v) => updateConfig('resistances', v)}
                applied={applied.resistances}
                onApply={pendingChanges.hasEnemyResistanceChanges ? handleApplyResistances : () => setApplied(prev => ({ ...prev, resistances: true }))}
                color="teal"
              />
            )}

            {/* Concentration Checks (display-only) */}
            {pendingChanges.hasConcentrationChanges && (
              <AutoApplyRow
                icon={<Focus className="w-4 h-4 text-sky-400" />}
                label="Concentration"
                description={
                  <>
                    {pendingChanges.concentrationMaintained > 0 && (
                      <span className="text-emerald-300">{pendingChanges.concentrationMaintained} maintained</span>
                    )}
                    {pendingChanges.concentrationMaintained > 0 && pendingChanges.concentrationBroken > 0 && ', '}
                    {pendingChanges.concentrationBroken > 0 && (
                      <span className="text-rose-300">{pendingChanges.concentrationBroken} broken</span>
                    )}
                    {pendingChanges.concentrationSpells.length > 0 && (
                      <span className="text-muted-foreground"> ({pendingChanges.concentrationSpells.join(', ')})</span>
                    )}
                  </>
                }
                enabled={config.concentration}
                onToggle={(v) => updateConfig('concentration', v)}
                applied={applied.concentration}
                onApply={() => setApplied(prev => ({ ...prev, concentration: true }))}
                color="sky"
              />
            )}

            {/* Ability Score Increases (display-only) */}
            {pendingChanges.abilityScoreIncreases.length > 0 && (
              <AutoApplyRow
                icon={<TrendingUp className="w-4 h-4 text-lime-400" />}
                label="Ability Score Increases"
                description={
                  <>
                    {pendingChanges.abilityScoreIncreases.map((asi, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        <span className="text-lime-300 capitalize">
                          {asi.ability}
                          {asi.increase > 0 ? ` +${asi.increase}` : ''}
                          {asi.newScore ? ` → ${asi.newScore}` : ''}
                        </span>
                        {asi.source && <span className="text-muted-foreground"> ({asi.source})</span>}
                      </span>
                    ))}
                  </>
                }
                preview="Review on character sheet"
                enabled={true}
                onToggle={() => {}}
                applied={applied.concentration} // display-only, no actual apply
                onApply={() => setApplied(prev => ({ ...prev, concentration: true }))}
                color="lime"
              />
            )}

            {/* Feat Acquisitions (display-only) */}
            {pendingChanges.featAcquisitions.length > 0 && (
              <AutoApplyRow
                icon={<Award className="w-4 h-4 text-fuchsia-400" />}
                label="Feats Detected"
                description={
                  <>
                    {pendingChanges.featAcquisitions.map((feat, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        <span className={feat.isKnownFeat ? 'text-fuchsia-300' : 'text-fuchsia-300/70'}>
                          {feat.featName}
                        </span>
                        {!feat.isKnownFeat && <span className="text-muted-foreground"> (homebrew?)</span>}
                        {feat.source && <span className="text-muted-foreground"> ({feat.source})</span>}
                      </span>
                    ))}
                  </>
                }
                preview="Review on character sheet"
                enabled={true}
                onToggle={() => {}}
                applied={applied.concentration}
                onApply={() => setApplied(prev => ({ ...prev, concentration: true }))}
                color="fuchsia"
              />
            )}

            {/* Class Feature Unlocks (display-only) */}
            {pendingChanges.classFeatureUnlocks.length > 0 && (
              <AutoApplyRow
                icon={<BookOpen className="w-4 h-4 text-emerald-400" />}
                label="Class Features"
                description={
                  <>
                    {pendingChanges.classFeatureUnlocks.map((feat, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        <span className="text-emerald-300">{feat.featureName}</span>
                        {feat.className && <span className="text-muted-foreground"> ({feat.className})</span>}
                        {feat.level && <span className="text-muted-foreground"> Lv{feat.level}</span>}
                      </span>
                    ))}
                  </>
                }
                preview="Review on character sheet"
                enabled={true}
                onToggle={() => {}}
                applied={applied.concentration}
                onApply={() => setApplied(prev => ({ ...prev, concentration: true }))}
                color="emerald"
              />
            )}
            <Button
              onClick={handleApplyAll}
              className="w-full gap-2 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600"
              disabled={Object.keys(applied).length > 0}
            >
              <Zap className="w-4 h-4" />
              Apply All Enabled Changes
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Individual auto-apply row
function AutoApplyRow({
  icon,
  label,
  description,
  preview,
  enabled,
  onToggle,
  applied,
  onApply,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  description: React.ReactNode;
  preview?: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  applied?: boolean;
  onApply: () => void;
  color: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg bg-${color}-500/5 border border-${color}-500/20`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{label}</span>
            {applied && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <Check className="w-3 h-3 mr-1" />
                Applied
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{description}</div>
          {preview && (
            <div className="text-xs text-foreground/70 mt-0.5">{preview}</div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={applied}
          className="scale-75"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={onApply}
          disabled={!enabled || applied}
          className="h-7 px-2"
        >
          {applied ? <Check className="w-4 h-4 text-emerald-400" /> : 'Apply'}
        </Button>
      </div>
    </div>
  );
}
