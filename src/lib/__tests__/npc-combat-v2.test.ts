import { describe, expect, it } from 'vitest';
import * as R from '../../../supabase/functions/npc-combat/rules.ts';
import * as S from '../../../supabase/functions/npc-combat/skills.ts';

// Live NPC Combat v2: party scaling, pause clocks and skill cooldowns (pure rules, no database).
const stats = R.cleanCombatStats({ maxHp: 120, ac: 13, attackBonus: 5, damage: '1d10+4', speed: 'medium' })!;
const NOW = Date.parse('2026-10-12T12:00:00Z');
const at = (s: number) => new Date(NOW + s * 1000).toISOString();

describe('party scaling', () => {
  it('defaults hand-built NPCs to 4 players', () => {
    expect(stats.designedFor).toBe(4);
  });
  it('shrinks a 6-player build for one player, with a floor', () => {
    expect(R.hpScale(1, 6)).toBe(0.35);
    expect(R.scaledMaxHp(200, 1, 6)).toBe(70);
  });
  it('is 1x at the size it was built for and caps at 1.5x', () => {
    expect(R.scaledMaxHp(120, 4, 4)).toBe(120);
    expect(R.hpScale(12, 2)).toBe(1.5);
  });
  it('keeps the share of health when max HP grows', () => {
    expect(R.rescaledHp(24, 48, 72)).toBe(36);
    expect(R.rescaledHp(1, 48, 72)).toBe(2);
    expect(R.rescaledHp(0, 48, 72)).toBe(0);
  });
});

describe('pause clocks', () => {
  it('moves a time later by the pause length', () => {
    expect(R.shiftIso(at(10), 20_000)).toBe(at(30));
  });
  it('never moves a time earlier than the floor', () => {
    expect(R.shiftIso(at(0), 1000, NOW + 3000)).toBe(at(3));
  });
  it('leaves empty times empty', () => {
    expect(R.shiftIso(null, 5000)).toBeNull();
  });
});

describe('skill cooldowns', () => {
  const skills = S.skillsOf({ skills: [{ type: 'heavy', name: 'Hammer' }, { type: 'mend', name: 'Stim' }, { type: 'shield', name: 'Wall', cooldown: 10 }] }, stats);
  const heavy = skills.find(s => s.type === 'heavy')!;
  const mend = skills.find(s => s.type === 'mend')!;
  it('uses the default cooldown, or the skill row override', () => {
    expect(heavy.cooldownMs).toBe(30_000);
    expect(skills.find(s => s.type === 'shield')!.cooldownMs).toBe(10_000);
  });
  it('falls back to a plain attack when every attack is cooling down', () => {
    const cd = S.afterUse({}, heavy, NOW, ['p1']);
    const ready = S.readySkills(skills, cd, NOW + 1000, stats);
    expect(ready.some(s => s.type === 'heavy')).toBe(false);
    expect(ready.some(s => s.type === 'strike' && s.name === 'Attack')).toBe(true);
    expect(S.readySkills(skills, cd, NOW + 31_000, stats).some(s => s.type === 'heavy')).toBe(true);
  });
  it('allows Mend twice per fight', () => {
    let cd = S.afterUse({}, mend, NOW, []);
    cd = S.afterUse(cd, mend, NOW + 61_000, []);
    expect(S.readySkills(skills, cd, NOW + 999_000, stats).some(s => s.type === 'mend')).toBe(false);
  });
  it('shifts cooldowns by a pause', () => {
    const cd = S.shiftCooldowns(S.afterUse({}, heavy, NOW, []), 20_000);
    expect(cd.ready?.heavy).toBe(at(50));
  });
  it('never pins the same player twice in a row', () => {
    const pin = S.skillsOf({ skills: [{ type: 'pin', name: 'Pin' }] }, stats);
    const ctx = {
      skills: pin, selfId: 'n1', turnNo: 1, signatureTurn: -99, canRetreat: false, lastPinned: 'p1',
      npcs: [{ id: 'n1', hp: 10, maxHp: 10, status: 'up', ward: 0 }],
      players: [{ id: 'p1', status: 'up', present: true, threat: 9 }, { id: 'p2', status: 'up', present: true, threat: 0 }],
    };
    for (let i = 0; i < 50; i++) {
      const c = S.chooseSkill(ctx, sides => (i % sides) + 1);
      if (c.kind === 'skill' && c.skill.type === 'pin') expect(c.targetIds).toEqual(['p2']);
    }
  });
});
