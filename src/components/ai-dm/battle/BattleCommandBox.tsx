// Pokémon-style command box: the battle text box and the ATTACK · CAST · AID · BAG menu, with move
// cards, "on who?" picks, area picks and the knock-out-or-finish choice. Display and taps only:
// the battle screen decides what each move does (onUse / aidFor).
// Plan: claude/POKEMON_BATTLE_PLAN.md, sections 4–6.

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { FeedTone } from '@/lib/battle-feed';
import './battle.css';

export type MoveRow = 'attack' | 'spell' | 'item';
export interface BattleMove {
  id: string;
  name: string;
  row: MoveRow;
  /** Who it can land on. */
  side: 'enemy' | 'ally';
  /** Damage dice, healing dice, "Buff"… */
  sub?: string;
  /** 0 = cantrip. */
  level?: number | null;
  school?: string | null;
  area?: boolean;
  /** Set when the move can't be used right now (shown instead of using it). */
  disabledReason?: string | null;
}
export interface BattleTarget {
  id: string;
  name: string;
  /** HP text or status ("12/30", "DOWN"). */
  sub: string;
  /** At or under 25% HP: offer Knock out / Finish. */
  low?: boolean;
  me?: boolean;
}
export interface AidOption { key: string; label: string; sub?: string; run: () => void }
export interface SpecialButton { label: string; sub?: string; tone: 'duel' | 'wind'; disabled?: boolean; reason?: string; onPress: () => void }
export type Finish = 'knockout' | 'kill';

interface Props {
  /** The battle feed line on screen now, or null when the feed is empty. */
  feed: { text: string; tone: FeedTone } | null;
  onSkipFeed: () => void;
  idleText: string;
  rolling: boolean;
  /** When set, the menu is locked and this says why (paused, huddle, fallen, pinned). */
  locked: string | null;
  /** Extra controls shown in place of the menu while locked (host's huddle / pause buttons). */
  lockedControls?: React.ReactNode;
  cooldownLeft: number;
  cooldownMax: number;
  moves: BattleMove[];
  /** The enemy a single-target attack lands on (the gold-outlined one). */
  enemyTarget: BattleTarget | null;
  enemies: BattleTarget[];
  /** Everyone on the party's side who can be healed or aided, me first. */
  friends: BattleTarget[];
  onUse: (move: BattleMove, targetIds: string[], finish?: Finish) => void;
  aidFor: (friendId: string) => AidOption[];
  special: SpecialButton | null;
  onChat: () => void;
  unread: number;
}

type Screen =
  | { kind: 'menu' }
  | { kind: 'list'; row: MoveRow }
  | { kind: 'pick'; move: BattleMove; side: 'enemy' | 'ally'; multi: boolean; picked: string[] }
  | { kind: 'finish'; move: BattleMove; targetId: string; targetName: string }
  | { kind: 'aid' }
  | { kind: 'aid-options'; friendId: string; friendName: string };

const AREA_MAX = 3;
const SCHOOL_COLOR: Record<string, string> = {
  abjuration: '#3a6ea8', conjuration: '#2a8a8a', divination: '#8a7a2a', enchantment: '#c24d8a',
  evocation: '#d8622a', illusion: '#6a5ad8', necromancy: '#6a4a8a', transmutation: '#7a8a2a',
};
const toneColor: Record<FeedTone, string> = { neutral: 'var(--b-ink)', hit: '#a2321f', heal: '#1e6a34', warn: '#a2321f', good: '#1e6a34', bad: '#7a1e14' };
const menuBtn = 'min-h-[56px] rounded-md text-[19px] font-bold active:scale-[0.97] transition-transform disabled:opacity-40';
const plainBtn = 'min-h-[44px] rounded-lg text-[14px] font-bold active:scale-[0.97] transition-transform disabled:opacity-40';

function typeTag(m: BattleMove): { label: string; color: string } {
  if (m.row === 'attack') return { label: 'PHYSICAL', color: '#7a6a5a' };
  if (m.row === 'item') return { label: 'ITEM', color: '#8a6a2a' };
  const s = (m.school ?? '').toLowerCase();
  return { label: s ? s.toUpperCase() : (m.side === 'ally' ? 'SUPPORT' : 'SPELL'), color: SCHOOL_COLOR[s] ?? (m.side === 'ally' ? '#2a7a44' : '#6a4a8a') };
}
function levelLabel(level: number | null | undefined): string {
  return level == null ? 'SPELLS' : level === 0 ? 'CANTRIP' : `LV${level}`;
}

export function BattleCommandBox(p: Props) {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [tab, setTab] = useState<number | null>(null);
  const busy = p.rolling || p.cooldownLeft > 0;
  // A lock (pause, pin, fall) always returns to the menu.
  useEffect(() => { if (p.locked) setScreen({ kind: 'menu' }); }, [p.locked]);

  const byRow = (row: MoveRow) => p.moves.filter(m => m.row === row);
  const spellLevels = useMemo(() => {
    const set = new Set<number>();
    for (const m of p.moves) if (m.row === 'spell') set.add(m.level ?? -1);
    return [...set].sort((a, b) => a - b);
  }, [p.moves]);
  const activeTab = tab != null && spellLevels.includes(tab) ? tab : spellLevels[0] ?? null;

  const back = () => setScreen({ kind: 'menu' });
  const applyMove = (move: BattleMove, ids: string[], finish?: Finish) => { p.onUse(move, ids, finish); back(); };

  const choose = (move: BattleMove) => {
    if (move.disabledReason || busy) return;
    if (move.side === 'enemy') {
      if (move.area) {
        setScreen({ kind: 'pick', move, side: 'enemy', multi: true, picked: p.enemyTarget ? [p.enemyTarget.id] : [] });
        return;
      }
      const t = p.enemyTarget;
      if (!t) return;
      // Knock out or finish: weapon attacks only (the referee takes the choice on attacks).
      if (t.low && move.row === 'attack') setScreen({ kind: 'finish', move, targetId: t.id, targetName: t.name });
      else applyMove(move, [t.id]);
      return;
    }
    setScreen({ kind: 'pick', move, side: 'ally', multi: !!move.area, picked: [] });
  };

  // ---------- the text box ----------
  let prompt: string | null = null;
  if (screen.kind === 'list') prompt = screen.row === 'attack' ? 'Pick a weapon.' : screen.row === 'spell' ? 'Pick a spell.' : 'Pick an item.';
  else if (screen.kind === 'pick') prompt = screen.multi ? `${screen.move.name.toUpperCase()}: pick up to ${AREA_MAX}.` : `${screen.move.name.toUpperCase()} on who?`;
  else if (screen.kind === 'finish') prompt = `Knock out or finish ${screen.targetName.toUpperCase()}?`;
  else if (screen.kind === 'aid') prompt = 'Aid who?';
  else if (screen.kind === 'aid-options') prompt = `Help ${screen.friendName.toUpperCase()} how?`;
  const showFeed = screen.kind === 'menu' && !!p.feed;
  const text = showFeed && p.feed ? p.feed.text : prompt ?? (p.rolling ? 'Rolling…' : p.locked ?? p.idleText);
  const textTone: FeedTone = showFeed && p.feed ? p.feed.tone : 'neutral';

  const card = (m: BattleMove, onPick: () => void) => {
    const t = typeTag(m);
    const off = !!m.disabledReason || busy;
    return (
      <button
        key={m.id}
        type="button"
        onClick={onPick}
        aria-disabled={off}
        className={cn('min-h-[64px] px-2 py-1.5 rounded-md text-left flex flex-col justify-between gap-1 active:scale-[0.98] transition-transform', off && 'opacity-45')}
        style={{ background: '#fffaf0', border: '2px solid var(--b-edge)' }}
      >
        <span className="text-[13px] font-bold leading-tight line-clamp-2">{m.name.toUpperCase()}</span>
        <span className="flex items-center justify-between gap-1">
          <span className="text-[9px] font-bold px-1 rounded-sm text-white truncate" style={{ background: t.color }}>{t.label}</span>
          <span className="text-[10px] font-bold shrink-0">{m.row === 'spell' ? (m.level ? `LV${m.level}` : '∞') : m.row === 'attack' ? '∞' : ''}</span>
        </span>
        <span className="text-[10px] truncate" style={{ color: 'var(--b-ink-soft)' }}>{m.disabledReason ?? m.sub ?? (m.area ? 'Up to 3 targets' : '')}</span>
      </button>
    );
  };

  const targetRow = (t: BattleTarget, on: boolean, onPick: () => void) => (
    <button key={t.id} type="button" onClick={onPick} aria-pressed={on}
      className="min-h-[48px] px-3 rounded-lg flex items-center justify-between gap-2 text-left active:scale-[0.98] transition-transform"
      style={{ background: on ? '#fff1c2' : 'var(--b-cream)', border: `3px solid ${on ? '#e8a400' : 'var(--b-edge)'}` }}>
      <span className="text-[15px] font-bold truncate">{on ? '▶ ' : ''}{t.me ? `${t.name.toUpperCase()} (YOU)` : t.name.toUpperCase()}</span>
      <span className="text-[12px] shrink-0" style={{ color: 'var(--b-ink-soft)' }}>{t.sub}</span>
    </button>
  );

  const backBtn = (label = '◀ BACK', onPress = back) => (
    <button type="button" onClick={onPress} className={cn(plainBtn, 'w-full text-white')} style={{ background: '#4a4160', border: '3px solid var(--b-edge)' }}>{label}</button>
  );

  // ---------- the lower panel ----------
  let panel: React.ReactNode = null;
  if (p.locked && screen.kind === 'menu') {
    panel = p.lockedControls ?? null;
  } else if (screen.kind === 'menu') {
    const cdPct = p.cooldownMax > 0 ? Math.min(100, (p.cooldownLeft / p.cooldownMax) * 100) : 0;
    panel = (
      <div className="flex flex-col gap-1.5">
        {p.cooldownLeft > 0 && (
          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#f4ecd8' }}>
            <span className="shrink-0">NEXT MOVE IN {p.cooldownLeft}s</span>
            <div className="flex-1 h-[6px]" style={{ background: '#4a4160', border: '1px solid #1c1810' }}>
              <div className="h-full transition-[width] duration-1000 ease-linear" style={{ width: `${cdPct}%`, background: 'var(--b-gold)' }} />
            </div>
          </div>
        )}
        <div className="battle-text p-1.5 grid grid-cols-2 gap-1.5">
          <button type="button" disabled={busy} onClick={() => setScreen({ kind: 'list', row: 'attack' })} className={menuBtn} style={{ background: '#f6d6cc', border: '2px solid var(--b-edge)' }}>ATTACK</button>
          <button type="button" disabled={busy} onClick={() => setScreen({ kind: 'list', row: 'spell' })} className={menuBtn} style={{ background: '#e2dcf6', border: '2px solid var(--b-edge)' }}>CAST</button>
          <button type="button" disabled={busy} onClick={() => setScreen({ kind: 'aid' })} className={menuBtn} style={{ background: '#d6efd8', border: '2px solid var(--b-edge)' }}>AID</button>
          <button type="button" disabled={busy} onClick={() => setScreen({ kind: 'list', row: 'item' })} className={menuBtn} style={{ background: '#efe3c4', border: '2px solid var(--b-edge)' }}>BAG</button>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={p.onChat} className={cn(plainBtn, 'flex-1 text-white flex items-center justify-center gap-2')} style={{ background: '#3a6ea8', border: '3px solid var(--b-edge)' }}>
            TABLE CHAT
            {p.unread > 0 && <span className="px-1.5 rounded text-[12px]" style={{ background: 'var(--b-gold)', color: 'var(--b-ink)' }}>{p.unread > 99 ? '99+' : p.unread}</span>}
          </button>
          {p.special && (
            <button type="button" onClick={p.special.onPress} disabled={p.special.disabled || busy} aria-label={p.special.reason ? `${p.special.label}: ${p.special.reason}` : p.special.label}
              className={cn(plainBtn, 'flex-1 flex flex-col items-center justify-center leading-tight text-white', p.special.tone === 'duel' && !p.special.disabled && 'battle-low')}
              style={{ background: p.special.tone === 'duel' ? '#a2321f' : '#4a4160', border: '3px solid var(--b-edge)' }}>
              <span>{p.special.label}</span>
              {p.special.sub && <span className="text-[10px] font-semibold opacity-80">{p.special.sub}</span>}
            </button>
          )}
        </div>
      </div>
    );
  } else if (screen.kind === 'list') {
    const all = byRow(screen.row);
    const shown = screen.row === 'spell' && activeTab != null ? all.filter(m => (m.level ?? -1) === activeTab) : all;
    panel = (
      <div className="flex flex-col gap-1.5 min-h-0">
        {screen.row === 'spell' && spellLevels.length > 1 && (
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {spellLevels.map(l => (
              <button key={l} type="button" onClick={() => setTab(l)} aria-pressed={l === activeTab}
                className="min-h-[40px] px-3 shrink-0 rounded-md text-[12px] font-bold"
                style={{ background: l === activeTab ? 'var(--b-gold)' : 'var(--b-cream)', border: '2px solid var(--b-edge)' }}>{levelLabel(l)}</button>
            ))}
          </div>
        )}
        <div className="battle-text p-1.5 grid grid-cols-2 gap-1.5 max-h-[180px] overflow-y-auto overscroll-contain">
          {shown.length === 0 && (
            <p className="col-span-2 text-[14px] p-2">{screen.row === 'attack' ? 'No weapon equipped.' : screen.row === 'spell' ? 'No spells you can cast here.' : 'No healing items in your bag.'}</p>
          )}
          {shown.map(m => card(m, () => choose(m)))}
        </div>
        {backBtn()}
      </div>
    );
  } else if (screen.kind === 'pick') {
    const s = screen;
    const list = s.side === 'enemy' ? p.enemies : p.friends;
    const toggle = (id: string) => setScreen({ ...s, picked: s.picked.includes(id) ? s.picked.filter(x => x !== id) : s.picked.length >= AREA_MAX ? s.picked : [...s.picked, id] });
    panel = (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-1.5 max-h-[168px] overflow-y-auto overscroll-contain">
          {list.length === 0 && <p className="battle-text text-[14px] p-2">No one to target.</p>}
          {list.map(t => targetRow(t, s.picked.includes(t.id), () => {
            if (s.multi) { toggle(t.id); return; }
            if (s.side === 'enemy' && t.low && s.move.row === 'attack') { setScreen({ kind: 'finish', move: s.move, targetId: t.id, targetName: t.name }); return; }
            applyMove(s.move, [t.id]);
          }))}
        </div>
        {s.multi && (
          <button type="button" disabled={s.picked.length === 0 || busy} onClick={() => applyMove(s.move, s.picked, s.side === 'enemy' ? 'knockout' : undefined)}
            className={cn(plainBtn, 'w-full text-white')} style={{ background: s.side === 'enemy' ? '#a2321f' : '#2a7a44', border: '3px solid var(--b-edge)' }}>
            {s.side === 'enemy' ? 'CAST' : 'USE'}{s.picked.length > 1 ? ` AT ${s.picked.length}` : ''}
          </button>
        )}
        {backBtn('CANCEL')}
      </div>
    );
  } else if (screen.kind === 'finish') {
    const s = screen;
    panel = (
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={busy} onClick={() => applyMove(s.move, [s.targetId], 'knockout')} className={menuBtn} style={{ background: 'var(--b-cream)', border: '3px solid var(--b-edge)' }}>KNOCK OUT</button>
          <button type="button" disabled={busy} onClick={() => applyMove(s.move, [s.targetId], 'kill')} className={menuBtn} style={{ background: '#f6d6cc', border: '3px solid var(--b-edge)' }}>FINISH</button>
        </div>
        {backBtn('CANCEL')}
      </div>
    );
  } else if (screen.kind === 'aid') {
    panel = (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-1.5 max-h-[168px] overflow-y-auto overscroll-contain">
          {p.friends.filter(f => !f.me).length === 0 && <p className="battle-text text-[14px] p-2">No allies to aid.</p>}
          {p.friends.filter(f => !f.me).map(t => targetRow(t, false, () => setScreen({ kind: 'aid-options', friendId: t.id, friendName: t.name })))}
        </div>
        {backBtn()}
      </div>
    );
  } else if (screen.kind === 'aid-options') {
    const opts = p.aidFor(screen.friendId);
    panel = (
      <div className="flex flex-col gap-1.5">
        {opts.length === 0 && <p className="battle-text text-[14px] p-2">Nothing you can do for them right now.</p>}
        {opts.map(o => (
          <button key={o.key} type="button" disabled={busy} onClick={() => { o.run(); back(); }}
            className="min-h-[48px] px-3 rounded-lg flex items-center justify-between gap-2 text-left disabled:opacity-40"
            style={{ background: 'var(--b-cream)', border: '3px solid var(--b-edge)' }}>
            <span className="text-[15px] font-bold">{o.label}</span>
            {o.sub && <span className="text-[12px]" style={{ color: 'var(--b-ink-soft)' }}>{o.sub}</span>}
          </button>
        ))}
        {backBtn('◀ BACK', () => setScreen({ kind: 'aid' }))}
      </div>
    );
  }

  return (
    <div className="battle-root flex flex-col gap-1.5">
      <button
        type="button"
        onClick={p.onSkipFeed}
        aria-live="polite"
        className="battle-text min-h-[64px] px-3 py-2 text-left flex items-end justify-between gap-2"
      >
        <span className="text-[16px] leading-snug whitespace-pre-line" style={{ color: toneColor[textTone] }}>{text}</span>
        {showFeed && <span aria-hidden className="battle-blink shrink-0" style={{ color: 'var(--b-red)' }}>▼</span>}
      </button>
      {panel}
    </div>
  );
}
