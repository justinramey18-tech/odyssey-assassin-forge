import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoloWebPanel } from '@/components/empyrean/SoloWebPanel';
import type { RulesWeb } from '@/lib/empyrean-rules-client';
import { normalizeLedger, webView } from '../../../../supabase/functions/empyrean-rules/web';

const web = (nodes: string[], xp: number, kin: number): RulesWeb => webView(normalizeLedger({ web: { nodes, camps: { c1: xp }, grant: 0, kcamps: { c1: kin }, kgrant: 0 } }));

describe('the progression web wall panel', () => {
  afterEach(() => cleanup());

  it('shows what there is to spend on each half and how much of the web is unlocked', () => {
    render(<SoloWebPanel web={web(['vitality-1', 'vigor-1'], 450, 10)} onOpen={vi.fn()} />);
    expect(screen.getByTestId('web-panel-count').textContent).toBe('2 of 180 unlocked');
    // 300 XP left: the next Vitality node and the first node of the other four rider spokes can be unlocked.
    expect(screen.getByRole('button', { name: "Rider's web, 300 XP to spend, 5 to unlock" })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Dragon's web, 7 Kinship to spend, 5 to unlock" })).toBeTruthy();
    expect(screen.getByText('300 XP')).toBeTruthy();
    expect(screen.getByText('7 Kinship')).toBeTruthy();
  });

  it('tapping the silver half opens the rider web and the ember half the dragon web', () => {
    const onOpen = vi.fn();
    render(<SoloWebPanel web={web([], 0, 0)} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: "Rider's web, 0 XP to spend" }));
    expect(onOpen).toHaveBeenLastCalledWith('rider');
    fireEvent.click(screen.getByRole('button', { name: "Dragon's web, 0 Kinship to spend" }));
    expect(onOpen).toHaveBeenLastCalledWith('dragon');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('with no game server it still draws, says so, and still opens (the web screen explains)', () => {
    const onOpen = vi.fn();
    const r = render(<SoloWebPanel web={null} onOpen={onOpen} />);
    expect(screen.getByText('The web needs the game server.')).toBeTruthy();
    expect(r.container.querySelector('img')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "Rider's web" }));
    expect(onOpen).toHaveBeenCalledWith('rider');
  });

  it('a web from an older server (no Kinship yet) reads as none to spend', () => {
    const old = { ...web([], 150, 4), kin: undefined } as RulesWeb;
    render(<SoloWebPanel web={old} onOpen={vi.fn()} />);
    expect(screen.getByText('0 Kinship')).toBeTruthy();
  });
});