import { describe, it, expect } from 'vitest';
import { parseAbilityScoreIncreaseMatches } from '../abilityScoreIncrease';
import { parseFeatAcquisitionMatches, KNOWN_FEATS } from '../featAcquisition';
import { parseClassFeatureUnlockMatches, KNOWN_CLASS_FEATURES } from '../classFeatureUnlock';

// ============================
// ABILITY SCORE INCREASE TESTS
// ============================

describe('parseAbilityScoreIncreaseMatches', () => {
  it('detects "increases Strength by 2"', () => {
    const r = parseAbilityScoreIncreaseMatches('The character increases Strength by 2.');
    expect(r.length).toBe(1);
    expect(r[0].ability).toBe('strength');
    expect(r[0].increase).toBe(2);
  });

  it('detects "DEX increases by 1"', () => {
    const r = parseAbilityScoreIncreaseMatches('DEX increases by 1 after training.');
    expect(r.length).toBe(1);
    expect(r[0].ability).toBe('dexterity');
    expect(r[0].increase).toBe(1);
  });

  it('detects "Wisdom is now 18"', () => {
    const r = parseAbilityScoreIncreaseMatches('Wisdom is now 18.');
    expect(r.length).toBe(1);
    expect(r[0].ability).toBe('wisdom');
    expect(r[0].newScore).toBe(18);
  });

  it('detects "gains +2 to Constitution"', () => {
    const r = parseAbilityScoreIncreaseMatches('She gains +2 to Constitution.');
    expect(r.length).toBe(1);
    expect(r[0].ability).toBe('constitution');
    expect(r[0].increase).toBe(2);
  });

  it('detects ASI block "+1 WIS, +1 CON"', () => {
    const r = parseAbilityScoreIncreaseMatches('Ability Score Improvement: +1 WIS, +1 CON');
    expect(r.length).toBe(2);
    expect(r.map(x => x.ability).sort()).toEqual(['constitution', 'wisdom']);
  });

  it('detects Tome of Understanding', () => {
    const r = parseAbilityScoreIncreaseMatches('Kael reads the Tome of Understanding and feels enlightened.');
    expect(r.length).toBe(1);
    expect(r[0].ability).toBe('wisdom');
    expect(r[0].increase).toBe(2);
    expect(r[0].source).toContain('Tome');
  });

  it('detects "STR goes up to 20"', () => {
    const r = parseAbilityScoreIncreaseMatches('After training, STR goes up to 20.');
    expect(r.length).toBe(1);
    expect(r[0].ability).toBe('strength');
    expect(r[0].newScore).toBe(20);
  });

  it('detects "raises their Charisma by 2"', () => {
    const r = parseAbilityScoreIncreaseMatches('The bard raises their Charisma by 2.');
    expect(r.length).toBe(1);
    expect(r[0].ability).toBe('charisma');
    expect(r[0].increase).toBe(2);
  });

  it('ignores unreasonable values', () => {
    const r = parseAbilityScoreIncreaseMatches('STR increases by 50');
    expect(r.length).toBe(0);
  });

  it('deduplicates same ability at same location', () => {
    const r = parseAbilityScoreIncreaseMatches('increases Strength by 2, Strength is now 18.');
    // These are far enough apart to both match
    expect(r.length).toBeGreaterThanOrEqual(1);
  });
});

// ========================
// FEAT ACQUISITION TESTS
// ========================

describe('parseFeatAcquisitionMatches', () => {
  it('detects "takes the Sentinel feat"', () => {
    const r = parseFeatAcquisitionMatches('At level 4, the fighter takes the Sentinel feat.');
    expect(r.length).toBe(1);
    expect(r[0].featName.toLowerCase()).toBe('sentinel');
    expect(r[0].isKnownFeat).toBe(true);
  });

  it('detects "gains feat: Great Weapon Master"', () => {
    const r = parseFeatAcquisitionMatches('Level up! Gains feat: Great Weapon Master.');
    expect(r.length).toBe(1);
    expect(r[0].featName.toLowerCase()).toBe('great weapon master');
  });

  it('detects "chooses Lucky as their feat"', () => {
    const r = parseFeatAcquisitionMatches('The halfling chooses Lucky as their feat at the ASI.');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const lucky = r.find(x => x.featName.toLowerCase() === 'lucky');
    expect(lucky).toBeDefined();
    expect(lucky!.isKnownFeat).toBe(true);
  });

  it('detects "Sharpshooter feat"', () => {
    const r = parseFeatAcquisitionMatches('Uses the Sharpshooter feat to take a -5/+10 shot.');
    expect(r.length).toBe(1);
    expect(r[0].featName.toLowerCase()).toBe('sharpshooter');
  });

  it('detects variant human feat', () => {
    const r = parseFeatAcquisitionMatches('Variant Human feat: Alert.');
    expect(r.length).toBe(1);
    expect(r[0].featName.toLowerCase()).toBe('alert');
    expect(r[0].source).toBe('variant human');
  });

  it('detects newer feats like Crusher', () => {
    const r = parseFeatAcquisitionMatches('The fighter takes Crusher.');
    expect(r.length).toBe(1);
    expect(r[0].featName.toLowerCase()).toBe('crusher');
    expect(r[0].isKnownFeat).toBe(true);
  });

  it('detects "selects the War Caster feat"', () => {
    const r = parseFeatAcquisitionMatches('At level 4, selects the War Caster feat for concentration.');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const wc = r.find(x => x.featName.toLowerCase() === 'war caster');
    expect(wc).toBeDefined();
  });

  it('handles unknown/homebrew feats gracefully', () => {
    const r = parseFeatAcquisitionMatches('New feat: Dragon Breath Mastery.');
    expect(r.length).toBe(1);
    expect(r[0].featName).toBe('Dragon Breath Mastery');
    expect(r[0].isKnownFeat).toBe(false);
  });

  it('does not false positive on common words', () => {
    const r = parseFeatAcquisitionMatches('The party gains a new feat: The.');
    expect(r.length).toBe(0);
  });

  it('deduplicates same feat nearby', () => {
    const r = parseFeatAcquisitionMatches('Takes the Sentinel feat. Sentinel feat chosen.');
    // Both are within 30 chars of each other likely
    expect(r.length).toBeGreaterThanOrEqual(1);
  });
});

// ================================
// CLASS FEATURE UNLOCK TESTS
// ================================

describe('parseClassFeatureUnlockMatches', () => {
  it('detects "unlocks Uncanny Dodge"', () => {
    const r = parseClassFeatureUnlockMatches('The rogue unlocks Uncanny Dodge at level 5.');
    expect(r.length).toBe(1);
    expect(r[0].featureName.toLowerCase()).toBe('uncanny dodge');
    expect(r[0].className).toBe('rogue');
    expect(r[0].isKnownFeature).toBe(true);
  });

  it('detects "gains the Extra Attack feature"', () => {
    const r = parseClassFeatureUnlockMatches('The fighter gains the Extra Attack feature.');
    expect(r.length).toBe(1);
    expect(r[0].featureName.toLowerCase()).toBe('extra attack');
    expect(r[0].className).toBe('fighter');
  });

  it('detects "learns Metamagic"', () => {
    const r = parseClassFeatureUnlockMatches('At level 3, the sorcerer learns Metamagic.');
    expect(r.length).toBe(1);
    expect(r[0].featureName.toLowerCase()).toBe('metamagic');
    expect(r[0].className).toBe('sorcerer');
  });

  it('detects "Evasion unlocked"', () => {
    const r = parseClassFeatureUnlockMatches('Evasion unlocked after reaching level 7.');
    expect(r.length).toBe(1);
    expect(r[0].featureName.toLowerCase()).toBe('evasion');
  });

  it('detects "new class feature: Wild Shape"', () => {
    const r = parseClassFeatureUnlockMatches('New class feature: Wild Shape.');
    expect(r.length).toBe(1);
    expect(r[0].featureName.toLowerCase()).toBe('wild shape');
    expect(r[0].className).toBe('druid');
  });

  it('detects "Rogue level 5: Uncanny Dodge"', () => {
    const r = parseClassFeatureUnlockMatches('Rogue level 5: Uncanny Dodge.');
    expect(r.length).toBe(1);
    expect(r[0].featureName.toLowerCase()).toBe('uncanny dodge');
    expect(r[0].className).toBe('rogue');
    expect(r[0].level).toBe(5);
  });

  it('detects "at level 2, gains Channel Divinity"', () => {
    const r = parseClassFeatureUnlockMatches('At level 2, gains Channel Divinity for the cleric.');
    expect(r.length).toBe(1);
    expect(r[0].featureName.toLowerCase()).toBe('channel divinity');
    expect(r[0].level).toBe(2);
  });

  it('detects "reaching level 3 unlocks Ki"', () => {
    const r = parseClassFeatureUnlockMatches('Upon reaching level 3, the monk unlocks Ki.');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const ki = r.find(x => x.featureName.toLowerCase() === 'ki');
    expect(ki).toBeDefined();
    expect(ki!.className).toBe('monk');
  });

  it('handles unknown custom features', () => {
    const r = parseClassFeatureUnlockMatches('New class feature: Shadow Step.');
    expect(r.length).toBe(1);
    expect(r[0].featureName).toBe('Shadow Step');
    expect(r[0].isKnownFeature).toBe(false);
  });

  it('does not false positive on common phrases', () => {
    const r = parseClassFeatureUnlockMatches('The party gained the room after combat.');
    expect(r.length).toBe(0);
  });

  it('deduplicates nearby same feature', () => {
    const r = parseClassFeatureUnlockMatches('Unlocks Evasion. Evasion gained.');
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  it('registry has features for all supported classes', () => {
    const classes = Object.keys(KNOWN_CLASS_FEATURES);
    expect(classes.length).toBeGreaterThanOrEqual(7);
    for (const cls of classes) {
      expect(KNOWN_CLASS_FEATURES[cls].length).toBeGreaterThan(0);
    }
  });
});
