import { describe, expect, it } from 'vitest';

import {

  GUIDES_KEY, MAX_GUIDE_CHARS, MAX_GUIDED_QUESTS,

  activeQuestGuides, buildGuidePrompt, buildQuestGuidesBlock, finishedGuideKeys, guideSlotFree, guideStages,

  keepsObjectives, normalizeQuestGuides, parseGuideReply, parseGuideSteps, progressFromTags, readQuestTags,

  storedQuestGuides, stripQuestTags, type QuestGuide,

} from '@/lib/empyrean-quest-guide';

import { normalizeQuest, normalizeQuestMap, type Quest } from '@/lib/quests';



const offered: Quest = normalizeQuest('the_missing_ledger', {

  status: 'offered', title: 'The Missing Ledger', challengeRating: 'moderate', description: 'A scribe begs for help.',

  stages: [{ id: 'a', text: 'Find the scribe', done: false }, { id: 'b', text: 'Recover the ledger', done: false }],

});

const prose = 'THE TRUTH\n' + 'The ledger was never stolen. '.repeat(80);

const reply = [

  '===STEPS===',

  '1. Meet the scribe in the Archives',

  '2) Search the quartermaster\'s stores',

  '- Follow the trail to the flight field',

  '4. Confront whoever holds the ledger',

  '===COMPLETE WHEN===',

  'The ledger is back in the Archives or its secret is public.',

  '===FAILED WHEN===',

  'The ledger is destroyed.',

  '===GUIDE===',

  prose,

].join('\n');

const guide = (key: string, at = '2026-11-19T10:00:00.000Z'): QuestGuide => ({

  questKey: key, title: key, steps: ['Step one here', 'Second thing', 'Third thing'], completeWhen: 'All done.', failWhen: 'All lost.', text: 'Secret truth. '.repeat(100), model: 'm', at,

});



describe('reading the writer\'s reply', () => {

  it('reads steps, tests and the guide', () => {

    const g = parseGuideReply(reply, offered, 'openai/gpt-6-astra', 'now');
    if (!g) throw new Error('Expected a usable guide');

    expect(g.steps).toEqual(['Meet the scribe in the Archives', "Search the quartermaster's stores", 'Follow the trail to the flight field', 'Confront whoever holds the ledger']);

    expect(g.completeWhen).toBe('The ledger is back in the Archives or its secret is public.');

    expect(g.failWhen).toBe('The ledger is destroyed.');

    expect(g.text.startsWith('THE TRUTH')).toBe(true);

    expect(g).toMatchObject({ questKey: 'the_missing_ledger', title: 'The Missing Ledger', model: 'openai/gpt-6-astra' });

  });

  it('refuses a reply with no guide, a short guide or too few steps', () => {

    expect(parseGuideReply('Sorry, I cannot.', offered, 'm', 'now')).toBeNull();

    expect(parseGuideReply(reply.replace(prose, 'Too short.'), offered, 'm', 'now')).toBeNull();

    expect(parseGuideReply(`===STEPS===\n1. Only one\n===GUIDE===\n${prose}`, offered, 'm', 'now')).toBeNull();

  });

  it('drops repeated steps and steps that contain one another, and keeps at most six', () => {

    expect(parseGuideSteps('1. Find the key\n2. find the key\n3. Find the key in the vault\n4. Open the door')).toEqual(['Find the key', 'Open the door']);

    expect(parseGuideSteps(Array.from({ length: 9 }, (_, i) => `${i + 1}. Distinct objective number ${'x'.repeat(i + 1)}y${i}`).join('\n'))).toHaveLength(6);

  });

  it('cuts an overlong guide at a paragraph end', () => {

    const long = Array.from({ length: 400 }, (_, i) => `Paragraph ${i}. ${'word '.repeat(30)}`).join('\n\n');

    const g = parseGuideReply(reply.replace(prose, long), offered, 'm', 'now');
    if (!g) throw new Error('Expected a usable guide');

    expect(g.text.length).toBeLessThanOrEqual(MAX_GUIDE_CHARS);

    expect(g.text.endsWith('word')).toBe(true);

  });

  it('a quest already under way keeps its own objectives whatever the writer lists', () => {

    const active: Quest = { ...offered, status: 'active', stages: [{ id: 'a', text: 'Find the scribe', done: true }, { id: 'b', text: 'Recover the ledger', done: false }] };

    expect(keepsObjectives(active)).toBe(true);

    expect(keepsObjectives(offered)).toBe(false);

    expect(parseGuideReply(reply, active, 'm', 'now')?.steps).toEqual(['Find the scribe', 'Recover the ledger']);

    expect(buildGuidePrompt(active, { characterName: 'Kylar', otherQuests: [] }).system).toContain('objectives are fixed');

    expect(buildGuidePrompt(active, { characterName: 'Kylar', otherQuests: [] }).user).toContain('1. Find the scribe [done]');

  });

});



describe('the writer\'s instruction sheet', () => {

  it('carries the quest, the story and the other quests', () => {

    const p = buildGuidePrompt(offered, { characterName: 'Kylar', dragonName: 'Ancalagon', campaignSummary: 'He crossed the parapet.', recentStory: 'DM: The bell rings.', worldFacts: ['Dain is dead'], otherQuests: ['Survive Basgiath'] });

    expect(p.system).toContain('===GUIDE===');

    expect(p.user).toContain('Title: The Missing Ledger');

    expect(p.user).toContain('He crossed the parapet.');

    expect(p.user).toContain('- Dain is dead');

    expect(p.user).toContain('Survive Basgiath');

    expect(p.user).toContain('Bonded dragon: Ancalagon.');

  });

});



describe('storage', () => {

  it('round-trips through quest_flags and is not read as a quest', () => {

    const stored = storedQuestGuides({ a: guide('a') });

    expect(stored.status).toBe('unknown');

    expect(normalizeQuestGuides(stored).a.steps).toHaveLength(3);

    expect(normalizeQuestMap({ [GUIDES_KEY]: stored } as any)).toEqual([]);

    expect(normalizeQuestGuides(null)).toEqual({});

    expect(normalizeQuestGuides({ guides: { bad: { text: '', steps: [] } } })).toEqual({});

  });

  it('counts only active quests toward the limit and names finished ones for removal', () => {

    const quests = ['a', 'b', 'c', 'd'].map((k, i) => normalizeQuest(k, { status: i === 3 ? 'completed' : 'active', title: k }));

    const guides = { a: guide('a'), b: guide('b'), d: guide('d') };

    expect(activeQuestGuides(guides, quests).map(g => g.questKey)).toEqual(['a', 'b']);

    expect(guideSlotFree(guides, quests)).toBe(true);

    expect(guideSlotFree({ ...guides, c: guide('c') }, quests)).toBe(false);

    expect(MAX_GUIDED_QUESTS).toBe(3);

    expect(finishedGuideKeys(guides, quests)).toEqual(['d']);

  });

  it('makes stable objectives from a guide', () => {

    expect(guideStages('q', guide('q'))).toEqual([

      { id: 'q-g1', text: 'Step one here', done: false }, { id: 'q-g2', text: 'Second thing', done: false }, { id: 'q-g3', text: 'Third thing', done: false },

    ]);

  });

});



describe('what the DM is told', () => {

  const flags = (status: string) => ({

    q: { status, title: 'The Missing Ledger', stages: [{ id: 'q-g1', text: 'Step one here', done: true }, { id: 'q-g2', text: 'Second thing', done: false }] },

    [GUIDES_KEY]: storedQuestGuides({ q: guide('q') }),

  });

  it('sends an active quest\'s guide with its steps as they stand', () => {

    const block = buildQuestGuidesBlock(flags('active'));

    expect(block).toContain('--- QUEST: The Missing Ledger (quest key: q) ---');

    expect(block).toContain('1. [done] Step one here');

    expect(block).toContain('2. Second thing');

    expect(block).toContain('<!--QUEST_STEP:quest_key:step_number-->');

    expect(block).toContain('Secret truth.');

  });

  it('sends nothing for a quest that is not active, or with no guides', () => {

    for (const s of ['offered', 'completed', 'failed']) expect(buildQuestGuidesBlock(flags(s))).toBe('');

    expect(buildQuestGuidesBlock({ q: { status: 'active', title: 'x' } })).toBe('');

    expect(buildQuestGuidesBlock(null)).toBe('');

  });

});



describe('the DM\'s tags', () => {

  const quests = [normalizeQuest('q', { status: 'active', title: 'Q', stages: [{ id: 'q-g1', text: 'Step one here', done: true }, { id: 'q-g2', text: 'Second thing', done: false }, { id: 'q-g3', text: 'Third thing', done: false }] })];

  const guides = { q: guide('q') };

  it('reads step, done and failed tags, forgiving spaces and case', () => {

    expect(readQuestTags('Story.\n<!--QUEST_STEP:q:2-->\n<!-- quest_step : Q : 3 -->\n<!--QUEST_DONE:q-->\n<!--QUEST_FAILED:other_one-->')).toEqual([

      { kind: 'step', questKey: 'q', step: 2 }, { kind: 'step', questKey: 'q', step: 3 }, { kind: 'done', questKey: 'q' }, { kind: 'failed', questKey: 'other_one' },

    ]);

    expect(readQuestTags('<!--QUEST_STEP:q:0--><!--QUEST_STEP:q:9--><!--QUEST_STEP:q-->')).toEqual([]);

  });

  it('hides tags, a half-typed one at the end too', () => {

    expect(stripQuestTags('The door opens.\n<!--QUEST_STEP:q:2-->')).toBe('The door opens.\n');

    expect(stripQuestTags('The door opens.\n<!--QUEST_STEP:q:2')).toBe('The door opens.\n');

    expect(stripQuestTags('The door opens.\n<!--QUEST_ST')).toBe('The door opens.\n');

    expect(stripQuestTags('Keep <!--BOND_GROWTH:2--> this')).toBe('Keep <!--BOND_GROWTH:2--> this');

  });

  it('turns tags into progress for active guided quests only', () => {

    expect(progressFromTags(readQuestTags('<!--QUEST_STEP:q:2--><!--QUEST_STEP:q:2--><!--QUEST_STEP:q:1--><!--QUEST_STEP:q:5-->'), guides, quests))

      .toEqual([{ key: 'q', stages_completed: ['Second thing'], status: null }]);

    expect(progressFromTags(readQuestTags('<!--QUEST_FAILED:q--><!--QUEST_DONE:q-->'), guides, quests)).toEqual([{ key: 'q', stages_completed: [], status: 'completed' }]);

    expect(progressFromTags(readQuestTags('<!--QUEST_FAILED:q-->'), guides, quests)).toEqual([{ key: 'q', stages_completed: [], status: 'failed' }]);

    expect(progressFromTags(readQuestTags('<!--QUEST_DONE:q-->'), {}, quests)).toEqual([]);

    expect(progressFromTags(readQuestTags('<!--QUEST_DONE:q-->'), guides, [{ ...quests[0], status: 'completed' }])).toEqual([]);

    expect(progressFromTags(readQuestTags('<!--QUEST_DONE:nope-->'), guides, quests)).toEqual([]);

  });

});
