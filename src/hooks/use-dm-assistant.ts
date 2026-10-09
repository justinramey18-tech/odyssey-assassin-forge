// State and network for the Human DM Assistant (host only, Party DM screen).
// The assistant talks through the shared ai-dm function using a custom
// instruction sheet (systemPromptOverride), so the server is unchanged.

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/auth-token';
import { loadApiKey } from '@/lib/api-keys';
import {
  type AssistantBible,
  type AssistantChatMessage,
  type AssistantDraft,
  type AssistantLiveContext,
  EMPTY_DRAFT,
  DIGEST_SYSTEM_PROMPT,
  buildAssistantMessages,
  buildAssistantSystemPrompt,
  buildDigestMessages,
  clearAssistantState,
  clearDigest,
  draftFromText,
  estimateTokens,
  hashText,
  isDigestCurrent,
  loadAssistantModel,
  loadAssistantState,
  loadDigest,
  parseAssistantReply,
  resolveAssistantModel,
  saveAssistantModel,
  saveAssistantState,
  saveDigest,
  visibleWhileStreaming,
} from '@/lib/dm-assistant';

const AI_DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;

/** One streamed call to ai-dm with a custom instruction sheet. Returns the full text. */
async function streamFromAiDm(opts: {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  model: string;
  maxTokens: number;
  signal: AbortSignal;
  onText?: (full: string) => void;
}): Promise<string> {
  const token = await getAuthToken();
  const response = await fetch(AI_DM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: opts.messages,
      systemPromptOverride: opts.systemPrompt,
      model: opts.model,
      maxTokens: opts.maxTokens,
      user_api_key: loadApiKey('anthropic') || undefined,
      user_openai_key: loadApiKey('openai') || undefined,
      user_perplexity_key: loadApiKey('perplexity') || undefined,
      user_xai_key: loadApiKey('xai') || undefined,
      user_venice_key: loadApiKey('venice') || undefined,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `The assistant could not be reached (${response.status}).`);
  }
  if (!response.body) throw new Error('No response from the assistant.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let finished = false;
  while (!finished) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { finished = true; break; }
      try {
        const parsed = JSON.parse(json);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          full += delta;
          opts.onText?.(full);
        }
      } catch { /* partial line or usage chunk */ }
    }
  }
  reader.cancel().catch(() => {});
  return full;
}

export type DigestStatus = 'none' | 'ready' | 'stale' | 'building' | 'error' | 'no-guides';

interface UseDmAssistantOptions {
  partyId: string | null;
  /** The party's shared DM model, used as the first default. */
  partyModel?: string | null;
  /** Read at send time, so the big screen never re-renders for the assistant. */
  getContext: () => AssistantLiveContext;
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function useDmAssistant({ partyId, partyModel, getContext }: UseDmAssistantOptions) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => loadAssistantState(partyId).messages);
  const [draft, setDraft] = useState<AssistantDraft>(() => loadAssistantState(partyId).draft);
  const [model, setModelState] = useState<string>(() => loadAssistantModel(partyModel));
  const [fullBible, setFullBible] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [writingDraft, setWritingDraft] = useState(false);
  const [digestStatus, setDigestStatus] = useState<DigestStatus>('none');
  const [digestBuiltAt, setDigestBuiltAt] = useState<string | null>(null);
  const [lastSendTokens, setLastSendTokens] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const getContextRef = useRef(getContext);
  getContextRef.current = getContext;
  // The party the in-memory chat belongs to, so a party switch never saves one party's chat under another.
  const ownerRef = useRef(partyId);

  useEffect(() => {
    if (ownerRef.current === partyId) return;
    abortRef.current?.abort();
    const saved = loadAssistantState(partyId);
    ownerRef.current = partyId;
    setMessages(saved.messages);
    setDraft(saved.draft);
  }, [partyId]);

  // Save the chat and draft on this phone whenever they change.
  useEffect(() => {
    saveAssistantState(ownerRef.current, { messages, draft });
  }, [messages, draft]);

  const setModel = useCallback((id: string) => {
    setModelState(id);
    saveAssistantModel(id);
  }, []);

  const refreshDigestStatus = useCallback(() => {
    const guides = (getContextRef.current().guides || '').trim();
    if (!guides) { setDigestStatus('no-guides'); setDigestBuiltAt(null); return; }
    const rec = loadDigest(partyId);
    if (!rec) { setDigestStatus('none'); setDigestBuiltAt(null); return; }
    setDigestBuiltAt(rec.builtAt);
    setDigestStatus(isDigestCurrent(rec, guides) ? 'ready' : 'stale');
  }, [partyId]);

  /** Use the saved digest, or build it once now. Falls back to the full guides if building fails. */
  const ensureBible = useCallback(async (guidesRaw: string, modelId: string, signal: AbortSignal): Promise<AssistantBible> => {
    const guides = (guidesRaw || '').trim();
    if (!guides) return { mode: 'none', text: '' };
    const rec = loadDigest(partyId);
    if (isDigestCurrent(rec, guides)) return { mode: 'digest', text: rec!.text };

    setDigestStatus('building');
    try {
      const text = (await streamFromAiDm({
        systemPrompt: DIGEST_SYSTEM_PROMPT,
        messages: buildDigestMessages(guides),
        model: modelId,
        maxTokens: 4000,
        signal,
      })).trim();
      if (!text) throw new Error('empty digest');
      const builtAt = new Date().toISOString();
      saveDigest(partyId, { hash: hashText(guides), text, builtAt, model: modelId });
      setDigestStatus('ready');
      setDigestBuiltAt(builtAt);
      return { mode: 'digest', text };
    } catch (err) {
      if (signal.aborted) throw err;
      console.error('[dm-assistant] digest build failed:', err);
      setDigestStatus('error');
      toast.warning('Could not build the World Bible digest', {
        description: 'Sent the full guides with this message instead.',
      });
      return { mode: 'full', text: guides };
    }
  }, [partyId]);

  const send = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || abortRef.current) return;

    const history = messagesRef.current;
    const hostMsg: AssistantChatMessage = { id: newId(), role: 'host', text, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, hostMsg]);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setStreamingText('');
    setWritingDraft(false);

    let partial = '';
    try {
      const ctx = getContextRef.current();
      const modelId = resolveAssistantModel(model);
      if (modelId !== model) {
        toast.info('That model needs your own API key on this phone', { description: 'Using the default model for this message.' });
      }

      const bible: AssistantBible = fullBible
        ? { mode: 'full', text: ctx.guides || '' }
        : await ensureBible(ctx.guides || '', modelId, controller.signal);

      const handoff = buildAssistantSystemPrompt(ctx, bible, draftRef.current);
      const apiMessages = buildAssistantMessages(history, text);
      const sentChars = handoff.chars + apiMessages.reduce((n, m) => n + m.content.length, 0);
      setLastSendTokens(estimateTokens(sentChars));

      const raw = await streamFromAiDm({
        systemPrompt: handoff.systemPrompt,
        messages: apiMessages,
        model: modelId,
        maxTokens: 8000,
        signal: controller.signal,
        onText: full => {
          partial = full;
          const view = visibleWhileStreaming(full);
          setStreamingText(view.text);
          setWritingDraft(view.writingDraft);
        },
      });

      const parsed = parseAssistantReply(raw);
      if (!parsed.chatText && !parsed.draftText) {
        throw new Error('The assistant sent back an empty reply. Try again, or pick another model.');
      }
      if (parsed.draftText) setDraft(draftFromText(parsed.draftText));
      setMessages(prev => [...prev, {
        id: newId(),
        role: 'assistant',
        text: parsed.chatText || 'Draft updated.',
        draftUpdated: !!parsed.draftText,
        createdAt: new Date().toISOString(),
      }]);
      // "Full Bible" is for one message only.
      if (fullBible) setFullBible(false);
    } catch (err) {
      if (controller.signal.aborted) {
        const shown = visibleWhileStreaming(partial).text;
        setMessages(prev => [...prev, {
          id: newId(),
          role: 'assistant',
          text: shown ? `${shown}\n\n(stopped)` : '(stopped)',
          createdAt: new Date().toISOString(),
        }]);
      } else {
        const msg = err instanceof Error ? err.message : 'The assistant could not be reached.';
        console.error('[dm-assistant] send failed:', err);
        setError(msg);
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      setStreamingText('');
      setWritingDraft(false);
      refreshDigestStatus();
    }
  }, [model, fullBible, ensureBible, refreshDigestStatus]);

  /** Resend the last host message after an error. */
  const retryLast = useCallback(() => {
    const last = messagesRef.current[messagesRef.current.length - 1];
    if (!last || last.role !== 'host') return;
    setMessages(prev => prev.slice(0, -1));
    messagesRef.current = messagesRef.current.slice(0, -1);
    void send(last.text);
  }, [send]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  /** Start a fresh chat and clear the draft (used by "New chat" and after Apply). */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setDraft({ ...EMPTY_DRAFT, whispers: [] });
    setError(null);
    clearAssistantState(ownerRef.current);
  }, []);

  /** Forget the saved digest so it is rebuilt on the next message. */
  const rebuildDigest = useCallback(() => {
    clearDigest(partyId);
    refreshDigestStatus();
    toast.info('The World Bible digest will be rebuilt with your next message.');
  }, [partyId, refreshDigestStatus]);

  return {
    messages,
    draft,
    setDraft,
    model,
    setModel,
    fullBible,
    setFullBible,
    isStreaming,
    streamingText,
    writingDraft,
    digestStatus,
    digestBuiltAt,
    refreshDigestStatus,
    rebuildDigest,
    lastSendTokens,
    error,
    send,
    retryLast,
    stop,
    reset,
  };
}
