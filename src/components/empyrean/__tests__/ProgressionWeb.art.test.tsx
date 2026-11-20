// The progression web's look: painted medallions, each half's own light, sparks on owned paths,
// the burst and the sound on an unlock, and opening on the half the hall's wall panel asked for.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressionWeb } from '@/components/empyrean/ProgressionWeb';
import type { RulesWeb } from '@/lib/empyrean-rules-client';
import { playWebUnlock, setWebSound } from '@/lib/empyrean-web-sounds';
import { webView, normalizeLedger } from '../../../../supabase/functions/empyrean-rules/web';

vi.mock('@/lib/empyrean-web-sounds', () => ({ playWebUnlock: vi.fn(), setWebSound: vi.fn(), webSoundOn: vi.fn(() => true) }));

const web = (nodes: string[] = [], xp = 50_000, kin = 500): RulesWeb => webView(normalizeLedger({ web: { nodes, camps: { c1: xp }, grant: 0, kcamps: { c1: kin }, kgrant: 0 } }));
const node = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}, `) });
const five = (b: string) => [1, 2, 3, 4, 5].map(i => `${b}-${i}`);
const art = (testId: string) => String(screen.getByTestId(testId).style.backgroundImage);

describe('progression web: the painted look', () => {
  beforeEach(() => { vi.mocked(playWebUnlock).mockClear(); vi.mocked(setWebSound).mockClear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('every node wears a medallion: a trunk node its spoke, a branch node its branch, a capstone its own', () => {
    render(<ProgressionWeb open onClose={vi.fn()} web={web()} onBuy={vi.fn()} />);
    expect(node('Hale').getAttribute('data-art')).toBe('rider-1:1');
    expect(node('Whetted').getAttribute('data-art')).toBe('rider-1:3');
    expect(node('Keen Edge').getAttribute('data-art')).toBe('rider-3:1');
    expect(node('Killing Stroke').getAttribute('data-art')).toBe('rider-5:2');
    expect(node('Deep Well').getAttribute('data-art')).toBe('rider-4:6');
    expect(screen.getAllByRole('button', { name: /, (owned|can unlock|locked)$/ }).every(b => b.hasAttribute('data-art'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Dragon' }));
    expect(node('Hearty').getAttribute('data-art')).toBe('dragon-1:1');
    expect(node('Inferno').getAttribute('data-art')).toBe('dragon-3:4');
    expect(node('Devoted').getAttribute('data-art')).toBe('dragon-2:9');
  });

  it('the state of a node is still said in words, and shown by more than colour', () => {
    render(<ProgressionWeb open onClose={vi.fn()} web={web(['vitality-1'], 300)} onBuy={vi.fn()} />);
    const owned = screen.getByRole('button', { name: 'Hale, owned' });
    const open = screen.getByRole('button', { name: /^Whetted, can unlock$/ });
    const locked = screen.getByRole('button', { name: /^Keen Edge, locked$/ });
    // A greyed painting for a locked node, a beckoning ring only on one that can be unlocked, and a badge on all three.
    expect((locked.firstElementChild as HTMLElement).style.filter).toContain('grayscale');
    expect((owned.firstElementChild as HTMLElement).style.filter).toBe('');
    expect(open.querySelector('.web-beckon')).toBeTruthy();
    expect(owned.querySelector('.web-beckon')).toBeNull();
    expect(locked.querySelector('.web-beckon')).toBeNull();
    for (const b of [owned, open, locked]) expect(b.querySelector('svg')).toBeTruthy();
  });

  it('each half has its own stone, hub and token; the chosen node shows its medallion', () => {
    render(<ProgressionWeb open onClose={vi.fn()} web={web()} onBuy={vi.fn()} />);
    expect(screen.getByTestId('web-backdrop').getAttribute('src')).toContain('empyrean-web-backdrop');
    expect(art('web-hub')).toContain('empyrean-web-rider-1');
    expect(art('web-token')).toContain('empyrean-web-rider-1');
    expect(screen.queryByTestId('web-chosen-art')).toBeNull();
    fireEvent.click(node('Deep Well'));
    expect(art('web-chosen-art')).toContain('empyrean-web-rider-4');
    fireEvent.click(screen.getByRole('button', { name: 'Dragon' }));
    expect(art('web-hub')).toContain('empyrean-web-dragon-1');
    expect(art('web-token')).toContain('empyrean-web-dragon-1');
  });

  it('a spark runs along every owned path, on the half being looked at, and never more than 48 at once', () => {
    const r = render(<ProgressionWeb open onClose={vi.fn()} web={web(['vitality-1', 'vitality-2', 'vigor-1'])} onBuy={vi.fn()} />);
    expect(screen.getAllByTestId('web-spark').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Dragon' }));
    expect(screen.getAllByTestId('web-spark').length).toBe(1);
    const all = web().spokes.filter(s => s.half === 'rider').flatMap(s => s.nodes.map(n => n.id));
    r.rerender(<ProgressionWeb open onClose={vi.fn()} web={web(all)} onBuy={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rider' }));
    expect(screen.getAllByTestId('web-spark').length).toBe(48);
    expect(screen.getAllByTestId('web-spark')[0].className).toContain('web-spark');
  });

  it('a node unlocked while the screen is open ignites and sounds, once; opening the screen never does', () => {
    vi.useFakeTimers();
    const r = render(<ProgressionWeb open onClose={vi.fn()} web={web(['vitality-1'])} onBuy={vi.fn()} />);
    expect(screen.queryByTestId('web-ignite')).toBeNull();
    expect(playWebUnlock).not.toHaveBeenCalled();
    r.rerender(<ProgressionWeb open onClose={vi.fn()} web={web(['vitality-1', 'vitality-2'])} onBuy={vi.fn()} />);
    expect(screen.getByTestId('web-ignite')).toBeTruthy();
    expect(playWebUnlock).toHaveBeenCalledTimes(1);
    expect(playWebUnlock).toHaveBeenLastCalledWith('small', 'rider');
    act(() => { vi.advanceTimersByTime(1200); });
    expect(screen.queryByTestId('web-ignite')).toBeNull();
    // A capstone on the dragon's half says so to the sound.
    r.rerender(<ProgressionWeb open onClose={vi.fn()} web={web(['vitality-1', 'vitality-2', ...five('vigor'), ...five('mend').slice(0, 4)])} onBuy={vi.fn()} />);
    expect(playWebUnlock).toHaveBeenCalledTimes(1);
    r.rerender(<ProgressionWeb open onClose={vi.fn()} web={web(['vitality-1', 'vitality-2', ...five('vigor'), ...five('mend')])} onBuy={vi.fn()} />);
    expect(playWebUnlock).toHaveBeenLastCalledWith('capstone', 'dragon');
    // Closed and opened again: nothing fires for what is already owned.
    r.rerender(<ProgressionWeb open={false} onClose={vi.fn()} web={web(['vitality-1', 'vitality-2', 'vitality-3'])} onBuy={vi.fn()} />);
    r.rerender(<ProgressionWeb open onClose={vi.fn()} web={web(['vitality-1', 'vitality-2', 'vitality-3'])} onBuy={vi.fn()} />);
    expect(playWebUnlock).toHaveBeenCalledTimes(2);
  });

  it('the unlock sounds can be switched off, and the choice is kept', () => {
    render(<ProgressionWeb open onClose={vi.fn()} web={web()} onBuy={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn the unlock sounds off' }));
    expect(setWebSound).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Turn the unlock sounds on' }));
    expect(setWebSound).toHaveBeenLastCalledWith(true);
  });

  it('opens on the half it was asked for, each time it opens; left alone it stays where the rider left it', () => {
    const r = render(<ProgressionWeb open onClose={vi.fn()} web={web()} onBuy={vi.fn()} startHalf="dragon" />);
    expect(screen.getByText(/Kinship to spend/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rider' }));
    expect(screen.getByText(/XP to spend/)).toBeTruthy();
    r.rerender(<ProgressionWeb open={false} onClose={vi.fn()} web={web()} onBuy={vi.fn()} startHalf="dragon" />);
    r.rerender(<ProgressionWeb open onClose={vi.fn()} web={web()} onBuy={vi.fn()} startHalf="dragon" />);
    expect(screen.getByText(/Kinship to spend/)).toBeTruthy();
    // From the sheet (no half asked for) it opens where it was last.
    fireEvent.click(screen.getByRole('button', { name: 'Rider' }));
    r.rerender(<ProgressionWeb open={false} onClose={vi.fn()} web={web()} onBuy={vi.fn()} />);
    r.rerender(<ProgressionWeb open onClose={vi.fn()} web={web()} onBuy={vi.fn()} />);
    expect(screen.getByText(/XP to spend/)).toBeTruthy();
  });
});
