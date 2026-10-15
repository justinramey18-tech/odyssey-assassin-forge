// Pure conversion: a reviewed party-creation build -> the exact character_saves
// payload that onboarding_finalize stores. Never reads or writes localStorage and
// never looks at the active character, so another hero's HP, gold, loot, spells,
// cooldowns or homebrew can't leak into the new save.
//
// Generated IDs are derived from the session id + position, so every retry of the
// same reviewed build produces the same IDs (no duplicate homebrew on retry).

import type { CharacterBuildData } from '@/hooks/use-ai-creation-chat';
import type { PartyRules } from '@/lib/ai-creation/party-creation-state';
import { validateAgainstRules } from '@/lib/ai-creation/party-creation-state';
import { buildDataToWizardState } from '@/hooks/use-ai-creation-chat';
import { allAbilities } from '@/lib/abilities';
import {
  calculateStartingHP, calculateStartingXP, mapXPPreset, mergeAbilities,
} from '@/components/wizard/utils/apply-wizard-state';
import { getPresetById, presetToEquipment } from '@/components/wizard/presets/equipment-presets';
import { formToEquipmentItem, type HomebrewGearFormState } from '@/lib/inventory/homebrewGear';
import type { CharacterEquipment, EquipmentItem, EquipmentSlotType, Rarity } from '@/lib/inventory/types';
import { getConsumableById } from '@/lib/consumables';
import { ODDS_PROFILES } from '@/lib/diceOdds';
import { getDefaultState as getDefaultSpellcastingState } from '@/hooks/use-spellcasting';
import { getPathConfig, getPathProgression } from '@/lib/magic/paths';
import { getSlotsForLevel, getPactSlotsForLevel, type MagicPath, type SpellcastingState, type SpellSchool, type CastingTime } from '@/lib/magic/types';
import type { HomebrewSpell } from '@/lib/spellCustomization/types';
import { DEFAULT_CUSTOMIZATION_STATE, type AbilityCustomizationState, type HomebrewAbility } from '@/lib/abilityCustomization/types';
import type { AbilityTree, ActionType, Character, UsageType } from '@/lib/types';

export interface PartySavePayload {
  character: Character;
  equipment: CharacterEquipment;
  achievements: unknown[];
  consumables: Array<{ consumableId: string; quantity: number; customConsumable?: Record<string, unknown> }>;
  xp: { currentXP: number; xpPreset: string };
  prestige: { prestigeXP: number; prestigeLevel: number; totalPrestigePoints: number };
  extended: Record<string, unknown>;
}

export type PrepareResult = { ok: true; payload: PartySavePayload } | { ok: false; issues: string[] };

/** Stable short tag for a session (letters/digits only). */
export function sessionTag(sessionId: string): string {
  return sessionId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();
}
export const partyGearId = (sessionId: string, i: number) => `homebrew-gear-p${sessionTag(sessionId)}-${i}`;
export const partySpellId = (sessionId: string, i: number) => `homebrew_spell_p${sessionTag(sessionId)}_${i}`;
export const partyAbilityId = (sessionId: string, i: number) => `homebrew_p${sessionTag(sessionId)}_${i}`;
export const partyConsumableId = (sessionId: string, i: number) => `homebrew_consumable_p${sessionTag(sessionId)}_${i}`;

const finite = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function preparePartySave(build: CharacterBuildData | null, rules: PartyRules | null, sessionId: string, now = Date.now()): PrepareResult {
  const issues = validateAgainstRules(build, rules);
  if (issues.length || !build) return { ok: false, issues: issues.length ? issues : ['No character build yet.'] };
  if (!sessionId) return { ok: false, issues: ['This character has no session.'] };

  const wizard = buildDataToWizardState(build); // existing defaults (scores, preset, xp preset)
  const level = wizard.level;
  const iso = new Date(now).toISOString();

  // ── Equipment: preset baseline + this build's homebrew gear ──
  let equipment: CharacterEquipment = wizard.equipment;
  const preset = wizard.selectedPresetId ? getPresetById(wizard.selectedPresetId) : undefined;
  if (preset) equipment = presetToEquipment(preset);
  equipment = { slots: { ...equipment.slots }, inventory: [...equipment.inventory] };
  (build.homebrewGear || []).forEach((g, i) => {
    const form: HomebrewGearFormState = {
      name: g.name, slotType: g.slotType as EquipmentSlotType, rarity: g.rarity as Rarity,
      level: g.level || 1, icon: g.icon || 'Sword', weight: g.weight || 1, value: g.value || 0,
      description: g.description || '', lore: g.lore || '', properties: g.properties || [],
      stats: g.stats || {}, damage: g.damage || '',
    };
    const item: EquipmentItem = { ...formToEquipmentItem(form), id: partyGearId(sessionId, i), createdAt: iso } as EquipmentItem;
    const slot = item.slotType as keyof CharacterEquipment['slots'];
    if (slot && slot in equipment.slots && !equipment.slots[slot]) equipment.slots[slot] = item;
    else equipment.inventory.push(item);
  });

  // ── Character from a clean baseline (never the active hero's abilities) ──
  const baseline = allAbilities.map(a => ({ abilityId: a.id, currentTier: 0 as const }));
  const character: Character = {
    name: build.name.trim(),
    level,
    primaryClass: wizard.primaryClass,
    portraitIcon: wizard.portraitIcon,
    abilities: mergeAbilities(baseline, wizard.starterAbilities),
    equippedAbilities: wizard.equippedAbilities && wizard.equippedAbilities.length ? wizard.equippedAbilities : [],
  };

  // ── Starting numbers from campaign rules / existing math ──
  const hp = calculateStartingHP(level, wizard.abilityScores.constitution);
  const currentXP = calculateStartingXP(level, wizard.xpPreset);
  const gold = Math.max(0, finite(rules?.startingGold, 0));
  if (![hp.current, hp.max, currentXP, gold].every(Number.isFinite) || hp.max <= 0) {
    return { ok: false, issues: ['The starting numbers could not be worked out for this build.'] };
  }

  // ── Homebrew spells (library format) — assigned explicitly as known below ──
  const spells: HomebrewSpell[] = (build.homebrewSpells || []).map((s, i) => ({
    id: partySpellId(sessionId, i),
    name: s.name,
    level: (s.level || 1) as HomebrewSpell['level'],
    school: (s.school || 'evocation') as SpellSchool,
    castingTime: (s.castingTime || 'action') as CastingTime,
    range: s.range || '60 feet',
    components: { verbal: s.components?.verbal ?? true, somatic: s.components?.somatic ?? true, material: s.components?.material },
    duration: s.duration || 'Instantaneous',
    concentration: !!s.concentration,
    ritual: !!s.ritual,
    description: s.description || '',
    higherLevels: s.higherLevels,
    damageType: s.damageType,
    damageFormula: s.damageDice,
    iconName: s.iconName || 'Sparkles',
    personalityQuips: { thunderhead: '', jarvis: '', deadpool: '' },
    isHomebrew: true as const,
    aiGenerated: true,
    createdAt: now,
    updatedAt: now,
  } as HomebrewSpell));

  // ── Magic path from a blank spellcasting state ──
  let spellcasting: SpellcastingState | undefined;
  if (wizard.selectedPath) {
    const path = wizard.selectedPath as MagicPath;
    const cfg = getPathConfig(path);
    const progression = getPathProgression(path);
    spellcasting = {
      ...getDefaultSpellcastingState(),
      path, pathUnlocked: true,
      spellcastingAbility: cfg.spellcastingAbility,
      spellSlots: getSlotsForLevel(level, progression),
      pactSlots: progression === 'pact' ? getPactSlotsForLevel(level) : undefined,
      // Spells written for THIS character are its known spells; nothing else is.
      knownSpells: spells.map(s => s.id),
    };
  }

  // ── Homebrew abilities (customization format; same as the standalone creator) ──
  const homebrewAbilities: HomebrewAbility[] = (build.homebrewAbilities || []).map((a, i) => ({
    id: partyAbilityId(sessionId, i),
    name: a.name,
    tree: (a.tree || 'hunter') as AbilityTree,
    icon: a.icon || 'Sword',
    type: a.type || 'active',
    actionType: (a.actionType || 'action') as ActionType,
    usageType: (a.usageType || 'at_will') as UsageType,
    tierEffects: (a.tierEffects || []).map(te => ({ tier: te.tier as 1 | 2 | 3, description: te.description })),
    dice: a.dice,
    cooldownMinutes: a.cooldownMinutes || 0,
    attackType: (a.attackType as HomebrewAbility['attackType']) || 'none',
    notes: a.notes,
    createdAt: now,
    updatedAt: now,
  } as HomebrewAbility));
  const abilityCustomization: AbilityCustomizationState = { ...DEFAULT_CUSTOMIZATION_STATE, overrides: {}, homebrewAbilities };

  // ── Consumables: registry presets + custom ones (same id for ref + definition) ──
  const consumables: PartySavePayload['consumables'] = [];
  for (const id of build.consumables || []) {
    if (!getConsumableById(id)) continue;
    const existing = consumables.find(c => c.consumableId === id);
    if (existing) existing.quantity += 1; else consumables.push({ consumableId: id, quantity: 1 });
  }
  (build.homebrewConsumables || []).forEach((c, i) => {
    const id = partyConsumableId(sessionId, i);
    consumables.push({
      consumableId: id, quantity: 1,
      customConsumable: {
        id, name: c.name, type: c.type || 'potion', rarity: c.rarity || 'common',
        effect: c.effect || c.description || '', duration: c.duration || 'Instantaneous',
        description: c.description || '', icon: c.icon || 'Flask', isHomebrew: true,
      },
    });
  });

  // ── Explicit per-character storage for the new save only ──
  const scoped: Record<string, string> = {
    'odyssey-ability-customization': JSON.stringify(abilityCustomization),
    'odyssey-consumables-inventory': JSON.stringify(consumables),
  };
  const oddsId = wizard.diceOddsMode && ODDS_PROFILES[wizard.diceOddsMode] ? wizard.diceOddsMode : 'fair';
  scoped['odyssey-dice-odds-profile'] = oddsId;
  const odds = ODDS_PROFILES[oddsId];
  if (odds?.uniform) scoped['odyssey-assassin-dice-odds'] = odds.byScene.combat;
  if (build.gender) scoped['dnd-character-gender'] = build.gender;
  if (build.race) scoped['dnd-character-race'] = build.race;
  if (build.backstory) scoped['dnd-character-backstory'] = build.backstory.slice(0, 2000);
  if (build.alignment && Number.isFinite(build.alignment.law) && Number.isFinite(build.alignment.good)) {
    scoped['odyssey-alignment-drift'] = JSON.stringify([{ promptId: '_ai_creation_seed', law: build.alignment.law, good: build.alignment.good, ts: now }]);
  }
  if (spellcasting) scoped['odyssey-spellcasting'] = JSON.stringify(spellcasting);
  if (build.empyrean) scoped['empyrean-unbonded-status'] = JSON.stringify(!!build.empyrean.unbonded);

  const extended: Record<string, unknown> = {
    abilityScores: { ...wizard.abilityScores },
    hpState: hp,
    deathSaves: { successes: 0, failures: 0 },
    shopGold: gold,
    characterIdentity: {
      ...(build.gender ? { gender: build.gender } : {}),
      ...(build.race ? { race: build.race } : {}),
      ...(build.backstory ? { backstory: build.backstory.slice(0, 2000) } : {}),
    },
    scopedLocalStorage: scoped,
  };
  if (spellcasting) extended.spellcasting = spellcasting;
  if (spells.length) extended.homebrewSpellLibrary = JSON.stringify({ homebrewSpells: spells });
  if (build.empyrean) extended.empyreanUnbondedStatus = !!build.empyrean.unbonded;

  return {
    ok: true,
    payload: {
      character, equipment, achievements: [], consumables,
      xp: { currentXP, xpPreset: mapXPPreset(wizard.xpPreset) },
      prestige: { prestigeXP: 0, prestigeLevel: 0, totalPrestigePoints: 0 },
      extended,
    },
  };
}

// ── One-shot hand-off receipt (account-level, never per character) ──
export interface PartyCreationReceipt { sessionId: string; partyId: string; saveId: string; userId: string; consumed?: boolean }
const RECEIPT_KEY = 'odyssey-party-creation-receipt';
export function writeReceipt(r: PartyCreationReceipt) { try { localStorage.setItem(RECEIPT_KEY, JSON.stringify(r)); } catch { /* ignore */ } }
export function readReceipt(): PartyCreationReceipt | null {
  try {
    const r = JSON.parse(localStorage.getItem(RECEIPT_KEY) || 'null');
    if (r && typeof r.sessionId === 'string' && typeof r.partyId === 'string' && typeof r.saveId === 'string' && typeof r.userId === 'string') return r;
  } catch { /* ignore */ }
  return null;
}
export function markReceiptConsumed(sessionId: string) {
  const r = readReceipt();
  if (r && r.sessionId === sessionId) writeReceipt({ ...r, consumed: true });
}
