import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { X, Send, Loader2, RotateCcw, Plus, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DM_MODELS } from '@/lib/dm-models';
import { loadApiKey } from '@/lib/api-keys';
import { listReworkableSpells } from '@/lib/spellForgeBus';
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

type InstallFn = (draft: SpellForgeDraft, options?: { replaceId?: string }) => Promise<{ ok: boolean; message: string }>;

export interface SpellForgeChatProps {
  open: boolean;
  onClose: () => void;
  character: { name: string; className?: string; level?: number; spellcastingAbility?: string; spellSaveDC?: number; spellAttackBonus?: number; existingSpellNames?: string[] };
  onInstall: InstallFn;
  /** Render inside the open drawer instead of a body portal. */
  inline?: boolean;
}

interface ChatMsg { role: 'user' | 'assistant'; content: string; display?: string }
type ReworkTarget = { id: string; name: string };

const MODEL_KEY = 'odyssey-spell-forge-model';
const DEFAULT_MODEL = 'venice/venice-uncensored-1-2';
const GREETING = "Welcome to the Spell Forge, where bad ideas become worse spells. Tell me what you want your magic to do to some poor bastard and I'll hammer it into a spell with a d20 table. Got an idea, or want me to pitch you some?";
const RESEND_MSG = "Your install block didn't parse. Resend the full draft with a valid [[SPELL]] JSON block.";
const BLOCK_RE = /\[\[SPELL\]\]([\s\S]*?)\[\[\/SPELL\]\]/g;
const READY_RE = /^[ \t]*\[FORGE_READY\][ \t]*$/m;

function readModel(): string {
  try { return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; }
}

function parseSuggestions(content: string): string[] {
  const match = content.match(/\[SUGGESTIONS:\s*(.*?)\]\s*$/);
  if (!match) return [];
  try {
    const raw = match[1];
    const suggestions: string[] = [];
    const regex = /"([^"]+)"/g;
    let m;
    while ((m = regex.exec(raw)) !== null) suggestions.push(m[1]);
    return suggestions;
  } catch {
    return [];
  }
}

function stripSuggestions(content: string): string {
  return content.replace(/\n?\[SUGGESTIONS:\s*.*?\]\s*$/, '').trimEnd();
}

function hasReady(content: string): boolean { return READY_RE.test(stripSuggestions(content)); }
function stripReady(content: string): string { return content.replace(/^[ \t]*\[FORGE_READY\][ \t]*$\n?/gm, '').trim(); }

function splitBlock(content: string): { text: string; block: string | null } {
  const matches = [...content.matchAll(BLOCK_RE)];
  if (!matches.length) return { text: content, block: null };
  const last = matches[matches.length - 1];
  const idx = last.index ?? 0;
  const text = (content.slice(0, idx) + content.slice(idx + last[0].length)).trim();
  return { text, block: last[1].trim() };
}

function buildReworkContent(s: Record<string, any>): string {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const join = (parts: string[]) => parts.filter(Boolean).join(' · ');
  const lines: string[] = [`REWORK: ${str(s.name)}`];
  const lvl = typeof s.level === 'number' ? (s.level === 0 ? 'Cantrip' : String(s.level)) : '';
  const l1 = join([lvl && `Level: ${lvl}`, str(s.school) && `School: ${str(s.school)}`]); if (l1) lines.push(l1);
  const l2 = join([str(s.castingTime) && `Casting time: ${str(s.castingTime)}`, str(s.range) && `Range: ${str(s.range)}`, str(s.duration) && `Duration: ${str(s.duration)}`]); if (l2) lines.push(l2);
  const l3 = join([typeof s.concentration === 'boolean' ? `Concentration: ${s.concentration ? 'yes' : 'no'}` : '', typeof s.ritual === 'boolean' ? `Ritual: ${s.ritual ? 'yes' : 'no'}` : '']); if (l3) lines.push(l3);
  const c = s.components;
  if (c && typeof c === 'object') {
    const parts = [c.verbal ? 'V' : '', c.somatic ? 'S' : '', str(c.material) ? `M (${str(c.material)})` : (c.material === true ? 'M' : '')].filter(Boolean);
    if (parts.length) lines.push(`Components: ${parts.join(', ')}`);
  }
  const atk = [str(s.attackType), str(s.saveStat)].filter(Boolean).join(' ');
  if (atk) lines.push(`Attack or save: ${atk}`);
  const dmg = [str(s.damageFormula), str(s.damageType)].filter(Boolean).join(' ');
  const l4 = join([dmg && `Damage: ${dmg}`, str(s.healingFormula) && `Healing: ${str(s.healingFormula)}`]); if (l4) lines.push(l4);
  if (str(s.higherLevels)) lines.push(`Higher levels: ${str(s.higherLevels)}`);
  if (typeof s.description === 'string' && s.description) { lines.push('Description:'); lines.push(s.description); }
  return lines.join('\n');
}

const CHIP_CLASS = 'animate-in fade-in-0 zoom-in-95 fill-mode-both duration-300 rounded-full min-h-[40px] px-3 text-sm font-cinzel text-primary border border-primary/50 bg-black/60 backdrop-blur-sm';

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

function SpellPreviewCard({ block, installedNames, onInstall, onResend, onCelebrate, busy, rework }: {
  block: string; installedNames: Set<string>; busy: boolean;
  onInstall: InstallFn;
  onResend: (msg: string) => void; onCelebrate: (name: string) => void;
  rework: ReworkTarget | null;
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

  const install = async (replace: boolean) => {
    setState('working'); setMsg('');
    try {
      const res = replace && rework ? await onInstall(draft, { replaceId: rework.id }) : await onInstall(draft);
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
        onClick={() => install(true)} disabled={state === 'working'}
        className={cn('mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg font-cinzel text-base font-semibold',
          state === 'done' ? 'bg-green-700 text-foreground' : 'bg-primary text-primary-foreground', 'disabled:opacity-70')}
        style={{ touchAction: 'manipulation' }}
      >
        {state === 'working' ? <Loader2 className="h-5 w-5 animate-spin" /> : state === 'done' ? <><Check className="h-5 w-5" />Installed</> : rework ? `Update ${rework.name}` : again ? 'Install again' : 'Install to Quick Actions'}
      </button>
      {rework && state !== 'done' && (
        <button onClick={() => install(false)} disabled={state === 'working'} className="mt-1 min-h-[40px] w-full text-xs text-muted-foreground underline disabled:opacity-50" style={{ touchAction: 'manipulation' }}>
          Save as a new spell instead
        </button>
      )}
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
  const [forging, setForging] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const reworkKey = `odyssey-spell-forge-rework-${character.name}`;
  const [reworkTarget, setReworkTargetState] = useState<ReworkTarget | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(reworkKey);
      const p = raw ? JSON.parse(raw) : null;
      setReworkTargetState(p && typeof p.id === 'string' && typeof p.name === 'string' ? { id: p.id, name: p.name } : null);
    } catch { setReworkTargetState(null); }
  }, [reworkKey]);

  const setReworkTarget = useCallback((t: ReworkTarget | null) => {
    setReworkTargetState(t);
    try { if (t) localStorage.setItem(reworkKey, JSON.stringify(t)); else localStorage.removeItem(reworkKey); } catch { /* ignore */ }
  }, [reworkKey]);

  // Load saved conversation for this character
  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setMessages(Array.isArray(parsed) ? parsed.filter((m: ChatMsg) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map((m: ChatMsg) => (typeof m.display === 'string' ? { role: m.role, content: m.content, display: m.display } : { role: m.role, content: m.content })) : []);
    } catch { setMessages([]); }
  }, [chatKey]);

  useEffect(() => {
    try { if (messages.length) localStorage.setItem(chatKey, JSON.stringify(messages)); else localStorage.removeItem(chatKey); } catch { /* ignore */ }
  }, [messages, chatKey]);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading, error, open]);

  const changeModel = (id: string) => { setModel(id); try { localStorage.setItem(MODEL_KEY, id); } catch { /* ignore */ } };

  const request = useCallback(async (history: ChatMsg[], isForging = false) => {
    setForging(isForging); setLoading(true); setError(null);
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

  const isForgeRequest = useCallback((history: ChatMsg[], text: string) => {
    if (/^\s*go\s*[.!]*\s*$/i.test(text)) return true;
    const lastA = [...history].reverse().find(m => m.role === 'assistant');
    return !!lastA && hasReady(lastA.content) && /forge|yes|do it/i.test(text);
  }, []);

  const sendText = useCallback((text: string, opts?: { display?: string; forging?: boolean }) => {
    const t = text.trim();
    if (!t || loading) return;
    const forge = opts?.forging ?? isForgeRequest(messages, t);
    const msg: ChatMsg = opts?.display ? { role: 'user', content: t, display: opts.display } : { role: 'user', content: t };
    const history = [...messages, msg];
    setMessages(history);
    void request(history, forge);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [messages, loading, request, isForgeRequest]);

  const handleSend = () => { if (!input.trim() || loading) return; const t = input; setInput(''); sendText(t); };
  const retry = () => { if (!loading) void request(messages, forging); };
  const newSpell = () => { setMessages([]); setError(null); setInstalled(new Set()); setReworkTarget(null); setPickerOpen(false); };
  const resend = (text: string) => sendText(text, { forging: true });

  const reworkable = open ? listReworkableSpells() : [];

  const pickRework = (s: Record<string, any>) => {
    setPickerOpen(false);
    const name = String(s.name ?? '');
    setReworkTarget({ id: String(s.id ?? ''), name });
    sendText(buildReworkContent(s), { display: `Rework: ${name}` });
  };

  const onChip = (chip: string) => {
    const lc = chip.toLowerCase();
    if (lc.includes('rework') && lc.includes('spell')) { setPickerOpen(true); return; }
    if (lc === "i've got an idea") { inputRef.current?.focus(); return; }
    if (lc === 'new spell' || lc === 'start a new spell') { newSpell(); return; }
    sendText(chip);
  };

  const lastMsg = messages[messages.length - 1];
  const chips: string[] = loading || error ? [] : messages.length === 0
    ? ["I've got an idea", 'Pitch me 3 ideas', ...(reworkable.length ? ['Rework one of my spells'] : []), 'Surprise me']
    : lastMsg?.role === 'assistant' ? parseSuggestions(lastMsg.content) : [];

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
      {reworkTarget && (
        <div className="relative z-10 flex items-center gap-2 border-b border-primary/20 bg-black/60 px-3 py-1 text-xs text-primary">
          <span className="truncate font-cinzel">Reworking: {reworkTarget.name}</span>
          <button onClick={() => setReworkTarget(null)} aria-label="Stop reworking" className="ml-auto flex h-10 w-10 items-center justify-center" style={{ touchAction: 'manipulation' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-primary/30 bg-primary/25 px-3 py-2 text-sm text-foreground backdrop-blur-sm">{m.display ?? m.content}</div>
              </div>
            );
          }
          const { text, block } = splitBlock(stripReady(stripSuggestions(m.content)));
          return (
            <div key={i} className="flex items-start gap-2">
              <Avatar />
              <div className="min-w-0 max-w-[88%] flex-1">
                {text && <div className="rounded-2xl rounded-tl-sm bg-black/60 px-3 py-2 text-sm text-foreground backdrop-blur-sm"><div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0"><ReactMarkdown>{text}</ReactMarkdown></div></div>}
                {block !== null && (
                  <SpellPreviewCard block={block} installedNames={installed} busy={loading} onInstall={onInstall} onResend={resend} onCelebrate={celebrate} rework={reworkTarget} />
                )}
              </div>
            </div>
          );
        })}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-9">
            {chips.map((c, i) => (
              <button key={`${c}-${i}`} onClick={() => onChip(c)} className={CHIP_CLASS} style={{ touchAction: 'manipulation', animationDelay: `${i * 80}ms` }}>{c}</button>
            ))}
          </div>
        )}
        {loading && !forging && (
          <div className="flex items-start gap-2">
            <Avatar />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-black/60 px-4 py-3 backdrop-blur-sm">
              {[0, 150, 300].map(d => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}
        {loading && forging && (
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
          ref={inputRef}
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

      {pickerOpen && (
        <div className="absolute inset-x-0 bottom-0 z-20 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-primary/40 bg-[#0d0d12]/95 px-3 pb-4 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
          <div className="mb-2 flex items-center">
            <h3 className="font-cinzel text-lg text-primary">Rework which spell?</h3>
            <button onClick={() => setPickerOpen(false)} className="ml-auto min-h-[48px] px-3 text-sm text-muted-foreground" style={{ touchAction: 'manipulation' }}>Cancel</button>
          </div>
          {reworkable.length === 0 ? (
            <div className="space-y-3 py-2 text-sm text-muted-foreground">
              <p>No homebrew spells yet. Forge one first.</p>
              <button onClick={() => setPickerOpen(false)} className="min-h-[48px] w-full rounded-lg border border-primary/50 text-primary" style={{ touchAction: 'manipulation' }}>Close</button>
            </div>
          ) : (
            <div className="space-y-2">
              {reworkable.map(s => {
                const sp = s as unknown as Record<string, any>;
                return (
                  <button key={String(sp.id)} onClick={() => pickRework(sp)} className="flex min-h-[52px] w-full flex-col items-start justify-center rounded-lg border border-primary/30 bg-black/50 px-3 py-2 text-left" style={{ touchAction: 'manipulation' }}>
                    <span className="font-cinzel text-sm text-primary">{String(sp.name)}</span>
                    <span className="text-xs capitalize text-muted-foreground">{sp.level === 0 ? 'Cantrip' : `Level ${sp.level}`}{sp.school ? ` · ${sp.school}` : ''}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {celebrating && <Celebration name={celebrating} reduced={reduced} onDone={() => setCelebrating(null)} />}
    </div>
  );

  return inline ? layer : createPortal(layer, document.body);
}

export default SpellForgeChat;
