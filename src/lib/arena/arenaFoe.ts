import type { Foe } from '@/components/arena/ArenaPractice';

const SPEEDS = ['trivial', 'easy', 'medium', 'hard', 'deadly'] as const;

/** Average of a dice string like "2d6+3". Returns null when it isn't dice. */
export function diceAverage(expr: string): number | null {
  const m = /^\s*(\d{1,2})d(\d{1,3})\s*([+-]\s*\d{1,3})?\s*$/i.exec(expr ?? '');
  if (!m) return null;
  const n = Number(m[1]), d = Number(m[2]), b = m[3] ? Number(m[3].replace(/\s/g, '')) : 0;
  if (!Number.isFinite(n) || !Number.isFinite(d) || n < 1 || d < 2) return null;
  return n * (d + 1) / 2 + b;
}

/** A practice copy of a saved NPC's fight stats, or null if it has none usable. */
export function foeFromNpc(name: string, raw: unknown): Foe | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const maxHp = Number(s.maxHp), ac = Number(s.ac), atk = Number(s.attackBonus);
  if (!Number.isFinite(maxHp) || maxHp <= 0 || !Number.isFinite(ac) || !Number.isFinite(atk)) return null;
  const avg = diceAverage(String(s.damage ?? ''));
  const speed = (SPEEDS as readonly string[]).includes(String(s.speed)) ? (s.speed as Foe['speed']) : 'medium';
  return { name: name.slice(0, 60), maxHp: Math.min(2000, maxHp), ac: Math.min(30, Math.max(5, ac)), attackBonus: Math.min(15, Math.max(-5, atk)), damageAvg: Math.max(1, avg ?? 6), speed };
}
