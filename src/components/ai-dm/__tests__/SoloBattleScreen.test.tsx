import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import { SoloBattleScreen, buildFightSheet } from '@/components/empyrean/SoloBattleScreen';
import type { SoloFightApi } from '@/hooks/use-solo-fight';
import type { FightView } from '@/lib/empyrean-rules-client';
// The real referee builds the views, so this also proves the screen reads what the server sends.
import * as C from '../../../../supabase/functions/empyrean-rules/combat';

const ctx: any = {
  name: 'Violet', level: 5, maxHP: 40, defenses: { armorClass: 15 },
  equipment: [{ slot: 'primary_weapon', name: 'Short sword', rarity: 'Common', stats: { damage: '1d6+4', attackBonus: 7 } }],
};
const start = (over: Partial<C.StartInput> = {}) => C.startFight({
  id: 'f1', riderName: 'Violet', level: 5, maxHp: 40, hp: 40, ac: 15, attackBonus: 7, weapons: [{ name: 'Short sword', damage: '1d6+4' }],
  foeKind: 'wyvern', count: 1, challenge: 'hard', lethal: true, arena: 'ground', dragon: { name: 'Gwyn', hp: null, bond: 40 }, masteryXp: 0, ...over,
}, Date.now() - 5000, () => 0.5);
const api = (view: FightView | null, over: Partial<SoloFightApi> = {}): SoloFightApi => ({
  fight: view, busy: false, line: null, flashes: [], serverTime: () => Date.now(),
  start: vi.fn(async () => true), act: vi.fn(async () => true), clash: vi.fn(async () => null), close: vi.fn(async () => {}), skipFeed: vi.fn(), ...over,
});
const props = { characterContext: ctx, bonded: true, signetName: 'Lightning', masteryRank: 0, strainRoom: 5, onClosed: vi.fn() };

describe('SoloBattleScreen', () => {
  afterEach(() => cleanup());

  it('shows the rider, the dragon and the enemy, and sends a weapon attack at the enemy', () => {
    const view = C.viewOf(start(), Date.now()) as FightView;
    const fight = api(view);
    render(<SoloBattleScreen fight={fight} {...props} />);
    expect(screen.getByText('BATTLE!')).toBeTruthy();
    expect(screen.getAllByText(/VIOLET/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GWYN/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/WYVERN/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('ATTACK'));
    fireEvent.click(screen.getByText('SHORT SWORD'));
    expect(fight.act).toHaveBeenCalledWith({ type: 'attack', targetId: view.enemies[0].id, weapon: 'Short sword' });
  });

  it('offers the signet at three strengths and blocks the ones the rider cannot afford', () => {
    const view = C.viewOf(start(), Date.now()) as FightView;
    const fight = api(view);
    render(<SoloBattleScreen fight={fight} {...props} strainRoom={4} />);
    fireEvent.click(screen.getByText('SIGNET'));
    expect(screen.getByText('LIGHTNING (FOCUSED)')).toBeTruthy();
    expect(screen.getByText('Too much strain')).toBeTruthy(); // all-out costs 6
    fireEvent.click(screen.getByText('LIGHTNING (STRONG)'));
    expect(fight.act).toHaveBeenCalledWith({ type: 'signet', targetId: view.enemies[0].id, intensity: 4, strainRoom: 4 });
  });

  it('on the mat there is no dragon and the special button yields', () => {
    const view = C.viewOf(start({ foeKind: 'cadet', lethal: false, arena: 'mat' }), Date.now()) as FightView;
    const fight = api(view);
    render(<SoloBattleScreen fight={fight} {...props} />);
    expect(screen.getByText('SPARRING')).toBeTruthy();
    expect(screen.queryAllByText(/GWYN/)).toHaveLength(0);
    fireEvent.click(screen.getByText('YIELD'));
    expect(fight.act).toHaveBeenCalledWith({ type: 'yield' });
  });

  it("says plainly that the dragon's death takes the rider, and closing hands the view back", async () => {
    const f = start();
    if (!f.dragon) throw new Error('Expected a bonded dragon');
    f.dragon.hp = 0; f.dragon.status = 'down'; f.dragonDied = true; f.status = 'ended'; f.outcome = 'defeat'; f.endedAt = Date.now();
    const view = C.viewOf(f, Date.now()) as FightView;
    const fight = api(view);
    const onClosed = vi.fn();
    render(<SoloBattleScreen fight={fight} {...props} onClosed={onClosed} />);
    expect(screen.getByText(/Gwyn is dead, and the bond takes you with it/)).toBeTruthy();
    fireEvent.click(screen.getByText('BACK TO THE STORY'));
    await waitFor(() => expect(onClosed).toHaveBeenCalledWith(view));
    expect(fight.close).toHaveBeenCalledTimes(1);
  });
});

describe('buildFightSheet', () => {
  it('never starts a fight at 0 HP or above the maximum, and falls back when the sheet is thin', () => {
    expect(buildFightSheet(ctx, 0)).toMatchObject({ level: 5, maxHp: 40, hp: 1, ac: 15, attackBonus: 7, weapons: [{ name: 'Short sword', damage: '1d6+4' }] });
    expect(buildFightSheet(ctx, 99).hp).toBe(40);
    expect(buildFightSheet(undefined, 7)).toMatchObject({ level: 1, maxHp: 10, hp: 7, ac: 12, weapons: [] });
  });
});