// Pokémon-style battle intro ("ONE-EYE KLEG wants to fight!") and the Victory / Defeat card.
// Display and taps only. Plan: claude/POKEMON_BATTLE_PLAN.md, section 3.

import { useEffect } from 'react';
import './battle.css';

const INTRO_MS = 1500;

/** A black curtain that wipes away over the battle, with the opening line. Tap to skip. */
export function BattleIntro({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, INTRO_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <button type="button" onClick={onDone} aria-label="Skip the battle intro"
      className="battle-root battle-wipe absolute inset-0 z-[5] flex items-center justify-center px-6"
      style={{ background: '#05060b' }}>
      <span className="battle-text px-4 py-3 text-[20px] font-bold text-center">{text}</span>
    </button>
  );
}

export interface EndCardFallen { userId: string; name: string }

interface EndProps {
  outcome: 'victory' | 'defeat' | 'ended';
  /** The referee's closing line ("Combat over: the party wins."). */
  summary?: string | null;
  fallen: EndCardFallen[];
  canRevive: boolean;
  busy: boolean;
  onRevive: (userId: string) => void;
  onClose: () => void;
}

/** The end of a fight: a big VICTORY! or DEFEAT… box, the summary and the host's Revive buttons. */
export function BattleEndCard({ outcome, summary, fallen, canRevive, busy, onRevive, onClose }: EndProps) {
  const title = outcome === 'victory' ? 'VICTORY!' : outcome === 'defeat' ? 'DEFEAT…' : 'THE BATTLE IS OVER';
  const color = outcome === 'victory' ? '#1e6a34' : outcome === 'defeat' ? '#7a1e14' : 'var(--b-ink)';
  return (
    <div className="battle-root fixed inset-x-3 top-1/2 -translate-y-1/2 z-[56] battle-text p-4 flex flex-col gap-3" role="dialog" aria-label={title}>
      <p className="text-[28px] font-bold text-center" style={{ color }}>{title}</p>
      {summary && <p className="text-[15px] text-center" style={{ color: 'var(--b-ink-soft)' }}>{summary}</p>}
      {canRevive && fallen.map(f => (
        <div key={f.userId} className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold truncate">💀 {f.name.toUpperCase()}</span>
          <button type="button" disabled={busy} onClick={() => onRevive(f.userId)}
            className="min-h-[44px] px-4 rounded-lg text-[14px] font-bold text-white disabled:opacity-40"
            style={{ background: '#2a7a44', border: '3px solid var(--b-edge)' }}>REVIVE</button>
        </div>
      ))}
      <button type="button" onClick={onClose}
        className="min-h-[48px] rounded-lg text-[16px] font-bold text-white"
        style={{ background: '#3a6ea8', border: '3px solid var(--b-edge)' }}>BACK TO THE TABLE</button>
    </div>
  );
}
