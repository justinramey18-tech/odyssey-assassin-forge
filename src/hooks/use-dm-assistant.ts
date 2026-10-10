// State and network for the Human DM Assistant (host only, Party DM screen).
// The assistant talks through the shared ai-dm function using a custom
// instruction sheet (systemPromptOverride), so the server is unchanged.

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/auth-token';
import { parseHostRoll, parseRollRequest, rollDice, rollForAssistant } from '@/lib/dm-dice';
import { loadApiKey } from '@/lib/api-keys';
import {
  type AssistantBible,
  type AssistantChatMessage,
  type AssistantDraft,
  type AssistantLiveContext,
  type AssistantMode,
  type AssistantPersona,
  type DraftEdit,
  EMPTY_DRAFT,
  applyDraftEdits,
  DIGEST_SYSTEM_PROMPT,
  buildAssistantSystemPrompt,
  buildDigestMessages,
  buildSessionMessages,
  clearAssistantState,
  clearDigest,
  draftFromText,
  estimateTokens,
  hashText,
  isDigestCurrent,
  loadAssistantModel,
  loadBrainstormModel,
  loadAssistantMode,
  loadAssistantPersona,
  loadRecentNpcs,
  loadAssistantState,
  loadDigest,
  parseAssistantReply,
  resolveAssistantModel,
  saveAssistantModel,
  saveBrainstormModel,
  saveAssistantMode,
  saveAssistantPersona,
  saveRecentNpc,
  splitParagraphs,
  saveAssistantState,
  saveDigest,
  visibleWhileStreaming,
} from '@/lib/dm-assistant';
import { buildSceneWeavePrompt, isOutOfCharacter, sceneToStory, type SceneLine } from '@/lib/dm-assistant-scenes';

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

/** What the last reply changed, so the panel can highlight it. Positions are 0-based in the new draft. */
export interface DraftChange {
  kind: 'new' | 'edit';
  paragraphs: number[];
  whispers: number[];
  at: number;
}

/** One step of undo: the draft before an assistant change, and the draft it produced. */
interface UndoStep {
  before: AssistantDraft;
  after: AssistantDraft;
  note: string;
}

const MAX_UNDO = 10;
const sameDraft = (x: AssistantDraft, y: AssistantDraft) => JSON.stringify(x) === JSON.stringify(y);

/** An NPC rehearsal in progress. A scene can hold several NPCs; the assistant answers as `npc`. */
export interface Rehearsal {
  /** The NPC who answers next. */
  npc: string;
  /** Everyone in the scene, in the order they joined. */
  cast: string[];
  sceneId: string;
}

/** A scene's lines, ready for the draft: everything the host said plus the NPC lines kept. */
export interface SceneInfo {
  cast: string[];
  lines: SceneLine[];
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
  // One model per mode: a fast one for brainstorming, the stronger writer for drafting.
  const [models, setModels] = useState<Record<AssistantMode, string>>(() => ({
    brainstorm: loadBrainstormModel(partyModel),
    draft: loadAssistantModel(partyModel),
  }));
  const [undoStack, setUndoStack] = useState<UndoStep[]>([]);
  const [fullBible, setFullBible] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [writingDraft, setWritingDraft] = useState(false);
  const [digestStatus, setDigestStatus] = useState<DigestStatus>('none');
  const [digestBuiltAt, setDigestBuiltAt] = useState<string | null>(null);
  const [lastSendTokens, setLastSendTokens] = useState<number | null>(null);
  const [lastReplyTokens, setLastReplyTokens] = useState<number | null>(null);
  const [mode, setModeState] = useState<AssistantMode>(() => loadAssistantMode());
  const [lastChange, setLastChange] = useState<DraftChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersonaState] = useState<AssistantPersona>(() => loadAssistantPersona());
  const [rehearsal, setRehearsalState] = useState<Rehearsal | null>(null);
  const [recentNpcs, setRecentNpcs] = useState<string[]>(() => loadRecentNpcs());
  // Shown on screen when a session is too long to send whole (never trimmed silently).
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null);
  const saveWarnedRef = useRef(false);
  // Read synchronously by send(), so ending a rehearsal and sending in the same tap works.
  const rehearsalRef = useRef<Rehearsal | null>(null);
  const sendRef = useRef<(text: string, modeOverride?: AssistantMode, opts?: { auto?: boolean }) => Promise<void>>();

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
    setUndoStack([]);
    rehearsalRef.current = null;
    setRehearsalState(null);
  }, [partyId]);

  // Save the chat and draft on this phone whenever they change.
  useEffect(() => {
    const saved = saveAssistantState(ownerRef.current, { messages, draft });
    if (!saved && !saveWarnedRef.current) {
      saveWarnedRef.current = true;
      toast.warning("Couldn't save this chat on the phone", { description: 'Storage is full or blocked. The chat still works, but closing the app would lose it.' });
    }
  }, [messages, draft]);

  const setMode = useCallback((next: AssistantMode) => {
    setModeState(next);
    saveAssistantMode(next);
  }, []);

  const setPersona = useCallback((next: AssistantPersona) => {
    setPersonaState(next);
    saveAssistantPersona(next);
  }, []);

  const setRehearsal = useCallback((next: Rehearsal | null) => {
    rehearsalRef.current = next;
    setRehearsalState(next);
  }, []);

  /** Append messages and keep the ref in step, so an automatic follow-up sees them. */
  const appendMessages = useCallback((added: AssistantChatMessage[]) => {
    messagesRef.current = [...messagesRef.current, ...added];
    setMessages(prev => [...prev, ...added]);
  }, []);

  /** A draft change made by the app itself (keeping a version, adding dialogue), with undo. */
  const applyLocalChange = useCallback((next: AssistantDraft, note: string, paragraphs: number[]) => {
    const before = draftRef.current;
    draftRef.current = next;
    setDraft(next);
    setUndoStack(prev => [...prev, { before, after: next, note }].slice(-MAX_UNDO));
    setLastChange({ kind: 'edit', paragraphs, whispers: [], at: Date.now() });
  }, []);

  const setModel = useCallback((forMode: AssistantMode, id: string) => {
    setModels(prev => ({ ...prev, [forMode]: id }));
    if (forMode === 'brainstorm') saveBrainstormModel(id);
    else saveAssistantModel(id);
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

  const send = useCallback(async (rawText: string, modeOverride?: AssistantMode, opts: { auto?: boolean } = {}) => {
    const text = rawText.trim();
    if (!text || abortRef.current) return;
    const modeAtSend = modeOverride ?? mode;
    if (modeOverride && modeOverride !== mode) setMode(modeOverride);
    // Edit numbers refer to the draft exactly as it was sent.
    const draftAtSend = draftRef.current;
    const scene = rehearsalRef.current;

    const history = messagesRef.current;
    const hostMsg: AssistantChatMessage = {
      id: newId(),
      role: 'host',
      text,
      createdAt: new Date().toISOString(),
      ...(scene ? { npc: scene.npc, sceneId: scene.sceneId } : {}),
      ...(opts.auto ? { auto: true } : {}),
    };
    appendMessages([hostMsg]);
    setError(null);
    let rolledSomething = false;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setStreamingText('');
    setWritingDraft(false);

    let partial = '';
    try {
      const ctx = getContextRef.current();
      // Rehearsal is quick back-and-forth, so it uses the fast Brainstorm model.
      const chosen = scene ? models.brainstorm : models[modeAtSend];
      const modelId = resolveAssistantModel(chosen);
      if (modelId !== chosen) {
        toast.info('That model needs your own API key on this phone', { description: 'Using the default model for this message.' });
      }

      const bible: AssistantBible = fullBible
        ? { mode: 'full', text: ctx.guides || '' }
        : await ensureBible(ctx.guides || '', modelId, controller.signal);

      const handoff = buildAssistantSystemPrompt(ctx, bible, draftAtSend, modeAtSend, { persona, npc: scene?.npc ?? null, cast: scene?.cast ?? [] });
      // The whole chat since the last post goes with every message.
      const session = buildSessionMessages(history, text);
      const apiMessages = session.messages;
      if (session.omittedTurns > 0) {
        const notice = `This chat is very long: the oldest ${session.omittedTurns} turn${session.omittedTurns === 1 ? '' : 's'} didn't fit in this message.`;
        setMemoryNotice(notice);
        toast.warning('Some of the chat was left out', { description: notice });
      } else {
        setMemoryNotice(null);
      }
      if (handoff.draftTrimmed && modeAtSend === 'draft' && !scene) {
        toast.warning('The draft is too long for the assistant to see whole', { description: 'It can only read the start. Edits to the end may be skipped.' });
      }
      const sentChars = handoff.chars + apiMessages.reduce((n, m) => n + m.content.length, 0);
      setLastSendTokens(estimateTokens(sentChars));

      const raw = await streamFromAiDm({
        systemPrompt: handoff.systemPrompt,
        messages: apiMessages,
        model: modelId,
        // Same room as an AI DM post (ai-dm's default), so a full draft of a long post is never cut off.
        maxTokens: 16000,
        signal: controller.signal,
        onText: full => {
          partial = full;
          const view = visibleWhileStreaming(full);
          setStreamingText(view.text);
          setWritingDraft(view.writingDraft);
        },
      });

      setLastReplyTokens(estimateTokens(raw.length));
      const parsed = parseAssistantReply(raw);
      if (!parsed.chatText && !parsed.draftText && !parsed.edits.length && !parsed.takes && !parsed.rolls.length && !parsed.unreadableEdits.length) {
        throw new Error('The assistant sent back an empty reply. Try again, or pick another model.');
      }

      let draftNote: string | undefined;
      const wantsChange = !!parsed.draftText || parsed.edits.length > 0;
      if (wantsChange && (modeAtSend === 'brainstorm' || scene)) {
        toast.info('Brainstorm mode leaves the draft alone', { description: 'Switch to Draft mode to let the assistant change it.' });
      } else if (parsed.draftText) {
        const next = draftFromText(parsed.draftText);
        setDraft(next);
        draftNote = 'New draft';
        setUndoStack(prev => [...prev, { before: draftAtSend, after: next, note: draftNote! }].slice(-MAX_UNDO));
        setLastChange({ kind: 'new', paragraphs: [], whispers: [], at: Date.now() });
      } else if (parsed.edits.length) {
        const result = applyDraftEdits(draftAtSend, parsed.edits);
        if (result.applied.length) {
          setDraft(result.draft);
          draftNote = `Edited ${result.applied.join(', ')}`;
          setUndoStack(prev => [...prev, { before: draftAtSend, after: result.draft, note: draftNote! }].slice(-MAX_UNDO));
          setLastChange({ kind: 'edit', paragraphs: result.changedParagraphs, whispers: result.changedWhispers, at: Date.now() });
        }
        if (result.skipped.length) {
          toast.warning(`Skipped ${result.skipped.join(', ')}`, { description: "It pointed at a part of the draft that doesn't exist, or one another edit in the same reply already changed. Everything else was applied." });
        }
      }
      // An edit the app couldn't read is reported, never dropped silently.
      let unreadNote = '';
      if (parsed.unreadableEdits.length && !parsed.draftText && !(modeAtSend === 'brainstorm' || scene)) {
        const list = parsed.unreadableEdits.join('; ');
        unreadNote = `(The app couldn't read ${parsed.unreadableEdits.length === 1 ? 'this edit' : 'these edits'}, so that part of the draft did not change: ${list})`;
        toast.warning(`Couldn't apply ${parsed.unreadableEdits.length === 1 ? 'an edit' : `${parsed.unreadableEdits.length} edits`}`, { description: `${list}. Ask again, or tap Undo if the draft looks wrong.` });
      }

      // Alternate versions: remember the paragraph's text so "Keep" still finds it later.
      let takes: AssistantChatMessage['takes'];
      if (parsed.takes) {
        const basis = splitParagraphs(draftAtSend.narrative)[parsed.takes.paragraph - 1];
        if (basis) takes = { paragraph: parsed.takes.paragraph, basis, options: parsed.takes.options };
        else toast.warning(`Those versions were for ¶${parsed.takes.paragraph}, which isn't in the draft.`);
      }

      const added: AssistantChatMessage[] = [{
        id: newId(),
        role: 'assistant',
        text: [parsed.chatText || (draftNote ? `${draftNote}.` : takes ? 'Here are some versions.' : parsed.rolls.length ? 'Rolling…' : unreadNote ? '' : 'Done.'), unreadNote].filter(Boolean).join('\n\n'),
        draftUpdated: !!draftNote,
        draftNote,
        suggestions: parsed.suggestions.length ? parsed.suggestions : undefined,
        takes,
        createdAt: new Date().toISOString(),
        ...(scene ? { npc: scene.npc, sceneId: scene.sceneId, picked: true } : {}),
      }];

      // Dice the assistant asked for are rolled here, with real random numbers.
      const unreadable: string[] = [];
      for (const req of parsed.rolls) {
        const r = parseRollRequest(req);
        if (!r) { unreadable.push(req); continue; }
        const roll = rollDice(r.label, r.expr, r.spec);
        added.push({ id: newId(), role: 'host', text: rollForAssistant(roll), roll, createdAt: new Date().toISOString() });
        rolledSomething = true;
      }
      if (unreadable.length) toast.warning(`Couldn't read a roll: ${unreadable.join(', ')}`);
      appendMessages(added);
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
    // One automatic follow-up so the assistant can use the dice it asked for.
    if (rolledSomething && !opts.auto) {
      setTimeout(() => { void sendRef.current?.('Use the dice results above and continue.', undefined, { auto: true }); }, 0);
    }
  }, [models, mode, setMode, persona, fullBible, ensureBible, refreshDigestStatus, appendMessages]);
  sendRef.current = send;

  /** "roll 1d20+5 Grukk attack" is rolled by the app right away, with no AI call. Returns true if handled. */
  const localRoll = useCallback((text: string): boolean => {
    const parsed = parseHostRoll(text);
    if (!parsed) return false;
    const roll = rollDice(parsed.label, parsed.expr, parsed.spec);
    appendMessages([{ id: newId(), role: 'host', text: rollForAssistant(roll), roll, createdAt: new Date().toISOString() }]);
    return true;
  }, [appendMessages]);

  /** Put one of the offered versions into the draft. */
  const keepTake = useCallback((messageId: string, index: number): boolean => {
    const msg = messagesRef.current.find(m => m.id === messageId);
    const takes = msg?.takes;
    const option = takes?.options[index];
    if (!takes || !option) return false;
    const paras = splitParagraphs(draftRef.current.narrative);
    const at = paras.findIndex(p => p === takes.basis);
    if (at === -1) {
      toast.warning('That paragraph changed since these versions were written', { description: 'Aim at it and ask for new versions.' });
      return false;
    }
    const edit: DraftEdit = { op: 'replace', target: 'paragraph', index: at + 1, body: option, label: `REPLACE ¶${at + 1}` };
    const result = applyDraftEdits(draftRef.current, [edit]);
    applyLocalChange(result.draft, `Kept version ${index + 1} for ¶${at + 1}`, result.changedParagraphs);
    // The kept text becomes the new basis, so the host can still switch versions.
    const newBasis = splitParagraphs(result.draft.narrative)[at] ?? option;
    const update = (m: AssistantChatMessage) => (m.id === messageId && m.takes ? { ...m, takes: { ...m.takes, basis: newBasis, kept: index } } : m);
    messagesRef.current = messagesRef.current.map(update);
    setMessages(prev => prev.map(update));
    return true;
  }, [applyLocalChange]);

  // ── NPC rehearsal ──
  /** Start a scene with this NPC, or add them to the scene already running (they answer next). */
  const startRehearsal = useCallback((name: string) => {
    const npc = name.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!npc) return;
    const current = rehearsalRef.current;
    if (current) {
      const known = current.cast.find(n => n.toLowerCase() === npc.toLowerCase());
      setRehearsal({ ...current, npc: known ?? npc, cast: known ? current.cast : [...current.cast, npc] });
    } else {
      setRehearsal({ npc, cast: [npc], sceneId: newId() });
    }
    setRecentNpcs(saveRecentNpc(npc));
  }, [setRehearsal]);

  /** Choose which NPC in the scene answers next. */
  const setSpeaker = useCallback((name: string) => {
    const current = rehearsalRef.current;
    if (!current || !current.cast.includes(name)) return;
    setRehearsal({ ...current, npc: name });
  }, [setRehearsal]);

  const endRehearsal = useCallback(() => setRehearsal(null), [setRehearsal]);

  /** Include or leave out one NPC line when it goes into the draft. */
  const togglePick = useCallback((messageId: string) => {
    const flip = (m: AssistantChatMessage) => (m.id === messageId ? { ...m, picked: !m.picked } : m);
    messagesRef.current = messagesRef.current.map(flip);
    setMessages(prev => prev.map(flip));
  }, []);

  /**
   * A scene's lines in the order they were said: everything the host typed (minus
   * notes like "(make him nervous)") and every NPC line still ticked.
   */
  const sceneInfo = useCallback((sceneId: string): SceneInfo => {
    const said = messagesRef.current.filter(m => m.sceneId === sceneId && !m.auto && !m.roll && m.text.trim());
    const cast: string[] = [];
    for (const m of said) if (m.npc && !cast.includes(m.npc)) cast.push(m.npc);
    const lines: SceneLine[] = said
      .filter(m => (m.role === 'assistant' ? !!m.picked : !isOutOfCharacter(m.text)))
      .map(m => ({ speaker: m.role === 'assistant' ? m.npc || '' : '', npc: m.role === 'assistant', text: m.text }));
    return { cast, lines };
  }, []);

  /** Add the scene to the draft exactly as said, every line in order: no AI call. */
  const addSceneAsIs = useCallback((sceneId: string, afterParagraph: number | null): number => {
    const { cast, lines } = sceneInfo(sceneId);
    const body = sceneToStory(lines);
    if (!body) { toast.info('Nothing to add yet: say something, or tick an NPC line.'); return 0; }
    const paras = splitParagraphs(draftRef.current.narrative);
    const after = afterParagraph !== null && afterParagraph <= paras.length ? afterParagraph : paras.length;
    const edit: DraftEdit = { op: 'insert', target: 'paragraph', index: after, body, label: `INSERT AFTER ¶${after}` };
    const result = applyDraftEdits(draftRef.current, [edit]);
    const who = cast.join(' & ') || 'the scene';
    applyLocalChange(result.draft, `Added ${lines.length} line${lines.length === 1 ? '' : 's'} with ${who}`, result.changedParagraphs);
    toast.success(`Added the scene with ${who} to the draft`);
    return lines.length;
  }, [sceneInfo, applyLocalChange]);

  /** Ask the assistant to weave the scene in with light narration, keeping every line. Ends the rehearsal. */
  const weaveScene = useCallback((sceneId: string, afterParagraph: number | null) => {
    const { cast, lines } = sceneInfo(sceneId);
    if (!lines.length) { toast.info('Nothing to weave yet: say something, or tick an NPC line.'); return; }
    setRehearsal(null);
    void send(buildSceneWeavePrompt(cast, lines, afterParagraph), 'draft');
  }, [sceneInfo, setRehearsal, send]);

  /**
   * Put the draft back the way it was before the assistant's last change.
   * Returns false (and changes nothing) when the host edited the draft by hand
   * since then and did not confirm losing those edits.
   */
  const undo = useCallback((confirmLoseHandEdits?: () => boolean): boolean => {
    const step = undoStack[undoStack.length - 1];
    if (!step) return false;
    if (!sameDraft(draftRef.current, step.after) && confirmLoseHandEdits && !confirmLoseHandEdits()) return false;
    setDraft(step.before);
    setUndoStack(prev => prev.slice(0, -1));
    setLastChange(null);
    toast.success(`Undid: ${step.note}`);
    return true;
  }, [undoStack]);

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
    setLastChange(null);
    setUndoStack([]);
    setRehearsal(null);
    setError(null);
    setMemoryNotice(null);
    messagesRef.current = [];
    clearAssistantState(ownerRef.current);
  }, [setRehearsal]);

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
    /** The model the current mode will use. */
    model: models[mode],
    models,
    setModel,
    undo,
    canUndo: undoStack.length > 0,
    undoNote: undoStack[undoStack.length - 1]?.note ?? null,
    mode,
    setMode,
    persona,
    setPersona,
    rehearsal,
    recentNpcs,
    startRehearsal,
    setSpeaker,
    endRehearsal,
    sceneInfo,
    memoryNotice,
    togglePick,
    addSceneAsIs,
    weaveScene,
    localRoll,
    keepTake,
    lastChange,
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
    lastReplyTokens,
    error,
    send,
    retryLast,
    stop,
    reset,
  };
}
