export interface ArenaBests {
  bestChain: number;
  bestEscapeMs: number | null;
  mostDamage: number;
  bestWave: number;
}

interface SessionLike {
  bestChain: number;
  bestEscapeMs: number | null;
  damage: number;
  bestWave?: number;
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);

/** Keep the better of the saved bests and this session. Bad saved numbers are ignored. */
export function mergeBests(prev: Partial<ArenaBests> | null, s: SessionLike): ArenaBests {
  const pEsc = prev && typeof prev.bestEscapeMs === 'number' && Number.isFinite(prev.bestEscapeMs) && prev.bestEscapeMs > 0 ? prev.bestEscapeMs : null;
  const sEsc = typeof s.bestEscapeMs === 'number' && Number.isFinite(s.bestEscapeMs) && s.bestEscapeMs > 0 ? s.bestEscapeMs : null;
  return {
    bestChain: Math.max(num(prev?.bestChain, 0), num(s.bestChain, 0)),
    bestEscapeMs: pEsc === null ? sEsc : sEsc === null ? pEsc : Math.min(pEsc, sEsc),
    mostDamage: Math.max(num(prev?.mostDamage, 0), num(s.damage, 0)),
    bestWave: Math.max(num(prev?.bestWave, 0), num(s.bestWave, 0)),
  };
}
