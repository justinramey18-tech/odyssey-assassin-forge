import { act, cleanup, renderHook } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmpyreanOpening, OPENING_DELAY_MS, type EmpyreanOpeningOptions } from '@/hooks/use-empyrean-opening';

// A tiny stand-in for the DM chat: sendMessage adds the player's line, newGame empties the chat.
function useChat(start: string[] = []) {
  const [messages, setMessages] = useState<string[]>(start);
  return {
    messages,
    send: (text: string) => setMessages(prev => [...prev, text]),
    reply: (text: string) => setMessages(prev => [...prev, `DM: ${text}`]),
    newGame: () => setMessages([]),
  };
}

type Props = { open: boolean; initialMessage: string | null; startFresh: boolean; tick: number; start?: string[] };

// The logic the DM screen used before CL-067, copied so the test shows what went wrong.
function useLegacy(p: Props) {
  const chat = useChat(p.start);
  const [initialSent, setInitialSent] = useState(false);
  // A new function every render, as the real sendMessage is whenever the screen's inputs change.
  const sendMessage = (text: string) => chat.send(text);
  const newGame = () => chat.newGame();
  useEffect(() => {
    if (p.open && p.initialMessage && !initialSent && p.startFresh && chat.messages.length > 0) { newGame(); return; }
    if (p.open && p.initialMessage && !initialSent && chat.messages.length === 0) {
      const timer = setTimeout(() => { if (!p.initialMessage) return; sendMessage(p.initialMessage); setInitialSent(true); }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open, p.initialMessage, initialSent, chat.messages.length, sendMessage, p.startFresh, newGame, p.tick]);
  return chat;
}

function useFixed(p: Props) {
  const chat = useChat(p.start);
  const opts: EmpyreanOpeningOptions = {
    open: p.open, initialMessage: p.initialMessage, startFresh: p.startFresh,
    messageCount: chat.messages.length, isLoading: false,
    newGame: () => chat.newGame(), sendMessage: (text: string) => chat.send(text),
  };
  useEmpyreanOpening(opts);
  return chat;
}

const SCENE = 'You stand at the foot of the parapet as the wind tears at your uniform.';
const base: Props = { open: true, initialMessage: SCENE, startFresh: true, tick: 0 };

// Re-render the screen every 100 ms for the given time (a busy screen).
async function busy(rerender: (p: Props) => void, props: Props, ms: number) {
  for (let t = 100; t <= ms; t += 100) {
    await act(async () => { vi.advanceTimersByTime(100); });
    rerender({ ...props, tick: t });
  }
}

describe('Empyrean opening scene (CL-067)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('before the fix: a busy screen never sends the opening, and the player\'s message and the DM reply are wiped', async () => {
    const { result, rerender } = renderHook((p: Props) => useLegacy(p), { initialProps: base });
    await busy(rerender, base, 3000);
    expect(result.current.messages).toEqual([]);
    act(() => result.current.send('Begin'));
    expect(result.current.messages).toEqual([]);
    act(() => result.current.reply('Formation, cadet!'));
    expect(result.current.messages).toEqual([]);
  });

  it('a busy screen still sends the opening once', async () => {
    const { result, rerender } = renderHook((p: Props) => useFixed(p), { initialProps: base });
    await busy(rerender, base, 3000);
    expect(result.current.messages).toEqual([SCENE]);
  });

  it('a fresh start clears an older story once, then sends the opening', async () => {
    const props = { ...base, start: ['old 1', 'DM: old 2'] };
    const { result } = renderHook((p: Props) => useFixed(p), { initialProps: props });
    expect(result.current.messages).toEqual([]);
    await act(async () => { vi.advanceTimersByTime(OPENING_DELAY_MS); });
    expect(result.current.messages).toEqual([SCENE]);
    act(() => result.current.reply('The wind howls.'));
    act(() => result.current.send('I climb.'));
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.messages).toEqual([SCENE, 'DM: The wind howls.', 'I climb.']);
  });

  it('a message sent before the opening goes out is kept, and the opening is not sent on top of it', async () => {
    const { result } = renderHook((p: Props) => useFixed(p), { initialProps: base });
    act(() => result.current.send('Begin'));
    act(() => result.current.reply('Formation, cadet!'));
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.messages).toEqual(['Begin', 'DM: Formation, cadet!']);
  });

  it('without a fresh start, a story already running is left alone', async () => {
    const props = { ...base, startFresh: false, start: ['mine'] };
    const { result } = renderHook((p: Props) => useFixed(p), { initialProps: props });
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.messages).toEqual(['mine']);
  });

  it('nothing is sent while closed; reopening an empty chat sends it again', async () => {
    const closed = { ...base, open: false, startFresh: false };
    const { result, rerender } = renderHook((p: Props) => useFixed(p), { initialProps: closed });
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.messages).toEqual([]);
    rerender({ ...closed, open: true });
    await act(async () => { vi.advanceTimersByTime(OPENING_DELAY_MS); });
    expect(result.current.messages).toEqual([SCENE]);
    act(() => result.current.newGame());
    rerender({ ...closed, open: false });
    rerender({ ...closed, open: true, tick: 1 });
    await act(async () => { vi.advanceTimersByTime(OPENING_DELAY_MS); });
    expect(result.current.messages).toEqual([SCENE]);
  });

  it('closing before the delay ends cancels the send', async () => {
    const { result, rerender } = renderHook((p: Props) => useFixed(p), { initialProps: base });
    rerender({ ...base, open: false });
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.messages).toEqual([]);
  });
});
