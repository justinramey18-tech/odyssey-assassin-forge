import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const record = vi.hoisted(() => ({ unread: [] as string[] }));
vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock('@/lib/dragon-record', () => ({
  loadSoloDragonState: () => ({ trust: 40, bond: 30, mood: 'calm', memories: [], speechHabits: [], riderEmotionalLog: [], unreadDragonMessages: record.unread }),
}));

import { useDragonVoice, type UseDragonVoiceOptions } from '@/hooks/use-dragon-voice';
import { saveVoiceMode } from '@/lib/dragon-voice';

const POST = 'The squad files out of the briefing room in silence, and nobody meets your eyes. '.repeat(4);

function setup(over: Partial<UseDragonVoiceOptions> = {}) {
  const calls = { addUnread: vi.fn((t: string) => { record.unread = [...record.unread, t]; }), clearUnread: vi.fn(() => { record.unread = []; }), turnToDragon: vi.fn(), ask: vi.fn(async (_prompt: string) => 'FEEL: 9\nLINE: You are a fool to trust him.') };
  const moment = { strain: 0, strainMax: 8, hp: 30, hpMax: 30, fightOpen: false };
  const props: UseDragonVoiceOptions = {
    enabled: true, campaignKey: 'c1', dragonName: 'Tairn', riderName: 'Violet', dragonNotes: '', facing: false,
    getMoment: () => moment, recentStory: () => ['An earlier post.'], ...calls, ...over,
  };
  const view = renderHook((p: UseDragonVoiceOptions) => useDragonVoice(p), { initialProps: props });
  return { view, calls: { ...calls, ...over } as typeof calls, moment, props };
}

const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };

describe('useDragonVoice', () => {
  beforeEach(() => { localStorage.clear(); record.unread = []; vi.useFakeTimers({ now: new Date('2026-11-19T12:00:00') }); });
  afterEach(() => { vi.useRealTimers(); });

  it('a strong opinion: one AI call, an unread line, and the turn at once when the rider is idle', async () => {
    const { view, calls } = setup();
    act(() => view.result.current.onDmPost(POST));
    await settle();
    expect(calls.ask).toHaveBeenCalledTimes(1);
    expect(String(calls.ask.mock.calls[0][0])).toContain('PUSHING INTO YOUR RIDER');
    expect(calls.addUnread).toHaveBeenCalledWith('You are a fool to trust him.');
    expect(calls.turnToDragon).toHaveBeenCalledTimes(1);
    expect(view.result.current.flash).toBe(true);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(view.result.current.flash).toBe(false);
  });

  it('a mild feeling stays unsaid', async () => {
    const ask = vi.fn(async () => 'FEEL: 4\nLINE: Hm.');
    const { view, calls } = setup({ ask });
    act(() => view.result.current.onDmPost(POST));
    await settle();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(calls.addUnread).not.toHaveBeenCalled();
    expect(calls.turnToDragon).not.toHaveBeenCalled();
  });

  it('after he speaks, the next posts cost no AI call (the brakes)', async () => {
    const { view, calls } = setup();
    act(() => view.result.current.onDmPost(POST));
    await settle();
    act(() => view.result.current.onDmPost(POST));
    act(() => view.result.current.onDmPost(POST));
    await settle();
    expect(calls.ask).toHaveBeenCalledTimes(1);
  });

  it('switched off, in a fight or unbonded: no AI call at all', async () => {
    saveVoiceMode('off');
    const off = setup();
    act(() => off.view.result.current.onDmPost(POST));
    await settle();
    expect(off.calls.ask).not.toHaveBeenCalled();
    saveVoiceMode('rare');
    const fight = setup();
    fight.moment.fightOpen = true;
    act(() => fight.view.result.current.onDmPost(POST));
    await settle();
    expect(fight.calls.ask).not.toHaveBeenCalled();
    const unbonded = setup({ enabled: false });
    act(() => unbonded.view.result.current.onDmPost(POST));
    await settle();
    expect(unbonded.calls.ask).not.toHaveBeenCalled();
  });

  it('while the rider is typing the turn waits for 2 quiet seconds', async () => {
    const { view, calls } = setup();
    act(() => { window.dispatchEvent(new Event('input')); });
    act(() => view.result.current.onDmPost(POST));
    await settle();
    expect(calls.addUnread).toHaveBeenCalledTimes(1);
    expect(calls.turnToDragon).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1200); window.dispatchEvent(new Event('input')); });
    act(() => { vi.advanceTimersByTime(1200); });
    expect(calls.turnToDragon).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(calls.turnToDragon).toHaveBeenCalledTimes(1);
  });

  it('already facing him: the line appears as his bubble, with no unread and no turn', async () => {
    const { view, calls } = setup({ facing: true });
    act(() => view.result.current.onDmPost(POST));
    await settle();
    expect(calls.addUnread).not.toHaveBeenCalled();
    expect(calls.turnToDragon).not.toHaveBeenCalled();
    expect(view.result.current.incoming.map(l => l.text)).toEqual(['You are a fool to trust him.']);
    const ids = view.result.current.incoming.map(l => l.id);
    act(() => view.result.current.onIncomingShown(ids));
    expect(view.result.current.incoming).toEqual([]);
  });

  it('opening the chat turns unread lines into bubbles and marks them read', () => {
    record.unread = ['A whisper from the story.', 'You are a fool to trust him.'];
    const { view, calls } = setup();
    act(() => view.result.current.takeUnread());
    expect(view.result.current.incoming.map(l => l.text)).toEqual(['A whisper from the story.', 'You are a fool to trust him.']);
    expect(calls.clearUnread).toHaveBeenCalledTimes(1);
    expect(new Set(view.result.current.incoming.map(l => l.id)).size).toBe(2);
  });

  it('a big moment speaks even at a low number, and a fight that starts meanwhile silences him', async () => {
    const ask = vi.fn(async () => 'FEEL: 2\nLINE: Stop. You are burning.');
    const strain = setup({ ask });
    strain.moment.strain = 6;
    act(() => strain.view.result.current.onDmPost('Short.'));
    await settle();
    expect(strain.calls.addUnread).toHaveBeenCalledWith('Stop. You are burning.');

    localStorage.clear();
    let release: (v: string) => void = () => {};
    const slow = vi.fn(() => new Promise<string>(r => { release = r; }));
    const late = setup({ ask: slow });
    act(() => late.view.result.current.onDmPost(POST));
    late.moment.fightOpen = true;
    await act(async () => { release('FEEL: 10\nLINE: Behind you.'); await Promise.resolve(); await Promise.resolve(); });
    expect(late.calls.addUnread).not.toHaveBeenCalled();
  });

  it('keeps what was said for the DM until it is cleared', () => {
    const { view } = setup();
    expect(view.result.current.bondNote()).toBe('');
    act(() => {
      view.result.current.onBondLine({ who: 'dragon', text: 'You are a fool to trust him.' });
      view.result.current.onBondLine({ who: 'rider', text: 'He saved my life.' });
    });
    const note = view.result.current.bondNote();
    expect(note).toContain('Tairn: You are a fool to trust him.');
    expect(note).toContain('Violet: He saved my life.');
    act(() => view.result.current.clearBondNote());
    expect(view.result.current.bondNote()).toBe('');
  });
});
