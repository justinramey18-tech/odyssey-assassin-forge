// The progression web's Channel spoke: a trunk of five and the Reservoir, Power, Control, Recovery and Mastery branches.
import { describe, expect, it } from 'vitest';
import * as C from '../../../supabase/functions/empyrean-rules/combat';
import * as R from '../../../supabase/functions/empyrean-rules/rules';
import * as W from '../../../supabase/functions/empyrean-rules/web';

const always = (v: number): R.Rand => () => v;
const T0 = 1_000_000;
const perks = (over: Partial<W.WebBonuses> = {}): W.WebBonuses => ({ ...W.NO_BONUSES, ...over });
const ledger = (nodes: string[], xp = 0) => W.normalizeLedger({ web: { nodes, camps: { c1: xp }, grant: 0 } });
const TRUNK = [1, 2, 3, 4, 5].map(i => `channel-${i}`);
const five = (b: string) => [1, 2, 3, 4, 5].map(i => `${b}-${i}`);
const BRANCHES = ['reserve', 'power', 'control', 'recover', 'mastery'];
const sheet = R.normalizeSheet({ level: 3, maxHp: 24 });

describe('Channel: the tree', () => {
  const channel = () => { const s = W.webView(ledger([])).spokes.find(x => x.id === 'channel'); if (!s) throw new Error('no channel'); return s; };

  it('has 30 nodes: a trunk of 5 and five branches of 5, each growing from the last trunk node', () => {
    const c = channel();
    expect(c.nodes.length).toBe(30);
    expect(new Set(c.nodes.map(n => n.id)).size).toBe(30);
    expect(c.branches.map(b => b.id)).toEqual(BRANCHES);
    expect(c.nodes.filter(n => n.branch === null).map(n => n.id)).toEqual(TRUNK);
    for (const b of BRANCHES) {
      const nodes = c.nodes.filter(n => n.branch === b);
      expect(nodes.map(n => n.tier)).toEqual(['small', 'small', 'big', 'big', 'capstone']);
      expect(nodes.map(n => n.parent)).toEqual(['channel-5', ...nodes.slice(0, 4).map(n => n.id)]);
    }
    expect(c.nodes.some(n => n.soon)).toBe(false);
  });

  it('keeps the first node riders already own exactly as it was', () => {
    expect(channel().nodes[0]).toMatchObject({ id: 'channel-1', name: 'First Reserve', effect: 'Signet Strain limit +1.', cost: 150, parent: null });
    expect(W.webBonuses(ledger(['channel-1'])).strainLimit).toBe(1);
  });

  it('the whole spoke costs 11,250 XP and gives everything', () => {
    let l = ledger([], 11250);
    for (const id of [...TRUNK, ...BRANCHES.flatMap(five)]) { const r = W.buyNode(l, id); expect(r.ok).toBe(true); if (r.ok) l = r.ledger; }
    expect(l.spent).toBe(11250);
    expect(W.webBonuses(l)).toEqual({
      ...W.NO_BONUSES, strainLimit: 11, freeChannel: true, backlashOff: 2,
      sigDamage: 4, sigDice: 2, sigKillRefund: true, signetCheck: 2, steadySignet: true,
      restEase: 2, groundEase: 2, coolEase: 1, strainHour: 1, masteryXp: 2, masteryCap: 8, masteryRankUp: true,
    });
  });

  it('a branch cannot be started before the trunk is finished', () => {
    const four = ledger(TRUNK.slice(0, 4), 9999);
    expect(W.buyNode(four, 'power-1')).toEqual({ ok: false, error: 'Unlock Fifth Reserve first.' });
    expect(W.buyNode(ledger(TRUNK, 9999), 'power-1').ok).toBe(true);
  });

  it('the strain limit never passes 20, however much is owned', () => {
    const all = W.webBonuses(ledger([...TRUNK, ...five('reserve')]));
    expect(all.strainLimit).toBe(11);
    expect(W.webStrainLimit(8, all)).toBe(19);
    expect(W.webStrainLimit(12, all)).toBe(20);
  });
});

describe('Channel, Control: signet checks', () => {
  const base = { d20: 8, modifier: 0, dc: 10, risk: 'signet' as const, label: 'Hold the ward', masteryXp: 0, bond: null };
  it('adds its bonus to a signet check, names it, and can turn a failure into a success', () => {
    const plain = R.resolveCheck(R.freshState(), 600, sheet, base, always(0.5));
    expect(plain.outcome).toBe('failure');
    const trained = R.resolveCheck(R.freshState(), 600, sheet, { ...base, webSignet: 2 }, always(0.5));
    expect(trained.outcome).toBe('success');
    expect(trained.total).toBe(plain.total + 2);
    expect(trained.line).toContain('+2 Control');
    expect(plain.line).not.toContain('Control');
  });

  it('gives nothing on a check that is not a signet check', () => {
    const mental = R.resolveCheck(R.freshState(), 600, sheet, { ...base, risk: 'mental', webSignet: 2, steadySignet: true, d20: 1 }, always(0.5));
    expect(mental.line).not.toContain('Control');
    expect(mental.outcome).toBe('critical_failure');
  });

  it('Perfect Control: a natural 1 on a signet check is a failure, not a critical failure', () => {
    const crit = R.resolveCheck(R.freshState(), 600, sheet, { ...base, d20: 1 }, always(0.5));
    expect(crit.outcome).toBe('critical_failure');
    const steady = R.resolveCheck(R.freshState(), 600, sheet, { ...base, d20: 1, steadySignet: true }, always(0.5));
    expect(steady.outcome).toBe('failure');
    expect(steady.strain).toBeLessThan(crit.strain);
    expect(steady.line).toContain('Perfect Control');
    const fine = R.resolveCheck(R.freshState(), 600, sheet, { ...base, d20: 15, steadySignet: true }, always(0.5));
    expect(fine.outcome).toBe('success');
    expect(fine.line).not.toContain('Perfect Control');
  });
});

describe('Channel, Recovery: strain that eases faster', () => {
  const strained = { ...R.freshState(), strain: 8 };
  it('a short rest eases 2, or more with the nodes, and says how much', () => {
    const plain = R.rest(strained, 600, 'short');
    expect(plain.ok && plain.state.strain).toBe(6);
    const eased = R.rest(strained, 600, 'short', false, 2);
    expect(eased.ok && eased.state.strain).toBe(4);
    expect(eased.ok && eased.summary).toContain('Signet Strain eases by 4.');
    expect(eased.ok && eased.strainDelta).toBe(-4);
    expect(plain.ok && plain.summary).toContain('Signet Strain eases by 2.');
  });

  it('Ground Yourself and the cool-down ease more with the nodes', () => {
    expect(R.changeStrain(strained, 'ground', 10).state.strain).toBe(6);
    expect(R.changeStrain(strained, 'ground', 10, { groundEase: 2 }).state.strain).toBe(4);
    expect(R.changeStrain(strained, 'cool', 10, { messageId: 'm1' }).state.strain).toBe(7);
    expect(R.changeStrain(strained, 'cool', 10, { messageId: 'm1', coolEase: 1 }).state.strain).toBe(6);
    // A round with a channel in it still does not cool, and a reply still counts once.
    expect(R.changeStrain(strained, 'cool', 10, { messageId: 'm1', coolEase: 1, channeled: true }).state.strain).toBe(8);
    const once = R.changeStrain(strained, 'cool', 10, { messageId: 'm1', coolEase: 1 }).state;
    expect(R.changeStrain(once, 'cool', 10, { messageId: 'm1', coolEase: 1 }).state.strain).toBe(6);
  });

  it('Still Water: 1 strain eases for each whole game hour, never below 0, and nothing without it', () => {
    expect(R.easeStrain(strained, 600, 0)).toBe(strained);
    const s0 = R.easeStrain(strained, 600, 1);
    expect([s0.strain, s0.easeAt]).toEqual([8, 600]);
    expect(R.easeStrain(s0, 650, 1)).toBe(s0);
    const three = R.easeStrain(s0, 600 + 190, 1);
    expect([three.strain, three.easeAt]).toEqual([5, 780]);
    expect(R.easeStrain(s0, 600 + 30 * 60, 1).strain).toBe(0);
    expect(R.normalizeState(JSON.parse(JSON.stringify(three))).easeAt).toBe(780);
  });
});

describe('Channel, Mastery: Signet Mastery grows faster', () => {
  it('more XP per channel and a higher daily limit', () => {
    const plain = R.signetUse(R.freshState(), 600, 4);
    const boosted = R.signetUse(R.freshState(), 600, 4, 0, { perChannel: 2, cap: 0 });
    expect(boosted.xpDelta).toBe(plain.xpDelta + 2);
    let s = R.freshState(); let total = 0;
    for (let i = 0; i < 12; i++) { const r = R.signetUse(s, 600 + i, 8); s = r.state; total += r.xpDelta; }
    expect(total).toBe(R.MASTERY_DAILY_XP);
    s = R.freshState(); total = 0;
    for (let i = 0; i < 12; i++) { const r = R.signetUse(s, 600 + i, 8, 0, { perChannel: 0, cap: 8 }); s = r.state; total += r.xpDelta; }
    expect(total).toBe(R.MASTERY_DAILY_XP + 8);
  });

  it('a story channel passes the boost on', () => {
    const plain = R.channelSignet(R.freshState(), 600, 4, 0, 0, 10);
    const boosted = R.channelSignet(R.freshState(), 600, 4, 0, 0, 10, false, null, { perChannel: 1, cap: 4 });
    expect(boosted.xpDelta).toBe(plain.xpDelta + 1);
    expect(boosted.cost).toBe(plain.cost);
  });

  it('Attuned: mastery counts as one rank higher, and the top rank stays the top', () => {
    expect(R.attunedXp(0, false)).toBe(0);
    expect(R.masteryRank(R.attunedXp(0, true))).toBe(1);
    expect(R.masteryRank(R.attunedXp(20, true))).toBe(2);
    expect(R.masteryRank(R.attunedXp(500, true))).toBe(R.masteryRank(500));
    expect(R.attunedXp(500, true)).toBe(500);
  });
});

describe('Channel, Power: signet strikes in a fight', () => {
  const strike = (web: W.WebBonuses | undefined, enemyHp = 500) => {
    const f = C.startFight({
      id: 'f1', riderName: 'Asha', level: 4, maxHp: 30, hp: 30, ac: 14, attackBonus: 5, weapons: [{ name: 'Dagger', damage: '1d4+3' }],
      foeKind: 'cadet', count: 1, challenge: 'moderate', lethal: true, arena: 'ground', dragon: null, masteryXp: 0, web,
    }, T0, always(0.5));
    f.enemies[0].hp = enemyHp; f.enemies[0].maxHp = Math.max(enemyHp, f.enemies[0].maxHp);
    const r = C.act(f, f.rider.readyAt + 10, { type: 'signet', targetId: f.enemies[0].id, intensity: 3, strainRoom: 10 }, always(0.5));
    return { r, lost: enemyHp - f.enemies[0].hp, log: f.log.map(e => e.text).join(' | ') };
  };
  it('adds flat damage and extra dice', () => {
    const plain = strike(undefined);
    expect(strike(perks({ sigDamage: 4 })).lost - plain.lost).toBe(4);
    expect(strike(perks({ sigDice: 2 })).lost - plain.lost).toBe(8);
    expect(strike(perks({ sigDamage: 4, sigDice: 2 })).lost - plain.lost).toBe(12);
  });

  it('Stormheart: a strike that drops the enemy gives 1 strain back; one that does not, does not', () => {
    const kill = strike(perks({ sigKillRefund: true }), 1);
    expect(kill.r).toMatchObject({ ok: true, strain: 2 });
    expect(kill.log).toContain('Stormheart: the kill gives 1 Signet Strain back.');
    expect(strike(perks({ sigKillRefund: true })).r).toMatchObject({ ok: true, strain: 3 });
    expect(strike(undefined, 1).r).toMatchObject({ ok: true, strain: 3 });
  });

  it('a rider with only Power perks still gets them (the perks are not thrown away as empty)', () => {
    expect(C.cleanPerks(perks({ sigDice: 1 }))).not.toBeNull();
    expect(C.cleanPerks(perks({ sigKillRefund: true }))).not.toBeNull();
    expect(C.cleanPerks(perks())).toBeNull();
  });
});