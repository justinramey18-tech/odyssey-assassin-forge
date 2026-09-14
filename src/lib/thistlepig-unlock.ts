// Builds the Thistlepig character and writes everything he needs into storage.
// Called once, from the signup flow, when the username "thistlepig" is claimed.

import {
  THISTLEPIG_ABILITIES,
  THISTLEPIG_ABILITY_SCORES,
  THISTLEPIG_ALIGNMENT,
  THISTLEPIG_BACKSTORY,
  THISTLEPIG_CONSUMABLES,
  THISTLEPIG_GEAR,
  THISTLEPIG_GENDER,
  THISTLEPIG_LEVEL,
  THISTLEPIG_NAME,
  THISTLEPIG_PORTRAIT_ICON,
  THISTLEPIG_RACE,
  THISTLEPIG_STARTER_ABILITIES,
  COSMIC_CHEF_MODE_KEY,
} from '@/lib/thistlepig';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import {
  AbilityCustomizationState,
  DEFAULT_CUSTOMIZATION_STATE,
  HomebrewAbility,
} from '@/lib/abilityCustomization/types';
import {
  formToEquipmentItem,
  loadHomebrewGear,
  saveHomebrewGear,
} from '@/lib/inventory/homebrewGear';
import { createInitialEquipment } from '@/lib/inventory';
import type { EquipmentItem } from '@/lib/inventory/types';
import type { WizardState } from '@/components/wizard/types';

const ABILITY_KEY = 'odyssey-ability-customization';
const CONSUMABLE_KEY = 'odyssey-consumables-inventory';

/** Writes the four signature moves into the homebrew ability store, idempotently. */
function writeAbilities(): void {
  let state: AbilityCustomizationState;
  try {
    const saved = getScopedItem(ABILITY_KEY);
    state = saved
      ? { ...DEFAULT_CUSTOMIZATION_STATE, ...JSON.parse(saved) }
      : { ...DEFAULT_CUSTOMIZATION_STATE, homebrewAbilities: [] };
  } catch {
    state = { ...DEFAULT_CUSTOMIZATION_STATE, homebrewAbilities: [] };
  }

  const now = Date.now();
  const existing = state.homebrewAbilities || [];
  const additions: HomebrewAbility[] = THISTLEPIG_ABILITIES
    .filter(seed => !existing.some(h => h.id === seed.id))
    .map(seed => ({ ...seed, createdAt: now, updatedAt: now }));

  state.homebrewAbilities = [...existing, ...additions];
  setScopedItem(ABILITY_KEY, JSON.stringify(state));
}

/** Writes his gear into the homebrew gear store and returns a filled equipment object. */
function writeGear() {
  const equipment = createInitialEquipment();
  const created: HomebrewGearItem[] = [];

  for (const form of THISTLEPIG_GEAR) {
    const item = formToEquipmentItem(form);
    created.push(item);
    const slot = item.slotType;
    if (slot && !equipment.slots[slot]) {
      equipment.slots[slot] = item;
    } else {
      equipment.inventory.push(item);
    }
  }

  try {
    saveHomebrewGear([...loadHomebrewGear(), ...created]);
  } catch (e) {
    console.error('[Thistlepig] Could not save homebrew gear:', e);
  }

  return equipment;
}

/** Drops his three consumables into the bag. */
function writeConsumables(): void {
  let existing: any[] = [];
  try {
    const stored = getScopedItem(CONSUMABLE_KEY);
    existing = stored ? JSON.parse(stored) : [];
  } catch {
    existing = [];
  }

  const entries = THISTLEPIG_CONSUMABLES.map((c, i) => {
    const id = 'homebrew_consumable_thistlepig_' + i;
    return {
      consumableId: id,
      quantity: 1,
      customConsumable: {
        id,
        name: c.name,
        type: c.type,
        rarity: c.rarity,
        effect: c.effect,
        duration: c.duration,
        description: c.description,
        icon: c.icon,
        isHomebrew: true,
      },
    };
  });

  const merged = [...existing];
  for (const entry of entries) {
    if (!merged.some((e: any) => e.consumableId === entry.consumableId)) {
      merged.push(entry);
    }
  }

  setScopedItem(CONSUMABLE_KEY, JSON.stringify(merged));
}

/** Seeds the alignment spectrum at Chaotic Neutral. */
function writeAlignment(): void {
  try {
    const activeId = localStorage.getItem('odyssey-active-cloud-save-id');
    const key = activeId
      ? 'odyssey-alignment-drift_' + activeId
      : 'odyssey-alignment-drift';
    const seed = {
      promptId: '_thistlepig_seed',
      law: THISTLEPIG_ALIGNMENT.law,
      good: THISTLEPIG_ALIGNMENT.good,
      ts: Date.now(),
    };
    let existing: any[] = [];
    try {
      existing = JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      existing = [];
    }
    existing.push(seed);
    localStorage.setItem(key, JSON.stringify(existing.slice(-50)));
  } catch (e) {
    console.error('[Thistlepig] Could not seed alignment:', e);
  }
}

/**
 * Builds Thistlepig. Writes everything to storage, then returns the WizardState
 * to hand to the app through router state as `aiCreatedCharacter`.
 */
export function unlockThistlepig(): WizardState {
  writeAbilities();
  writeConsumables();
  writeAlignment();
  const equipment = writeGear();

  setScopedItem('dnd-character-gender', THISTLEPIG_GENDER);
  setScopedItem('dnd-character-race', THISTLEPIG_RACE);
  setScopedItem('dnd-character-backstory', THISTLEPIG_BACKSTORY.slice(0, 2000));
  setScopedItem(COSMIC_CHEF_MODE_KEY, 'true');

  console.log('[Thistlepig] Cosmic Chef unlocked.');

  return {
    currentStep: 8,
    completedSteps: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    name: THISTLEPIG_NAME,
    level: THISTLEPIG_LEVEL,
    portraitIcon: THISTLEPIG_PORTRAIT_ICON as any,
    // Stored on the rogue chassis for engine compatibility. He is displayed as
    // "Cosmic Chef" everywhere - see src/lib/thistlepig.ts isCosmicChefMode().
    primaryClass: 'rogue',
    abilityScores: THISTLEPIG_ABILITY_SCORES,
    scoreGenerationMethod: 'standard',
    gameMode: 'infinityPool',
    honestModeRules: {
      requireGearUnlocks: true,
      organicLevelUp: true,
      maxLevelInfinityStones: true,
      noRerolls: true,
      scribeItemVerification: true,
      prestigePointsRequireXP: true,
      prestigeRespecDisabled: true,
      enforceCooldowns: true,
      enforceWildShapeDuration: true,
    },
    xpPreset: 'standard',
    diceOddsMode: 'fair',
    selectedPath: null,
    starterAbilities: THISTLEPIG_STARTER_ABILITIES,
    equipment,
    selectedPresetId: null,
    equippedAbilities: THISTLEPIG_STARTER_ABILITIES.map(a => a.abilityId),
  };
}
