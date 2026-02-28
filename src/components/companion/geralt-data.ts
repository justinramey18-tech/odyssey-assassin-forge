import { Smile, Frown, Meh, AlertTriangle } from 'lucide-react';
import type { DieType } from '@/lib/diceRoller';

// ── Types ──

export interface GeraltState {
  currentHP: number;
  maxHP: number;
  tempHP: number;
  level: number;
  xp: number;
  abilities: { str: number; dex: number; con: number; wis: number; int: number; cha: number };
  conditions: string[];
  mood: 'happy' | 'neutral' | 'agitated' | 'enraged';
  loyalty: number;
  notes: string;
}

export const DEFAULT_STATE: GeraltState = {
  currentHP: 59,
  maxHP: 59,
  tempHP: 0,
  level: 3,
  xp: 0,
  abilities: { str: 20, dex: 12, con: 17, wis: 12, int: 3, cha: 7 },
  conditions: [],
  mood: 'happy',
  loyalty: 80,
  notes: '',
};

export const CONDITIONS = ['Frightened', 'Prone', 'Charmed', 'Restrained', 'Poisoned', 'Stunned', 'Blinded'];
export const MOODS: GeraltState['mood'][] = ['happy', 'neutral', 'agitated', 'enraged'];

export const MOOD_CONFIG = {
  happy: { icon: Smile, label: 'Happy', color: 'text-emerald-400 border-emerald-500/40' },
  neutral: { icon: Meh, label: 'Neutral', color: 'text-amber-400 border-amber-500/40' },
  agitated: { icon: Frown, label: 'Agitated', color: 'text-orange-400 border-orange-500/40' },
  enraged: { icon: AlertTriangle, label: 'Enraged', color: 'text-rose-400 border-rose-500/40' },
};

export interface GeraltAttack {
  name: string;
  bonus: string;
  damage: string;
  desc: string;
  hitMod?: number;
  damageDie?: DieType;
  damageCount?: number;
  damageMod?: number;
}

export const ATTACKS: GeraltAttack[] = [
  { name: 'Beak', bonus: '+7', damage: '1d10 + 5 piercing', desc: 'Melee Weapon Attack', hitMod: 7, damageDie: 'd10', damageCount: 1, damageMod: 5 },
  { name: 'Claws', bonus: '+7', damage: '2d8 + 5 slashing', desc: 'Melee Weapon Attack', hitMod: 7, damageDie: 'd8', damageCount: 2, damageMod: 5 },
  { name: 'Bear Hug', bonus: '—', damage: 'Grapple (DC 15)', desc: 'On Claws hit, target is grappled' },
];

export interface AttackRollResult {
  attackName: string;
  type: 'hit' | 'damage';
  roll: { total: number; rolls: number[]; modifier: number };
  isNat20: boolean;
  isNat1: boolean;
}

// ── Storage helpers ──

function getStorageKey(characterId: string) {
  return `odyssey_${characterId}_geralt_companion`;
}

export function loadState(characterId: string): GeraltState {
  try {
    const raw = localStorage.getItem(getStorageKey(characterId));
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(characterId: string, state: GeraltState) {
  try {
    localStorage.setItem(getStorageKey(characterId), JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save Geralt state:', e);
  }
}

// ── Helpers ──

export function getModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function formatMod(score: number) {
  const mod = getModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
