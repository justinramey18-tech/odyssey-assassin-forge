// Solo Empyrean Live NPCs (D-38): the shape of a built-in canon character.
// Everything is paraphrased from the lore Bible's Canon Cast guide (castCanon.ts). No book text.
import type { FightChallenge, FoeKind } from '@/lib/empyrean-rules-client';

/** The three years of Violet's time at Basgiath: Fourth Wing, Iron Flame, Onyx Storm. */
export type CanonEra = 'fw' | 'if' | 'os';
export const CANON_ERAS: CanonEra[] = ['fw', 'if', 'os'];
export const CANON_ERA_LABELS: Record<CanonEra, string> = {
  fw: "Violet's first year (Fourth Wing)",
  if: "Violet's second year (Iron Flame)",
  os: "Violet's third year (Onyx Storm)",
};

export type CastGroup = 'squad' | 'core' | 'cadets' | 'command' | 'riders' | 'royals' | 'poromiel' | 'assembly' | 'civilians' | 'venin';
export const CAST_GROUP_LABELS: Record<CastGroup, string> = {
  squad: "Violet's squad",
  core: 'Core cast',
  cadets: 'Other cadets',
  command: 'Command and staff',
  riders: 'Officers and riders',
  royals: 'Royals and nobles',
  poromiel: 'Poromiel and the fliers',
  assembly: 'The Aretian Assembly',
  civilians: 'Families and civilians',
  venin: 'Venin',
};

/** A fact or secret, with the era in which it is first true or first revealed. */
export interface CanonFact { era: CanonEra; text: string }

export interface CanonNpc {
  key: string;
  name: string;
  /** Other names the story may use (first name, surname, title). Matched whole-word. */
  aliases: string[];
  group: CastGroup;
  /** Who they are in each era they can be met. A missing era means dead, gone or not there yet. */
  roles: Partial<Record<CanonEra, string>>;
  /** Eras in which they are present only in secret: not listed until the story names them. */
  hiddenIn?: CanonEra[];
  look: string;
  personality: string;
  voice: string;
  wants: string;
  /** What they openly are and have: dragon, signet, background. */
  facts: CanonFact[];
  /** What they hide. Never said outright; it shapes how they talk. */
  secrets: CanonFact[];
  /** Starting attitude toward a cadet they don't know, -3 (hostile) to +3 (warm). */
  attitude: number;
  /** How they fight on the solo battle screen; null for someone who won't fight. */
  fight: { kind: FoeKind; challenge: FightChallenge } | null;
}

const ORDER: Record<CanonEra, number> = { fw: 0, if: 1, os: 2 };

/** True when something first true in `factEra` is known by `era`. */
export function eraReached(factEra: CanonEra, era: CanonEra): boolean {
  return ORDER[factEra] <= ORDER[era];
}

/** Shorthand used by the data files. */
export const f = (era: CanonEra, text: string): CanonFact => ({ era, text });
