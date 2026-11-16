// The chat with the Empyrean onboarding assistant (server function empyrean-onboarding).
// Streams replies, keeps the conversation as a draft for a day (so a reload or an account switch
// doesn't lose it), and turns the assistant's final build into a checked result.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  displayText, extractOnboardingResult, looksLikeBrokenResult, parseSuggestions, type OnboardingResult,
} from '@/lib/empyrean-onboarding';

export type OnboardingMode = 'rider' | 'campaign';
export interface OnboardingMessage { role: 'user' | 'assistant'; content: string }

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/empyrean-onboarding`;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Plain phone storage, not per character: a new rider has no save yet, and the draft must be
// carried as-is when the player switches to the separate Empyrean account (D-28).
export const onboardingDraftKey = (mode: OnboardingMode) => `odyssey-empyrean-onboarding-draft-${mode}`;

function loadDraft(mode: OnboardingMode): OnboardingMessage[] {
  try {
    const raw = localStorage.getItem(onboardingDraftKey(mode));
    if (!raw) return [];
    const d = JSON.parse(raw);
    if (typeof d?.savedAt !== 'number' || Date.now() - d.savedAt > DRAFT_MAX_AGE_MS || !Array.isArray(d.messages)) {
      localStorage.removeItem(onboardingDraftKey(mode));
      return [];
    }
    return d.messages.filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string');
  } catch {
    return [];
  }
}

/** Read the OpenAI-style event stream the server sends, calling onText for each piece. */
async function readStream(body: ReadableStream<Uint8Array>, onText: (t: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const handle = (line: string): boolean => {
    const l = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (!l.startsWith('data: ')) return false;
    const payload = l.slice(6).trim();
    if (payload === '[DONE]') return true;
    try {
      const piece = JSON.parse(payload)?.choices?.[0]?.delta?.content;
      if (typeof piece === 'string' && piece) onText(piece);
    } catch { /* a broken line: skip it */ }
    return false;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (handle(line)) return;
    }
  }
  if (buffer.trim()) handle(buffer);
}

export interface OnboardingChatOptions {
  mode: OnboardingMode;
  /** The lore guides text (see empyrean-onboarding.ts). Read when each message is sent. */
  getLore: () => string;
  /** The existing rider, for 'campaign' mode. */
  getRider?: () => string;
}

export function useEmpyreanOnboardingChat(opts: OnboardingChatOptions) {
  const { mode } = opts;
  const [messages, setMessages] = useState<OnboardingMessage[]>(() => loadDraft(mode));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optsRef = useRef(opts); optsRef.current = opts;
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages); messagesRef.current = messages;

  useEffect(() => {
    if (isLoading) return;
    try {
      if (messages.length) localStorage.setItem(onboardingDraftKey(mode), JSON.stringify({ messages, savedAt: Date.now() }));
    } catch { /* storage full: the chat still works, it just won't survive a reload */ }
  }, [messages, isLoading, mode]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = useCallback(async (input: string) => {
    const content = input.trim();
    if (!content || abortRef.current) return;
    const history: OnboardingMessage[] = [...messagesRef.current, { role: 'user', content }];
    setMessages(history);
    setError(null);
    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let reply = '';
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setError('Please sign in first.'); return; }
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode, messages: history, lore: optsRef.current.getLore(), rider: optsRef.current.getRider?.() ?? '' }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        const body = await resp.json().catch(() => ({}));
        setError(typeof body?.error === 'string' ? body.error : 'The guide could not answer. Try again.');
        return;
      }
      await readStream(resp.body, piece => {
        reply += piece;
        setMessages([...history, { role: 'assistant', content: reply }]);
      });
      if (!reply.trim()) setError('The guide sent an empty answer. Try again.');
      else if (looksLikeBrokenResult(reply)) setError('The build was cut off. Ask the guide to send it again.');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setError('Connection lost. Try again.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  }, [mode]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setIsLoading(false);
    try { localStorage.removeItem(onboardingDraftKey(mode)); } catch { /* ignore */ }
  }, [mode]);

  const last = messages[messages.length - 1];
  const result: OnboardingResult | null = useMemo(() => {
    if (isLoading || last?.role !== 'assistant') return null;
    const r = extractOnboardingResult(last.content);
    return r && r.kind === (mode === 'rider' ? 'rider' : 'campaign') ? r : null;
  }, [last, isLoading, mode]);
  const suggestions = useMemo(
    () => (!isLoading && last?.role === 'assistant' && !result ? parseSuggestions(last.content) : []),
    [last, isLoading, result],
  );
  const shown = useMemo(
    () => messages.map(m => (m.role === 'assistant' ? { ...m, content: displayText(m.content) } : m)),
    [messages],
  );

  return { messages: shown, rawCount: messages.length, isLoading, error, result, suggestions, sendMessage, reset };
}
