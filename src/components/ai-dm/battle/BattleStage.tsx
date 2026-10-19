// Pokémon-style battle stage: the field, the fighters as sprites (their real portraits), the enemy
// HP boxes, my HP box and the party strip. Display only: it reads plain props and reports taps.
// Plan: claude/POKEMON_BATTLE_PLAN.md, sections 2 and 7.

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { hpBand } from '@/lib/battle-feed';
import './battle.css';

export interface StageLine { text: string; tone: 'warn' | 'muted' | 'info' | 'good'; blink?: boolean }

export interface StageFighter {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  /** up | down | stable | dead | ko | fled */
  status: string;
  portrait?: string | null;
  level?: number | null;
  /** Small tag on an enemy box: difficulty or speed. */
  tag?: string | null;
  /** One status line under the HP bar ("▼ HEAVY BLOW at XEYLE · 4s", "Acts in 12s"). */
  line?: StageLine | null;
  /** Effect badges (ward, buffs, temp HP). */
  chips?: string[];
  /** An NPC fighting on the party's side (D-24). */
  ally?: boolean;
  deathOk?: number;
  deathBad?: number;
  pinned?: boolean;
  /** 0–100 */
  resolve?: number;
  /** 0–100 */
  duel?: number;
  perks?: { label: string; used?: boolean }[];
}

export interface StageFlash { id: string; kind: 'hit' | 'heal'; amount: number; key: string }

interface Props {
  enemies: StageFighter[];
  /** Everyone else on the party's side (players and NPC allies), not me. */
  party: StageFighter[];
  me: StageFighter | null;
  targetId: string | null;
  onPickEnemy: (id: string) => void;
  onPickFriend?: (id: string) => void;
  /** Recent hits and heals (by fighter id), for the shake and the number pop-ups. */
  flashes: StageFlash[];
}

const BAR: Record<'green' | 'yellow' | 'red', string> = { green: '#45b649', yellow: '#f2c230', red: '#e0432f' };
const out = (s: string) => s === 'ko' || s === 'dead' || s === 'fled';

function initials(name: string): string {
  const parts = name.replace(/['"“”]/g, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function HpBar({ hp, max, small }: { hp: number; max: number; small?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  return (
    <div className={cn('flex items-center rounded-md overflow-hidden', small ? 'h-[10px]' : 'h-[13px]')} style={{ border: '2px solid var(--b-edge)', background: 'var(--b-edge)' }}>
      <span className={cn('px-1 font-bold leading-none', small ? 'text-[8px]' : 'text-[9px]')} style={{ color: 'var(--b-gold)' }}>HP</span>
      <div className={cn('flex-1 mr-[2px] rounded-sm overflow-hidden', small ? 'h-[6px]' : 'h-[7px]')} style={{ background: 'var(--b-cream-dim)' }}>
        <div className="battle-hp-fill" style={{ width: `${pct}%`, background: BAR[hpBand(hp, max)] }} />
      </div>
    </div>
  );
}

function Sprite({ f, size, front, back, flash }: { f: StageFighter; size: 'lg' | 'md' | 'sm'; front?: boolean; back?: boolean; flash?: StageFlash }) {
  const [broken, setBroken] = useState(false);
  const dims = size === 'lg' ? 'w-[108px] h-[132px]' : size === 'md' ? 'w-[84px] h-[108px]' : 'w-[58px] h-[78px]';
  const fallen = out(f.status) || f.status === 'down';
  return (
    <div className={cn('relative', dims)}>
      <div
        key={flash?.key ?? 'still'}
        className={cn(
          'w-full h-full overflow-hidden flex items-center justify-center',
          size === 'lg' ? 'rounded-[38px_38px_16px_16px]' : 'rounded-[26px_26px_12px_12px]',
          front && !fallen && 'battle-bob',
          flash?.kind === 'hit' && 'battle-hit',
          flash?.kind === 'heal' && 'battle-heal',
          out(f.status) && 'battle-faint',
          f.status === 'down' && 'opacity-50 grayscale',
          !front && !out(f.status) && 'opacity-90',
        )}
        style={{ background: f.ally ? '#2f5d47' : back ? '#3c3a5c' : '#6b4a3f', boxShadow: '0 6px 0 rgba(0,0,0,0.25)' }}
      >
        {f.portrait && !broken
          ? <img src={f.portrait} alt="" draggable={false} loading="lazy" onError={() => setBroken(true)} className="w-full h-full object-cover" />
          : <span className="text-[18px] font-bold" style={{ color: '#f4ecd8' }}>{initials(f.name)}</span>}
      </div>
      {flash && (
        <span key={`n${flash.key}`} className="battle-pop pointer-events-none absolute left-1/2 -top-2 text-[26px] font-bold" style={{ color: flash.kind === 'hit' ? '#ff4a2f' : '#4ae06a', textShadow: '2px 2px 0 #1c1810' }}>
          {flash.kind === 'hit' ? `-${flash.amount}` : `+${flash.amount}`}
        </span>
      )}
    </div>
  );
}

const lineColor: Record<StageLine['tone'], string> = { warn: '#a2321f', muted: '#5a4a2a', info: '#2b4a8a', good: '#2a7a44' };

function EnemyBox({ f, on, onPick }: { f: StageFighter; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      aria-label={`Target ${f.name}, ${f.hp} of ${f.maxHp} HP`}
      className={cn('battle-box shrink-0 w-full text-left px-2 pt-0.5 pb-1 flex flex-col gap-[2px] min-h-[44px]', out(f.status) && 'opacity-60')}
      style={{ borderRadius: '4px 14px 4px 4px', borderColor: on ? '#e8a400' : undefined, boxShadow: on ? '0 0 0 2px var(--b-gold), 3px 3px 0 #1c1810' : undefined }}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="text-[13px] font-bold truncate">{on ? '▶ ' : ''}{f.name.toUpperCase()}</span>
        <span className="text-[11px] font-semibold shrink-0 tabular-nums">{f.hp}/{f.maxHp}</span>
      </span>
      <HpBar hp={f.hp} max={f.maxHp} small />
      <span className="flex items-center justify-between gap-1 min-h-[12px]">
        {f.line
          ? <span className={cn('text-[10px] font-semibold truncate', f.line.blink && 'battle-blink')} style={{ color: lineColor[f.line.tone] }}>{f.line.text}</span>
          : <span />}
        {f.tag && <span className="text-[9px] font-bold shrink-0" style={{ color: 'var(--b-ink-soft)' }}>{f.tag}</span>}
      </span>
      {(f.chips?.length ?? 0) > 0 && (
        <span className="flex flex-wrap gap-1">
          {f.chips!.map(c => <span key={c} className="text-[9px] font-semibold px-1 rounded" style={{ background: '#dbe7f6', color: '#1b3266' }}>{c}</span>)}
        </span>
      )}
    </button>
  );
}

function MyBox({ f }: { f: StageFighter }) {
  const low = f.maxHp > 0 && f.hp / f.maxHp < 0.25 && f.status === 'up';
  return (
    <div className="battle-box px-2.5 pt-1.5 pb-2 flex flex-col gap-[3px]" style={{ borderRadius: '16px 4px 4px 4px' }}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[15px] font-bold truncate">{f.pinned ? '📌 ' : ''}{f.name.toUpperCase()}</span>
        {f.level ? <span className="text-[12px] font-semibold shrink-0">Lv{f.level}</span> : null}
      </div>
      <div className={cn(low && 'battle-low')}><HpBar hp={f.hp} max={f.maxHp} /></div>
      <div className="text-right text-[17px] font-bold tabular-nums leading-tight">
        {f.status === 'down' ? <span style={{ color: 'var(--b-red)' }}>DOWN</span> : `${f.hp}/ ${f.maxHp}`}
      </div>
      {typeof f.resolve === 'number' && (
        <div className="flex items-center gap-1.5">
          <span className="w-[34px] text-[9px] font-bold" style={{ color: '#6b5420' }}>RSLV</span>
          <div className="flex-1 h-[5px]" style={{ background: 'var(--b-cream-dim)' }}><div className={cn('battle-hp-fill', f.resolve >= 100 && 'battle-low')} style={{ width: `${Math.min(100, f.resolve)}%`, background: '#3a8fd8' }} /></div>
        </div>
      )}
      {typeof f.duel === 'number' && (
        <div className="flex items-center gap-1.5">
          <span className="w-[34px] text-[9px] font-bold" style={{ color: '#8a2a1c' }}>DUEL</span>
          <div className="flex-1 h-[5px]" style={{ background: 'var(--b-cream-dim)' }}><div className={cn('battle-hp-fill', f.duel >= 100 && 'battle-low')} style={{ width: `${Math.min(100, f.duel)}%`, background: '#d84a3a' }} /></div>
        </div>
      )}
      {((f.perks?.length ?? 0) > 0 || (f.chips?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {f.perks?.map(p => <span key={p.label} className={cn('text-[9px] font-semibold px-1 rounded', p.used && 'opacity-40')} style={{ background: '#f3e2b0' }}>{p.label}</span>)}
          {f.chips?.map(c => <span key={c} className="text-[9px] font-semibold px-1 rounded" style={{ background: '#dbe7f6', color: '#1b3266' }}>{c}</span>)}
        </div>
      )}
    </div>
  );
}

function MiniBox({ f, onPick }: { f: StageFighter; onPick?: () => void }) {
  const tag = f.status === 'down' ? `DOWN ${'●'.repeat(f.deathOk ?? 0)}${'○'.repeat(Math.max(0, 3 - (f.deathOk ?? 0)))}`
    : f.status === 'stable' ? 'STABLE' : f.status === 'dead' ? 'FALLEN' : f.status === 'ko' ? 'KO' : f.ally ? 'ALLY' : `${f.hp}/${f.maxHp}`;
  const danger = f.status === 'down' || f.status === 'dead' || f.status === 'ko';
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!onPick}
      aria-label={`${f.name}, ${tag}`}
      className="min-h-[34px] px-1.5 py-1 text-left flex flex-col gap-[2px] rounded"
      style={{ background: danger ? '#f3d9d2' : 'var(--b-cream)', border: `2px solid ${f.ally ? '#2a7a44' : 'var(--b-edge)'}` }}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-bold truncate">{f.pinned ? '📌' : ''}{f.name.toUpperCase()}</span>
        <span className="text-[9px] font-bold shrink-0" style={{ color: danger ? '#c0301e' : f.ally ? '#2a7a44' : 'var(--b-edge)' }}>{tag}</span>
      </span>
      <span className="block h-[5px]" style={{ background: 'var(--b-cream-dim)', border: '1px solid var(--b-edge)' }}>
        <span className="block battle-hp-fill" style={{ width: `${f.maxHp > 0 ? Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100)) : 0}%`, background: f.ally ? '#2f9a55' : BAR[hpBand(f.hp, f.maxHp)] }} />
      </span>
    </button>
  );
}

export function BattleStage({ enemies, party, me, targetId, onPickEnemy, onPickFriend, flashes }: Props) {
  const flashOf = (id: string) => [...flashes].reverse().find(x => x.id === id);
  // Sprites: the target stands in front, up to two more behind; 4+ enemies get a "+N" chip.
  const standing = enemies.filter(f => !out(f.status));
  const front = standing.find(f => f.id === targetId) ?? standing[0] ?? enemies[0];
  const behind = enemies.filter(f => f.id !== front?.id).slice(0, 2);
  const more = Math.max(0, enemies.length - 3);
  const mates = party.slice(0, 3);
  // The enemy column scrolls when it is taller than the stage allows.
  const colRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = colRef.current?.querySelector('[aria-pressed="true"]') as HTMLElement | null;
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [targetId]);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--b-sky)' }}>
      {/* Field: sky, horizon, hills and grass in flat bands. */}
      <div aria-hidden className="absolute inset-x-0 top-[22%] h-[8%]" style={{ background: 'var(--b-sky-2)' }} />
      <div aria-hidden className="absolute left-[38%] top-[24%] w-[80%] h-[18%] rounded-[50%]" style={{ background: 'var(--b-hill)' }} />
      <div aria-hidden className="absolute inset-x-0 top-[32%] bottom-0" style={{ background: 'var(--b-grass)' }} />
      <div aria-hidden className="absolute inset-x-0 top-[66%] bottom-0" style={{ background: 'var(--b-grass-2)' }} />

      {/* Enemy platform and sprites (top right). */}
      <div aria-hidden className="absolute right-[-4%] top-[40%] w-[62%] h-[10%] rounded-[50%]" style={{ background: 'var(--b-pad)', border: '3px solid var(--b-pad-edge)' }} />
      {behind[0] && <div className="absolute right-[31%] top-[21%]"><Sprite f={behind[0]} size="sm" flash={flashOf(behind[0].id)} /></div>}
      {behind[1] && <div className="absolute right-[2%] top-[20%]"><Sprite f={behind[1]} size="sm" flash={flashOf(behind[1].id)} /></div>}
      {front && <div className="absolute right-[12%] top-[13%]"><Sprite f={front} size="md" front flash={flashOf(front.id)} /></div>}
      {more > 0 && <span className="absolute right-[4%] top-[4%] text-[11px] font-bold px-1.5 rounded battle-box">+{more}</span>}

      {/* Enemy HP boxes (top left), tap to target. */}
      <div ref={colRef} className="absolute left-[3%] top-[3%] w-[48%] max-h-[42%] overflow-y-auto overscroll-contain flex flex-col gap-1.5 pr-1 [scrollbar-width:none]">
        {enemies.map(f => <EnemyBox key={f.id} f={f} on={f.id === targetId} onPick={() => onPickEnemy(f.id)} />)}
        {enemies.length === 0 && <span className="battle-box px-2 py-1 text-[12px]">No enemies standing.</span>}
      </div>

      {/* Party platform and sprites (bottom left), seen from behind. */}
      <div aria-hidden className="absolute left-[-6%] bottom-[-3%] w-[64%] h-[12%] rounded-[50%]" style={{ background: 'var(--b-pad)', border: '3px solid var(--b-pad-edge)' }} />
      {mates[0] && <div className="absolute left-[1%] bottom-[22%]"><Sprite f={mates[0]} size="sm" back flash={flashOf(mates[0].id)} /></div>}
      {mates[1] && <div className="absolute left-[36%] bottom-[18%]"><Sprite f={mates[1]} size="sm" back flash={flashOf(mates[1].id)} /></div>}
      {mates[2] && <div className="absolute left-[25%] bottom-[30%]"><Sprite f={mates[2]} size="sm" back flash={flashOf(mates[2].id)} /></div>}
      {me && <div className="absolute left-[8%] bottom-[3%]"><Sprite f={me} size="lg" back flash={flashOf(me.id)} /></div>}

      {/* My box and the party strip (bottom right). */}
      <div className="absolute right-[3%] bottom-[3%] w-[47%] flex flex-col gap-1.5">
        {me && <MyBox f={me} />}
        {party.length > 0 && (
          <div className="grid grid-cols-2 gap-1 max-h-[80px] overflow-y-auto overscroll-contain [scrollbar-width:none]">
            {party.map(f => <MiniBox key={f.id} f={f} onPick={onPickFriend ? () => onPickFriend(f.id) : undefined} />)}
          </div>
        )}
      </div>
    </div>
  );
}
