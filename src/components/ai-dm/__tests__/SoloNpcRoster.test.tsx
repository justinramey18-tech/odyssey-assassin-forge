import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoloNpcRoster } from '@/components/empyrean/SoloNpcRoster';
import { SoloFightSetupSheet } from '@/components/empyrean/SoloFightSetupSheet';
import { buildRoster } from '@/lib/solo-npcs';
import type { SoloNpcs } from '@/hooks/use-solo-npcs';

const roster = buildRoster([
  { id: '1', campaign_id: 'c', npc_key: 'dain-aetos', name: 'Dain Aetos', custom: null, attitude: -1, memories: ['Kylar broke formation.'], status: 'met' },
], 'fw');
const npcs = (over: Partial<SoloNpcs> = {}): SoloNpcs => ({
  ready: true, era: 'fw', setEra: vi.fn(), roster, entry: (k) => roster.find(e => e.key === k), mention: () => null,
  setStatus: vi.fn(async () => {}), remove: vi.fn(async () => {}), build: vi.fn(async () => null), building: false, onStory: vi.fn(), ...over,
});

describe('People: the solo roster and Mind screen (D-38)', () => {
  afterEach(() => cleanup());

  it('lists Met and the rest of the era\'s cast, never secret survivors', () => {
    render(<SoloNpcRoster open onOpenChange={vi.fn()} npcs={npcs()} riderName="Kylar" onTalk={vi.fn()} />);
    expect(screen.getByText('Met (1)')).toBeTruthy();
    expect(screen.getByText('Dain Aetos')).toBeTruthy();
    expect(screen.getByText('Violet Sorrengail')).toBeTruthy();
    expect(screen.queryByText('Brennan Sorrengail')).toBeNull();
    expect(screen.queryByText('Sloane Mairi')).toBeNull();
  });

  it('the Mind screen shows feelings and memories but never secrets; Talk and Fight hand off', () => {
    const onTalk = vi.fn();
    const onFight = vi.fn();
    render(<SoloNpcRoster open onOpenChange={vi.fn()} npcs={npcs()} riderName="Kylar" onTalk={onTalk} onFight={onFight} />);
    fireEvent.click(screen.getByText('Dain Aetos'));
    expect(screen.getAllByText('wary').length).toBeGreaterThan(0);
    expect(screen.getByText('Kylar broke formation.')).toBeTruthy();
    expect(screen.queryByText(/report on them/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Fight/ }));
    expect(onFight).toHaveBeenCalledWith(expect.objectContaining({ key: 'dain-aetos', fight: { kind: 'rider', challenge: 'hard' } }));
  });

  it('switching the era goes through the hook', () => {
    const setEra = vi.fn();
    render(<SoloNpcRoster open onOpenChange={vi.fn()} npcs={npcs({ setEra })} riderName="Kylar" onTalk={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Year 2' }));
    expect(setEra).toHaveBeenCalledWith('if');
  });

  it('a fight against a roster NPC starts with their name, kind and danger', () => {
    const onStart = vi.fn();
    render(<SoloFightSetupSheet mode="fight" onOpenChange={vi.fn()} bonded={false} flying={false} busy={false} onStart={onStart}
      preset={{ foeKind: 'rider', foeName: 'Dain Aetos', challenge: 'hard' }} />);
    expect(screen.getByText('Against Dain Aetos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Fight$/ }));
    expect(onStart).toHaveBeenCalledWith({ foeKind: 'rider', foeName: 'Dain Aetos', count: 1, challenge: 'hard', lethal: true, arena: 'ground' });
  });
});
