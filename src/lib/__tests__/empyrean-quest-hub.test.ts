import { describe, it, expect } from 'vitest';
import {
  HUB_CATEGORIES,
  HUB_KEY,
  allowedChallenges,
  buildSeekPrompt,
  classifyQuest,
  currentQuest,
  emptyHubState,
  hubPayout,
  hubUnlocks,
  normalizeHubState,
  normalizePendingPayouts,
  questRewards,
  standingFactsLine,
  storedPendingPayouts,
  parseSeekReply,
  planQuestUpdates,
  questCategory,
  rankInfo,
  signetStrainCeiling,
} from '@/lib/empyrean-quest-hub';
import { normalizeQuest, normalizeQuestMap, toStored, type Quest } from '@/lib/quests';

const active = (over: Partial<Quest> & { key: string }): Quest => ({
  status: 'active',
  title: over.key,
  challengeRating: 'moderate',
  stages: [
    { id: 's0', text: 'Find the map', done: false },
    { id: 's1', text: 'Return it to the professor', done: false },
  ],
  ...over,
});

describe('categories and sorting', () => {
  it('has 8 categories with 5 ranks each', () => {
    expect(HUB_CATEGORIES).toHaveLength(8);
    for (const c of HUB_CATEGORIES) expect(c.ranks).toHaveLength(5);
  });

  it('sorts by words, title counting double, and falls back to Missions', () => {
    expect(classifyQuest('A flight over the Vale', 'Your dragon wants to hunt')).toBe('dragon');
    expect(classifyQuest('Exam in the Archives')).toBe('academics');
    expect(classifyQuest('Contraband in the barracks', 'Someone is smuggling secrets')).toBe('intrigue');
    expect(classifyQuest('Something odd')).toBe('missions');
  });

  it('keeps a valid stored category over the word sort', () => {
    const q = normalizeQuest('x', { status: 'active', title: 'A flight at dawn', category: 'personal' });
    expect(q.category).toBe('personal');
    expect(questCategory(q)).toBe('personal');
    expect(questCategory(normalizeQuest('y', { status: 'active', title: 'A flight at dawn', category: 'nonsense' }))).toBe('dragon');
  });

  it('the hub key is reserved, so other boards never list it as a quest', () => {
    expect(normalizeQuestMap({ [HUB_KEY]: { points: { dragon: 4 } }, real: { status: 'active' } }).map(q => q.key)).toEqual(['real']);
  });

  it('category survives normalize and toStored (other boards ignore it)', () => {
    const stored = toStored(normalizeQuest('k', { status: 'offered', title: 'T', category: 'signet' }));
    expect(stored.category).toBe('signet');
  });
});

describe('ranks', () => {
  it('climbs at 3, 8, 15 and 25 points', () => {
    expect(rankInfo('academics', 0)).toMatchObject({ index: 0, name: 'Novice', next: 3, progress: 0 });
    expect(rankInfo('academics', 2).progress).toBe(67);
    expect(rankInfo('academics', 3)).toMatchObject({ index: 1, name: 'Student' });
    expect(rankInfo('academics', 8).index).toBe(2);
    expect(rankInfo('academics', 15).index).toBe(3);
    expect(rankInfo('academics', 40)).toMatchObject({ index: 4, name: 'Sage', next: null, progress: 100 });
  });

  it('unlocks harder work with rank', () => {
    expect(allowedChallenges(0)).toEqual(['easy', 'moderate']);
    expect(allowedChallenges(2)).toEqual(['easy', 'moderate', 'hard']);
    expect(allowedChallenges(4)).toEqual(['moderate', 'hard', 'deadly']);
  });

  it('signet rank raises the strain ceiling to 9 at rank 3 and 10 at rank 5', () => {
    expect(signetStrainCeiling(0)).toBe(8);
    expect(signetStrainCeiling(7)).toBe(8);
    expect(signetStrainCeiling(8)).toBe(9);
    expect(signetStrainCeiling(24)).toBe(9);
    expect(signetStrainCeiling(25)).toBe(10);
    expect(signetStrainCeiling(999)).toBe(10);
  });

  it('normalizes stored standing and ignores junk', () => {
    expect(normalizeHubState(null)).toEqual(emptyHubState());
    const s = normalizeHubState({ points: { dragon: '7', signet: -4, bogus: 9, squad: 2.9 } });
    expect(s.points.dragon).toBe(7);
    expect(s.points.signet).toBe(0);
    expect(s.points.squad).toBe(2);
    expect('bogus' in s.points).toBe(false);
  });
});

describe('planQuestUpdates', () => {
  it('adds new offers with a category and never re-offers', () => {
    const plan = planQuestUpdates([active({ key: 'old_quest' })], emptyHubState(), [
      { key: 'old_quest', title: 'Old quest', stages: ['a', 'b'] },
      { title: 'Sparring on the mat', description: 'A rival challenges you', stages: ['Accept', 'Win'] },
      { title: 'Dawn flight', category: 'dragon', stages: ['Saddle up', 'Fly'] },
    ], []);
    expect(plan.offered.map(q => [q.key, q.category, q.status])).toEqual([
      ['sparring_on_the_mat', 'combat', 'offered'],
      ['dawn_flight', 'dragon', 'offered'],
    ]);
    expect(plan.upserts).toHaveLength(2);
    expect(plan.payouts).toHaveLength(0);
  });

  it('pays a finished quest once: XP, gold, standing and a rank-up', () => {
    const hub = emptyHubState();
    hub.points.academics = 2;
    const q = active({ key: 'study', category: 'academics', xpReward: 120, goldReward: 20 });
    const plan = planQuestUpdates([q], hub, [], [{ key: 'study', stages_completed: ['Find the map', 'Return it to the professor'], status: null }]);
    expect(plan.payouts).toEqual([expect.objectContaining({ category: 'academics', xp: 120, gold: 20, points: 2 })]);
    expect(plan.hub?.points.academics).toBe(4);
    expect(plan.rankUps).toEqual([{ category: 'academics', from: 'Novice', to: 'Student' }]);
    const stored = plan.upserts[0].stored as { rewardsPaid?: boolean; status?: string };
    expect(stored.status).toBe('completed');
    expect(stored.rewardsPaid).toBe(true);
    // Already paid: completing again pays nothing.
    const paid = normalizeQuest('study', { ...plan.upserts[0].stored, status: 'active' });
    const again = planQuestUpdates([paid], plan.hub!, [], [{ key: 'study', status: 'completed' }]);
    expect(again.payouts).toHaveLength(0);
    expect(again.hub).toBeNull();
  });

  it('dragon quests give bond and trust by challenge; a failed one costs trust', () => {
    const win = planQuestUpdates([active({ key: 'hunt', category: 'dragon', challengeRating: 'hard' })], emptyHubState(), [], [{ key: 'hunt', status: 'completed' }]);
    expect([win.bondDelta, win.trustDelta]).toEqual([5, 4]);
    expect(win.hub?.points.dragon).toBe(3);
    const lose = planQuestUpdates([active({ key: 'hunt', category: 'dragon' })], emptyHubState(), [], [{ key: 'hunt', status: 'failed' }]);
    expect([lose.bondDelta, lose.trustDelta]).toEqual([0, -2]);
    expect(lose.failed).toHaveLength(1);
    expect(lose.hub).toBeNull();
  });

  it('signet quests clear strain', () => {
    const plan = planQuestUpdates([active({ key: 'focus', category: 'signet' })], emptyHubState(), [], [{ key: 'focus', status: 'completed' }]);
    expect(plan.strainRelief).toBe(2);
  });

  it('ignores progress on quests that are not active', () => {
    const offered: Quest = { ...active({ key: 'later' }), status: 'offered' };
    const plan = planQuestUpdates([offered], emptyHubState(), [], [{ key: 'later', status: 'completed' }, { key: 'missing', status: 'completed' }]);
    expect(plan.upserts).toHaveLength(0);
  });

  it('a stage tick keeps the quest active and gives its category to an old uncategorized quest', () => {
    const q = active({ key: 'flight_drill', title: 'Flight drill with your dragon' });
    const plan = planQuestUpdates([q], emptyHubState(), [], [{ key: 'flight_drill', stages_completed: ['Find the map'] }]);
    const stored = plan.upserts[0].stored as { status?: string; category?: string };
    expect(stored.status).toBe('active');
    expect(stored.category).toBe('dragon');
    expect(plan.payouts).toHaveLength(0);
  });
});

describe('seek a quest', () => {
  it('builds a prompt that names the category, rank and allowed challenges', () => {
    const { system, user } = buildSeekPrompt('signet', 0, { characterName: 'Vi', dragonName: 'Tairn', existingTitles: ['Old one'] });
    expect(system).toContain('Signet');
    expect(system).toContain('"Spark"');
    expect(system).toContain('"easy", "moderate"');
    expect(system).not.toContain('"deadly"');
    expect(user).toContain('Tairn');
    expect(user).toContain('Old one');
  });

  it('parses a fenced reply, forces the category, clamps challenge and rewards, drops repeats', () => {
    const reply = 'Here you go:\n```json\n[' +
      '{"title":"Hold the line","description":"d","challenge_rating":"deadly","stages":["a","b","c"],"xp_reward":99999,"gold_reward":-5},' +
      '{"title":"Old one","challenge_rating":"easy","stages":["a","b"]},' +
      '{"title":"One stage only","challenge_rating":"easy","stages":["a"]},' +
      '{"title":"Steady breath","challenge_rating":"weird","stages":["a","b"],"xp_reward":"80"}' +
      ']\n```';
    const offers = parseSeekReply(reply, 'signet', 0, ['old one']);
    expect(offers.map(o => [o.title, o.category, o.challenge_rating])).toEqual([
      ['Hold the line', 'signet', 'moderate'],
      ['Steady breath', 'signet', 'easy'],
    ]);
    expect(offers[0].xp_reward).toBe(300);
    expect(offers[0].gold_reward).toBe(38);
    expect(offers[1].xp_reward).toBe(80);
  });

  it('returns nothing for a reply without a JSON array', () => {
    expect(parseSeekReply('Sorry, I cannot.', 'squad', 0, [])).toEqual([]);
    expect(parseSeekReply('[not json', 'squad', 0, [])).toEqual([]);
  });
});

describe('currentQuest', () => {
  it('prefers an active main quest, then the most recent active one', () => {
    const a = active({ key: 'a', updated_at: '2026-01-02' });
    const b = active({ key: 'b', updated_at: '2026-01-03' });
    const m = active({ key: 'm', questType: 'main', updated_at: '2026-01-01' });
    expect(currentQuest([a, b])?.key).toBe('b');
    expect(currentQuest([a, b, m])?.key).toBe('m');
    expect(currentQuest([{ ...a, status: 'offered' }])).toBeNull();
  });
});

describe('quest rewards: what the card shows is what the server pays', () => {
  it("keeps a listed reward inside its challenge's range; a missing one uses the middle", () => {
    expect(questRewards(active({ key: 'a', xpReward: 500, goldReward: 30 }))).toEqual({ xp: 300, gold: 30 });
    expect(questRewards(active({ key: 'b', challengeRating: 'deadly', xpReward: 100 }))).toEqual({ xp: 500, gold: 250 });
    expect(questRewards(active({ key: 'c', challengeRating: undefined }))).toEqual({ xp: 200, gold: 38 });
  });
  it('a DM offer is stored with the real reward, and the payout and its log line use it', () => {
    const offered = planQuestUpdates([], emptyHubState(), [{ title: 'Survive Basgiath', stages: ['Day one'], xp_reward: 500, challenge_rating: 'moderate' } as any], []);
    expect(offered.offered[0]).toMatchObject({ xpReward: 300 });
    // A quest stored before this change (500 XP listed) still pays and logs 300.
    const done = planQuestUpdates([active({ key: 'old', xpReward: 500, goldReward: 15 })], emptyHubState(), [], [{ key: 'old', status: 'completed' }]);
    expect(done.payouts[0]).toMatchObject({ xp: 300, gold: 15 });
    const stored = done.upserts[0].stored as { xpReward: number; events: Array<{ text: string }> };
    expect(stored.xpReward).toBe(300);
    expect(stored.events.at(-1)?.text).toContain('300 XP, 15 gold');
    expect(hubPayout(normalizeQuest('old', stored))).toEqual({ questKey: 'old', challenge: 'moderate', title: 'old', xp: 300, gold: 15 });
  });
  it('keeps unanswered payouts (clamped, one per quest) under a reserved key', () => {
    const list = normalizePendingPayouts({ pending: [
      { questKey: 'a', challenge: 'hard', title: 'A', xp: 9999, gold: 50 },
      { questKey: 'a', challenge: 'hard', title: 'dup', xp: 300, gold: 50 },
      { questKey: '', xp: 10 },
      { questKey: 'b', challenge: 'nope', xp: 150, gold: 20 },
    ] });
    expect(list).toEqual([
      { questKey: 'a', challenge: 'hard', title: 'A', xp: 600, gold: 50 },
      { questKey: 'b', challenge: 'moderate', title: 'b', xp: 150, gold: 20 },
    ]);
    expect(normalizePendingPayouts(storedPendingPayouts(list))).toEqual(list);
    expect(normalizeQuestMap({ __empyrean_quest_payouts__: storedPendingPayouts(list) })).toEqual([]);
  });
});

describe('progress unlocks and standing', () => {
  it('lists the Signet strain raises always, and harder offers only where standing has been earned', () => {
    const fresh = hubUnlocks(emptyHubState());
    expect(fresh.map(u => [u.id, u.unlocked])).toEqual([['q-signet-3', false], ['q-signet-5', false]]);
    const hub = normalizeHubState({ points: { signet: 9, combat: 2, missions: 16 } });
    const list = hubUnlocks(hub);
    expect(list.find(u => u.id === 'q-signet-3')?.unlocked).toBe(true);
    expect(list.find(u => u.id === 'q-signet-5')?.unlocked).toBe(false);
    expect(list.filter(u => u.id.startsWith('q-combat')).map(u => [u.id, u.unlocked])).toEqual([['q-combat-hard', false]]);
    expect(list.filter(u => u.id.startsWith('q-missions')).map(u => [u.id, u.unlocked])).toEqual([['q-missions-hard', true], ['q-missions-deadly', true]]);
    expect(list.some(u => u.id.startsWith('q-academics'))).toBe(false);
  });
  it('tells the DM the standing the rider has earned, and nothing before any', () => {
    expect(standingFactsLine(emptyHubState())).toBe('');
    const line = standingFactsLine(normalizeHubState({ points: { combat: 8, personal: 1 } }));
    expect(line).toContain('Combat & Training: Duelist (rank 3 of 5)');
    expect(line).toContain('Personal: Stranger (rank 1 of 5)');
    expect(line).not.toContain('Academics');
  });
});
