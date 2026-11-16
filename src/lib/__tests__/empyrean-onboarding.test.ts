import { beforeEach, describe, expect, it } from 'vitest';
import * as P from '../../../supabase/functions/empyrean-onboarding/prompt';
import { CHARACTER_RULES } from '../../../supabase/functions/_shared/creation-rules';
import {
  applyPendingLaunch, buildLoreText, campaignLoreText, canonLoreText, clearLaunch, CLASS_IDS, displayText,
  DRAGON_COLOR_IDS, EVENT_LEVELS, extractOnboardingResult, FOCUS_VALUES, looksLikeBrokenResult, missingCanonGuides,
  ONBOARDING_MAX_LORE_CHARS, parseSuggestions, readLaunch, saveLaunch, setLaunchStage, START_LOCATION_IDS, YEAR_VALUES,
} from '@/lib/empyrean-onboarding';
import { DRAGON_COLORS } from '@/lib/dragonColors';
import { EMPYREAN_CANON_GUIDES, EMPYREAN_CANON_GUIDE_IDS } from '@/lib/empyreanGMGuides';
import { buildEmpyreanStarterAtlas } from '@/lib/empyreanCanon/continentMap';
import { projectActive, validateAtlasGraph } from '@/lib/campaign-atlas';
import { loadEmpyreanDMConfig, loadEmpyreanOpeningScene } from '@/lib/empyreanDMPersona';

const block = (obj: unknown) => 'Here you go.\n```json\n' + JSON.stringify(obj) + '\n```';
const empyrean = { dragonName: 'Vyrmora', dragonColor: 'dark-green', dragonPersonality: 'Patient and dry.', signetType: 'Wardbreaker', yearAtBasgiath: 'first-year', campaignFocus: 'mystery' };
const campaign = { startLocationId: 'basgiath', events: 'normal', openingScene: 'The parapet is slick with rain and the wind wants you dead. Below, the ravine waits. Behind you, someone is counting.' };
const character = {
  name: 'Kaelen Voss', level: 1, portraitIcon: 'Shield', primaryClass: 'rogue', gender: 'male', race: 'human', backstory: 'A scribe\'s son who chose the parapet.',
  abilityScores: { strength: 8, dexterity: 15, constitution: 14, intelligence: 12, wisdom: 13, charisma: 10 }, alignment: { law: 0, good: 2 },
  gameMode: 'infinityPool', honestModeRules: {}, xpPreset: 'standard', diceOddsMode: 'fair', selectedPath: null, starterAbilities: [], selectedPresetId: 'street-runner',
  consumables: ['potion-healing'], homebrewGear: [], homebrewSpells: [], homebrewAbilities: [], homebrewConsumables: [],
};

describe('the phone and the server agree', () => {
  it('on every list of accepted values', () => {
    expect([...DRAGON_COLOR_IDS]).toEqual([...P.DRAGON_COLOR_IDS]);
    expect([...YEAR_VALUES]).toEqual([...P.YEAR_VALUES]);
    expect([...FOCUS_VALUES]).toEqual([...P.FOCUS_VALUES]);
    expect([...START_LOCATION_IDS]).toEqual([...P.START_LOCATION_IDS]);
    expect([...EVENT_LEVELS]).toEqual([...P.EVENT_LEVELS]);
    expect([...DRAGON_COLOR_IDS]).toEqual(DRAGON_COLORS.map(c => c.id));
    for (const id of CLASS_IDS) expect(CHARACTER_RULES).toContain(`${id} (`);
    expect(ONBOARDING_MAX_LORE_CHARS).toBeLessThanOrEqual(P.MAX_LORE_CHARS);
  });
});

describe('the guide\'s instructions', () => {
  const rider = P.buildSystemPrompt('rider', 'LORE-MARKER', '');
  const camp = P.buildSystemPrompt('campaign', 'LORE-MARKER', 'Name: Kaelen');
  it('know every feature the app has', () => {
    for (const feature of ['Camp', 'The Map', 'Fights', 'sparring mat', 'Quest Hub', 'Bond screen', 'Signet Strain', 'Signet Mastery', 'loot review', 'scene pictures', 'dice odds', 'random events', 'death saves']) {
      expect(rider).toContain(feature);
    }
  });
  it('carry the lore and the character rules for a new rider, and the rider for a new campaign', () => {
    expect(rider).toContain('LORE BIBLE');
    expect(rider).toContain('LORE-MARKER');
    expect(rider).toContain(CHARACTER_RULES);
    expect(rider).toContain('"action":"apply_empyrean_rider"');
    expect(camp).not.toContain(CHARACTER_RULES);
    expect(camp).toContain('THE RIDER');
    expect(camp).toContain('Name: Kaelen');
    expect(camp).toContain('"action":"apply_empyrean_campaign"');
  });
  it('keep sent text inside its limits', () => {
    expect(P.clip('x'.repeat(10), 4)).toBe('xxxx');
    expect(P.clip(42, 4)).toBe('');
  });
});

describe('reading the guide\'s build', () => {
  it('reads a new rider and checks every field', () => {
    const r = extractOnboardingResult(block({ action: 'apply_empyrean_rider', data: { ...character, empyrean, campaign } }));
    expect(r?.kind).toBe('rider');
    if (r?.kind !== 'rider') return;
    expect(r.character.name).toBe('Kaelen Voss');
    expect(r.character.homebrewGear).toEqual([]);
    expect(r.empyrean).toEqual(empyrean);
    expect(r.campaign.events).toBe('normal');
  });
  it('fixes values the app does not accept, and keeps cadets at Basgiath', () => {
    const r = extractOnboardingResult(block({ action: 'apply_empyrean_rider', data: {
      ...character, primaryClass: 'paladin', level: 99, abilityScores: { strength: 40 },
      empyrean: { ...empyrean, dragonColor: 'crimson', yearAtBasgiath: 'fifth-year', campaignFocus: 'chaos' },
      campaign: { ...campaign, startLocationId: 'samara', events: 'always' },
    } }));
    if (r?.kind !== 'rider') throw new Error('Expected a rider');
    expect(r.character.primaryClass).toBe('rogue');
    expect(r.character.level).toBe(20);
    expect(r.character.abilityScores.strength).toBe(20);
    expect(r.character.abilityScores.dexterity).toBe(10);
    expect(r.empyrean).toMatchObject({ dragonColor: 'deep-red', yearAtBasgiath: 'first-year', campaignFocus: 'balanced' });
    expect(r.campaign).toMatchObject({ startLocationId: 'basgiath', events: 'rare' });
  });
  it('lets a graduated rider start at an outpost', () => {
    const r = extractOnboardingResult(block({ action: 'apply_empyrean_campaign', data: {
      empyrean: { ...empyrean, yearAtBasgiath: 'graduated rider' }, campaign: { ...campaign, startLocationId: 'Samara' },
    } }));
    expect(r).toMatchObject({ kind: 'campaign', campaign: { startLocationId: 'samara' } });
  });
  it('refuses a build with no dragon name, no opening scene or no rider name', () => {
    expect(extractOnboardingResult(block({ action: 'apply_empyrean_campaign', data: { empyrean: { ...empyrean, dragonName: '' }, campaign } }))).toBeNull();
    expect(extractOnboardingResult(block({ action: 'apply_empyrean_campaign', data: { empyrean, campaign: { ...campaign, openingScene: 'Short.' } } }))).toBeNull();
    expect(extractOnboardingResult(block({ action: 'apply_empyrean_rider', data: { ...character, name: '', empyrean, campaign } }))).toBeNull();
    expect(extractOnboardingResult('No build here. [SUGGESTIONS: "Begin"]')).toBeNull();
  });
  it('notices a build that was cut off', () => {
    const cut = '```json\n{"action":"apply_empyrean_rider","data":{"name":"Kae';
    expect(looksLikeBrokenResult(cut)).toBe(true);
    expect(looksLikeBrokenResult(block({ action: 'apply_empyrean_campaign', data: { empyrean, campaign } }))).toBe(false);
  });
  it('shows the player the words, not the suggestion line or the JSON', () => {
    const reply = 'Welcome, cadet.\n[SUGGESTIONS: "Quick build", "Walk me through it"]';
    expect(parseSuggestions(reply)).toEqual(['Quick build', 'Walk me through it']);
    expect(displayText(reply)).toBe('Welcome, cadet.');
    expect(displayText(block({ action: 'apply_empyrean_campaign', data: { empyrean, campaign } }))).toBe('Here you go.');
    expect(displayText('```json\n{"x":1}\n```')).toMatch(/Begin/);
  });
});

describe('the lore the guide is sent', () => {
  it('is the five canon guides and the starter map\'s places for a new rider', () => {
    const lore = canonLoreText();
    for (const g of EMPYREAN_CANON_GUIDES) expect(lore).toContain(`## ${g.name}`);
    expect(lore).toContain('Places on the app\'s starter map');
    expect(lore).toContain('Basgiath War College');
    expect(lore.length).toBeLessThanOrEqual(ONBOARDING_MAX_LORE_CHARS);
  });
  it('is the campaign\'s own enabled guides for a new campaign, or canon when it has none', () => {
    const mine = [{ id: 'empyrean-lore-canon-rules', name: 'My Rules', content: 'Edited by me.', enabled: true }, { id: 'other', name: 'Not Empyrean', content: 'x', enabled: true }];
    const text = campaignLoreText(mine, EMPYREAN_CANON_GUIDE_IDS);
    expect(text).toContain('Edited by me.');
    expect(text).not.toContain('Not Empyrean');
    expect(campaignLoreText([], EMPYREAN_CANON_GUIDE_IDS)).toBe(canonLoreText());
    expect(buildLoreText([{ name: 'Big', content: 'y'.repeat(200_000) }]).length).toBe(ONBOARDING_MAX_LORE_CHARS);
  });
  it('installs only the canon guides a campaign is missing', () => {
    expect(missingCanonGuides([])).toHaveLength(5);
    expect(missingCanonGuides(EMPYREAN_CANON_GUIDE_IDS)).toEqual([]);
    expect(missingCanonGuides([EMPYREAN_CANON_GUIDE_IDS[0]]).map(g => g.customId)).toEqual(EMPYREAN_CANON_GUIDE_IDS.slice(1));
  });
});

describe('the launch note', () => {
  beforeEach(() => { localStorage.clear(); });
  const setup = { ...empyrean, campaignFocus: 'mystery' as const };
  const camp = { startLocationId: 'basgiath', events: 'normal' as const, openingScene: campaign.openingScene };
  it('waits until the rider is saved, then applies the setup to the saved rider once', () => {
    saveLaunch('Kaelen Voss', setup, camp);
    expect(readLaunch()?.stage).toBe('pending');
    expect(loadEmpyreanDMConfig()).toBeNull(); // nothing written per character yet
    localStorage.setItem('odyssey-active-cloud-save-id', 'save-1'); // the rider's first save
    expect(applyPendingLaunch()).toBe(true);
    expect(loadEmpyreanDMConfig()).toMatchObject({ characterName: 'Kaelen Voss', dragonName: 'Vyrmora', dragonColor: 'dark-green', campaignFocus: 'mystery' });
    expect(loadEmpyreanDMConfig()?.selectedLoreGuides).toEqual(expect.arrayContaining(EMPYREAN_CANON_GUIDE_IDS));
    expect(loadEmpyreanOpeningScene()).toBe(campaign.openingScene);
    expect(localStorage.getItem('odyssey-app-mode::save-1')).toBe('empyrean');
    expect(readLaunch()?.stage).toBe('ready');
    expect(applyPendingLaunch()).toBe(false);
    setLaunchStage('open');
    expect(readLaunch()?.stage).toBe('open');
    clearLaunch();
    expect(readLaunch()).toBeNull();
  });
  it('keeps the bond when a new campaign keeps the same dragon, and resets it for a new dragon', async () => {
    const { loadBondState, saveBondState } = await import('@/lib/dragonBondState');
    const { applyEmpyreanSetup } = await import('@/lib/empyrean-onboarding');
    localStorage.setItem('odyssey-active-cloud-save-id', 'save-2');
    saveBondState({ ...loadBondState(), bond: 64, trust: 40 });
    const keep = { selectedLoreGuides: ['mine'], selectedToneGuides: ['tone-1'], selectedSessionTemplate: null, characterName: 'Kaelen', dragonName: 'Vyrmora', dragonColor: 'onyx', signetType: 'Wards', yearAtBasgiath: 'second-year', campaignFocus: 'combat' as const };
    const cfg = applyEmpyreanSetup(setup, camp, 'Kaelen', keep);
    expect(loadBondState().bond).toBe(64);
    expect(cfg.selectedToneGuides).toEqual(['tone-1']);
    expect(cfg.selectedLoreGuides).toEqual(expect.arrayContaining(['mine', ...EMPYREAN_CANON_GUIDE_IDS]));
    applyEmpyreanSetup({ ...setup, dragonName: 'Ashveil' }, camp, 'Kaelen', keep);
    expect(loadBondState().bond).toBe(15);
  });
  it('expires after two hours', () => {
    saveLaunch('Kaelen Voss', setup, camp, 'pending', Date.now() - 3 * 60 * 60 * 1000);
    expect(readLaunch()).toBeNull();
    expect(applyPendingLaunch()).toBe(false);
  });
});

describe('the starter map\'s starting place', () => {
  const C = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  it('starts a graduated rider at an outpost on the Continent, with Basgiath\'s grounds still inside', () => {
    const built = buildEmpyreanStarterAtlas(C, { startLocationId: 'samara' });
    expect(validateAtlasGraph(built.atlas)).toBeNull();
    expect(built.atlas.activeMapId).toBe(built.rootMapId);
    expect(projectActive(built.atlas).currentLocationId).toBe('samara');
    expect(built.atlas.maps).toHaveLength(2);
  });
  it('ignores a place that is not a starting place', () => {
    const built = buildEmpyreanStarterAtlas(C, { startLocationId: 'aretia' });
    expect(built.atlas.activeMapId).toBe(built.basgiathMapId);
    expect(projectActive(built.atlas).currentLocationId).toBe('courtyard');
  });
});
