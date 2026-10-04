import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { X, Send, Loader2, RotateCcw, Plus, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DM_MODELS } from '@/lib/dm-models';
import { loadApiKey } from '@/lib/api-keys';
import { parseRollTable } from '@/lib/magic/parseRollTable';
import { DiceOutcomeTable } from '@/components/magic/DiceOutcomeTable';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface SpellForgeDraft {
  name: string; level: number; school: string; castingTime: string; range: string; duration: string;
  concentration: boolean; ritual: boolean;
  components: { verbal: boolean; somatic: boolean; material?: string | null };
  attackType?: string | null; saveStat?: string | null; damageFormula?: string | null; damageType?: string | null;
  healingFormula?: string | null; higherLevels?: string | null; description: string;
}

export interface SpellForgeChatProps {
  open: boolean;
  onClose: () => void;
  character: { name: string; className?: string; level?: number; spellcastingAbility?: string; spellSaveDC?: number; spellAttackBonus?: number; existingSpellNames?: string[] };
  onInstall: (draft: SpellForgeDraft) => Promise<{ ok: boolean; message: string }>;
  /** Render inside the open drawer instead of a body portal. */
  inline?: boolean;
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

const MODEL_KEY = 'odyssey-spell-forge-model';
const DEFAULT_MODEL = 'venice/venice-uncensored-1-2';
const GREETING = "Tell me the spell you want. A bit, a joke, a power fantasy. I'll ask a couple of questions, then forge it with a d20 table you can install straight into Quick Actions.";
const RESEND_MSG = "Your install block didn't parse. Resend the full draft with a valid [[SPELL]] JSON block.";
const BLOCK_RE = /\[\[SPELL\]\]([\s\S]*?)\[\[\/SPELL\]\]/g;

function readModel(): string {
  try { return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; }
}

function splitBlock(content: string): { text: string; block: string | null } {
  const matches = [...content.matchAll(BLOCK_RE)];
  if (!matches.length) return { text: content, block: null };
  const last = matches[matches.length - 1];
  const idx = last.index ?? 0;
  const text = (content.slice(0, idx) + content.slice(idx + last[0].length)).trim();
  return { text, block: last[1].trim() };
}

function validate(d: SpellForgeDraft): string[] {
  const errs: string[] = [];
  const nonEmpty = (k: keyof SpellForgeDraft) => typeof d[k] === 'string' && (d[k] as string).trim().length > 0;
  (['name', 'description', 'school', 'castingTime', 'range', 'duration'] as const).forEach(k => { if (!nonEmpty(k)) errs.push(`${k} is missing`); });
  if (!Number.isInteger(d.level) || d.level < 0 || d.level > 9) errs.push('level must be a whole number from 0 to 9');
  const { table } = parseRollTable(typeof d.description === 'string' ? d.description : '');
  const okTable = !!table && table.rows.length === 20 && table.rows.every((r, i) => r.roll === i + 1);
  if (!okTable) errs.push(`the d20 table needs exactly 20 rows numbered 1 to 20 (found ${table?.rows.length ?? 0})`);
  return errs;
}

function FallbackVideo({ src, poster, loop = true, className, reduced, onEnded }: { src: string; poster: string; loop?: boolean; className?: string; reduced: boolean; onEnded?: () => void }) {
  const [failed, setFailed] = useState(false);
  if (reduced || failed) return <img src={poster} alt="" aria-hidden="true" className={className} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />;
  return (
    <video
      src={src} poster={poster} autoPlay muted loop={loop} playsInline preload="auto" aria-hidden="true"
      className={className}
      onError={() => setFailed(true)}
      onEnded={onEnded}
      ref={el => { if (el) el.play?.().catch(() => setFailed(true)); }}
    />
  );
}

function Avatar() {
  return <img src="/forge-avatar.webp" alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />;
}

function SpellPreviewCard({ block, installedNames, onInstall, onResend, onCelebrate, busy }: {
  block: string; installedNames: Set<string>; busy: boolean;
  onInstall: (d: SpellForgeDraft) => Promise<{ ok: boolean; message: string }>;
  onResend: (msg: string) => void; onCelebrate: (name: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const draft = useMemo<SpellForgeDraft | null>(() => { try { return JSON.parse(block); } catch { return null; } }, [block]);
  const errors = useMemo(() => (draft && typeof draft === 'object' ? validate(draft) : null), [draft]);

  const resendBtn = (text: string) => (
    <button onClick={() => onResend(text)} disabled={busy} className="mt-2 min-h-[48px] w-full rounded-lg border border-primary/50 px-3 text-sm text-primary disabled:opacity-50" style={{ touchAction: 'manipulation' }}>
      Ask Forge to resend
    </button>
  );

  if (!draft || typeof draft !== 'object') {
    return <div className="mt-2 rounded-xl border border-destructive/50 bg-black/60 p-3 text-sm backdrop-blur-sm">This spell didn't come through cleanly.{resendBtn(RESEND_MSG)}</div>;
  }
  if (errors && errors.length) {
    return (
      <div className="mt-2 rounded-xl border border-amber-500/50 bg-black/60 p-3 text-sm backdrop-blur-sm">
        <p className="font-semibold text-amber-400">This draft can't be installed yet:</p>
        <ul className="mt-1 list-disc pl-5 text-amber-300">{errors.map(e => <li key={e}>{e}</li>)}</ul>
        {resendBtn(`Your install block has problems: ${errors.join('; ')}. Resend the full draft with a valid [[SPELL]] JSON block.`)}
      </div>
    );
  }

  const { intro, table } = parseRollTable(draft.description);
  const chips = [draft.castingTime?.replace(/_/g, ' '), draft.range, draft.duration,
    draft.damageFormula ? `${draft.damageFormula}${draft.damageType ? ` ${draft.damageType}` : ''}` : null,
    draft.saveStat ? `${draft.saveStat} save` : null].filter(Boolean) as string[];
  const again = installedNames.has(draft.name.trim().toLowerCase());

  const install = async () => {
    setState('working'); setMsg('');
    try {
      const res = await onInstall(draft);
      setMsg(res.message);
      if (res.ok) { setState('done'); onCelebrate(draft.name); } else setState('error');
    } catch (e) {
      setState('error'); setMsg(e instanceof Error ? e.message : 'Install failed.');
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-primary/40 bg-black/70 p-3 backdrop-blur-sm">
      <h3 className="font-cinzel text-lg text-primary">{draft.name}</h3>
      <p className="text-xs capitalize text-muted-foreground">{draft.level === 0 ? 'Cantrip' : `Level ${draft.level}`} · {draft.school}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map(c => <span key={c} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] capitalize text-foreground">{c}</span>)}
      </div>
      {intro && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{intro}</p>}
      {table && <div className="mt-3"><DiceOutcomeTable table={table} /></div>}
      <button
        onClick={install} disabled={state === 'working'}
        className={cn('mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg font-cinzel text-base font-semibold',
          state === 'done' ? 'bg-green-700 text-foreground' : 'bg-primary text-primary-foreground', 'disabled:opacity-70')}
        style={{ touchAction: 'manipulation' }}
      >
        {state === 'working' ? <Loader2 className="h-5 w-5 animate-spin" /> : state === 'done' ? <><Check className="h-5 w-5" />Installed</> : again ? 'Install again' : 'Install to Quick Actions'}
      </button>
      {msg && <p className={cn('mt-2 text-sm', state === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{msg}</p>}
    </div>
  );
}

function Celebration({ name, reduced, onDone }: { name: string; reduced: boolean; onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(onDone, 300);
  }, [onDone]);
  useEffect(() => { const t = setTimeout(finish, reduced ? 1500 : 5000); return () => clearTimeout(t); }, [finish, reduced]);
  return (
    <div onClick={finish} data-vaul-no-drag="" style={{ zIndex: 10060 }} className={cn('fixed inset-0 bg-black transition-opacity duration-300', fading ? 'opacity-0' : 'opacity-100')}>
      <FallbackVideo src="/forge-installed.mp4" poster="/forge-installed-poster.webp" loop={false} reduced={reduced} onEnded={finish} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 flex h-1/3 flex-col items-center justify-center bg-gradient-to-t from-black/90 to-transparent px-6 text-center">
        <p className="font-cinzel text-3xl text-primary [text-shadow:0_2px_8px_#000]">{name}</p>
        <p className="mt-2 text-sm text-foreground/90">Installed to Quick Actions</p>
      </div>
    </div>
  );
}

export function SpellForgeChat({ open, onClose, character, onInstall, inline = false }: SpellForgeChatProps) {
  const reduced = !!useReducedMotion();
  const chatKey = `odyssey-spell-forge-chat-${character.name}`;
  const veniceModels = useMemo(() => DM_MODELS.filter(m => m.provider === 'venice'), []);
  const [model, setModel] = useState(readModel);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Load saved conversation for this character
  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setMessages(Array.isArray(parsed) ? parsed.filter((m: ChatMsg) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') : []);
    } catch { setMessages([]); }
  }, [chatKey]);

  useEffect(() => {
    try { if (messages.length) localStorage.setItem(chatKey, JSON.stringify(messages)); else localStorage.removeItem(chatKey); } catch { /* ignore */ }
  }, [messages, chatKey]);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading, error, open]);

  const changeModel = (id: string) => { setModel(id); try { localStorage.setItem(MODEL_KEY, id); } catch { /* ignore */ } };

  const request = useCallback(async (history: ChatMsg[]) => {
    setLoading(true); setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('spell-forge', {
        body: { messages: history.map(m => ({ role: m.role, content: m.content })), model, user_venice_key: loadApiKey('venice') || undefined, character },
      });
      if (fnErr) {
        let text = fnErr.message || 'Spell Forge failed.';
        try { const ctx = (fnErr as { context?: Response }).context; const j = ctx ? await ctx.json() : null; if (j?.error) text = j.error; } catch { /* ignore */ }
        throw new Error(text);
      }
      if (data?.error) throw new Error(String(data.error));
      const reply = typeof data?.reply === 'string' ? data.reply : '';
      if (!reply.trim()) throw new Error('The Forge returned an empty reply.');
      setMessages([...history, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spell Forge failed.');
    } finally { setLoading(false); }
  }, [model, character]);

  const sendText = useCallback((text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const history = [...messages, { role: 'user' as const, content: t }];
    setMessages(history);
    void request(history);
  }, [messages, loading, request]);

  const handleSend = () => { if (!input.trim() || loading) return; const t = input; setInput(''); sendText(t); };
  const retry = () => { if (!loading) void request(messages); };
  const newSpell = () => { setMessages([]); setError(null); setInstalled(new Set()); };

  const celebrate = (name: string) => {
    setInstalled(prev => new Set(prev).add(name.trim().toLowerCase()));
    setCelebrating(name);
  };

  if (!open) return null;

  const layer = (
    <div data-vaul-no-drag="" className="fixed inset-0 flex flex-col bg-[#0d0d12]" style={{ zIndex: 10050, pointerEvents: 'auto', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <FallbackVideo src="/forge-chat-bg.mp4" poster="/forge-chat-bg-poster.webp" reduced={reduced} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-black/55" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" />
      {/* Preload celebration video */}
      {!reduced && <video src="/forge-installed.mp4" preload="auto" muted playsInline aria-hidden="true" className="hidden" />}

      <header className="relative z-10 flex items-center gap-2 border-b border-primary/20 bg-black/50 px-3 py-2">
        <img src="/forge-icon.webp" alt="" className="h-8 w-8 rounded-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <h2 className="font-cinzel text-lg text-primary">Spell Forge</h2>
        <div className="ml-auto flex items-center gap-1">
          <select value={model} onChange={e => changeModel(e.target.value)} className="h-10 max-w-[130px] rounded-md border border-primary/30 bg-black/70 px-2 text-xs text-foreground">
            {!veniceModels.some(m => m.id === model) && <option value={model}>{model}</option>}
            {veniceModels.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button onClick={newSpell} aria-label="New spell" className="flex h-12 items-center gap-1 rounded-md px-2 text-xs text-primary" style={{ touchAction: 'manipulation' }}>
            <Plus className="h-4 w-4" />New spell
          </button>
          <button onClick={onClose} aria-label="Close" className="flex h-12 w-12 items-center justify-center text-foreground" style={{ touchAction: 'manipulation' }}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="relative z-10 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 py-4">
        {messages.length === 0 && (
          <div className="flex items-start gap-2">
            <Avatar />
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-black/60 px-3 py-2 text-sm text-foreground backdrop-blur-sm">{GREETING}</div>
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-primary/30 bg-primary/25 px-3 py-2 text-sm text-foreground backdrop-blur-sm">{m.content}</div>
              </div>
            );
          }
          const { text, block } = splitBlock(m.content);
          return (
            <div key={i} className="flex items-start gap-2">
              <Avatar />
              <div className="min-w-0 max-w-[88%] flex-1">
                {text && <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-black/60 px-3 py-2 text-sm text-foreground backdrop-blur-sm">{text}</div>}
                {block !== null && (
                  <SpellPreviewCard block={block} installedNames={installed} busy={loading} onInstall={onInstall} onResend={sendText} onCelebrate={celebrate} />
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex items-start gap-2">
            <Avatar />
            <div className="w-[60vw] overflow-hidden rounded-xl border border-primary/40 bg-black/60">
              <div className="aspect-[9/16] max-h-[45vh] w-full overflow-hidden">
                <FallbackVideo src="/forge-loader.mp4" poster="/forge-loader-poster.webp" reduced={reduced} className="h-full w-full object-cover" />
              </div>
              <p className="animate-pulse py-2 text-center font-cinzel text-sm text-primary">Forging...</p>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-black/60 p-3 text-sm text-destructive">
            <span>{error}</span>
            <button onClick={retry} className="flex min-h-[48px] items-center gap-2 rounded-md border border-destructive/50 px-3 text-foreground" style={{ touchAction: 'manipulation' }}>
              <RotateCcw className="h-4 w-4" />Retry
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="relative z-10 flex items-end gap-2 border-t border-primary/20 bg-[#0d0d12] px-3 py-2">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Describe your spell..."
          rows={2}
          className="min-h-[48px] flex-1 resize-none text-base"
          style={{ fontSize: 16 }}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()} aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50" style={{ touchAction: 'manipulation' }}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>

      {celebrating && <Celebration name={celebrating} reduced={reduced} onDone={() => setCelebrating(null)} />}
    </div>
  );

  return inline ? layer : createPortal(layer, document.body);
}

export default SpellForgeChat;
