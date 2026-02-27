// Save homebrew content from AI Creation Assistant build data to localStorage
// This runs BEFORE navigation so the data is available when hooks initialize

import { CharacterBuildData } from '@/hooks/use-ai-creation-chat';
import {
  HomebrewGearItem,
  formToEquipmentItem,
  loadHomebrewGear,
  saveHomebrewGear,
  HomebrewGearFormState,
} from '@/lib/inventory/homebrewGear';
import type { EquipmentItem } from '@/lib/inventory/types';
import {
  loadSpellCustomization,
  saveSpellCustomization,
  generateHomebrewSpellId,
} from '@/lib/spellCustomization/utils';
import { HomebrewSpell, SpellCustomizationState } from '@/lib/spellCustomization/types';
import {
  AbilityCustomizationState,
  DEFAULT_CUSTOMIZATION_STATE,
  HomebrewAbility,
} from '@/lib/abilityCustomization/types';
import { generateHomebrewId } from '@/lib/abilityCustomization/utils';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import type { SpellSchool, CastingTime } from '@/lib/magic/types';
import type { AbilityTree, ActionType, UsageType } from '@/lib/types';
import type { EquipmentSlotType, Rarity } from '@/lib/inventory/types';

interface SaveSummary {
  gear: number;
  spells: number;
  abilities: number;
  consumables: number;
  totalItems: number;
  /** The created gear items (as EquipmentItem) so they can be auto-equipped */
  createdGearItems: EquipmentItem[];
}

export function saveHomebrewContentFromBuildData(data: CharacterBuildData): SaveSummary {
  const summary: SaveSummary = { gear: 0, spells: 0, abilities: 0, consumables: 0, totalItems: 0, createdGearItems: [] };

  // ── Homebrew Gear ──
  if (data.homebrewGear && data.homebrewGear.length > 0) {
    try {
      const existing = loadHomebrewGear();
      const newItems: HomebrewGearItem[] = data.homebrewGear.map(g => {
        const form: HomebrewGearFormState = {
          name: g.name,
          slotType: g.slotType as EquipmentSlotType,
          rarity: g.rarity as Rarity,
          level: g.level || 1,
          icon: g.icon || 'Sword',
          weight: g.weight || 1,
          value: g.value || 0,
          description: g.description || '',
          lore: g.lore || '',
          properties: g.properties || [],
          stats: g.stats || {},
          damage: g.damage || '',
        };
        return formToEquipmentItem(form);
      });
      saveHomebrewGear([...existing, ...newItems]);
      summary.gear = newItems.length;
      summary.createdGearItems = newItems;
    } catch (e) {
      console.error('[AICreation] Failed to save homebrew gear:', e);
    }
  }

  // ── Homebrew Spells ──
  if (data.homebrewSpells && data.homebrewSpells.length > 0) {
    try {
      const spellState = loadSpellCustomization();
      const newSpells: HomebrewSpell[] = data.homebrewSpells.map(s => ({
        id: generateHomebrewSpellId(),
        name: s.name,
        level: (s.level || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
        school: (s.school || 'evocation') as SpellSchool,
        castingTime: (s.castingTime || 'action') as CastingTime,
        range: s.range || '60 feet',
        components: {
          verbal: s.components?.verbal ?? true,
          somatic: s.components?.somatic ?? true,
          material: s.components?.material,
        },
        duration: s.duration || 'Instantaneous',
        concentration: s.concentration || false,
        ritual: s.ritual || false,
        description: s.description || '',
        higherLevels: s.higherLevels,
        damageType: s.damageType,
        damageFormula: s.damageDice,
        iconName: s.iconName || 'Sparkles',
        personalityQuips: { thunderhead: '', jarvis: '', deadpool: '' },
        isHomebrew: true as const,
        aiGenerated: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      spellState.homebrewSpells = [...spellState.homebrewSpells, ...newSpells];
      saveSpellCustomization(spellState);
      summary.spells = newSpells.length;
    } catch (e) {
      console.error('[AICreation] Failed to save homebrew spells:', e);
    }
  }

  // ── Homebrew Abilities ──
  if (data.homebrewAbilities && data.homebrewAbilities.length > 0) {
    try {
      const ABILITY_KEY = 'odyssey-ability-customization';
      let abilityState: AbilityCustomizationState;
      try {
        const saved = getScopedItem(ABILITY_KEY);
        abilityState = saved ? { ...DEFAULT_CUSTOMIZATION_STATE, ...JSON.parse(saved) } : { ...DEFAULT_CUSTOMIZATION_STATE };
      } catch {
        abilityState = { ...DEFAULT_CUSTOMIZATION_STATE };
      }

      const newAbilities: HomebrewAbility[] = data.homebrewAbilities.map(a => ({
        id: generateHomebrewId(),
        name: a.name,
        tree: (a.tree || 'hunter') as AbilityTree,
        icon: a.icon || 'Sword',
        type: a.type || 'active',
        actionType: (a.actionType || 'action') as ActionType,
        usageType: (a.usageType || 'at_will') as UsageType,
        tierEffects: (a.tierEffects || []).map(te => ({
          tier: te.tier as 1 | 2 | 3,
          description: te.description,
        })),
        dice: a.dice,
        cooldownMinutes: a.cooldownMinutes || 0,
        attackType: (a.attackType as any) || 'none',
        notes: a.notes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      abilityState.homebrewAbilities = [...abilityState.homebrewAbilities, ...newAbilities];
      setScopedItem(ABILITY_KEY, JSON.stringify(abilityState));
      summary.abilities = newAbilities.length;
    } catch (e) {
      console.error('[AICreation] Failed to save homebrew abilities:', e);
    }
  }

  // ── Homebrew Consumables ──
  if (data.homebrewConsumables && data.homebrewConsumables.length > 0) {
    try {
      const CONSUMABLE_KEY = 'odyssey-consumables-inventory';
      let existing: any[] = [];
      try {
        const stored = getScopedItem(CONSUMABLE_KEY);
        existing = stored ? JSON.parse(stored) : [];
      } catch { existing = []; }

      const newConsumables = data.homebrewConsumables.map(c => ({
        consumableId: `homebrew_consumable_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        quantity: 1,
        customConsumable: {
          id: `homebrew_consumable_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: c.name,
          type: c.type || 'potion',
          rarity: c.rarity || 'common',
          effect: c.effect || c.description || '',
          duration: c.duration || 'Instantaneous',
          description: c.description || '',
          icon: c.icon || 'Flask',
          isHomebrew: true,
        },
      }));

      setScopedItem(CONSUMABLE_KEY, JSON.stringify([...existing, ...newConsumables]));
      summary.consumables = newConsumables.length;
    } catch (e) {
      console.error('[AICreation] Failed to save homebrew consumables:', e);
    }
  }

  summary.totalItems = summary.gear + summary.spells + summary.abilities + summary.consumables;
  return summary;
}
