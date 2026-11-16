// Empyrean onboarding: everything the "Become a Dragon Rider" assistant needs on the phone apart
// from the chat itself. It reads the assistant's final build (and checks every field), prepares
// the lore it is sent, turns the build into the character wizard state and the campaign config,
// and keeps a one-time launch note so the first scene opens straight after the rider is saved.
// The server half is supabase/functions/empyrean-onboarding (prompt.ts holds the same value lists).

import { buildDataToWizardState, type CharacterBuildData } from '@/hooks/use-ai-creation-chat';
import { getPresetById, presetToEquipment } from '@/components/wizard/presets/equipment-presets';
import type { WizardState } from '@/components/wizard/types';
import type { CharacterContext } from '@/components/oracle/types';
import { EMPYREAN_CANON_GUIDES, EMPYREAN_CANON_GUIDE_IDS } from '@/lib/empyreanGMGuides';
import { BASGIATH_PLACES, CONTINENT_PLACES, STARTER_START_IDS } from '@/lib/empyreanCanon/continentMap';
import { saveDragonNotes, saveEmpyreanDMConfig, saveEmpyreanOpeningScene, type CampaignFocus, type EmpyreanDMConfig } from '@/lib/empyreanDMPersona';
import { DEFAULT_BOND, DEFAULT_TRUST, saveBondState, setIsUnbonded } from '@/lib/dragonBondState';
import { setScopedItem } from '@/lib/scoped-storage';

// ── the values the app accepts (the server's prompt.ts lists the same ones; a test checks) ──
export const DRAGON_COLOR_IDS = ['deep-red', 'deep-blue', 'deep-purple', 'deep-gold', 'onyx', 'dark-green', 'silver', 'dark-orange', 'brown'] as const;
export const YEAR_VALUES = ['first-year', 'second-year', 'third-year', 'graduated rider'] as const;
export const FOCUS_VALUES = ['combat', 'political', 'romance', 'mystery', 'survival', 'balanced'] as const;
export const START_LOCATION_IDS = STARTER_START_IDS;
export const EVENT_LEVELS = ['off', 'rare', 'normal'] as const;
export const CLASS_IDS = ['rogue', 'wizard', 'sorcerer', 'warlock', 'cleric', 'druid', 'bard', 'prodigy'] as const;
export type EventSetting = typeof EVENT_LEVELS[number];

export const ONBOARDING_MAX_LORE_CHARS = 115_000;

export interface EmpyreanSetup {
  dragonName: string;
  dragonColor: string;
  dragonPersonality: string;
  signetType: string;
  yearAtBasgiath: string;
  campaignFocus: CampaignFocus;
}
export interface CampaignSetup {
  startLocationId: string;
  events: EventSetting;
  openingScene: string;
}
export type OnboardingResult =
  | { kind: 'rider'; character: CharacterBuildData; empyrean: EmpyreanSetup; campaign: CampaignSetup }
  | { kind: 'campaign'; empyrean: EmpyreanSetup; campaign: CampaignSetup };

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  (list as readonly string[]).includes(String(value ?? '').trim().toLowerCase()) ? String(value).trim().toLowerCase() as T : fallback;
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const int = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** The dragon, signet, year and focus. Null when the dragon has no name. */
export function sanitizeEmpyrean(raw: unknown): EmpyreanSetup | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const dragonName = text(r.dragonName, 40);
  if (!dragonName) return null;
  return {
    dragonName,
    dragonColor: pick(DRAGON_COLOR_IDS, r.dragonColor, 'deep-red'),
    dragonPersonality: text(r.dragonPersonality, 1500),
    signetType: text(r.signetType, 80),
    yearAtBasgiath: pick(YEAR_VALUES, r.yearAtBasgiath, 'first-year'),
    campaignFocus: pick(FOCUS_VALUES, r.campaignFocus, 'balanced') as CampaignFocus,
  };
}

/** Where it starts, random events and the opening scene. Null without a usable opening scene. Cadets always start at Basgiath. */
export function sanitizeCampaign(raw: unknown, yearAtBasgiath: string): CampaignSetup | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const openingScene = text(r.openingScene, 2500);
  if (openingScene.length < 40) return null;
  const start = pick(START_LOCATION_IDS, r.startLocationId, 'basgiath');
  return {
    startLocationId: yearAtBasgiath === 'graduated rider' ? start : 'basgiath',
    events: pick(EVENT_LEVELS, r.events, 'rare'),
    openingScene,
  };
}

/** The character fields, with the app's limits applied. Null without a usable name. */
export function sanitizeCharacter(raw: unknown): CharacterBuildData | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const name = text(r.name, 30);
  if (name.length < 2) return null;
  const scores = (r.abilityScores && typeof r.abilityScores === 'object' ? r.abilityScores : {}) as Record<string, unknown>;
  const score = (key: string) => int(scores[key], 3, 20, 10);
  return {
    ...(r as CharacterBuildData),
    name,
    level: int(r.level, 1, 20, 1),
    primaryClass: pick(CLASS_IDS, r.primaryClass, 'rogue'),
    portraitIcon: text(r.portraitIcon, 20) || 'Shield',
    gender: text(r.gender, 40),
    race: text(r.race, 40),
    backstory: text(r.backstory, 2000),
    abilityScores: {
      strength: score('strength'), dexterity: score('dexterity'), constitution: score('constitution'),
      intelligence: score('intelligence'), wisdom: score('wisdom'), charisma: score('charisma'),
    },
    gameMode: r.gameMode === 'honest' ? 'honest' : 'infinityPool',
    xpPreset: pick(['standard', 'fastTrack', 'epicJourney', 'milestone'] as const, r.xpPreset, 'standard'),
    diceOddsMode: pick(['fair', 'heroic', 'dramatic', 'chaotic', 'cursed'] as const, r.diceOddsMode, 'fair'),
    starterAbilities: Array.isArray(r.starterAbilities) ? r.starterAbilities.filter((a: any) => a && typeof a.abilityId === 'string').slice(0, 20) : [],
    consumables: Array.isArray(r.consumables) ? r.consumables.filter((c: unknown) => typeof c === 'string').slice(0, 12) : [],
    // Homebrew is not part of rider creation.
    homebrewGear: [], homebrewSpells: [], homebrewAbilities: [], homebrewConsumables: [],
    empyrean: undefined,
  };
}

const RESULT_BLOCK = /```json\s*([\s\S]*?)```/g;

/** The assistant's final build, if this reply holds one (checked; never trusts the AI's values). */
export function extractOnboardingResult(content: string): OnboardingResult | null {
  for (const match of content.matchAll(RESULT_BLOCK)) {
    let parsed: any;
    try { parsed = JSON.parse(match[1].trim()); } catch { continue; }
    const data = parsed?.data;
    if (!data || typeof data !== 'object') continue;
    const empyrean = sanitizeEmpyrean(data.empyrean);
    if (!empyrean) continue;
    const campaign = sanitizeCampaign(data.campaign, empyrean.yearAtBasgiath);
    if (!campaign) continue;
    if (parsed.action === 'apply_empyrean_campaign') return { kind: 'campaign', empyrean, campaign };
    if (parsed.action === 'apply_empyrean_rider') {
      const character = sanitizeCharacter(data);
      if (character) return { kind: 'rider', character, empyrean, campaign };
    }
  }
  return null;
}

/** True when a reply started a build block that didn't come through whole (cut off). */
export function looksLikeBrokenResult(content: string): boolean {
  return /"action"\s*:\s*"apply_empyrean_(rider|campaign)"/.test(content) && !extractOnboardingResult(content);
}

export function parseSuggestions(content: string): string[] {
  const m = content.match(/\[SUGGESTIONS:\s*(.*?)\]\s*$/);
  if (!m) return [];
  return Array.from(m[1].matchAll(/"([^"]+)"/g), x => x[1]).slice(0, 4);
}
export function stripSuggestions(content: string): string {
  return content.replace(/\n?\[SUGGESTIONS:\s*.*?\]\s*$/, '').trimEnd();
}
/** What the player sees of a reply: no suggestion line, and the build block replaced by a short note. */
export function displayText(content: string): string {
  return stripSuggestions(content).replace(/```json[\s\S]*?(```|$)/g, '').trim() || '✅ Your build is ready. Tap Begin.';
}

// ── the lore the assistant is sent ──
function placesText(): string {
  const line = (p: { name: string; region?: string; note: string; discovered?: boolean }) =>
    `- ${p.name}${p.region ? ` (${p.region})` : ''}${p.discovered === false ? ' [starts undiscovered on the map]' : ''}: ${p.note}`;
  return ['## Places on the app\'s starter map', 'The Continent:', ...CONTINENT_PLACES.map(line), 'Basgiath\'s grounds:', ...BASGIATH_PLACES.map(line)].join('\n');
}

/** Lore guides as one text, with the starter map's places, cut to what the server accepts. */
export function buildLoreText(guides: Array<{ name: string; content: string }>): string {
  const body = guides.filter(g => g.content.trim()).map(g => `## ${g.name}\n${g.content.trim()}`).join('\n\n');
  return `${body}\n\n${placesText()}`.slice(0, ONBOARDING_MAX_LORE_CHARS);
}

/** The built-in canon guides (D-32): the lore for a new rider. */
export function canonLoreText(): string {
  return buildLoreText(EMPYREAN_CANON_GUIDES);
}

/**
 * For a new campaign: the campaign's own enabled Empyrean guides (a player's edited Bible wins),
 * or the built-in canon guides when none are installed.
 */
export function campaignLoreText(installed: Array<{ id: string; name: string; content: string; enabled: boolean }>, empyreanIds: string[]): string {
  const ids = new Set(empyreanIds);
  const mine = installed.filter(g => g.enabled && ids.has(g.id));
  return mine.length ? buildLoreText(mine) : canonLoreText();
}

/** The existing rider, as facts for "new campaign" mode. */
export function riderSummary(name: string, ctx: CharacterContext | undefined, config: EmpyreanDMConfig | null): string {
  const lines = [
    `Name: ${name || ctx?.name || 'Unknown'}`,
    ctx ? `Level ${ctx.level}${ctx.characterClass ? ` ${ctx.characterClass}` : ''}${ctx.race ? `, ${ctx.race}` : ''}${ctx.gender ? `, ${ctx.gender}` : ''}` : '',
    ctx?.backstory ? `Backstory: ${ctx.backstory.slice(0, 1500)}` : '',
    config?.dragonName ? `Current dragon: ${config.dragonName} (${config.dragonColor || 'color not set'})` : 'Current dragon: none set',
    config?.signetType ? `Signet: ${config.signetType}` : '',
    config?.yearAtBasgiath ? `Last campaign's year: ${config.yearAtBasgiath}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

// ── turning the build into the app's state ──

/** The wizard state for the new rider (with the gear preset filled in), plus the identity fields the sheet keeps on the side. */
export function prepareRiderCharacter(character: CharacterBuildData): WizardState {
  if (character.gender) setScopedItem('dnd-character-gender', character.gender);
  if (character.race) setScopedItem('dnd-character-race', character.race);
  if (character.backstory) setScopedItem('dnd-character-backstory', character.backstory.slice(0, 2000));
  const state = buildDataToWizardState(character);
  const preset = state.selectedPresetId ? getPresetById(state.selectedPresetId) : undefined;
  if (preset) state.equipment = presetToEquipment(preset);
  return state;
}

export function toEmpyreanConfig(setup: EmpyreanSetup, characterName: string, keep?: EmpyreanDMConfig | null): EmpyreanDMConfig {
  return {
    selectedLoreGuides: Array.from(new Set([...(keep?.selectedLoreGuides ?? []), ...EMPYREAN_CANON_GUIDE_IDS])),
    selectedToneGuides: keep?.selectedToneGuides ?? [],
    selectedSessionTemplate: null,
    characterName,
    dragonName: setup.dragonName,
    dragonColor: setup.dragonColor,
    signetType: setup.signetType,
    yearAtBasgiath: setup.yearAtBasgiath,
    campaignFocus: setup.campaignFocus,
  };
}

/** Save the campaign setup the solo Empyrean screen reads: config, dragon notes, a fresh bond for a new dragon, the opening scene, Empyrean mode. */
export function applyEmpyreanSetup(setup: EmpyreanSetup, campaign: CampaignSetup, characterName: string, keep?: EmpyreanDMConfig | null): EmpyreanDMConfig {
  const config = toEmpyreanConfig(setup, characterName, keep);
  saveEmpyreanDMConfig(config);
  saveDragonNotes(setup.dragonPersonality);
  setIsUnbonded(false);
  // A new dragon starts a fresh bond. The same dragon (a new campaign with it) keeps its bond.
  if (!keep?.dragonName || keep.dragonName.trim().toLowerCase() !== setup.dragonName.trim().toLowerCase()) {
    saveBondState({
      bond: DEFAULT_BOND, trust: DEFAULT_TRUST, mood: 'calm', memories: [], totalChatExchanges: 0,
      sessionChatCount: 0, ruptures: 0, lastContactTimestamp: null, unreadDragonMessages: [],
    });
  }
  saveEmpyreanOpeningScene(campaign.openingScene);
  setScopedItem('odyssey-app-mode', 'empyrean');
  return config;
}

/** The canon guides that still need installing (the ones the player already has stay as they are). */
export function missingCanonGuides(installedIds: Iterable<string>): Array<{ name: string; content: string; customId: string }> {
  const have = new Set(installedIds);
  return EMPYREAN_CANON_GUIDES.filter(g => !have.has(g.id)).map(g => ({ name: g.name, content: g.content, customId: g.id }));
}

// ── the one-time launch note ──
// Kept in plain phone storage (not per character): a new rider has no save id until it is first
// saved, and settings written per character before that would be lost (only the keys in
// scoped-keys.ts move to the new save). So Begin writes this note, and the campaign setup is
// applied only after the rider is saved.
// Stages: 'pending' (Begin pressed; the rider is being saved) → 'ready' (setup applied to the
// saved rider) → 'open' (the first scene was opened; the solo screen still reads the start place
// and events setting from it) → cleared.
export const EMPYREAN_LAUNCH_KEY = 'odyssey-empyrean-launch';
const LAUNCH_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface EmpyreanLaunch {
  v: 1;
  stage: 'pending' | 'ready' | 'open';
  characterName: string;
  empyrean: EmpyreanSetup;
  campaign: CampaignSetup;
  createdAt: number;
}

export function saveLaunch(characterName: string, empyrean: EmpyreanSetup, campaign: CampaignSetup, stage: EmpyreanLaunch['stage'] = 'pending', now = Date.now()): EmpyreanLaunch {
  const note: EmpyreanLaunch = { v: 1, stage, characterName, empyrean, campaign, createdAt: now };
  try { localStorage.setItem(EMPYREAN_LAUNCH_KEY, JSON.stringify(note)); } catch { /* storage full: the player can still start from the hub */ }
  return note;
}

export function readLaunch(now = Date.now()): EmpyreanLaunch | null {
  try {
    const raw = localStorage.getItem(EMPYREAN_LAUNCH_KEY);
    if (!raw) return null;
    const note = JSON.parse(raw) as EmpyreanLaunch;
    if (note?.v !== 1 || typeof note.createdAt !== 'number' || now - note.createdAt > LAUNCH_MAX_AGE_MS || !note.empyrean || !note.campaign) {
      localStorage.removeItem(EMPYREAN_LAUNCH_KEY);
      return null;
    }
    return note;
  } catch {
    return null;
  }
}

export function setLaunchStage(stage: EmpyreanLaunch['stage']): void {
  const note = readLaunch();
  if (note) try { localStorage.setItem(EMPYREAN_LAUNCH_KEY, JSON.stringify({ ...note, stage })); } catch { /* ignore */ }
}

export function clearLaunch(): void {
  try { localStorage.removeItem(EMPYREAN_LAUNCH_KEY); } catch { /* ignore */ }
}

/** After the new rider is saved: apply the campaign setup to it. True when a launch is waiting. */
export function applyPendingLaunch(): boolean {
  const note = readLaunch();
  if (!note || note.stage !== 'pending') return false;
  applyEmpyreanSetup(note.empyrean, note.campaign, note.characterName);
  setLaunchStage('ready');
  return true;
}
