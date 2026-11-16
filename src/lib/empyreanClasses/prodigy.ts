// The Prodigy: solo Empyrean's own class (D-37). A Channeler, a Bondkeeper and a Wingleader in
// one rider, strong on purpose. Its progression is the Ascension: five tiers reached by level,
// each raising all three pillars at once (Channel: the signet; Bond: the dragon; Command: the
// fight and the wing).
// Pure rules, no Deno, no network. This file exists twice, byte for byte:
//   supabase/functions/empyrean-rules/prodigy.ts (the server applies it)
//   src/lib/empyreanClasses/prodigy.ts (the phone shows it and sizes the strain bar)
// A test fails if the two copies differ.

export const PRODIGY_CLASS_ID = 'prodigy';
export const PRODIGY_NAME = 'The Prodigy';

export type ProdigyTier = 0 | 1 | 2 | 3 | 4 | 5;
export interface AscensionTier { tier: Exclude<ProdigyTier, 0>; name: string; fromLevel: number; motto: string }
export const ASCENSION_TIERS: AscensionTier[] = [
  { tier: 1, name: 'Kindled', fromLevel: 1, motto: 'The signet, the dragon and the wing all answer you.' },
  { tier: 2, name: 'Awakened', fromLevel: 5, motto: 'Power that should take years comes in months.' },
  { tier: 3, name: 'Ascendant', fromLevel: 10, motto: 'Your dragon fights like two, and the wing follows your read.' },
  { tier: 4, name: 'Paragon', fromLevel: 15, motto: 'Channels that would burn out others barely cost you.' },
  { tier: 5, name: 'Empyreal', fromLevel: 20, motto: 'Rider, dragon and command move as one will.' },
];

const lvl = (level: unknown) => Math.min(20, Math.max(1, Math.trunc(Number(level)) || 1));
export const isProdigy = (riderClass: unknown): boolean => riderClass === PRODIGY_CLASS_ID;

/** The Ascension tier for a level (1 to 5). */
export function ascensionTier(level: unknown): Exclude<ProdigyTier, 0> {
  const l = lvl(level);
  let t: Exclude<ProdigyTier, 0> = 1;
  for (const a of ASCENSION_TIERS) if (l >= a.fromLevel) t = a.tier;
  return t;
}
/** 0 for every rider who is not a Prodigy; otherwise the Ascension tier. */
export function prodigyTier(riderClass: unknown, level: unknown): ProdigyTier {
  return isProdigy(riderClass) ? ascensionTier(level) : 0;
}
export function nextAscension(level: unknown): AscensionTier | null {
  const l = lvl(level);
  return ASCENSION_TIERS.find(a => a.fromLevel > l) ?? null;
}

// ── Channel (the signet) ──
/** Signet Strain limit: +1 per tier. */
export const prodigyStrainBonus = (t: ProdigyTier): number => t;
/** A Prodigy's strain limit may go past the usual cap of 12. */
export const PRODIGY_STRAIN_CAP = 16;
/** Strain a channel costs less: intensity 3+ from Awakened, intensity 5+ one more from Paragon. */
export function prodigyStrainDiscount(t: ProdigyTier, intensity: number): number {
  return (t >= 2 && intensity >= 3 ? 1 : 0) + (t >= 4 && intensity >= 5 ? 1 : 0);
}
/** Signet Mastery grows twice as fast (and the daily limit doubles). */
export const prodigyMasteryMultiplier = (t: ProdigyTier): number => (t > 0 ? 2 : 1);
/** Extra d6 on every signet strike in a fight. */
export const prodigySignetDice = (t: ProdigyTier): number => t;
/** Bonus on signet checks: +1 (Kindled, Awakened), +2 (Ascendant, Paragon), +3 (Empyreal). */
export const prodigyCheckBonus = (t: ProdigyTier): number => (t === 0 ? 0 : Math.ceil(t / 2));

// ── Bond (the dragon) ──
/** The dragon's fighting body: +10% HP per tier. */
export const prodigyDragonHpMultiplier = (t: ProdigyTier): number => 1 + 0.1 * t;
/** The dragon acts half a second sooner per tier. */
export const prodigyDragonIntervalMs = (t: ProdigyTier, baseMs: number): number => baseMs - 500 * t;
/** Fire every third dragon turn; every other turn from Ascendant. */
export const prodigyFireEvery = (t: ProdigyTier): number => (t >= 3 ? 2 : 3);
/** The bond at which the dragon starts shielding its rider: 61 (normal), 41 (Awakened), 21 (Paragon). */
export const prodigyShieldBond = (t: ProdigyTier): number => (t >= 4 ? 21 : t >= 2 ? 41 : 61);
/** Extra dragon's help on checks from Awakened. */
export const prodigyDragonAssistBonus = (t: ProdigyTier): number => (t >= 2 ? 1 : 0);

// ── Command (the fight and the wing) ──
/** The rider's wait between moves: half a second shorter per tier. */
export const prodigyRiderCooldownMs = (t: ProdigyTier, baseMs: number): number => baseMs - 500 * t;
/** Fleeing is easier: the DC drops by the tier. */
export const prodigyFleeBonus = (t: ProdigyTier): number => t;
/** Battle Briefs per in-game day: 1 (Kindled, Awakened), 2 (Ascendant, Paragon), 3 (Empyreal). */
export const prodigyBriefsPerDay = (t: ProdigyTier): number => (t >= 5 ? 3 : t >= 3 ? 2 : t >= 1 ? 1 : 0);

/** What a tier gives, in plain words (the Camp screen and the DM read the same lines). */
export function describeTier(t: Exclude<ProdigyTier, 0>): string[] {
  const disc = [t >= 2 ? 'channels of intensity 3+ cost 1 less strain' : '', t >= 4 ? 'intensity 5+ another 1 less' : ''].filter(Boolean).join(', ');
  return [
    `Channel: Signet Strain limit +${prodigyStrainBonus(t)}, Signet Mastery grows twice as fast, signet checks +${prodigyCheckBonus(t)}, signet strikes +${prodigySignetDice(t)}d6${disc ? `, ${disc}` : ''}.`,
    `Bond: dragon +${Math.round(10 * t)}% HP in fights, acts every ${(prodigyDragonIntervalMs(t, 10000) / 1000).toFixed(1)}s, breathes fire every ${prodigyFireEvery(t) === 2 ? 'other' : 'third'} turn, shields you from bond ${prodigyShieldBond(t)}${prodigyDragonAssistBonus(t) ? ', +1 dragon\'s help on checks' : ''}.`,
    `Command: a move every ${(prodigyRiderCooldownMs(t, 8000) / 1000).toFixed(1)}s in fights, fleeing is ${prodigyFleeBonus(t)} easier, ${prodigyBriefsPerDay(t)} Battle Brief${prodigyBriefsPerDay(t) === 1 ? '' : 's'} a day.`,
  ];
}

/** The GAME FACTS line for a Prodigy (empty for anyone else). */
export function prodigyFactsLine(riderClass: unknown, level: unknown, briefsLeft: number): string {
  const t = prodigyTier(riderClass, level);
  if (!t) return '';
  const a = ASCENSION_TIERS[t - 1];
  return `Class: ${PRODIGY_NAME}, Ascension ${a.name} (tier ${t} of 5): a rare rider whose signet, dragon bond and command of the wing all grow together, far faster than other cadets. Let others notice it; envy and suspicion follow prodigies at Basgiath. ${describeTier(t).join(' ')} Battle Briefs left today: ${briefsLeft}. When the player message carries a [BATTLE BRIEF, binding: ...] line, answer it with one true, useful tactical fact about the current situation (a weakness, a hidden threat, a safer route or the right moment), then continue the scene.`;
}
