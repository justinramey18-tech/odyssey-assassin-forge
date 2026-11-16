import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));
import { EmpyreanOnboardingChat } from '@/components/empyrean/EmpyreanOnboardingChat';

function reply(text: string) {
  const body = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
  const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(body)); c.close(); } });
  return { ok: true, status: 200, body: stream, json: async () => ({}) };
}
const BUILD = 'Your campaign is ready.\n```json\n' + JSON.stringify({ action: 'apply_empyrean_campaign', data: {
  empyrean: { dragonName: 'Vyrmora', dragonColor: 'onyx', dragonPersonality: '', signetType: 'Wards', yearAtBasgiath: 'graduated rider', campaignFocus: 'combat' },
  campaign: { startLocationId: 'montserrat', events: 'normal', openingScene: 'The outpost bell rings twice. Your dragon is already on the wall, wings half open, watching the pass.' },
} }) + '\n```';

const fetchMock = vi.fn();
describe('EmpyreanOnboardingChat', () => {
  beforeEach(() => { localStorage.clear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('greets the guide by itself, shows its reply and suggestions, and sends a tapped suggestion', async () => {
    fetchMock.mockResolvedValueOnce(reply('Welcome back, Kaelen. What next?\n[SUGGESTIONS: "A border posting", "Surprise me"]'));
    render(<EmpyreanOnboardingChat mode="campaign" characterName="Kaelen" getLore={() => 'LORE'} onBegin={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText('Welcome back, Kaelen. What next?')).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content).toMatch(/I'm Kaelen/);
    expect(screen.queryByText(/I want to start a new Empyrean campaign/)).toBeNull(); // the automatic greeting is not shown
    fetchMock.mockResolvedValueOnce(reply('Montserrat it is.'));
    fireEvent.click(screen.getByText('A border posting'));
    expect(await screen.findByText('Montserrat it is.')).toBeTruthy();
  });

  it('shows the build summary and Begin when the guide sends the build', async () => {
    fetchMock.mockResolvedValueOnce(reply(BUILD));
    const onBegin = vi.fn();
    render(<EmpyreanOnboardingChat mode="campaign" characterName="Kaelen" getLore={() => 'LORE'} onBegin={onBegin} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Starts at Montserrat/)).toBeTruthy());
    expect(screen.getByText(/Vyrmora \(Onyx\)/)).toBeTruthy();
    fireEvent.click(screen.getByText('Begin'));
    expect(onBegin).toHaveBeenCalledWith(expect.objectContaining({ kind: 'campaign', campaign: expect.objectContaining({ startLocationId: 'montserrat' }) }));
  });
});
