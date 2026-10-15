import { describe, it, expect } from 'vitest';
import { preparePartySave, partyGearId } from '@/lib/ai-creation/party-build-save';
import type { CharacterBuildData } from '@/hooks/use-ai-creation-chat';

const SESSION = '11111111-2222-3333-4444-555555555555';
const build = (over: Partial<CharacterBuildData> = {}): CharacterBuildData => ({
  name: 'Vex', level: 3, portraitIcon: 'Skull', primaryClass: 'rogue', race: 'elf',
  abilityScores: { strength: 10, dexterity: 16, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 },
  gameMode: 'infinityPool', honestModeRules: {} as CharacterBuildData['honestModeRules'],
  xpPreset: 'standard', diceOddsMode: 'fair', selectedPath: null, starterAbilities: [],
  selectedPresetId: null, consumables: [],
  homebrewGear: [{ name: 'Dusk Blade', slotType: 'primary_weapon', rarity: 'rare', level: 1, icon: 'Sword', weight: 1, value: 1, description: '', lore: '', properties: [], stats: {}, damage: '1d6' }],
  homebrewConsumables: [{ name: 'Ink Draught', type: 'potion', rarity: 'common', effect: 'x', duration: '1m', description: 'd', icon: 'Flask' }],
  ...over,
});

describe('preparePartySave', () => {
  it('uses the campaign starting gold', () => {
    const r = preparePartySave(build(), { startingGold: 75 }, SESSION);
    expect(r.ok && r.payload.extended.shopGold).toBe(75);
  });

  it('starts with 0 gold when the campaign does not say', () => {
    const r = preparePartySave(build(), {}, SESSION);
    expect(r.ok && r.payload.extended.shopGold).toBe(0);
  });

  it('reuses the same generated ids on retry', () => {
    const a = preparePartySave(build(), null, SESSION, 1000);
    const b = preparePartySave(build(), null, SESSION, 9999);
    if (!a.ok || !b.ok) throw new Error('prep failed');
    expect(a.payload.equipment.slots.primary_weapon?.id).toBe(partyGearId(SESSION, 0));
    expect(b.payload.equipment.slots.primary_weapon?.id).toBe(partyGearId(SESSION, 0));
    expect(a.payload.consumables[0].consumableId).toBe(b.payload.consumables[0].consumableId);
  });

  it('gives a custom consumable the same id in inventory and definition', () => {
    const r = preparePartySave(build(), null, SESSION);
    if (!r.ok) throw new Error('prep failed');
    const c = r.payload.consumables[0];
    expect(c.customConsumable?.id).toBe(c.consumableId);
  });

  it('refuses a build at the wrong starting level', () => {
    const r = preparePartySave(build({ level: 2 }), { startingLevel: 3 }, SESSION);
    expect(r.ok).toBe(false);
  });

  it('starts at full, finite HP', () => {
    const r = preparePartySave(build(), null, SESSION);
    if (!r.ok) throw new Error('prep failed');
    const hp = r.payload.extended.hpState as { current: number; max: number };
    expect(Number.isFinite(hp.max) && hp.max > 0 && hp.current === hp.max).toBe(true);
  });
});
