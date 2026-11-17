// Solo Empyrean urge meter (D-40): how strongly each core NPC is moved to speak unprompted.
// 15 hand-written profiles (Justin approved 2026-11-17, claude/NPC_URGE_PROFILES.md); everyone
// else gets NEUTRAL_TEMPERAMENT. All of it is paraphrase from the canon cast entries; no book text.
// Era tags keep later-book topics out of an earlier campaign (same rule as the cast facts).
import type { CanonEra } from './types';

/** What an NPC usually does when the urge wins. */
export type UrgeIntent = 'speech' | 'action' | 'whisper';

/** How often they speak up at all. Quiet needs ~40% more urge, loud ~25% less. */
export type TalkStyle = 'quiet' | 'normal' | 'loud';

/** Trigger categories a profile can weigh. Missing = ×1. */
export type UrgeCategory = 'insult' | 'praise' | 'danger' | 'secret' | 'authority' | 'silence';

export interface TemperamentTopic {
  /** Counted only from this era on (eraReached). */
  era: CanonEra;
  /** Whole-word matches, case-insensitive. */
  words: string[];
  /** A secret topic: scored with the secret weight, and the reason never names it outright. */
  secret?: boolean;
}

export interface TemperamentPerson {
  /** First name is enough; matched whole-word against the line. */
  name: string;
  feeling: 'loyal' | 'protective' | 'loves' | 'wary' | 'rival' | 'hates' | 'blames';
  /** Counted only from this era on. Missing = always. */
  era?: CanonEra;
}

export interface Temperament {
  style: TalkStyle;
  /** What they usually do when they cross the line. */
  intent: UrgeIntent;
  /** Multipliers on trigger categories; missing = 1. */
  reacts?: Partial<Record<UrgeCategory, number>>;
  topics?: TemperamentTopic[];
  people?: TemperamentPerson[];
  /** Arguments between others raise their urge (the squad's peacemaker). */
  peacemaker?: boolean;
}

export const NEUTRAL_TEMPERAMENT: Temperament = { style: 'normal', intent: 'speech' };

export const TEMPERAMENTS: Record<string, Temperament> = {
  'xaden-riorson': {
    style: 'quiet', intent: 'action',
    reacts: { danger: 2, secret: 1.5, insult: 0.5, authority: 0.5 },
    topics: [
      { era: 'fw', words: ['marked', 'rebellion', 'fen', 'traitor', 'relic'] },
      { era: 'if', words: ['tyrrendor', 'aretia', 'revolution'] },
      { era: 'fw', words: ['venin'], secret: true },
    ],
    people: [
      { name: 'Garrick', feeling: 'loyal' }, { name: 'Bodhi', feeling: 'loyal' },
      { name: 'Violet', feeling: 'protective' }, { name: 'Dain', feeling: 'wary' },
      { name: 'Lilith', feeling: 'wary' }, { name: 'Aaric', feeling: 'wary', era: 'if' },
    ],
  },
  'dain-aetos': {
    style: 'normal', intent: 'speech',
    reacts: { authority: 1.5, insult: 1.5 },
    topics: [
      { era: 'fw', words: ['codex', 'rule', 'rules', 'curfew', 'sneak', 'sneaking', 'regulation', 'father', 'colonel', 'marked'] },
      { era: 'if', words: ['liam'] },
    ],
    people: [{ name: 'Violet', feeling: 'protective' }, { name: 'Xaden', feeling: 'rival' }],
  },
  'garrick-tavis': {
    style: 'quiet', intent: 'action',
    reacts: { danger: 2 },
    topics: [{ era: 'fw', words: ['spar', 'sparring', 'mat', 'fight', 'fighting', 'challenge'] }],
    people: [
      { name: 'Xaden', feeling: 'loyal' }, { name: 'Bodhi', feeling: 'loyal' },
      { name: 'Imogen', feeling: 'loves' },
    ],
  },
  'bodhi-durran': {
    style: 'normal', intent: 'speech',
    reacts: { insult: 0.5, silence: 1.5 },
    peacemaker: true,
    topics: [{ era: 'fw', words: ['tyrrendor', 'heir'], secret: true }],
    people: [{ name: 'Xaden', feeling: 'protective' }, { name: 'Garrick', feeling: 'loyal' }],
  },
  'mira-sorrengail': {
    style: 'normal', intent: 'speech',
    reacts: { danger: 2, praise: 0.5 },
    topics: [{ era: 'fw', words: ['armor', 'survival', 'ward', 'wards', 'montserrat', 'strythmore'] }],
    people: [
      { name: 'Violet', feeling: 'protective' }, { name: 'Lilith', feeling: 'wary' },
      { name: 'Brennan', feeling: 'loves', era: 'if' },
    ],
  },
  'brennan-sorrengail': {
    style: 'normal', intent: 'speech',
    reacts: { danger: 1.5 },
    topics: [
      { era: 'fw', words: ['heal', 'healing', 'mend', 'mender', 'mending', 'wounded', 'injury'] },
      { era: 'if', words: ['aretia', 'lies', 'revolution'] },
    ],
    people: [
      { name: 'Violet', feeling: 'protective' }, { name: 'Mira', feeling: 'loves' },
      { name: 'Xaden', feeling: 'loyal', era: 'if' }, { name: 'Lilith', feeling: 'wary' },
    ],
  },
  'lilith-sorrengail': {
    style: 'quiet', intent: 'speech',
    reacts: { authority: 2, insult: 1.5, praise: 0.25 },
    topics: [{ era: 'fw', words: ['duty', 'discipline', 'weak', 'weakness', 'ward', 'wards', 'codex'] }],
    people: [
      { name: 'Violet', feeling: 'protective' }, { name: 'Mira', feeling: 'protective' },
      { name: 'Melgren', feeling: 'loyal' },
    ],
  },
  'jack-barlowe': {
    style: 'loud', intent: 'speech',
    reacts: { insult: 2, danger: 0.5 },
    topics: [{ era: 'fw', words: ['parapet', 'challenge', 'mat', 'weak', 'weakness', 'afraid', 'scared', 'hurt'] }],
    people: [{ name: 'Violet', feeling: 'hates' }, { name: 'Xaden', feeling: 'hates' }],
  },
  'jesinia-neilwart': {
    style: 'quiet', intent: 'action',
    reacts: { insult: 0.5 },
    topics: [
      { era: 'fw', words: ['book', 'books', 'archives', 'archive', 'history', 'scribe', 'scribes', 'truth'] },
      { era: 'if', words: ['hidden', 'forbidden'] },
    ],
    people: [{ name: 'Violet', feeling: 'loyal' }, { name: 'Sawyer', feeling: 'loves', era: 'if' }],
  },
  'sloane-mairi': {
    style: 'normal', intent: 'speech',
    reacts: { insult: 1.5, praise: 0.5 },
    topics: [{ era: 'if', words: ['liam', 'marked'] }],
    people: [
      { name: 'Violet', feeling: 'blames', era: 'if' }, { name: 'Xaden', feeling: 'wary', era: 'if' },
      { name: 'Imogen', feeling: 'wary', era: 'if' },
    ],
  },
  'aaric-graycastle': {
    style: 'quiet', intent: 'action',
    reacts: { secret: 2, authority: 0.5 },
    topics: [{ era: 'if', words: ['royal', 'prince', 'king', 'tauri', 'alic', 'cam', 'crown'], secret: true }],
    people: [{ name: 'Xaden', feeling: 'hates', era: 'if' }],
  },
  'violet-sorrengail': {
    style: 'normal', intent: 'speech',
    reacts: { danger: 1.5, secret: 1.5 },
    topics: [{ era: 'fw', words: ['history', 'archives', 'book', 'books', 'poison', 'dagger', 'daggers', 'mother'] }],
    people: [
      { name: 'Rhiannon', feeling: 'loyal' }, { name: 'Ridoc', feeling: 'loyal' },
      { name: 'Mira', feeling: 'loves' }, { name: 'Lilith', feeling: 'wary' },
      { name: 'Dain', feeling: 'wary' }, { name: 'Dain', feeling: 'hates', era: 'if' },
      { name: 'Xaden', feeling: 'protective' },
    ],
  },
  'rhiannon-matthias': {
    style: 'normal', intent: 'speech',
    reacts: { danger: 1.5, silence: 1.5 },
    topics: [{ era: 'fw', words: ['plan', 'plans', 'squad', 'family', 'morraine'] }],
    people: [
      { name: 'Violet', feeling: 'loyal' }, { name: 'Ridoc', feeling: 'loyal' },
      { name: 'Sawyer', feeling: 'loyal' },
    ],
  },
  'ridoc-gamlyn': {
    style: 'loud', intent: 'speech',
    reacts: { silence: 2, danger: 1.5, insult: 0.5 },
    topics: [{ era: 'fw', words: ['prank', 'pranks', 'joke', 'aotrom', 'ice'] }],
    people: [
      { name: 'Violet', feeling: 'loyal' }, { name: 'Rhiannon', feeling: 'loyal' },
      { name: 'Sawyer', feeling: 'loyal' },
    ],
  },
  'imogen-cardulo': {
    style: 'normal', intent: 'speech',
    reacts: { insult: 2, praise: 0.5 },
    topics: [{ era: 'fw', words: ['marked', 'rebellion', 'traitor', 'fen', 'relic'] }],
    people: [
      { name: 'Quinn', feeling: 'loyal' }, { name: 'Xaden', feeling: 'loyal' },
      { name: 'Garrick', feeling: 'rival' },
    ],
  },
};

/** A roster NPC's temperament: the hand-written one, else neutral. */
export function temperamentFor(key: string): Temperament {
  return TEMPERAMENTS[key] ?? NEUTRAL_TEMPERAMENT;
}
