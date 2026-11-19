import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgressionWeb } from '@/components/empyrean/ProgressionWeb';
import { webView, normalizeLedger } from '../../../../supabase/functions/empyrean-rules/web';

const web = (xp: number, nodes: string[] = []) => webView(normalizeLedger({ web: { nodes, camps: { c1: xp }, grant: 0 } }));

describe('progression web screen', () => {
  afterEach(() => cleanup());

  it('renders nothing while closed', () => {
    const r = render(<ProgressionWeb open={false} onClose={vi.fn()} web={web(150)} onBuy={vi.fn()} />);
    expect(r.container.innerHTML).toBe('');
  });

  it('says the game server is needed when there is no web', () => {
    render(<ProgressionWeb open onClose={vi.fn()} web={null} onBuy={vi.fn()} />);
    expect(screen.getByText(/needs the game server/)).toBeTruthy();
  });

  it('shows the XP to spend and opens on Channel with its six nodes', () => {
    render(<ProgressionWeb open onClose={vi.fn()} web={web(150)} onBuy={vi.fn()} />);
    expect(screen.getByTestId('web-balance').textContent).toBe('150');
    expect(screen.getByText('Signet Strain limit')).toBeTruthy();
    for (const name of ['First Reserve', 'Second Reserve', 'Third Reserve', 'Tempered Conduit', 'Steady Conduit', 'Deep Well']) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText('Unlock First Reserve first.')).toBeTruthy();
  });

  it('buys only after the confirm step', async () => {
    const onBuy = vi.fn(async () => true);
    render(<ProgressionWeb open onClose={vi.fn()} web={web(150)} onBuy={onBuy} />);
    fireEvent.click(screen.getAllByRole('button', { name: '150 XP' })[0]);
    expect(onBuy).not.toHaveBeenCalled();
    expect(screen.getByText('Spend 150 XP on First Reserve?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Spend 150 XP on First Reserve?')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: '150 XP' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(onBuy).toHaveBeenCalledWith('channel-1'));
    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('a node that cannot be bought has a disabled button', () => {
    render(<ProgressionWeb open onClose={vi.fn()} web={web(0)} onBuy={vi.fn()} />);
    const buttons = screen.getAllByRole('button', { name: /^\d+,?\d* XP$/ }) as HTMLButtonElement[];
    expect(buttons.length).toBe(6);
    expect(buttons.every(b => b.disabled)).toBe(true);
    expect(screen.getByText('You need 150 more XP.')).toBeTruthy();
  });

  it('marks an owned node and offers the next', () => {
    render(<ProgressionWeb open onClose={vi.fn()} web={web(400, ['channel-1'])} onBuy={vi.fn()} />);
    expect(screen.getByText('Owned')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Channel 1/6' })).toBeTruthy();
    const next = screen.getAllByRole('button', { name: '150 XP' }) as HTMLButtonElement[];
    expect(next[0].disabled).toBe(false);
  });

  it('shows the other spokes and the dragon half as coming', () => {
    render(<ProgressionWeb open onClose={vi.fn()} web={web(150)} onBuy={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vitality' }));
    expect(screen.getByText('Coming in a later update.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dragon' }));
    expect(screen.getByRole('button', { name: 'Loyalty' })).toBeTruthy();
    expect(screen.getByText('Coming in a later update.')).toBeTruthy();
  });

  it('closes from the header', () => {
    const onClose = vi.fn();
    render(<ProgressionWeb open onClose={onClose} web={web(150)} onBuy={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
