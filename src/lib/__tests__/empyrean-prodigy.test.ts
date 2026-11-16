import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as P from '@/lib/empyreanClasses/prodigy';
import * as C from '../../../supabase/functions/empyrean-rules/combat';
import * as R from '../../../supabase/functions/empyrean-rules/rules';
import { PRODIGY_TIERS, buildSystemPrompt } from '../../../supabase/functions/empyrean-onboarding/prompt';
import { signetStrainCost as phoneCost } from '@/lib/empyrean-rules-client';
import { CLASS_REGISTRY, getAllClasses, getSpellcasterClasses, getClassFeatures } from '@/lib/classes';
import { calculateMulticlassMaxHP } from '@/lib/hpCalculation';
import { sanitizeCharacter } from '@/lib/empyrean-onboarding';

const always = (v: number): R.Rand => () => v;
const T0 = 1_000_000;
const prodigySheet = (level: number): R.Sheet => R.normalizeSheet({ level, maxHp: 40, riderClass: 'prodigy' });
const plainSheet = (level: number): R.Sheet => R.normalizeSheet({ level, maxHp: 40 });

describe('the Prodigy rules', () => {
  it('exist twice, byte for byte, on the phone and the server', () => {
    expect(readFileSync('src/lib/empyreanClasses/prodigy.ts', 'utf8')).toBe(readFileSync('supabase/functions/empyrean-rules/prodigy.ts', 'utf8'));
  });
  it('climb five Ascensions by level, and do nothing for other riders', () => {
    expect([1, 4, 5, 9, 10, 14, 15, 19, 20].map(P.ascensionTier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
    expect(P.prodigyTier('prodigy', 12)).toBe(3);
    expect(P.prodigyTier('wizard', 20)).toBe(0);
    expect(P.prodigyTier(undefined, 20)).toBe(0);
    expect(P.nextAscension(7)?.name).toBe('Ascendant');
    expect(P.nextAscension(20)).toBeNull();
    for (const t of [1, 2, 3, 4, 5] as const) expect(P.describeTier(t)).toHaveLength(3);
  });
  it('make strong channels cheaper and keep the phone and server costs equal', () => {
    for (let t = 0; t <= 5; t++) for (let rank = 0; rank <= 4; rank++) for (let i = 1; i <= 8; i++) {
      expect(phoneCost(i, rank, t)).toBe(R.signetStrainCost(i, rank, t));
    }
    expect(R.signetStrainCost(6, 0, 0)).toBe(6);
    expect(R.signetStrainCost(6, 0, 2)).toBe(5);
    expect(R.signetStrainCost(6, 4, 5)).toBe(2);
    expect(R.signetStrainCost(1, 4, 5)).toBe(1); // never below 1
  });
  it('grow Signet Mastery twice as fast, with a doubled daily limit', () => {
    const one = R.signetUse(R.freshState(), 0, 6, 1);
    expect(one.xpDelta).toBe(4);
    let s = R.freshState(); let total = 0;
    for (let k = 0; k < 10; k++) { const r = R.signetUse(s, 0, 8, 1); s = r.state; total += r.xpDelta; }
    expect(total).toBe(16);
    expect(R.signetUse(R.freshState(), 0, 6).xpDelta).toBe(2);
  });
  it('add the Prodigy bonus and extra dragon\'s help on checks', () => {
    const input = { d20: 10, modifier: 0, dc: 15, risk: 'signet' as const, label: 'Shape the storm', masteryXp: 0, bond: 30 };
    const plain = R.resolveCheck(R.freshState(), 0, plainSheet(5), input, always(0.5));
    const prod = R.resolveCheck(R.freshState(), 0, prodigySheet(5), input, always(0.5));
    expect(prod.total - plain.total).toBe(2); // +1 Prodigy, +1 dragon's help (Awakened)
    expect(prod.line).toContain('+1 Prodigy');
    expect(R.resolveCheck(R.freshState(), 0, prodigySheet(5), { ...input, risk: 'mental' }, always(0.5)).total - R.resolveCheck(R.freshState(), 0, plainSheet(5), { ...input, risk: 'mental' }, always(0.5)).total).toBe(1);
  });
  it('give Battle Briefs a day by tier, and refuse them to anyone else', () => {
    let s = R.freshState();
    const first = R.battleBrief(s, 60, prodigySheet(3));
    if (!first.ok) throw new Error('Expected a brief');
    expect(first.line).toContain('BATTLE BRIEF, binding');
    expect(first.left).toBe(0);
    s = first.state;
    expect(R.battleBrief(s, 120, prodigySheet(3)).ok).toBe(false);
    expect(R.battleBrief(s, R.DAY + 60, prodigySheet(3)).ok).toBe(true); // a new in-game day
    expect(R.briefsLeft(R.freshState(), 0, prodigySheet(20))).toBe(3);
    expect(R.battleBrief(R.freshState(), 0, plainSheet(20)).ok).toBe(false);
    expect(R.normalizeState({}).briefs).toEqual({ day: 1, n: 0 });
  });
  it('tell the DM about the class only for a Prodigy', () => {
    const facts = R.buildRuleFacts(R.freshState(), { minute: 480, masteryXp: 0, bond: 30, bonded: true, traveling: false, sheet: prodigySheet(10) });
    expect(facts).toContain('Class: The Prodigy, Ascension Ascendant');
    expect(facts).toContain('Battle Briefs left today: 2');
    expect(R.buildRuleFacts(R.freshState(), { minute: 480, masteryXp: 0, bond: 30, bonded: true, traveling: false, sheet: plainSheet(10) })).not.toContain('Prodigy');
    expect(R.normalizeSheet({ riderClass: 'wizard' }).riderClass).toBeNull();
  });
});

describe('the Prodigy in a fight', () => {
  const start = (prodigy: number, level = 10) => C.startFight({
    id: 'f1', riderName: 'Asha', level, maxHp: 60, hp: 60, ac: 15, attackBonus: 6, weapons: [{ name: 'Dagger', damage: '1d4+3' }],
    foeKind: 'soldier', count: 2, challenge: 'moderate', lethal: true, arena: 'ground', dragon: { name: 'Gwyn', hp: null, bond: 50 }, masteryXp: 0, prodigy,
  }, T0, always(0.5));
  it('brings a tougher dragon and moves sooner', () => {
    const plain = start(0); const prod = start(3);
    if (!prod.dragon || !plain.dragon) throw new Error('Expected bonded dragons');
    expect(prod.dragon.maxHp).toBe(Math.round(plain.dragon.maxHp * 1.3));
    expect(prod.prodigy).toBe(3);
    const a = C.act(prod, prod.rider.readyAt, { type: 'attack', targetId: prod.enemies[0].id }, always(0.5));
    expect(a.ok).toBe(true);
    expect(prod.rider.readyAt - (T0 + 1500)).toBe(C.RIDER_COOLDOWN_MS - 1500);
  });
  it('lets the dragon act sooner, breathe fire every other turn and shield from a lower bond', () => {
    const f = start(4);
    const g = f.dragon;
    if (!g) throw new Error('Expected a bonded dragon');
    C.advance(f, g.nextAt, always(0.99));
    expect(g.turns).toBe(1);
    expect(g.nextAt - (T0 + 6000)).toBe(C.DRAGON_INTERVAL_MS - 2000);
    expect(P.prodigyFireEvery(4)).toBe(2);
    expect(P.prodigyShieldBond(4)).toBeLessThanOrEqual(50);
  });
  it('charges less strain for a strong channel and hits harder with the signet', () => {
    const plain = start(0); const prod = start(5);
    const p = C.act(plain, plain.rider.readyAt, { type: 'signet', targetId: plain.enemies[0].id, intensity: 6, strainRoom: 20 }, always(0.9));
    const q = C.act(prod, prod.rider.readyAt, { type: 'signet', targetId: prod.enemies[0].id, intensity: 6, strainRoom: 20 }, always(0.9));
    expect(p.ok && q.ok).toBe(true);
    if (!p.ok || !q.ok) return;
    expect(q.strain).toBe(p.strain - 2);
    expect(prod.enemies[0].hp).toBeLessThan(plain.enemies[0].hp);
  });
  it('plays a fight saved before the Prodigy existed exactly as before', () => {
    const f = start(0);
    delete (f as { prodigy?: number }).prodigy;
    const a = C.act(f, f.rider.readyAt, { type: 'attack', targetId: f.enemies[0].id }, always(0.5));
    expect(a.ok).toBe(true);
    expect(f.rider.readyAt - (T0 + 1500)).toBe(C.RIDER_COOLDOWN_MS);
  });
});

describe('the Prodigy as an engine class', () => {
  it('has a d10 hit die, no spells, and its Ascensions as features', () => {
    const c = CLASS_REGISTRY.prodigy;
    expect([c.hitDie, c.hitDieMax, c.hitDieAvg, c.spellcasting.type]).toEqual(['d10', 10, 6, 'none']);
    expect(calculateMulticlassMaxHP('prodigy', 5, {}, 2)).toBe(12 + 4 * 8);
    expect(getClassFeatures('prodigy').map(f => f.level)).toEqual([1, 5, 10, 15, 20]);
  });
  it('stays out of the D&D class pickers and multiclassing', () => {
    expect(getAllClasses().map(c => c.id)).not.toContain('prodigy');
    expect(getSpellcasterClasses().map(c => c.id)).not.toContain('prodigy');
    expect(getAllClasses()).toHaveLength(7);
  });
  it('is offered first by the Dragon Rider guide, with the same Ascension names, and accepted from its build', () => {
    expect(PRODIGY_TIERS).toEqual(P.ASCENSION_TIERS.map(a => [a.name, a.fromLevel]));
    const prompt = buildSystemPrompt('rider', 'LORE', '');
    expect(prompt).toContain('THE PRODIGY');
    expect(prompt).toContain('primaryClass "prodigy"');
    expect(buildSystemPrompt('campaign', 'LORE', 'Name: X')).not.toContain('THE PRODIGY');
    expect(sanitizeCharacter({ name: 'Kaelen', primaryClass: 'prodigy' })?.primaryClass).toBe('prodigy');
  });
});
