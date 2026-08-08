// Narration style — the tone the AI DM writes in.
// Chosen by the player (solo) or the host (party). Never overrides GM Guides
// or OOC directives; it sits below both in the style priority chain.

export type NarrationStyleId = 'default' | 'serious' | 'gritty' | 'comedic' | 'horror';
export type NarrationIntensity = 'light' | 'standard' | 'heavy';

export const DEFAULT_NARRATION_STYLE: NarrationStyleId = 'default';
export const DEFAULT_NARRATION_INTENSITY: NarrationIntensity = 'standard';

export interface NarrationStyleState {
  style: NarrationStyleId;
  intensity: NarrationIntensity;
}

export const DEFAULT_NARRATION_STATE: NarrationStyleState = {
  style: DEFAULT_NARRATION_STYLE,
  intensity: DEFAULT_NARRATION_INTENSITY,
};

export interface NarrationStyleMeta {
  id: NarrationStyleId;
  label: string;
  blurb: string;
  /** Concrete writing instruction fed to the DM. */
  instruction: string;
  /** One-line reminder appended to quest step prompts. */
  shortLine: string;
  className: string;
}

export const NARRATION_STYLES: NarrationStyleMeta[] = [
  {
    id: 'default',
    label: 'Default',
    blurb: 'No tone steering — guides and persona decide.',
    instruction: '',
    shortLine: '',
    className: 'text-muted-foreground border-border bg-muted/20',
  },
  {
    id: 'serious',
    label: 'Serious',
    blurb: 'Grounded, dramatic, weighty stakes.',
    instruction:
      'Write with grounded dramatic weight. Treat every choice as consequential. Keep humour rare and dry. Favour restraint, clear cause and effect, and characters who behave like adults under pressure. No winking at the audience, no camp.',
    shortLine: 'Keep the tone serious and grounded.',
    className: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  },
  {
    id: 'gritty',
    label: 'Gritty',
    blurb: 'Dirt, fatigue, cost, consequence.',
    instruction:
      'Write gritty, low-fantasy prose. Show physical cost: fatigue, blood, cold, hunger, damaged gear, coin that runs out. Violence is ugly and fast, never balletic. NPCs are self-interested and tired. Victories are partial and leave a mark. Avoid heroic polish and clean resolutions.',
    shortLine: 'Keep the tone gritty — show cost, dirt and fatigue.',
    className: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  },
  {
    id: 'comedic',
    label: 'Comedic',
    blurb: 'Timing, banter, absurd but real.',
    instruction:
      'Write with comic timing. Humour comes from character, escalation and bad luck — not from breaking the world or mocking the players. NPCs have specific, funny wants. Keep the danger real underneath so the jokes land. Punchline placement matters: end beats on the sharp line.',
    shortLine: 'Keep the tone comedic — timing and character-driven humour.',
    className: 'text-lime-300 border-lime-500/40 bg-lime-500/10',
  },
  {
    id: 'horror',
    label: 'Horror',
    blurb: 'Dread, restraint, wrongness.',
    instruction:
      'Write horror through restraint. Build dread with sound, absence, wrongness and detail that arrives one beat too late. Withhold the full shape of the threat. Bodies and spaces behave slightly incorrectly. Keep pacing tight and sentences short when the pressure rises. Gore is an accent, never the point.',
    shortLine: 'Keep the tone horror — dread, restraint, wrongness.',
    className: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
  },
];

export const NARRATION_INTENSITIES: Array<{ id: NarrationIntensity; label: string; modifier: string }> = [
  { id: 'light', label: 'Light', modifier: 'Apply this tone as a light colouring — a few touches per response, never overwhelming the scene.' },
  { id: 'standard', label: 'Standard', modifier: 'Apply this tone consistently through the response without overpowering plot or mechanics.' },
  { id: 'heavy', label: 'Heavy', modifier: 'Apply this tone hard. It should dominate word choice, imagery, rhythm and NPC behaviour in every paragraph.' },
];

export function narrationStyleMeta(id: NarrationStyleId | undefined): NarrationStyleMeta {
  return NARRATION_STYLES.find(s => s.id === id) ?? NARRATION_STYLES[0];
}

export function isNarrationStyle(v: unknown): v is NarrationStyleId {
  return NARRATION_STYLES.some(s => s.id === v);
}

export function isNarrationIntensity(v: unknown): v is NarrationIntensity {
  return NARRATION_INTENSITIES.some(i => i.id === v);
}

export function normalizeNarrationState(raw: unknown): NarrationStyleState {
  const style = (raw as any)?.style;
  const intensity = (raw as any)?.intensity;
  return {
    style: isNarrationStyle(style) ? style : DEFAULT_NARRATION_STYLE,
    intensity: isNarrationIntensity(intensity) ? intensity : DEFAULT_NARRATION_INTENSITY,
  };
}

/** Prompt block sent to the DM. Empty string when no style is selected. */
export function buildNarrationStyleBlock(state: NarrationStyleState | null | undefined): string {
  if (!state) return '';
  const meta = narrationStyleMeta(state.style);
  if (!meta.instruction) return '';
  const intensity = NARRATION_INTENSITIES.find(i => i.id === state.intensity) ?? NARRATION_INTENSITIES[1];
  return [
    '## NARRATION STYLE (PLAYER-SELECTED)',
    `Selected tone: ${meta.label} (${intensity.label} intensity).`,
    meta.instruction,
    intensity.modifier,
    'This tone applies to every beat, including quest objective narration, scene openers and NPC behaviour.',
    'It ranks BELOW Host/Player OOC directives and GM Guides, and ABOVE the DM Persona and the neutral default. If a guide defines style explicitly, the guide wins.',
  ].join('\n');
}

/** One-line reminder for quest kickoff / objective step prompts. */
export function narrationStyleLine(state: NarrationStyleState | null | undefined): string {
  if (!state) return '';
  const meta = narrationStyleMeta(state.style);
  if (!meta.shortLine) return '';
  const intensity = NARRATION_INTENSITIES.find(i => i.id === state.intensity) ?? NARRATION_INTENSITIES[1];
  return `(Narration style: ${meta.label}, ${intensity.label}. ${meta.shortLine})`;
}

export function narrationStyleSummary(state: NarrationStyleState): string {
  const meta = narrationStyleMeta(state.style);
  if (meta.id === 'default') return 'Default';
  const intensity = NARRATION_INTENSITIES.find(i => i.id === state.intensity) ?? NARRATION_INTENSITIES[1];
  return `${meta.label} · ${intensity.label}`;
}
