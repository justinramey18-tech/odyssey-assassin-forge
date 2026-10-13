// Arena 2.0: a mock Live Table. Same Quick Actions, sheet, dice and fight
// mini-games as a real party session, but no DM — a practice opponent answers
// in the chat instead. Everything stays on this phone and in practice memory.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Swords, Send, User, Zap } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { PartyDMQuickActions } from '@/components/ai-dm/PartyDMQuickActions';
import { SoloCharacterSheet } from '@/components/ai-dm/SoloCharacterSheet';
import { DiceRollOverlay } from '@/components/ai-dm/DiceRollOverlay';
import { CounterClashRing } from '@/components/ai-dm/CounterClashRing';
import { TugAndSlip } from '@/components/ai-dm/TugAndSlip';
import { DuelWheel, type DuelVerdict } from '@/components/ai-dm/DuelWheel';
import { parseActionCard, type ActionCard } from '@/lib/roundChatActionCard';
import * as M from '@/lib/combatMinigames';
import * as DU from '@/lib/combatDuel';
import type { CharacterContext } from '@/components/oracle/types';
import type { Foe } from './ArenaPractice';
import { cn } from '@/lib/utils';
import { sparLine, buildSparPrompt } from '@/lib/arena/arenaAi';

interface Line { id: string; who: 'you' | 'foe' | 'table'; text: string; card?: ActionCard | null }
type Live =
  | { kind: 'clash'; clash: M.Clash; hitAt: number; results: Array<M.ClashQ | null> }
  | { kind: 'pin'; struggle: M.Struggle; until: number; startedAt: number }
  | { kind: 'duel'; duel: DU.Duel }
  | null;

const roll: M.Roller = (s) => 1 + Math.floor(Math.random() * s);
const GAP: Record<DU.DuelSpeed, number> = { trivial: 16000, easy: 14000, medium: 12000, hard: 10000, deadly: 8000 };
const TAUNTS = ['Is that all you have?', 'Again! Faster!', 'Watch my shoulder — no, my feet!', 'You telegraph everything.', 'Good. Now defend.', 'Keep your guard up!'];
const HURT = ['Ngh — a fair hit.', 'Better!', 'That one stung.', 'You are learning.'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const finite = (n: unknown, f: number) => (Number.isFinite(Number(n)) ? Number(n) : f);

interface Props { ctx: CharacterContext; foe: Foe & { persona?: string }; onBack: () => void }

export function ArenaTable({ ctx, foe, onBack }: Props) {
  const maxHp = Math.max(1, finite(ctx.maxHP, 30));
  const myAc = finite(ctx.defenses?.armorClass, 12);
  const [myHp, setMyHp] = useState(Math.min(maxHp, Math.max(1, finite(ctx.currentHP, maxHp))));
  const myHpRef = useRef(myHp);
  const [foeHp, setFoeHp] = useState(foe.maxHp);
  const foeHpRef = useRef(foe.maxHp);
  const [lines, setLines] = useState<Line[]>([{ id: 'start', who: 'table', text: `${foe.name} steps into the ring. Use your Actions like a real fight — no DM, no story, no cost.` }]);
  const [draft, setDraft] = useState('');
  const [qaOpen, setQaOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [live, setLive] = useState<Live>(null);
  const [over, setOver] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const now = useCallback(() => Date.now(), []);
  const [aiOn, setAiOn] = useState(true);
  const linesRef = useRef<Line[]>([]);
  const busyRef = useRef(false);
  const lastAiRef = useRef(0);
  useEffect(() => { linesRef.current = lines; }, [lines]);

  const post = useCallback((who: Line['who'], text: string, card?: ActionCard | null) => {
    setLines((l) => [...l.slice(-199), { id: `${Date.now()}-${Math.random()}`, who, text, card }]);
  }, []);

  // Real AI voice for the opponent; falls back to a stock line if the call fails.
  const foeSpeak = useCallback(async (fallback: string | null, force = false) => {
    if (!aiOn) { if (fallback) post('foe', `${foe.name}: ${fallback}`); return; }
    if (busyRef.current || (!force && Date.now() - lastAiRef.current < 4000)) return;
    busyRef.current = true; lastAiRef.current = Date.now();
    const sys = buildSparPrompt({ foeName: foe.name, foePersona: foe.persona, playerName: ctx.name || 'the challenger', foeHp: foeHpRef.current, foeMax: foe.maxHp, myHp: myHpRef.current, myMax: maxHp });
    const hist = linesRef.current.map((l) => ({ who: l.who, text: l.card ? `${l.card.action}${l.card.outcome ? ` — ${l.card.outcome}` : ''}` : l.text.replace(`${foe.name}: `, '') }));
    const text = await sparLine(sys, hist);
    busyRef.current = false;
    if (text) post('foe', `${foe.name}: ${text}`);
    else if (fallback) post('foe', `${foe.name}: ${fallback}`);
  }, [aiOn, foe.name, foe.persona, foe.maxHp, ctx.name, maxHp, post]);

  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' }); }, [lines.length]);

  const hurtMe = useCallback((n: number, why: string) => {
    if (!Number.isFinite(n) || n <= 0) return;
    const hp = Math.max(0, myHpRef.current - Math.round(n));
    myHpRef.current = hp; setMyHp(hp);
    post('table', `${why} You take ${Math.round(n)} damage (${hp}/${maxHp}).`);
    if (hp === 0) { setOver(true); setLive(null); post('foe', `${foe.name}: Yield! Dust yourself off and go again.`); }
  }, [foe.name, maxHp, post]);

  const hurtFoe = useCallback((n: number) => {
    if (!Number.isFinite(n) || n <= 0) return;
    const hp = Math.max(0, foeHpRef.current - Math.round(n));
    foeHpRef.current = hp; setFoeHp(hp);
    if (hp === 0) { setOver(true); setLive(null); post('table', `${foe.name} is beaten! Victory.`); }
    else if (Math.random() < 0.5) setTimeout(() => void foeSpeak(pick(HURT)), 50);
  }, [foe.name, post, foeSpeak]);

  // Resolve whatever the Quick Actions / composer sends, exactly as the referee would.
  const onSend = useCallback((raw: string) => {
    if (over) return;
    const { card, body } = parseActionCard(raw);
    const text = body.split('\n')[0].slice(0, 240);
    post('you', card ? '' : text, card);
    if (!card) { setTimeout(() => void foeSpeak(pick(TAUNTS), true), 50); return; }
    const dmg = finite(card.damageTotal, 0);
    if (card.kind === 'heal' || (card.kind === 'spell' && finite(card.amount, 0) > 0 && !dmg)) {
      const amt = finite(card.amount, 0);
      const hp = Math.min(maxHp, myHpRef.current + amt);
      myHpRef.current = hp; setMyHp(hp);
      post('table', `You recover ${amt} HP (${hp}/${maxHp}).`);
      return;
    }
    if (card.kind === 'attack' || (card.kind === 'spell' && (card.resolve ?? 'attack') === 'attack' && Number.isFinite(card.attackTotal))) {
      const crit = card.d20 === 20;
      if (card.d20 === 1 || (!crit && finite(card.attackTotal, 0) < foe.ac)) { post('table', `${card.attackTotal ?? '?'} vs AC ${foe.ac} — miss.`); return; }
      post('table', `${crit ? 'Critical! ' : ''}${card.attackTotal} vs AC ${foe.ac} — hit for ${dmg}.`);
      hurtFoe(dmg);
      return;
    }
    if (card.kind === 'spell' && card.resolve === 'save') {
      const save = roll(20) + 2;
      const ok = save >= finite(card.saveDC, 13);
      const d = ok ? Math.floor(dmg / 2) : dmg;
      post('table', `${foe.name} rolls ${save} vs DC ${card.saveDC ?? 13} — ${ok ? 'saves, half' : 'fails'}: ${d} damage.`);
      hurtFoe(d);
      return;
    }
    if (dmg > 0) { post('table', `${card.action} lands for ${dmg}.`); hurtFoe(dmg); }
    else post('table', `${card.action} — noted. (No effect on a practice opponent.)`);
  }, [over, post, foe.ac, foe.name, maxHp, hurtFoe, foeSpeak]);

  // The opponent's turn: a big move (Clash or Pin) or a plain swing.
  useEffect(() => {
    if (live || over) return;
    const t = setTimeout(() => {
      const r = Math.random();
      if (r < 0.6) void foeSpeak(pick(TAUNTS), true);
      if (r < 0.45) {
        const moves: M.ClashMove[] = ['heavy', 'signature', 'sweep'];
        const c = M.buildClash(`c${Date.now()}`, pick(moves), roll);
        post('table', `⚠ ${foe.name} winds up a big move — Counter Clash!`);
        setLive({ kind: 'clash', clash: c, hitAt: now() + 1200 - M.clashStartsAt(c, 0), results: [] });
      } else if (r < 0.6) {
        const t0 = now();
        post('table', `⚠ ${foe.name} grabs you — Pinned! Break free.`);
        setLive({ kind: 'pin', struggle: M.newStruggle(Math.floor(Math.random() * 1e9), t0), until: t0 + 30000, startedAt: t0 });
      } else {
        const atk = roll(20) + foe.attackBonus;
        if (atk >= myAc) hurtMe(Math.max(1, Math.round(foe.damageAvg * (0.6 + Math.random() * 0.8))), `${foe.name} hits (${atk} vs your AC ${myAc}).`);
        else post('table', `${foe.name} swings — ${atk} vs your AC ${myAc}, miss.`);
      }
    }, GAP[foe.speed]);
    return () => clearTimeout(t);
  }, [live, over, foe, myAc, now, post, hurtMe, foeSpeak]);

  useEffect(() => {
    if (live?.kind !== 'clash') return;
    const id = setInterval(() => {
      if (now() <= live.hitAt + 600) return;
      const f = live.clash.swings.reduce((a, _s, i) => a + M.clashFactor(live.results[i]), 0) / live.clash.swings.length;
      const perfect = M.chainPerfect(live.clash, live.results);
      setLive(null);
      if (perfect) { post('table', 'Perfect chain! You counter.'); hurtFoe(roll(8) + 3); }
      else hurtMe(Math.round(f * foe.damageAvg * (live.clash.move === 'signature' ? 2 : 1.3)), 'The clash ends.');
    }, 100);
    return () => clearInterval(id);
  }, [live, now, foe.damageAvg, hurtMe, hurtFoe, post]);

  useEffect(() => {
    if (live?.kind !== 'pin') return;
    const id = setInterval(() => { if (now() > live.until) { setLive(null); hurtMe(Math.round(foe.damageAvg * 1.5), 'The pin held.'); } }, 200);
    return () => clearInterval(id);
  }, [live, now, foe.damageAvg, hurtMe]);

  const onClashTap = async (side: M.Side, tapAt: number) => {
    if (live?.kind !== 'clash') return null;
    const j = M.judgeClash(live.clash, live.hitAt, tapAt, side, live.results);
    if (!j) return null;
    const results = [...live.results]; results[j.index] = j.q;
    setLive({ ...live, results });
    return { ok: true, index: j.index, quality: j.q };
  };
  const onHeave = async (tapAt: number) => {
    if (live?.kind !== 'pin') return null;
    const r = M.heave(live.struggle, tapAt);
    if (!r) return null;
    if (r.free) { post('table', `You broke free in ${((tapAt - live.startedAt) / 1000).toFixed(1)}s.`); setTimeout(() => setLive(null), 900); }
    else setLive({ ...live, struggle: r.state });
    return { ok: true, free: r.free, struggle: r.state };
  };
  const startDuel = () => {
    const P = DU.deriveDuel({ level: finite(ctx.level, 5), dex: 14, ac: myAc, maxHp, npcAttack: foe.attackBonus, npcDamageAvg: foe.damageAvg, npcSpeed: foe.speed });
    post('table', `⚔ You call ${foe.name} out — Duel!`);
    setLive({ kind: 'duel', duel: DU.newDuel({ id: `d${Date.now()}`, npcId: 'arena', npcName: foe.name, startAt: now() + DU.DUEL_LEAD_MS, finish: 'knockout', weapon: null }, P, Math.random) });
  };
  const onDuelFinish = async (inputs: DU.DuelInput[]): Promise<DuelVerdict | null> => {
    if (live?.kind !== 'duel') return null;
    const run = DU.startRun(live.duel);
    for (const i of inputs) DU.inputRun(run, i);
    const out = DU.finishRun(run);
    const won = out.hits <= out.perfect;
    if (won) hurtFoe(foeHpRef.current); else hurtMe(Math.round(out.hits * foe.damageAvg * 0.6), 'You lose the duel.');
    return { ok: true, perfect: out.perfect, block: out.block, hits: out.hits, ripostes: out.ripostes, allPerfect: out.allPerfect, defeated: won, npcName: foe.name };
  };

  const restart = () => {
    myHpRef.current = maxHp; setMyHp(maxHp); foeHpRef.current = foe.maxHp; setFoeHp(foe.maxHp);
    setOver(false); setLive(null); post('table', 'New round. Fight!');
  };
  const sendDraft = () => { const t = draft.trim(); if (!t) return; onSend(t); setDraft(''); };
  const duelReady = !over && !live && foeHp / foe.maxHp <= 0.3;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Fight bar */}
      <div className="mx-3 mb-2 rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={onBack} aria-label="Back to opponents" style={{ touchAction: 'manipulation' }} className="flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground"><ArrowLeft className="h-5 w-5" /></button>
          <span className="font-cinzel text-sm font-bold uppercase tracking-wider text-foreground">{foe.name}</span>
          <button type="button" onClick={() => setAiOn((v) => !v)} aria-pressed={aiOn} style={{ touchAction: 'manipulation' }} className={cn('min-h-[48px] rounded-full border px-3 text-[10px] font-bold uppercase tracking-wider', aiOn ? 'border-primary text-primary' : 'border-border text-muted-foreground')}>{aiOn ? 'Live AI' : 'Offline'} · AC {foe.ac}</button>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-destructive transition-all" style={{ width: `${(foeHp / foe.maxHp) * 100}%` }} /></div>
        <div className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{ctx.name} · {myHp}/{maxHp}</div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(myHp / maxHp) * 100}%` }} /></div>
      </div>

      {/* Mock Live Table chat */}
      <div ref={feedRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3">
        {lines.map((l) => (
          <div key={l.id} className={cn('flex', l.who === 'you' ? 'justify-end' : 'justify-start')}>
            {l.who === 'table' ? (
              <div className="mx-auto max-w-[90%] text-center text-xs italic text-muted-foreground">{l.text}</div>
            ) : (
              <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm', l.who === 'you' ? 'bg-primary/15 text-foreground' : 'border border-border bg-card text-foreground')}>
                {l.card ? (
                  <div>
                    <div className="font-cinzel text-xs font-bold uppercase tracking-wider text-primary">{l.card.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number.isFinite(l.card.attackTotal) && <>To hit {l.card.attackTotal} (d20 {l.card.d20}) · </>}
                      {Number.isFinite(l.card.damageTotal) && <>{l.card.damageTotal} dmg {l.card.damageFormula ? `(${l.card.damageFormula})` : ''}</>}
                      {Number.isFinite(l.card.amount) && <>{l.card.amount} {l.card.kind === 'heal' ? 'healed' : ''}</>}
                      {l.card.outcome && <> · {l.card.outcome}</>}
                    </div>
                  </div>
                ) : l.text}
              </div>
            )}
          </div>
        ))}
      </div>

      {over && (
        <button type="button" onClick={restart} style={{ touchAction: 'manipulation' }} className="mx-3 mt-2 min-h-[52px] rounded-xl border border-primary font-cinzel font-bold uppercase tracking-wider text-primary">Go again</button>
      )}

      {/* Composer + action dock, same shape as the Live Table */}
      <div className="border-t border-border bg-background px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 500))} placeholder="Speak in character…" rows={1} className="min-h-[48px] flex-1 resize-none" />
          <button type="button" onClick={sendDraft} aria-label="Send" style={{ touchAction: 'manipulation' }} className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95"><Send className="h-5 w-5" /></button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setQaOpen(true)} disabled={over || !!live} style={{ touchAction: 'manipulation' }} className={cn('flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-sm font-semibold', (over || live) && 'opacity-40')}><Swords className="h-4 w-4" />Actions</button>
          <button type="button" onClick={startDuel} disabled={!duelReady} style={{ touchAction: 'manipulation' }} className={cn('flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-sm font-semibold', !duelReady && 'opacity-40')}><Zap className="h-4 w-4" />Duel</button>
          <button type="button" onClick={() => setSheetOpen(true)} style={{ touchAction: 'manipulation' }} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-sm font-semibold"><User className="h-4 w-4" />Sheet</button>
        </div>
      </div>

      <PartyDMQuickActions open={qaOpen} onOpenChange={setQaOpen} characterContext={ctx} characterName={ctx.name} onUsePrompt={onSend} onSendPrompt={onSend} />
      <SoloCharacterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} ctx={{ ...ctx, currentHP: myHp }} currentXP={finite(ctx.progression?.currentXP, 0)} gold={finite(ctx.gold, 0)} />
      <DiceRollOverlay />

      {live?.kind === 'clash' && <CounterClashRing skillName="Big move" npcName={foe.name} clash={live.clash} hitAt={live.hitAt} results={live.results} serverTime={now} frozenAt={null} onTap={onClashTap} />}
      {live?.kind === 'pin' && <TugAndSlip npcName={foe.name} pinnedUntil={live.until} struggle={live.struggle} serverTime={now} frozenAt={null} onHeave={onHeave} />}
      {live?.kind === 'duel' && <DuelWheel duel={live.duel} serverTime={now} onFinish={onDuelFinish} onClose={() => setLive(null)} />}
    </div>
  );
}
