import { describe, expect, it } from 'vitest';
import * as W from '../../../supabase/functions/empyrean-rules/web';
import * as R from '../../../supabase/functions/empyrean-rules/rules';

const OLD = '2026-11-15T00:00:00.000Z';
const NEW = '2027-01-05T00:00:00.000Z';
const withXp = (xp: number, nodes: string[] = []) => W.normalizeLedger({ web: { nodes, camps: { c1: xp }, grant: 0 } });
const rand = () => 0.5;

describe('progression web: the ledger', () => {
  it('reads an empty or broken rider row as an empty ledger', () => {
    for (const raw of [undefined, null, {}, { web: 7 }, { web: { nodes: 'x', camps: [] } }, 'junk']) {
      const l = W.normalizeLedger(raw, NEW);
      expect(l).toEqual({ v: 1, nodes: [], spent: 0, camps: {}, grant: 0 });
      expect(W.xpBalance(l)).toBe(0);
    }
  });

  it('gives riders from before the cutoff a one-time grant worth one small node, and nobody else', () => {
    expect(W.normalizeLedger({}, OLD).grant).toBe(W.NODE_COST.small);
    expect(W.normalizeLedger({}, NEW).grant).toBe(0);
    expect(W.normalizeLedger({}, undefined).grant).toBe(0);
    // Once saved, the stored grant is the grant: it is never given twice or taken back.
    expect(W.normalizeLedger({ web: { grant: 0 } }, OLD).grant).toBe(0);
    expect(W.normalizeLedger({ web: { grant: 150 } }, NEW).grant).toBe(150);
  });

  it('drops unknown and repeated nodes, and works out what was spent from the nodes owned', () => {
    const l = W.normalizeLedger({ web: { nodes: ['channel-1', 'channel-1', 'nope', 'channel-2'], spent: 999999, camps: { c1: 500 } } }, NEW);
    expect(l.nodes).toEqual(['channel-1', 'channel-2']);
    expect(l.spent).toBe(300);
    expect(W.xpBalance(l)).toBe(200);
  });

  it('keeps every other key of the rider data when the ledger is saved', () => {
    const l = withXp(10);
    expect(W.withLedger({ other: { a: 1 } }, l)).toEqual({ other: { a: 1 }, web: l });
    expect(W.withLedger(null, l)).toEqual({ web: l });
  });

  it('counts a campaign up, never down, and keeps a deleted campaign', () => {
    let l = W.normalizeLedger({}, NEW);
    expect(W.creditCampaign(l, 'c1', 0)).toBe(l);
    l = W.creditCampaign(l, 'c1', 75);
    expect(W.xpEarned(l)).toBe(75);
    expect(W.creditCampaign(l, 'c1', 75)).toBe(l);
    expect(W.creditCampaign(l, 'c1', 20)).toBe(l);
    l = W.creditCampaign(l, 'c2', 40);
    l = W.creditCampaign(l, 'c1', 100);
    expect(l.camps).toEqual({ c1: 100, c2: 40 });
    expect(W.xpEarned(l)).toBe(140);
  });
});

describe('progression web: buying', () => {
  it('buys the first Channel node for 150 XP and refuses a second without the XP', () => {
    const r = W.buyNode(withXp(200), 'channel-1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ledger.nodes).toEqual(['channel-1']);
    expect(r.ledger.spent).toBe(150);
    expect(W.xpBalance(r.ledger)).toBe(50);
    const again = W.buyNode(r.ledger, 'channel-2');
    expect(again).toEqual({ ok: false, error: 'You need 100 more XP.' });
  });

  it('refuses a node out of order, a node already owned, and anything not in the web', () => {
    expect(W.buyNode(withXp(5000), 'channel-3')).toEqual({ ok: false, error: 'Unlock Second Reserve first.' });
    expect(W.buyNode(withXp(5000, ['channel-1']), 'channel-1')).toEqual({ ok: false, error: 'You already have that upgrade.' });
    expect(W.buyNode(withXp(5000), 'saddle-1').ok).toBe(false);
    expect(W.buyNode(withXp(5000), '').ok).toBe(false);
  });

  it('a whole spoke costs 2,250 XP and can be bought in order', () => {
    let l = withXp(2250);
    for (let i = 1; i <= 6; i++) {
      const r = W.buyNode(l, `channel-${i}`);
      expect(r.ok).toBe(true);
      if (r.ok) l = r.ledger;
    }
    expect(l.spent).toBe(2250);
    expect(W.xpBalance(l)).toBe(0);
    expect(W.webBonuses(l)).toEqual({ strainLimit: 7, backlashOff: 2, freeChannel: true, maxHp: 0 });
    // What is saved reads back the same.
    expect(W.normalizeLedger(W.withLedger({}, l))).toEqual(l);
  });

  it('never lets the balance go below zero', () => {
    const l = W.normalizeLedger({ web: { nodes: ['channel-1', 'channel-2'], camps: { c1: 10 }, grant: 0 } });
    expect(W.xpBalance(l)).toBe(0);
  });
});

describe('progression web: what the nodes do', () => {
  it('adds the bonus to the strain limit the phone sent, up to 20, and gives none without a signet', () => {
    const b = W.webBonuses(withXp(0, ['channel-1', 'channel-2']));
    expect(b.strainLimit).toBe(2);
    expect(W.webStrainLimit(8, b)).toBe(10);
    expect(W.webStrainLimit(19, b)).toBe(20);
    expect(W.webStrainLimit(0, b)).toBe(0);
    expect(W.webStrainLimit(null, b)).toBeNull();
    expect(W.webStrainLimit(8, W.NO_BONUSES)).toBe(8);
  });

  it('strain can rise past the old limit by exactly the bonus', () => {
    const limit = W.webStrainLimit(8, W.webBonuses(withXp(0, ['channel-1'])));
    let s = { ...R.freshState(), strain: 8 };
    s = R.raiseStrain(s, 3, limit, 'test').state;
    expect(s.strain).toBe(9);
  });

  it('a failed signet check adds less strain with the Conduit nodes, and says so', () => {
    const base = { d20: 1, modifier: 0, dc: 15, risk: 'signet' as const, label: 'Hold the ward', masteryXp: 0, bond: null };
    const sheet = R.normalizeSheet({ level: 3, maxHp: 24 });
    const plain = R.resolveCheck(R.freshState(), 600, sheet, base, rand);
    expect(plain.strain).toBe(2);
    expect(plain.line).not.toContain('absorbed');
    expect('strainAbsorbed' in (plain.events[0].payload || {})).toBe(false);
    const one = R.resolveCheck(R.freshState(), 600, sheet, { ...base, strainOff: 1 }, rand);
    expect(one.strain).toBe(1);
    expect(one.line).toContain('+1 Signet Strain');
    expect(one.line).toContain('Channel training absorbed 1 Signet Strain');
    expect(one.events[0].payload?.strainAbsorbed).toBe(1);
    const all = R.resolveCheck(R.freshState(), 600, sheet, { ...base, strainOff: 5 }, rand);
    expect(all.strain).toBe(0);
    // A check with no strain to take off is untouched.
    const mental = R.resolveCheck(R.freshState(), 600, sheet, { ...base, risk: 'mental', strainOff: 2 }, rand);
    expect(mental.strain).toBe(0);
    expect(mental.line).not.toContain('absorbed');
  });

  it('Deep Well: the first channel of each in-game day costs no strain, the second does', () => {
    const first = R.channelSignet(R.freshState(), 600, 4, 0, 0, 10, true);
    expect(first.free).toBe(true);
    expect(first.cost).toBe(0);
    expect(first.state.strain).toBe(0);
    expect(first.xpDelta).toBeGreaterThan(0);
    const second = R.channelSignet(first.state, 700, 4, 0, 0, 10, true);
    expect(second.free).toBe(false);
    expect(second.state.strain).toBe(4);
    // Next day: free again. The state survives a save and a read.
    const saved = R.normalizeState(JSON.parse(JSON.stringify(second.state)));
    const nextDay = R.channelSignet(saved, 600 + R.DAY, 4, 0, 0, 10, true);
    expect(nextDay.free).toBe(true);
    expect(nextDay.state.strain).toBe(4);
  });

  it('without Deep Well a channel costs what it always did', () => {
    const r = R.channelSignet(R.freshState(), 600, 4, 0, 0, 10);
    expect(r.free).toBe(false);
    expect(r.cost).toBe(4);
    expect(r.state.strain).toBe(4);
    expect(r.state.signet.freeDay).toBe(0);
  });
});

describe('progression web: what the phone is shown', () => {
  it('lists ten spokes, five a half, with Vitality and Channel open', () => {
    const v = W.webView(withXp(150));
    expect(v.spokes.length).toBe(10);
    expect(v.spokes.filter(s => s.half === 'rider').length).toBe(5);
    expect(v.spokes.filter(s => !s.coming).map(s => s.id)).toEqual(['vitality', 'channel']);
    expect(v.xp).toEqual({ earned: 150, spent: 0, balance: 150 });
    const channel = v.spokes.find(s => s.id === 'channel');
    expect(channel?.nodes.map(n => n.canBuy)).toEqual([true, false, false, false, false, false]);
    expect(channel?.nodes[1].why).toBe('Unlock First Reserve first.');
  });

  it('marks owned nodes, opens the next one, and says how much XP is missing', () => {
    const v = W.webView(withXp(200, ['channel-1']));
    const channel = v.spokes.find(s => s.id === 'channel');
    expect(channel?.owned).toBe(1);
    expect(channel?.nodes[0]).toMatchObject({ owned: true, canBuy: false, why: null });
    expect(channel?.nodes[1]).toMatchObject({ owned: false, canBuy: false, why: 'You need 100 more XP.' });
    expect(v.bonuses.strainLimit).toBe(1);
  });
});

describe('progression web: Vitality, a trunk that splits into five branches', () => {
  const vitality = (l: W.WebLedger) => { const s = W.webView(l).spokes.find(x => x.id === 'vitality'); if (!s) throw new Error('no vitality'); return s; };
  const buyAll = (l: W.WebLedger, ids: string[]) => ids.reduce((acc, id) => { const r = W.buyNode(acc, id); if (!r.ok) throw new Error(`${id}: ${(r as { error: string }).error}`); return r.ledger; }, l);
  const TRUNK = [1, 2, 3, 4, 5].map(i => `vitality-${i}`);
  const TOUGH = [1, 2, 3, 4, 5].map(i => `tough-${i}`);

  it('has 30 nodes: a trunk of 5 and five branches of 5', () => {
    const v = vitality(withXp(0));
    expect(v.nodes.length).toBe(30);
    expect(v.branches.map(b => b.id)).toEqual(['tough', 'ward', 'regen', 'adren', 'blood']);
    expect(v.nodes.filter(n => n.branch === null).map(n => n.id)).toEqual(TRUNK);
    for (const b of v.branches) {
      const nodes = v.nodes.filter(n => n.branch === b.id);
      expect(nodes.map(n => n.tier)).toEqual(['small', 'small', 'big', 'big', 'capstone']);
      // Every branch grows from the last trunk node, then runs in a line.
      expect(nodes.map(n => n.parent)).toEqual(['vitality-5', ...nodes.slice(0, 4).map(n => n.id)]);
    }
    expect(v.nodes[0].parent).toBeNull();
    expect(new Set(v.nodes.map(n => n.id)).size).toBe(30);
  });

  it('the trunk gives +3 max HP a node and is bought in order', () => {
    expect(W.buyNode(withXp(9999), 'vitality-2')).toEqual({ ok: false, error: 'Unlock Hale first.' });
    const l = buyAll(withXp(750), TRUNK);
    expect(W.webBonuses(l).maxHp).toBe(15);
    expect(l.spent).toBe(750);
    expect(W.xpBalance(l)).toBe(0);
  });

  it('a branch cannot be started before the trunk is finished', () => {
    const four = buyAll(withXp(9999), TRUNK.slice(0, 4));
    expect(W.buyNode(four, 'tough-1')).toEqual({ ok: false, error: 'Unlock Ironblooded first.' });
    const five = buyAll(four, ['vitality-5']);
    expect(W.buyNode(five, 'tough-1').ok).toBe(true);
    expect(W.buyNode(five, 'tough-2')).toEqual({ ok: false, error: 'Unlock Thick Hide first.' });
  });

  it('Toughness adds 30 more: +45 max HP with the trunk, for 2,850 XP', () => {
    const l = buyAll(withXp(2850), [...TRUNK, ...TOUGH]);
    expect(W.webBonuses(l)).toEqual({ strainLimit: 0, backlashOff: 0, freeChannel: false, maxHp: 45 });
    expect(l.spent).toBe(2850);
    expect(vitality(l).owned).toBe(10);
    expect(W.normalizeLedger(W.withLedger({}, l))).toEqual(l);
  });

  it('the four branches still to come are shown but cannot be bought, even with the XP', () => {
    const l = buyAll(withXp(99999), TRUNK);
    const v = vitality(l);
    for (const id of ['ward-1', 'regen-1', 'adren-1', 'blood-1']) {
      expect(W.buyNode(l, id)).toEqual({ ok: false, error: 'Coming in the next update.' });
      expect(v.nodes.find(n => n.id === id)).toMatchObject({ soon: true, canBuy: false, owned: false });
    }
    expect(v.nodes.filter(n => n.soon).length).toBe(20);
    expect(v.nodes.find(n => n.id === 'tough-1')).toMatchObject({ soon: false, canBuy: true });
  });

  it('Channel still works the same beside it, and both add up', () => {
    const l = buyAll(withXp(9999), ['channel-1', ...TRUNK]);
    expect(W.webBonuses(l)).toEqual({ strainLimit: 1, backlashOff: 0, freeChannel: false, maxHp: 15 });
    const channel = W.webView(l).spokes.find(s => s.id === 'channel');
    expect(channel?.nodes.map(n => n.parent)).toEqual([null, 'channel-1', 'channel-2', 'channel-3', 'channel-4', 'channel-5']);
    expect(channel?.branches).toEqual([]);
  });
});
