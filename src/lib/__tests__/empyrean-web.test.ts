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
    expect(W.buyNode(withXp(5000), 'vitality-1').ok).toBe(false);
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
    expect(W.webBonuses(l)).toEqual({ strainLimit: 7, backlashOff: 2, freeChannel: true });
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
  it('lists ten spokes, five a half, with only Channel open', () => {
    const v = W.webView(withXp(150));
    expect(v.spokes.length).toBe(10);
    expect(v.spokes.filter(s => s.half === 'rider').length).toBe(5);
    expect(v.spokes.filter(s => !s.coming).map(s => s.id)).toEqual(['channel']);
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
