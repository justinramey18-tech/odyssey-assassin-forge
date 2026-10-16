import { describe, expect, it } from 'vitest';
import { baseSlotChoice, oneTapTargets } from '@/lib/combat/oneTapCombat';
import { buffCardFromEffects, type ActionCard } from '@/lib/roundChatActionCard';

const fighters = [
  { id: 'n1', kind: 'npc', status: 'up', hp: 10 },
  { id: 'n2', kind: 'npc', status: 'up', hp: 10 },
  { id: 'n3', kind: 'npc', status: 'up', hp: 10 },
  { id: 'n4', kind: 'npc', status: 'up', hp: 10 },
  { id: 'p1', kind: 'player', status: 'up', hp: 12 },
  { id: 'p2', kind: 'player', status: 'down', hp: 0 },
];
const dmg: ActionCard = { action: 'Fire Bolt', kind: 'spell', damageTotal: 7 };

describe('one-tap base-level slot', () => {
  const res = { slots: [{ level: 1, current: 0, max: 2 }, { level: 2, current: 3, max: 3 }], pactSlots: undefined };
  it('casts at base level only', () => expect(baseSlotChoice(2, res)).toEqual({ slotLevel: 2, usePact: false }));
  it('never upcasts when the base slot is gone', () => expect(baseSlotChoice(1, res)).toBeNull());
  it('cantrips spend nothing', () => expect(baseSlotChoice(0, res)).toEqual({}));
});

describe('one-tap targets', () => {
  it('single-target uses only the primary', () => expect(oneTapTargets(dmg, ['n1', 'n2'], fighters)).toEqual({ ok: true, targetId: 'n1', extraIds: [] }));
  it('area caps at three and never mixes sides', () =>
    expect(oneTapTargets({ ...dmg, area: true }, ['n1', 'p1', 'n2', 'n3', 'n4'], fighters)).toEqual({ ok: true, targetId: 'n1', extraIds: ['n2', 'n3'] }));
  it('no target is refused', () => expect(oneTapTargets(dmg, [], fighters)).toEqual({ ok: false, reason: 'no-target' }));
  it('ally heal lands on a downed ally', () =>
    expect(oneTapTargets({ action: 'Cure Wounds', kind: 'heal', amount: 8 }, ['p2'], fighters)).toMatchObject({ ok: true, targetId: 'p2' }));
  it('damage on an ally fails', () => expect(oneTapTargets(dmg, ['p1'], fighters)).toEqual({ ok: false, reason: 'wrong-target' }));
  it('structured buff goes to a living ally only', () => {
    const buff = buffCardFromEffects('Shield of Faith', [{ kind: 'ac_bonus', amount: 2, durationSeconds: 600 }], false)!;
    expect(buff).toMatchObject({ resolve: 'buff', targetKind: 'ally', combatEffects: [{ kind: 'ac_bonus', amount: 2, durationSeconds: 600 }] });
    expect(oneTapTargets(buff, ['p1'], fighters)).toMatchObject({ ok: true, targetId: 'p1' });
    expect(oneTapTargets(buff, ['p2'], fighters)).toEqual({ ok: false, reason: 'wrong-target' });
  });
  it('invalid buff data builds no card', () => expect(buffCardFromEffects('X', [{ kind: 'ac_bonus', amount: 99, durationSeconds: 1 }], false)).toBeNull());
});
