import { describe, expect, it } from 'vitest';
import { oneTapTargets } from '@/lib/combat/oneTapCombat';
import type { ActionCard } from '@/lib/roundChatActionCard';

const f = (id: string, kind: string, status: string, hp: number, ally = false) => ({ id, kind, status, hp, ally });
const fighters = [
  f('me', 'player', 'up', 20), f('pal', 'player', 'down', 0),
  f('ally', 'npc', 'up', 30, true), f('koAlly', 'npc', 'ko', 0, true), f('foe', 'npc', 'up', 40),
];
const heal = { kind: 'heal', action: 'Cure Wounds', amount: 8 } as unknown as ActionCard;
const areaHeal = { kind: 'heal', action: 'Mass Healing Word', amount: 6, area: true } as unknown as ActionCard;
const buff = { action: 'Shield of Faith', resolve: 'buff', combatEffects: [{ kind: 'ac_bonus', amount: 2, durationSeconds: 60 }] } as unknown as ActionCard;
const dmg = { kind: 'attack', action: 'Fire Bolt', damageTotal: 9 } as unknown as ActionCard;

describe('one-tap casts and NPC allies (D-24)', () => {
  it('heals a standing ally', () => expect(oneTapTargets(heal, ['ally'], fighters)).toEqual({ ok: true, targetId: 'ally', extraIds: [] }));
  it('buffs a standing ally', () => expect(oneTapTargets(buff, ['ally'], fighters).ok).toBe(true));
  it('refuses a knocked-out ally', () => expect(oneTapTargets(heal, ['koAlly'], fighters)).toEqual({ ok: false, reason: 'wrong-target' }));
  it('never aims damage at an ally', () => expect(oneTapTargets(dmg, ['ally'], fighters)).toEqual({ ok: false, reason: 'wrong-target' }));
  it('still damages enemies and heals downed players', () => {
    expect(oneTapTargets(dmg, ['foe'], fighters).ok).toBe(true);
    expect(oneTapTargets(heal, ['pal'], fighters).ok).toBe(true);
  });
  it('never heals an enemy', () => expect(oneTapTargets(heal, ['foe'], fighters)).toEqual({ ok: false, reason: 'wrong-target' }));
  it('an area heal keeps standing allies and drops enemies and knocked-out allies', () => {
    expect(oneTapTargets(areaHeal, ['pal', 'ally', 'foe', 'koAlly'], fighters)).toEqual({ ok: true, targetId: 'pal', extraIds: ['ally'] });
  });
});