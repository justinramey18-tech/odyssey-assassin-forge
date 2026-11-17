import { describe, expect, it } from 'vitest';
import { arenaBackdrop, castPortraitForName, dragonPortrait, foePortrait, DRAGON_PORTRAITS } from '@/lib/empyreanArt';

describe('empyrean art lookups', () => {
  it('every dragon color has its own portrait', () => {
    expect(Object.keys(DRAGON_PORTRAITS)).toHaveLength(9);
    expect(dragonPortrait('silver')).toBe(DRAGON_PORTRAITS.silver);
    expect(dragonPortrait(undefined)).toBe(DRAGON_PORTRAITS.onyx);
  });
  it('named cast foes use their cast portrait before the creature picture', () => {
    expect(castPortraitForName('Xaden Riorson')).toBeTruthy();
    expect(foePortrait('cadet', 'Xaden')).toBe(castPortraitForName('Xaden Riorson'));
    expect(foePortrait('soldier', 'Nobody Special')).toBeUndefined();
    expect(foePortrait('venin', 'A dark wielder')).toBeTruthy();
  });
  it('sparring mats and real ground fights get different backdrops', () => {
    expect(arenaBackdrop('mat', false)).not.toBe(arenaBackdrop('ground', true));
    expect(arenaBackdrop('ground', true)).not.toBe(arenaBackdrop('ground', false));
  });
});

import { signetEmblem } from '@/lib/empyreanArt';
describe('signetEmblem', () => {
  it('matches the five signet powers and nothing for unknown', () => {
    const names = ['Lightning Wielder', 'Shadow Wielder', 'Ice', 'Mental Shield', 'Distance Wielder'];
    const got = names.map(signetEmblem);
    expect(got.every(Boolean)).toBe(true);
    expect(new Set(got).size).toBe(5);
    expect(signetEmblem('')).toBeUndefined();
    expect(signetEmblem('Plant growth')).toBeUndefined();
  });
});
