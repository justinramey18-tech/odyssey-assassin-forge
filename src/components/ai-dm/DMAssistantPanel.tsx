// Human DM Assistant panel (host only). A private co-DM chat. In Brainstorm
// mode it only talks ideas through; in Draft mode it writes the post and makes
// small, numbered edits (¶3, W1) instead of rewriting everything. The draft
// opens over the chat area and starts collapsed whenever a new draft arrives.
// Players never see this chat.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { WhisperEditor } from './WhisperEditor';
import { DiceCard, NpcLine, TakesCard } from './DMAssistantCards';
import { ART, AssistantBackdrop, AssistantCrest, Medal, SealStampOverlay, draftFrameStyle } from './DMAssistantArt';
import { AimTools, AssistantSettings, NpcPicker, RehearsalBanner, SceneActions } from './DMAssistantControls';
import { getModelLabel } from '@/lib/dm-models';
import { serializeWhispers } from '@/lib/whisper-parser';
import { useDmAssistant, type DraftChange } from '@/hooks/use-dm-assistant';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import {
  BRAINSTORM_PROMPTS,
  DRAFT_PROMPTS,
  VERSIONS_PROMPT,
  draftCounts,
  draftIsEmpty,
  splitParagraphs,
  type AssistantLiveContext,
  type QuickPrompt,
} from '@/lib/dm-assistant';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  PenLine,
  RotateCcw,
  Send,
  Settings2,
  Square,
  Undo2,
  X,
} from 'lucide-react';

interface DMAssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyId: string | null;
  /** The party's shared DM model, used as the assistant's first default. */
  partyModel?: string | null;
  partyMemberNames: string[];
  /** Read at send time: story, Live Table, roster, guides. */
  getContext: () => AssistantLiveContext;
  /** Posts the draft to the table. Resolves true once it has landed. */
  onApply: (content: string) => Promise<boolean>;
  /** True while the AI DM is writing; Apply waits. */
  aiDmWriting: boolean;
}

const WHISPER_LABEL: Record<'action' | 'tactics' | 'whisper', string> = {
  action: 'Roll',
  tactics: 'Tactics',
  whisper: 'Whisper',
};

type Aim = { kind: 'p' | 'w'; n: number };

/** Reading view only: hide narration speaker tags. Edit by hand still shows them. */
const forReading = (text: string) => text.replace(/\[VOICE:[^\]]*\]|\[\/VOICE\]/gi, '');

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const kTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));

export function DMAssistantPanel({
  open,
  onOpenChange,
  partyId,
  partyModel,
  partyMemberNames,
  getContext,
  onApply,
  aiDmWriting,
}: DMAssistantPanelProps) {
  const a = useDmAssistant({ partyId, partyModel, getContext });
  const [input, setInput] = useState('');
  const [draftOpen, setDraftOpen] = useState(false);
  const [editByHand, setEditByHand] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aim, setAim] = useState<Aim | null>(null);
  const [glow, setGlow] = useState<DraftChange | null>(null);
  const [badge, setBadge] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const [npcPicker, setNpcPicker] = useState(false);
  const [npcName, setNpcName] = useState('');
  const [sealing, setSealing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Voice input: spoken words are added to the message box, ready to edit or send.
  const speech = useSpeechToText({
    onTranscript: useCallback((text: string) => {
      setInput(prev => (prev.trim() ? `${prev.trimEnd()} ${text}` : text));
    }, []),
  });
  const { stop: stopListening } = speech;
  useEffect(() => { if (!open) stopListening(); }, [open, stopListening]);

  const { refreshDigestStatus } = a;
  useEffect(() => {
    if (open) refreshDigestStatus();
    else setConfirming(false);
  }, [open, refreshDigestStatus]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [a.messages.length, a.streamingText, a.isStreaming, draftOpen]);

  // A new draft arrives collapsed; an edit keeps the draft as it is and highlights what changed.
  useEffect(() => {
    const change = a.lastChange;
    if (!change) return;
    setAim(null);
    setGlow(change);
    if (change.kind === 'new') {
      setDraftOpen(false);
      setEditByHand(false);
      setBadge('New draft');
    } else if (!draftOpen) {
      setBadge('Updated');
    }
    // draftOpen is read, not watched: only a new change should run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.lastChange]);

  // Opening the draft clears the badge; rolls and whispers start collapsed each time.
  useEffect(() => {
    if (!draftOpen) return;
    setBadge(null);
    setExtrasOpen(false);
  }, [draftOpen]);

  // Highlights fade a few seconds after the host can see them.
  useEffect(() => {
    if (!glow || !draftOpen) return;
    const t = setTimeout(() => setGlow(null), 4000);
    return () => clearTimeout(t);
  }, [glow, draftOpen]);

  const sealedCount = open ? getContext().sealedOrder.length : 0;
  const paragraphs = splitParagraphs(a.draft.narrative);
  const items = a.draft.whispers.filter(w => w.content.trim());
  const counts = draftCounts(a.draft);
  const hasDraft = !draftIsEmpty(a.draft);
  const canApply = hasDraft && !a.isStreaming && !aiDmWriting && !applying;
  const lastAssistant = [...a.messages].reverse().find(m => m.role === 'assistant');
  const lastMessage = a.messages[a.messages.length - 1];
  const lastDraftChangeId = [...a.messages].reverse().find(m => m.draftUpdated)?.id;
  const suggestions = !a.isStreaming && lastMessage?.role === 'assistant' ? (lastMessage.suggestions || []) : [];
  // Where each rehearsal scene ends, to show its "add to draft" actions there.
  const sceneEnds = new Map<string, number>();
  a.messages.forEach((m, i) => { if (m.sceneId) sceneEnds.set(m.sceneId, i); });
  const pickedCount = (sceneId: string) => a.messages.filter(m => m.sceneId === sceneId && m.role === 'assistant' && m.picked).length;

  const prompts: QuickPrompt[] = a.mode === 'brainstorm'
    ? BRAINSTORM_PROMPTS
    : DRAFT_PROMPTS.map(q => (q.label === 'Draft it' && hasDraft ? { ...q, label: 'Redraft all' } : q));

  const aimLabel = aim ? `${aim.kind === 'p' ? '¶' : 'W'}${aim.n}` : '';
  const aimPreview = aim
    ? forReading((aim.kind === 'p' ? paragraphs[aim.n - 1] : items[aim.n - 1]?.content) || '')
    : '';

  /** Send typed text or a quick button. Typed text and aimed buttons carry the aim (e.g. "[¶3] …"). */
  const handleSend = (q?: QuickPrompt, opts: { aimed?: boolean } = {}) => {
    const typed = (q?.text ?? input).trim();
    if (!typed || a.isStreaming) return;
    if (speech.isListening) speech.stop();
    // "roll 1d20+5 Grukk attack" is rolled by the app on the spot: no AI call.
    if (!q && a.localRoll(typed)) { setInput(''); return; }
    const useAim = !!aim && (!q || opts.aimed);
    const text = useAim ? `[${aimLabel}] ${typed}` : typed;
    setConfirming(false);
    setEditByHand(false);
    void a.send(text, q?.mode);
    if (!q || opts.aimed) { setAim(null); }
    if (!q) setInput('');
  };

  const startNpc = (name: string) => {
    if (!name.trim()) return;
    a.startRehearsal(name);
    setNpcPicker(false);
    setNpcName('');
    setAim(null);
    setDraftOpen(false);
  };

  /** Dialogue goes after the aimed paragraph when one is aimed, otherwise at the end. */
  const insertAfter = aim?.kind === 'p' ? aim.n : null;
  const addAsIs = (sceneId: string) => {
    if (a.addSceneAsIs(sceneId, insertAfter)) { setAim(null); setBadge('Updated'); }
  };
  const weave = (sceneId: string) => {
    a.weaveScene(sceneId, insertAfter);
    setAim(null);
  };

  /** A suggestion starting with "Draft:" switches to Draft mode and asks for the change. */
  const sendSuggestion = (text: string) => {
    const m = /^draft\s*:\s*(.+)$/i.exec(text.trim());
    if (m) handleSend({ label: text, text: `Draft it: ${m[1]}`, mode: 'draft' });
    else handleSend({ label: text, text });
  };

  const handleUndo = () => {
    a.undo(() => window.confirm('Undo will also remove the hand edits you made since that change. Undo anyway?'));
  };

  const handleNewChat = () => {
    if ((a.messages.length > 0 || hasDraft) && !window.confirm('Start a new chat? This clears the chat and the draft.')) return;
    a.reset();
    setConfirming(false);
    setDraftOpen(false);
    setAim(null);
    setBadge(null);
  };

  const handleApply = async () => {
    if (!canApply) return;
    setApplying(true);
    try {
      const content = serializeWhispers(a.draft.narrative, a.draft.whispers);
      const ok = await onApply(content);
      if (ok) {
        a.reset();
        setConfirming(false);
        setDraftOpen(false);
        setAim(null);
        setBadge(null);
        // The wax seal stamps once, then the panel closes (see finishSeal).
        setSealing(true);
      }
    } finally {
      setApplying(false);
    }
  };

  const finishSeal = () => {
    setSealing(false);
    onOpenChange(false);
  };

  const toggleAim = (next: Aim) => {
    if (editByHand) return;
    setAim(cur => (cur && cur.kind === next.kind && cur.n === next.n ? null : next));
  };

  const draftSummary = hasDraft
    ? [plural(paragraphs.length, '¶', '¶'), plural(counts.rolls, 'roll', 'rolls'), plural(counts.whispers, 'whisper', 'whispers')].join(' · ')
    : 'Empty';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-vaul-no-drag
        className="h-[92vh] p-0 bg-[#0b0b10] border-t border-amber-500/30 rounded-t-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 px-3 pt-3 pb-2 border-b border-white/10 space-y-2">
          <div className="pr-8 pl-1">
            <SheetTitle className="font-cinzel text-amber-300 text-[15px] flex items-center gap-2">
              <AssistantCrest busy={a.isStreaming} className="w-8 h-8" /> Human DM Assistant
            </SheetTitle>
            <SheetDescription className="sr-only">Your private co-DM. Players never see this chat.</SheetDescription>
          </div>

          <div className="flex items-center gap-2">
            <div role="radiogroup" aria-label="Assistant mode" className="flex-1 grid grid-cols-2 rounded-lg border border-white/10 bg-white/5 p-0.5">
              {(['brainstorm', 'draft'] as const).map(m => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={a.mode === m}
                  onClick={() => a.setMode(m)}
                  disabled={a.isStreaming}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'min-h-[38px] rounded-md text-[13px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50',
                    a.mode === m
                      ? (m === 'brainstorm' ? 'bg-teal-800/50 text-teal-100 border border-teal-400/40' : 'bg-amber-800/45 text-amber-100 border border-amber-400/40')
                      : 'text-white/55 border border-transparent',
                  )}
                >
                  <Medal src={m === 'brainstorm' ? ART.medalBrainstorm : ART.medalDraft} className="w-5 h-5" />
                  {m === 'brainstorm' ? 'Brainstorm' : 'Draft'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSettingsOpen(v => !v)}
              aria-label="Assistant settings"
              aria-expanded={settingsOpen}
              style={{ touchAction: 'manipulation' }}
              className={cn('shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center', settingsOpen ? 'border-amber-400/40 bg-amber-900/30 text-amber-200' : 'border-white/10 bg-white/5 text-white/65')}
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleNewChat}
              disabled={a.isStreaming}
              aria-label="New chat"
              style={{ touchAction: 'manipulation' }}
              className="shrink-0 w-10 h-10 rounded-lg border border-white/10 bg-white/5 text-white/65 flex items-center justify-center disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <p className={cn('text-[11px] text-white/45 px-1', draftOpen && 'hidden')}>
            {a.mode === 'brainstorm'
              ? "Talks ideas through with you. Won't touch the draft."
              : 'Writes the draft, then makes small edits to the parts you name.'}
          </p>

          {settingsOpen && (
            <AssistantSettings
              models={a.models}
              onModelChange={a.setModel}
              persona={a.persona}
              onPersonaChange={a.setPersona}
              digestStatus={a.digestStatus}
              onRebuildDigest={a.rebuildDigest}
              fullBible={a.fullBible}
              onFullBibleChange={a.setFullBible}
              busy={a.isStreaming}
            />
          )}

          <div className="text-[11px] text-white/40 px-1 truncate">
            {getModelLabel(a.rehearsal ? a.models.brainstorm : a.model)}
            {' · '}
            {sealedCount > 0 ? `Answering ${plural(sealedCount, 'sealed line', 'sealed lines')}` : 'No sealed lines'}
            {a.lastSendTokens ? ` · Brief ~${kTokens(a.lastSendTokens)}` : ''}
            {a.lastReplyTokens ? ` · Reply ~${kTokens(a.lastReplyTokens)}` : ''}
            {a.fullBible ? ' · next message sends the full guides' : ''}
          </div>
        </div>

        {/* Body: the chat, with the draft opening over it */}
        <div className="relative flex-1 min-h-0">
          <AssistantBackdrop stage={!!a.rehearsal} />
          <div ref={listRef} className="absolute inset-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-2.5">
            {a.messages.length === 0 && !a.isStreaming && (
              <div className="text-[13px] text-white/55 leading-relaxed space-y-2 px-1">
                <p>Throw ideas at me, or start with a quick button below. I can see the story summary, the latest DM post, the Live Table and your sealed lines.</p>
                <p className="text-white/40 text-[12px]">When you&apos;re ready, switch to Draft and I&apos;ll write the post. After that, tap any paragraph in the draft to point me at just that part.</p>
                <p className="text-white/40 text-[12px]">Tap &ldquo;Talk to an NPC&rdquo; to rehearse dialogue in character. Type &ldquo;roll 1d20+5 Grukk attack&rdquo; for real dice.</p>
              </div>
            )}

            {a.messages.map((m, i) => {
              const prev = a.messages[i - 1];
              const sceneStart = !!m.sceneId && prev?.sceneId !== m.sceneId;
              const sceneEnd = !!m.sceneId && sceneEnds.get(m.sceneId) === i;
              const sceneLive = !!m.sceneId && a.rehearsal?.sceneId === m.sceneId;
              const picked = m.sceneId ? pickedCount(m.sceneId) : 0;
              return (
                <div key={m.id} className="space-y-2.5">
                  {sceneStart && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-300/70 font-cinzel pt-1">
                      <span className="h-px flex-1 bg-amber-400/20" />
                      <Medal src={ART.medalNpc} className="w-5 h-5" /> Talking to {m.npc}
                      <span className="h-px flex-1 bg-amber-400/20" />
                    </div>
                  )}

                  {m.roll ? (
                    <DiceCard roll={m.roll} />
                  ) : m.auto ? (
                    <div className="text-center text-[11px] text-white/35">Continued with the dice results</div>
                  ) : m.role === 'assistant' && m.npc ? (
                    <NpcLine npc={m.npc} text={m.text} picked={!!m.picked} onTogglePick={() => a.togglePick(m.id)} />
                  ) : (
                    <div className={cn('flex', m.role === 'host' ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words',
                        m.role === 'host'
                          ? 'bg-amber-900/35 border border-amber-500/25 text-amber-50/90'
                          : 'bg-white/5 border border-white/10 text-white/85',
                      )}>
                        {m.role === 'host' && m.npc && (
                          <span className="block text-[10px] uppercase tracking-wider text-amber-200/55 mb-0.5">To {m.npc}</span>
                        )}
                        {m.text}
                        {m.draftUpdated && (
                          <span className="mt-1.5 flex items-center gap-3">
                            <button
                              onClick={() => setDraftOpen(true)}
                              style={{ touchAction: 'manipulation' }}
                              className="flex items-center gap-1 text-[11px] text-emerald-300/85"
                            >
                              <Check className="w-3 h-3" /> {m.draftNote || 'Draft updated'} · view
                            </button>
                            {m.id === lastDraftChangeId && a.canUndo && (
                              <button
                                onClick={handleUndo}
                                disabled={a.isStreaming}
                                style={{ touchAction: 'manipulation' }}
                                className="flex items-center gap-1 text-[11px] text-amber-200/80 disabled:opacity-40"
                              >
                                <Undo2 className="w-3 h-3" /> Undo
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {m.takes && (
                    <TakesCard takes={m.takes} disabled={a.isStreaming} onKeep={idx => { if (a.keepTake(m.id, idx)) setBadge('Updated'); }} />
                  )}

                  {sceneEnd && !sceneLive && picked > 0 && (
                    <SceneActions
                      npc={m.npc || ''}
                      picked={picked}
                      insertAfter={insertAfter}
                      busy={a.isStreaming}
                      onAddAsIs={() => addAsIs(m.sceneId!)}
                      onWeave={() => weave(m.sceneId!)}
                    />
                  )}
                </div>
              );
            })}

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {suggestions.map(text => {
                  const drafts = /^draft\s*:/i.test(text);
                  return (
                    <button
                      key={text}
                      onClick={() => sendSuggestion(text)}
                      style={{ touchAction: 'manipulation' }}
                      className={cn(
                        'min-h-[36px] px-3 rounded-full border text-[12.5px] text-left',
                        drafts ? 'border-amber-400/45 bg-amber-800/30 text-amber-100' : 'border-teal-400/35 bg-teal-900/25 text-teal-100',
                      )}
                    >
                      {text}{drafts && a.mode === 'brainstorm' ? ' →' : ''}
                    </button>
                  );
                })}
              </div>
            )}

            {a.isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words bg-white/5 border border-white/10 text-white/85">
                  {a.digestStatus === 'building' && !a.streamingText
                    ? 'Reading your World Bible once…'
                    : (a.streamingText || 'Thinking…')}
                  {a.writingDraft && (
                    <span className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-300/80">
                      <Loader2 className="w-3 h-3 animate-spin" /> Working on the draft…
                    </span>
                  )}
                </div>
              </div>
            )}

            {a.error && !a.isStreaming && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-[12px] text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1">{a.error}</span>
                <button onClick={a.retryLast} style={{ touchAction: 'manipulation' }} className="shrink-0 underline text-red-100">
                  Retry
                </button>
              </div>
            )}
          </div>

          {draftOpen && (
            <div className="absolute inset-0 z-10 flex flex-col bg-[#0b0b10]">
              {/* Latest reply, so the conversation stays visible while reading the draft */}
              {(a.isStreaming || lastAssistant) && (
                <button
                  onClick={() => setDraftOpen(false)}
                  style={{ touchAction: 'manipulation' }}
                  className="shrink-0 mx-3 mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[12px] text-white/70 flex items-start gap-2"
                >
                  {a.isStreaming
                    ? <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin text-amber-300/80" />
                    : <MessageCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/40" />}
                  <span className="line-clamp-2 flex-1">
                    {a.isStreaming ? (a.streamingText || (a.writingDraft ? 'Working on the draft…' : 'Thinking…')) : lastAssistant?.text}
                  </span>
                </button>
              )}

              <div className="shrink-0 flex items-center gap-2 px-3 pt-2 pb-1">
                <span className="text-[11px] text-white/40 truncate">
                  {editByHand ? 'Leave a blank line between paragraphs.' : paragraphs.length ? 'Tap a paragraph to point the assistant at it.' : ''}
                </span>
                {a.canUndo && (
                  <button
                    onClick={handleUndo}
                    disabled={a.isStreaming}
                    aria-label={a.undoNote ? `Undo: ${a.undoNote}` : 'Undo'}
                    style={{ touchAction: 'manipulation' }}
                    className="ml-auto shrink-0 min-h-[32px] px-2.5 rounded-md border border-white/15 bg-white/5 text-white/70 text-[12px] flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Undo
                  </button>
                )}
                <button
                  onClick={() => { setEditByHand(v => !v); setAim(null); }}
                  disabled={a.isStreaming}
                  style={{ touchAction: 'manipulation' }}
                  className={cn('shrink-0 min-h-[32px] px-2.5 rounded-md border text-[12px] flex items-center gap-1.5 disabled:opacity-40', !a.canUndo && 'ml-auto',
                    editByHand ? 'border-emerald-400/40 bg-emerald-900/30 text-emerald-100' : 'border-white/15 bg-white/5 text-white/70')}
                >
                  {editByHand ? <Check className="w-3.5 h-3.5" /> : <PenLine className="w-3.5 h-3.5" />}
                  {editByHand ? 'Done editing' : 'Edit by hand'}
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mx-2 mb-2 px-1.5 py-1.5 space-y-2" style={draftFrameStyle}>
                {editByHand ? (
                  <Textarea
                    value={a.draft.narrative}
                    onChange={e => a.setDraft({ ...a.draft, narrative: e.target.value })}
                    placeholder="The story text players will read."
                    className="min-h-[55vh] bg-white/5 border-amber-900/30 text-[14px] leading-relaxed text-foreground resize-none focus-visible:ring-amber-500/30"
                  />
                ) : paragraphs.length === 0 ? (
                  <p className="text-[13px] text-white/50 leading-relaxed px-1 pt-2">
                    No draft yet. Switch to Draft and tap Draft it, or tap Edit by hand to write it yourself.
                  </p>
                ) : (
                  <>
                    {paragraphs.map((p, i) => {
                      const aimed = aim?.kind === 'p' && aim.n === i + 1;
                      const lit = glow?.kind === 'edit' && glow.paragraphs.includes(i);
                      return (
                        <button
                          key={`${i}-${p.slice(0, 24)}`}
                          onClick={() => toggleAim({ kind: 'p', n: i + 1 })}
                          style={{ touchAction: 'manipulation' }}
                          className={cn(
                            'w-full text-left rounded-lg border px-3 py-2 flex gap-2 transition-colors duration-700',
                            aimed ? 'border-amber-400/60 bg-amber-900/25'
                              : lit ? 'border-emerald-400/50 bg-emerald-900/25'
                              : 'border-white/5 bg-white/[0.02]',
                          )}
                        >
                          <span className="shrink-0 text-[11px] font-semibold text-amber-300/70 pt-0.5 w-6">¶{i + 1}</span>
                          <span className="text-[14px] leading-relaxed text-white/90 whitespace-pre-wrap break-words">{forReading(p)}</span>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Rolls & whispers: collapsed by default */}
                <div className="rounded-lg border border-white/10 bg-white/[0.02]">
                  <button
                    onClick={() => setExtrasOpen(v => !v)}
                    aria-expanded={extrasOpen}
                    style={{ touchAction: 'manipulation' }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                  >
                    {extrasOpen ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronRight className="w-4 h-4 text-white/50" />}
                    <span className="text-[13px] text-white/80">Rolls &amp; whispers</span>
                    <span className="ml-auto text-[11px] text-white/40">
                      {items.length ? `${items.length}` : 'none'}
                      {glow?.kind === 'edit' && glow.whispers.length > 0 && !extrasOpen ? ' · updated' : ''}
                    </span>
                  </button>
                  {extrasOpen && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {editByHand ? (
                        <WhisperEditor
                          whispers={a.draft.whispers}
                          onChange={whispers => a.setDraft({ ...a.draft, whispers })}
                          partyMemberNames={partyMemberNames}
                        />
                      ) : items.length === 0 ? (
                        <p className="text-[12px] text-white/45 px-1 pb-1">No rolls or whispers yet. Ask for one, or use Edit by hand.</p>
                      ) : items.map((w, i) => {
                        const aimed = aim?.kind === 'w' && aim.n === i + 1;
                        const lit = glow?.kind === 'edit' && glow.whispers.includes(i);
                        return (
                          <button
                            key={`${i}-${w.content.slice(0, 24)}`}
                            onClick={() => toggleAim({ kind: 'w', n: i + 1 })}
                            style={{ touchAction: 'manipulation' }}
                            className={cn(
                              'w-full text-left rounded-md border px-2.5 py-2 flex gap-2 transition-colors duration-700',
                              aimed ? 'border-amber-400/60 bg-amber-900/25'
                                : lit ? 'border-emerald-400/50 bg-emerald-900/25'
                                : 'border-white/5 bg-white/[0.02]',
                            )}
                          >
                            <span className="shrink-0 text-[11px] font-semibold text-amber-300/70 pt-0.5 w-6">W{i + 1}</span>
                            <span className="text-[13px] leading-relaxed text-white/85 break-words">
                              <span className="text-[11px] uppercase tracking-wide text-violet-200/70 mr-1.5">
                                {WHISPER_LABEL[w.type]}{w.type === 'whisper' && w.target ? ` → ${w.target}` : ''}
                              </span>
                              {w.content}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/10 px-3 pt-2 pb-4 space-y-2">
          {(hasDraft || a.mode === 'draft' || draftOpen) && (
            <button
              onClick={() => setDraftOpen(v => !v)}
              aria-expanded={draftOpen}
              style={{ touchAction: 'manipulation' }}
              className={cn(
                'w-full min-h-[40px] rounded-lg border px-3 flex items-center gap-2 text-left',
                draftOpen ? 'border-emerald-400/40 bg-emerald-950/40' : 'border-white/10 bg-white/5',
              )}
            >
              <span className="font-cinzel text-[12px] text-emerald-300/90 uppercase tracking-wider">Draft</span>
              <span className="text-[11px] text-white/45 truncate">{draftSummary}</span>
              {badge && !draftOpen && (
                <span className="shrink-0 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] text-emerald-200 animate-pulse">
                  {badge}
                </span>
              )}
              <span className="ml-auto shrink-0 flex items-center gap-1 text-[12px] text-white/60">
                {draftOpen ? 'Back to chat' : 'Open'}
                {draftOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </span>
            </button>
          )}

          {aim && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-900/20 px-2.5 py-1.5">
              <span className="shrink-0 text-[12px] font-semibold text-amber-200">{aimLabel}</span>
              <span className="flex-1 min-w-0 truncate text-[12px] text-amber-50/70">{aimPreview}</span>
              <span className="shrink-0 text-[10px] text-amber-200/60">{a.mode === 'draft' ? 'edit' : 'discuss'}</span>
              <button onClick={() => setAim(null)} aria-label="Clear target" style={{ touchAction: 'manipulation' }} className="shrink-0 p-1 text-amber-100/70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {npcPicker && !a.rehearsal && (
            <NpcPicker value={npcName} onChange={setNpcName} onStart={startNpc} onCancel={() => setNpcPicker(false)} recent={a.recentNpcs} />
          )}

          {a.rehearsal && (
            <RehearsalBanner
              npc={a.rehearsal.npc}
              picked={pickedCount(a.rehearsal.sceneId)}
              insertAfter={insertAfter}
              busy={a.isStreaming}
              onAddAsIs={() => addAsIs(a.rehearsal!.sceneId)}
              onWeave={() => weave(a.rehearsal!.sceneId)}
              onDone={a.endRehearsal}
            />
          )}

          {aim?.kind === 'p' && !a.rehearsal && (
            <AimTools
              busy={a.isStreaming}
              onVersions={() => handleSend({ label: '3 versions', text: VERSIONS_PROMPT }, { aimed: true })}
              onTone={q => handleSend(q, { aimed: true })}
            />
          )}

          <div className={cn('flex gap-1.5 overflow-x-auto scrollbar-hide', (draftOpen || a.rehearsal || aim?.kind === 'p') && 'hidden')}>
            {!npcPicker && (
              <button
                onClick={() => setNpcPicker(true)}
                disabled={a.isStreaming}
                style={{ touchAction: 'manipulation' }}
                className="shrink-0 min-h-[34px] px-3 rounded-full border border-amber-300/40 bg-[#2a2016] text-[12px] text-amber-100 flex items-center gap-1.5 disabled:opacity-40"
              >
                <Medal src={ART.medalNpc} className="w-5 h-5" /> Talk to an NPC
              </button>
            )}
            {prompts.map(q => (
              <button
                key={q.label}
                onClick={() => handleSend(q)}
                disabled={a.isStreaming}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  'shrink-0 min-h-[34px] px-3 rounded-full border text-[12px] disabled:opacity-40',
                  q.mode === 'draft'
                    ? 'border-amber-400/40 bg-amber-800/30 text-amber-100'
                    : 'border-amber-500/25 bg-amber-900/15 text-amber-200/85',
                )}
              >
                {q.label}{q.mode === 'draft' ? ' →' : ''}
              </button>
            ))}
          </div>

          {speech.isListening && (
            <div className="flex items-center gap-2 px-1 text-[12px] text-red-200/85">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="truncate">{speech.interimText ? `${speech.interimText}…` : 'Listening… tap the mic again to stop'}</span>
            </div>
          )}

          <div className="flex items-end gap-2">
            {speech.isSupported && (
              <button
                onClick={speech.toggle}
                aria-label={speech.isListening ? 'Stop listening' : 'Speak your message'}
                aria-pressed={speech.isListening}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  'shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center',
                  speech.isListening ? 'border-red-400/50 bg-red-900/35 text-red-200' : 'border-white/10 bg-white/5 text-white/60',
                )}
              >
                {speech.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={a.rehearsal
                ? `Say something to ${a.rehearsal.npc}… (e.g. Kaelen: where's the pup?)`
                : aim
                ? (a.mode === 'draft' ? `What should change in ${aimLabel}?` : `What about ${aimLabel}?`)
                : (a.mode === 'draft' ? 'Ask for a draft or a change…' : 'Bounce an idea off your co-DM…')}
              rows={2}
              className="flex-1 min-h-[44px] max-h-[120px] bg-white/5 border-white/10 text-[13px] resize-none focus-visible:ring-amber-500/30"
            />
            {a.isStreaming ? (
              <button
                onClick={a.stop}
                aria-label="Stop"
                style={{ touchAction: 'manipulation' }}
                className="shrink-0 w-11 h-11 rounded-xl border border-red-500/40 bg-red-900/30 text-red-200 flex items-center justify-center"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                aria-label="Send to assistant"
                style={{ touchAction: 'manipulation' }}
                className="shrink-0 w-11 h-11 rounded-xl border border-amber-500/40 bg-amber-900/35 text-amber-200 flex items-center justify-center disabled:opacity-35"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={!canApply}
              aria-label={aiDmWriting ? 'Wait: the AI DM is writing' : 'Apply to Table'}
              style={{ touchAction: 'manipulation' }}
              className="w-full min-h-[44px] flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-35"
            >
              {aiDmWriting
                ? <span className="font-cinzel text-[13px] text-emerald-200">Wait: the AI DM is writing</span>
                : <img src={ART.applyButton} alt="" aria-hidden="true" draggable={false} className="h-11 w-auto max-w-full select-none" />}
            </button>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 space-y-2">
              <ul className="text-[12px] text-emerald-50/80 space-y-1">
                <li>
                  {sealedCount > 0
                    ? `Answers ${plural(sealedCount, 'sealed line', 'sealed lines')}; they'll be marked sent.`
                    : 'No sealed lines: posts as a new scene beat.'}
                </li>
                <li>{plural(counts.rolls, 'roll request', 'roll requests')} · {plural(counts.whispers, 'whisper', 'whispers')}</li>
                <li className="text-emerald-50/55">Sheets update from the story text on phones with auto-sync on.</li>
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={applying}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 min-h-[42px] rounded-lg border border-white/15 bg-white/5 text-white/75 text-[13px] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={!canApply}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 min-h-[42px] rounded-lg border border-emerald-400/50 bg-emerald-700/50 text-emerald-50 text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Post it
                </button>
              </div>
            </div>
          )}
        </div>
        {sealing && <SealStampOverlay onDone={finishSeal} />}
      </SheetContent>
    </Sheet>
  );
}
