// Human DM Assistant panel (host only). A private co-DM chat that builds a
// draft post — story text, roll requests, whispers — which the host applies
// to the table with one tap. Players never see this chat.

import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { WhisperEditor } from './WhisperEditor';
import { DM_MODELS } from '@/lib/dm-models';
import { serializeWhispers } from '@/lib/whisper-parser';
import { useDmAssistant, type DigestStatus } from '@/hooks/use-dm-assistant';
import {
  QUICK_PROMPTS,
  draftCounts,
  draftIsEmpty,
  modelNeedsMissingKey,
  type AssistantLiveContext,
} from '@/lib/dm-assistant';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Square,
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

const PROVIDER_LABEL: Record<string, string> = {
  lovable: 'Built in',
  anthropic: 'Claude',
  'openai-direct': 'OpenAI (your key)',
  perplexity: 'Perplexity (your key)',
  'xai-direct': 'Grok (your key)',
  venice: 'Venice',
};

const DIGEST_LABEL: Record<DigestStatus, string> = {
  'no-guides': 'No guides enabled',
  none: 'Bible digest builds on your first message',
  stale: 'Guides changed: digest rebuilds on your next message',
  building: 'Reading your World Bible once…',
  ready: 'Bible digest ready',
  error: 'Digest failed: full guides were sent',
};

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
  const [draftOpen, setDraftOpen] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { refreshDigestStatus } = a;
  useEffect(() => {
    if (open) refreshDigestStatus();
    else setConfirming(false);
  }, [open, refreshDigestStatus]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [a.messages.length, a.streamingText, a.isStreaming]);

  const sealedCount = open ? getContext().sealedOrder.length : 0;
  const counts = draftCounts(a.draft);
  const hasDraft = !draftIsEmpty(a.draft);
  const canApply = hasDraft && !a.isStreaming && !aiDmWriting && !applying;

  const groups = Object.keys(PROVIDER_LABEL)
    .map(provider => ({ provider, models: DM_MODELS.filter(m => m.provider === provider) }))
    .filter(g => g.models.length > 0);

  const handleSend = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || a.isStreaming) return;
    setConfirming(false);
    void a.send(value);
    if (text === undefined) setInput('');
  };

  const handleNewChat = () => {
    if ((a.messages.length > 0 || hasDraft) && !window.confirm('Start a new chat? This clears the chat and the draft.')) return;
    a.reset();
    setConfirming(false);
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
        setDraftOpen(true);
        onOpenChange(false);
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-vaul-no-drag
        className="h-[92vh] p-0 bg-[#0b0b10] border-t border-amber-500/30 rounded-t-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-2 border-b border-white/10 space-y-2">
          <div className="pr-8">
            <SheetTitle className="font-cinzel text-amber-300 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Human DM Assistant
            </SheetTitle>
            <SheetDescription className="text-[11px] text-white/45">
              Your private co-DM. Players never see this chat.
            </SheetDescription>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={a.model}
              onChange={e => a.setModel(e.target.value)}
              aria-label="Assistant model"
              className="flex-1 min-w-0 min-h-[40px] rounded-lg bg-white/5 border border-white/10 text-[13px] text-white/85 px-2"
            >
              {groups.map(g => (
                <optgroup key={g.provider} label={PROVIDER_LABEL[g.provider]}>
                  {g.models.map(m => {
                    const locked = modelNeedsMissingKey(m.id);
                    return (
                      <option key={m.id} value={m.id} disabled={locked}>
                        {m.label}{locked ? ' (needs your key)' : ''}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
            <button
              onClick={handleNewChat}
              disabled={a.isStreaming}
              style={{ touchAction: 'manipulation' }}
              className="shrink-0 min-h-[40px] px-3 rounded-lg border border-white/10 bg-white/5 text-white/70 text-[12px] flex items-center gap-1.5 disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" /> New chat
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-white/50">
            <BookOpen className="w-3.5 h-3.5 shrink-0 text-amber-300/70" />
            <span className="truncate">{DIGEST_LABEL[a.digestStatus]}</span>
            {(a.digestStatus === 'ready' || a.digestStatus === 'error' || a.digestStatus === 'stale') && (
              <button
                onClick={a.rebuildDigest}
                disabled={a.isStreaming}
                style={{ touchAction: 'manipulation' }}
                className="shrink-0 underline text-amber-300/80 disabled:opacity-40"
              >
                Rebuild
              </button>
            )}
            <label className="ml-auto shrink-0 flex items-center gap-1.5">
              <span>Full Bible</span>
              <Switch checked={a.fullBible} onCheckedChange={a.setFullBible} disabled={a.isStreaming} aria-label="Send the full guides with the next message" />
            </label>
          </div>
          <div className="text-[11px] text-white/40">
            {sealedCount > 0
              ? `Answering ${sealedCount} sealed line${sealedCount === 1 ? '' : 's'}`
              : 'No sealed lines: you can still write a scene beat'}
            {a.lastSendTokens ? ` · last message about ${Math.round(a.lastSendTokens / 1000)}k tokens` : ''}
            {a.fullBible ? ' · next message sends the full guides' : ''}
          </div>
        </div>

        {/* Chat */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-2.5">
          {a.messages.length === 0 && !a.isStreaming && (
            <div className="text-[13px] text-white/55 leading-relaxed space-y-2 px-1">
              <p>Ask anything, or start with a quick button below. I can see the story summary, the latest DM post, the Live Table and your sealed lines.</p>
              <p className="text-white/40 text-[12px]">Damage, healing, XP, gold, items and quests update players&apos; sheets only when they&apos;re written in the story text, so I&apos;ll put them there.</p>
            </div>
          )}

          {a.messages.map(m => (
            <div key={m.id} className={cn('flex', m.role === 'host' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words',
                m.role === 'host'
                  ? 'bg-amber-900/35 border border-amber-500/25 text-amber-50/90'
                  : 'bg-white/5 border border-white/10 text-white/85',
              )}>
                {m.text}
                {m.draftUpdated && (
                  <span className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-300/80">
                    <Check className="w-3 h-3" /> Draft updated
                  </span>
                )}
              </div>
            </div>
          ))}

          {a.isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words bg-white/5 border border-white/10 text-white/85">
                {a.digestStatus === 'building' && !a.streamingText
                  ? 'Reading your World Bible once…'
                  : (a.streamingText || 'Thinking…')}
                {a.writingDraft && (
                  <span className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-300/80">
                    <Loader2 className="w-3 h-3 animate-spin" /> Writing the draft…
                  </span>
                )}
              </div>
            </div>
          )}

          {a.error && !a.isStreaming && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-[12px] text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{a.error}</span>
              <button
                onClick={a.retryLast}
                style={{ touchAction: 'manipulation' }}
                className="shrink-0 underline text-red-100"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Draft */}
        <div className="shrink-0 border-t border-white/10 bg-black/30">
          <button
            onClick={() => setDraftOpen(v => !v)}
            style={{ touchAction: 'manipulation' }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
          >
            <span className="font-cinzel text-[12px] text-emerald-300/90 uppercase tracking-wider">Draft</span>
            <span className="text-[11px] text-white/45 truncate">
              {hasDraft
                ? `${counts.rolls} roll${counts.rolls === 1 ? '' : 's'} · ${counts.whispers} whisper${counts.whispers === 1 ? '' : 's'}${counts.tactics ? ` · ${counts.tactics} tactic${counts.tactics === 1 ? '' : 's'}` : ''}`
                : 'Empty: ask the assistant to draft, or write it yourself'}
            </span>
            {draftOpen ? <ChevronDown className="w-4 h-4 ml-auto text-white/50" /> : <ChevronUp className="w-4 h-4 ml-auto text-white/50" />}
          </button>
          {draftOpen && (
            <div className="max-h-[38vh] overflow-y-auto overscroll-contain px-3 pb-3 space-y-2">
              <Textarea
                value={a.draft.narrative}
                onChange={e => a.setDraft({ ...a.draft, narrative: e.target.value })}
                placeholder="The story text players will read…"
                rows={7}
                className="bg-white/5 border-amber-900/30 text-[13px] text-foreground resize-none focus-visible:ring-amber-500/30"
              />
              <WhisperEditor
                whispers={a.draft.whispers}
                onChange={whispers => a.setDraft({ ...a.draft, whispers })}
                partyMemberNames={partyMemberNames}
              />
            </div>
          )}
        </div>

        {/* Input + Apply */}
        <div className="shrink-0 border-t border-white/10 px-3 pt-2 pb-4 space-y-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {QUICK_PROMPTS.map(q => (
              <button
                key={q.label}
                onClick={() => handleSend(q.text)}
                disabled={a.isStreaming}
                style={{ touchAction: 'manipulation' }}
                className="shrink-0 min-h-[34px] px-3 rounded-full border border-amber-500/25 bg-amber-900/15 text-amber-200/85 text-[12px] disabled:opacity-40"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Talk to your co-DM…"
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
              style={{ touchAction: 'manipulation' }}
              className="w-full min-h-[44px] rounded-xl border border-emerald-500/40 bg-emerald-900/35 text-emerald-200 font-cinzel text-[13px] flex items-center justify-center gap-2 disabled:opacity-35"
            >
              <Check className="w-4 h-4" />
              {aiDmWriting ? 'Wait: the AI DM is writing' : 'Apply to Table'}
            </button>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 space-y-2">
              <ul className="text-[12px] text-emerald-50/80 space-y-1">
                <li>
                  {sealedCount > 0
                    ? `Answers ${sealedCount} sealed line${sealedCount === 1 ? '' : 's'}; they'll be marked sent.`
                    : 'No sealed lines: posts as a new scene beat.'}
                </li>
                <li>
                  {counts.rolls} roll request{counts.rolls === 1 ? '' : 's'} · {counts.whispers} whisper{counts.whispers === 1 ? '' : 's'}
                </li>
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
      </SheetContent>
    </Sheet>
  );
}
