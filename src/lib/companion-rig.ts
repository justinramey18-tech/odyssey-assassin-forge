// Custom battle companion — appearance + bond. Pure data, no React.
// Stored per character (scoped key `odyssey-companion-rig`).

export const COMPANION_STORAGE_KEY = 'odyssey-companion-rig';

export type Chassis = 'prowler' | 'behemoth' | 'drake' | 'automaton';
export type EarStyle = 'pricked' | 'tufted' | 'horns' | 'frills' | 'none';
export type TailStyle = 'plume' | 'whip' | 'club' | 'chain';
export type Pattern = 'solid' | 'stripes' | 'spots' | 'cracks' | 'runes';
export type Temperament = 'feral' | 'sentinel' | 'reckless' | 'cunning';
export type Collar = 'none' | 'leather' | 'spiked' | 'pendant';
export type Armor = 'none' | 'leather' | 'chain' | 'plate';
export type PawGear = 'none' | 'wraps' | 'blades';
export type HeadShape = 'canid' | 'feline' | 'ursine' | 'beaked' | 'reptile' | 'visor';
export type FeetStyle = 'paws' | 'talons' | 'hooves' | 'pads';
export type BackFeature = 'none' | 'mane' | 'wings' | 'spines' | 'shell';

export const HEADS = ['canid', 'feline', 'ursine', 'beaked', 'reptile', 'visor'] as const;
export const FEET = ['paws', 'talons', 'hooves', 'pads'] as const;
export const BACKS = ['none', 'mane', 'wings', 'spines', 'shell'] as const;

/** The anatomy each body family is born with; players can override any part. */
export const CHASSIS_ANATOMY: Record<Chassis, { head: HeadShape; feet: FeetStyle; back: BackFeature }> = {
  prowler: { head: 'canid', feet: 'paws', back: 'none' },
  behemoth: { head: 'ursine', feet: 'pads', back: 'none' },
  drake: { head: 'reptile', feet: 'talons', back: 'wings' },
  automaton: { head: 'visor', feet: 'hooves', back: 'spines' },
};

export interface CompanionRig {
  name: string;
  title: string;
  chassis: Chassis;
  head: HeadShape;
  feet: FeetStyle;
  back: BackFeature;
  build: number;   // 0 lithe .. 1 massive
  muzzle: number;  // 0 blunt .. 1 long
  ears: EarStyle;
  tail: TailStyle;
  pelt: string;
  belly: string;
  eye: string;
  accent: string;
  glowEyes: boolean;
  pattern: Pattern;
  scars: { eye: boolean; ear: boolean; muzzle: boolean; ribs: boolean };
  collar: Collar;
  armor: Armor;
  paws: PawGear;
  temperament: Temperament;
  bond: number; // 0..100
}

export const NAME_MAX = 24;
export const TITLE_MAX = 32;

export const DEFAULT_RIG: CompanionRig = {
  name: 'Grimjaw',
  title: 'the Ash Wolf',
  chassis: 'prowler',
  head: 'canid',
  feet: 'paws',
  back: 'none',
  build: 0.45,
  muzzle: 0.6,
  ears: 'pricked',
  tail: 'plume',
  pelt: '#3a3f47',
  belly: '#b9a487',
  eye: '#f5b342',
  accent: '#c2410c',
  glowEyes: true,
  pattern: 'solid',
  scars: { eye: false, ear: false, muzzle: false, ribs: false },
  collar: 'leather',
  armor: 'none',
  paws: 'none',
  temperament: 'sentinel',
  bond: 30,
};

export const PELT_SWATCHES = ['#1b1c20', '#3a3f47', '#8a8f98', '#e8e4dc', '#7a2e1d', '#b5762f', '#2b4a6b', '#3f5d3a', '#6b4f7a', '#8c6a3c'];
export const BELLY_SWATCHES = ['#b9a487', '#e8e0cf', '#5a5f68', '#d9b36c', '#9b3b2a', '#c9d3dc'];
export const EYE_SWATCHES = ['#f5b342', '#3ee08f', '#5ec8ff', '#ff3b3b', '#a46bff', '#f2f2f2'];
export const ACCENT_SWATCHES = ['#c2410c', '#eab308', '#22d3ee', '#a855f7', '#ef4444', '#84cc16'];

const pick = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fb;
const unit = (v: unknown, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fb;
};
const hex = (v: unknown, fb: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb);
const text = (v: unknown, max: number, fb: string) => (typeof v === 'string' ? v.slice(0, max) : fb);

/** Turn anything (stored JSON, partial patch) into a safe rig. */
export function sanitizeRig(raw: unknown): CompanionRig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const d = DEFAULT_RIG;
  const bondN = Number(r.bond);
  const s = (r.scars && typeof r.scars === 'object' ? r.scars : {}) as Record<string, unknown>;
  const chassis = pick(r.chassis, ['prowler', 'behemoth', 'drake', 'automaton'] as const, d.chassis);
  const anat = CHASSIS_ANATOMY[chassis];
  return {
    name: text(r.name, NAME_MAX, d.name),
    title: text(r.title, TITLE_MAX, d.title),
    chassis,
    head: pick(r.head, HEADS, anat.head),
    feet: pick(r.feet, FEET, anat.feet),
    back: pick(r.back, BACKS, anat.back),
    build: unit(r.build, d.build),
    muzzle: unit(r.muzzle, d.muzzle),
    ears: pick(r.ears, ['pricked', 'tufted', 'horns', 'frills', 'none'] as const, d.ears),
    tail: pick(r.tail, ['plume', 'whip', 'club', 'chain'] as const, d.tail),
    pelt: hex(r.pelt, d.pelt),
    belly: hex(r.belly, d.belly),
    eye: hex(r.eye, d.eye),
    accent: hex(r.accent, d.accent),
    glowEyes: typeof r.glowEyes === 'boolean' ? r.glowEyes : d.glowEyes,
    pattern: pick(r.pattern, ['solid', 'stripes', 'spots', 'cracks', 'runes'] as const, d.pattern),
    scars: { eye: s.eye === true, ear: s.ear === true, muzzle: s.muzzle === true, ribs: s.ribs === true },
    collar: pick(r.collar, ['none', 'leather', 'spiked', 'pendant'] as const, d.collar),
    armor: pick(r.armor, ['none', 'leather', 'chain', 'plate'] as const, d.armor),
    paws: pick(r.paws, ['none', 'wraps', 'blades'] as const, d.paws),
    temperament: pick(r.temperament, ['feral', 'sentinel', 'reckless', 'cunning'] as const, d.temperament),
    bond: Number.isFinite(bondN) ? Math.min(100, Math.max(0, Math.round(bondN))) : d.bond,
  };
}

/** Add bond, clamped to 0..100; ignores bad numbers. */
export function addBond(rig: CompanionRig, amount: number): CompanionRig {
  if (!Number.isFinite(amount)) return rig;
  return { ...rig, bond: Math.min(100, Math.max(0, Math.round(rig.bond + amount))) };
}

export function bondLabel(bond: number): string {
  if (bond >= 85) return 'Sworn';
  if (bond >= 60) return 'Devoted';
  if (bond >= 35) return 'Trusting';
  if (bond >= 15) return 'Wary';
  return 'Feral';
}
