import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ session: { access_token: 'tok' } as { access_token: string } | null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: mock.session } }) } },
}));
import { onboardingDraftKey, useEmpyreanOnboardingChat } from '@/hooks/use-empyrean-onboarding-chat';

/** A server reply streamed the way the edge function sends it. */
function streamOf(text: string, pieces = 3): Response {
  const size = Math.ceil(text.length / pieces);
  const chunks = Array.from({ length: pieces }, (_, i) => text.slice(i * size, (i + 1) * size)).filter(Boolean);
  const body = chunks.map(c => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes.slice(0, 7)); c.enqueue(bytes.slice(7)); c.close(); } });
  return { ok: true, status: 200, body: stream, json: async () => ({}) } as unknown as Response;
}
const BUILD = 'Ready.\n```json\n' + JSON.stringify({ action: 'apply_empyrean_campaign', data: {
  empyrean: { dragonName: 'Vyrmora', dragonColor: 'onyx', dragonPersonality: '', signetType: 'Wards', yearAtBasgiath: 'second-year', campaignFocus: 'combat' },
  campaign: { startLocationId: 'basgiath', events: 'off', openingScene: 'Smoke over the flight field. Your dragon lands hard beside you, scales still hot from the run.' },
} }) + '\n```';

const fetchMock = vi.fn();
const opts = (mode: 'rider' | 'campaign' = 'rider') => ({ mode, getLore: () => 'LORE', getRider: () => 'Name: Kaelen' });

describe('useEmpyreanOnboardingChat', () => {
  beforeEach(() => { localStorage.clear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); mock.session = { access_token: 'tok' }; });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('sends the conversation, the mode, the lore and the rider with the player\'s sign-in, and streams the reply', async () => {
    fetchMock.mockResolvedValue(streamOf('Welcome to Basgiath, cadet.\n[SUGGESTIONS: "Quick build", "Walk me through it"]'));
    const { result } = renderHook(() => useEmpyreanOnboardingChat(opts('campaign')));
    await act(async () => { await result.current.sendMessage('Hello'); });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/functions\/v1\/empyrean-onboarding$/);
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ mode: 'campaign', messages: [{ role: 'user', content: 'Hello' }], lore: 'LORE', rider: 'Name: Kaelen' });
    expect(result.current.messages[1]).toEqual({ role: 'assistant', content: 'Welcome to Basgiath, cadet.' });
    expect(result.current.suggestions).toEqual(['Quick build', 'Walk me through it']);
    expect(result.current.result).toBeNull();
  });

  it('turns the final build into a checked result for its own mode only', async () => {
    fetchMock.mockImplementation(async () => streamOf(BUILD, 5));
    const campaignChat = renderHook(() => useEmpyreanOnboardingChat(opts('campaign')));
    await act(async () => { await campaignChat.result.current.sendMessage('Begin'); });
    expect(campaignChat.result.current.result).toMatchObject({ kind: 'campaign', empyrean: { dragonName: 'Vyrmora' }, campaign: { events: 'off' } });
    expect(campaignChat.result.current.suggestions).toEqual([]);
    expect(campaignChat.result.current.messages[1].content).toBe('Ready.');
    const riderChat = renderHook(() => useEmpyreanOnboardingChat(opts('rider')));
    await act(async () => { await riderChat.result.current.sendMessage('Begin'); });
    expect(riderChat.result.current.result).toBeNull(); // a campaign build is not a rider
  });

  it('keeps the chat as a draft across a reload, per mode, until Start over', async () => {
    fetchMock.mockResolvedValue(streamOf('Name your rider.'));
    const first = renderHook(() => useEmpyreanOnboardingChat(opts('rider')));
    await act(async () => { await first.result.current.sendMessage('Hi'); });
    first.unmount();
    expect(localStorage.getItem(onboardingDraftKey('rider'))).toContain('Name your rider.');
    const again = renderHook(() => useEmpyreanOnboardingChat(opts('rider')));
    expect(again.result.current.rawCount).toBe(2);
    expect(renderHook(() => useEmpyreanOnboardingChat(opts('campaign'))).result.current.rawCount).toBe(0);
    act(() => again.result.current.reset());
    expect(again.result.current.rawCount).toBe(0);
    expect(localStorage.getItem(onboardingDraftKey('rider'))).toBeNull();
  });

  it('asks the player to sign in, and reports server errors and cut-off builds', async () => {
    mock.session = null;
    const { result } = renderHook(() => useEmpyreanOnboardingChat(opts()));
    await act(async () => { await result.current.sendMessage('Hi'); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Please sign in first.');

    mock.session = { access_token: 'tok' };
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, body: null, json: async () => ({ error: 'Too many requests. Try again in a moment.' }) });
    await act(async () => { await result.current.sendMessage('Again'); });
    expect(result.current.error).toBe('Too many requests. Try again in a moment.');

    fetchMock.mockResolvedValueOnce(streamOf('```json\n{"action":"apply_empyrean_rider","data":{"name":"Ka'));
    await act(async () => { await result.current.sendMessage('Begin'); });
    await waitFor(() => expect(result.current.error).toMatch(/cut off/));
    expect(result.current.result).toBeNull();
  });
});
