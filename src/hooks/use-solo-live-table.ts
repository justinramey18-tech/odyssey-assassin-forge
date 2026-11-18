// Solo Empyrean Live Table: the party Live Table, run on this phone for one rider.
// Reuses the Arena's local table (same message contract as the party table) and the
// solo roster: who is "on stage" = NPCs named in the latest DM post plus anyone the
// rider called over. NPC answers come from voiceNPC in off-feed mode, so nothing reaches
// the story until the rider taps Send to DM.
// - NPCs hear the table: each answer gets the latest table lines (party NPCs read the last 40).
// - One answer at a time, in the order asked; an answer waits while the DM is writing.
// - "Let them talk": 2 or 3 NPCs speak to each other (the party scene, run on the phone).
// - The table is kept on this phone per campaign (storageKey).
// - Send to DM marks lines sent only when the DM really replied.
// - Urge meter (D-40): on-stage NPCs can speak unprompted. The engine (src/lib/npc-urge.ts)
//   scores every heard line and the silence; crossing the line makes an NPC speak, on the cheap
//   urge model, with the reason handed to the AI. Caps: 2 wakes per rider line, 1 reaction to an
//   unprompted line, never a chain. Brakes: the DM writing, a scene, a fight (paused), table closed.
//   Unprompted lines never carry the roll or join controls.
// - Urge upgrades (2026-11-17): meter levels are kept per campaign; whispers (🤫) are heard only by
//   the rider and the whisperer; sealing an unprompted line makes that NPC chattier, deleting it or
//   hushing them quieter; cadets hold back while an officer or command is on stage; an ignored
//   question makes the NPC press; a tense DM post lowers everyone's bar for five minutes.
// - Tier 3 (2026-11-17): a rider line that touches something an NPC remembers adds urge; an AI judge
//   (solo-npc "judge", reports only) reads lines the word lists made little of.
// - Huddles (src/lib/npc-huddle.ts): two NPCs on stage start talking among themselves and the rider
//   is a third voice in it. The urge meter picks who speaks next; heat, stances and steam move with
//   what is said; tension, old ground, appetite and pace are kept on the phone per campaign.
//   Nothing here writes saved data: memories and attitude still change only through Send to DM.
// - DM tandem (src/lib/live-npc-tandem.ts): the DM's hidden LIVE directions set the stage and the
//   room's mood, cue an NPC to speak, or start a huddle; a hand-off carries a LIVE TABLE STATE note
//   (dmNotes) back to the DM. With no directions in a post, everything works from names as before.
// - Delivery (src/lib/npc-delivery.ts): every line here is written from the NPC's voice, mood and its
//   own PRIVATE NOTE from last time (kept on the phone under the storage key plus :minds), not a fixed
//   two-line shape. The app measures what came out and corrects sameness on the next request. A rare
//   hidden action can change the scene: walk out, step between, square up, hand something over.
// - Travel (src/lib/travel-offers.ts): an NPC may propose going somewhere with the rider (travelOffer);
//   NPCs who came along (companions) stay on stage through the trip and the first DM post after it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useArenaRoundChat } from '@/hooks/use-arena-round-chat';
import { CANON_ERA_LABELS, matchNames, npcVoiceContext } from '@/lib/empyreanCanon/castNpcs';
import { castPortrait } from '@/lib/empyreanCanon/castPortraits';
import { temperamentFor } from '@/lib/empyreanCanon/castNpcs/temperament';
import { rosterNameEntries, type RosterEntry } from '@/lib/solo-npcs';
import {
  URGE_LINE_MODEL, URGE_RULES, addReasons, freshUrge, pickWakes, resetUrge, scoreLine,
  effectiveThreshold, silenceReasons, spotlightBonus, urgeStanding, whyBlock, type NpcUrgeState, type Talkativeness,
  URGE_TUNING, asksQuestion, energyScale, ignoredQuestionReasons, learnTaste, mentionsAny, rankFromRole, rankScale, tableEnergy,
  URGE_TIER3, judgeReasons, memoryMatch, memoryReason, needsJudge, type JudgedLine,
} from '@/lib/npc-urge';
import {
  HUDDLE_RULES, addPressure, afterNpcLine, afterRiderLine, applyRead, freshTaste, huddleBlock, joinHuddle, learnPace, leaveHuddle,
  likedHuddle, nextBeat, nextSpeaker, openHuddle, pairKey, pauseMs, readTaste, readySpark, settleHuddle,
  type Huddle, type HuddleEnd, type HuddleNpc, type HuddleTaste, type PairPressure,
} from '@/lib/npc-huddle';
import { askJudge, type JudgeAsk } from '@/lib/solo-judge';
import {
  deliveryBlock, fitToShape, isKeyLine, measureLine, moodFacts, partsNote, planTurn, readNotes, readShapes, readTurn, stripSpeaker, type TurnShape,
  type LineShape, type MindNote, type NpcAction,
} from '@/lib/npc-delivery';
import { voiceFor } from '@/lib/empyreanCanon/castNpcs/voice';
import { directionsSig, parseDirections, stripLiveTags, tableStateForDm, type DmDirections, type TableStateInput } from '@/lib/live-npc-tandem';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { formatReply, parseReply } from '@/lib/chatReply';
import { stripActionCard } from '@/lib/roundChatActionCard';
import { npcLineForDm } from '@/lib/live-npcs';
import type { RoundChatMessage } from '@/hooks/use-round-chat';
import type { SocialCheckResult } from '@/lib/npcSocialChecks';
import type { SoloNpcs } from '@/hooks/use-solo-npcs';
import { parseNpcJoin, parseNpcRoll, keepNpcRoll, buildRollAnswer, rollModifier, type NpcRollRequest } from '@/lib/live-npcs';
import type { CharacterContext } from '@/components/oracle/types';
import { rollD20, awaitLatestD20Reveal } from '@/lib/rollD20';
import { soloRollLine } from '@/lib/solo-table-actions';
import { checkRisk, type RulesCheck } from '@/lib/empyrean-rules-client';
import { resolveOddsForContext } from '@/lib/diceOdds';

const MAX_STAGE = 8;
/** How many recent table lines an NPC hears, and their size. */
export const TABLE_HEARD_LINES = 16;
const TABLE_HEARD_CHARS = 3000;
const LINE_CHARS = 400;
/** The Live Table comedy dial for solo hand-offs: 1–3 = played straight, no fourth-wall breaks. */
export const SOLO_CHAOS_LEVEL = 2;
/** The longest an answer waits for the DM to finish writing. */
const WAIT_FOR_DM_MS = 180_000;
/** How often the urge meter looks at the clock (decay, silence, tells). */
const URGE_TICK_MS = 10_000;

type VoiceFn = (
  names: string | string[], line: string,
  social?: { skill: SocialCheckResult['skill']; opposingSkillLabel: string; playerTotal: number; npcTotal: number; outcome: SocialCheckResult['outcome']; rollBlockText?: string },
  mind?: string, offFeed?: boolean, tableControls?: string, modelOverride?: string, delivery?: string,
) => Promise<string | undefined>;

/** What a caller knows about the moment a line is spoken in. */
interface SpeakMoment {
  /** The rider put a direct question to this NPC. */
  directQuestion?: boolean;
  /** Words in the rider's line this answers. */
  riderWords?: number;
  /** The last line of a conversation. */
  closing?: boolean;
  /** A line that matters: written by the story's own model even when unprompted. */
  keyLine?: boolean;
  /** Urge over their bar before it was reset for speaking. */
  stir?: number;
}

/** The Live Table rules for the DM (ai-dm `liveTable`), for a solo hand-off. */
export interface SoloLiveTableContext {
  mode: 'live';
  chaosLevel: number;
  hasTableTalk: boolean;
  hasInCharacter: boolean;
  hasNpcLines: boolean;
  hasCombat: false;
  /** For the app only (never sent to the server as a rule): what the table knows that the sealed lines do not say. */
  dmNotes?: string;
}

/** The urge meter's switches, kept on this phone per campaign. */
export interface UrgeSettings { enabled: boolean; perNpc: Record<string, Talkativeness>; /** Learned taste per NPC: a threshold factor (below 1 = chattier). */ learned: Record<string, number>; /** The AI judge reads lines the word lists made little of. Missing = on. */ judge?: boolean; /** NPCs may start talking among themselves. Missing = on. */ huddles?: boolean }
const DEFAULT_URGE_SETTINGS: UrgeSettings = { enabled: true, perNpc: {}, learned: {}, judge: true, huddles: true };

/** What the Live Table shows about a huddle: the one running, or the last one while its lines can still be sealed. */
export interface HuddleView { active: boolean; names: string[]; heat: number; canSeal: boolean }

/** A whispered line: only the rider and the whisperer hear it. */
export const WHISPER_MARK = '🤫';
export function isWhisper(m: Pick<RoundChatMessage, 'content' | 'npc_id'>): boolean {
  return !!m.npc_id && parseReply(m.content || '').body.trimStart().startsWith(WHISPER_MARK);
}

/** Meter levels kept on the phone, and which table lines were unprompted (for learning). */
interface UrgeLevels { states: Record<string, NpcUrgeState>; unprompted: string[]; /** Unprompted lines already learned from. */ learnedIds: string[]; /** The DM post the table energy was read from, and when. */ energy: { sig: string; at: number } | null; /** The DM post whose cue and huddle directions already ran. */ directed: string }
/** Engine reasons that say nothing about what the line meant: they never count as "the lists caught it". */
const PLAIN_REASONS = new Set(['your name came up', 'the talk keeps passing you by']);
/** Enough of a DM post to tell it from the next one. */
const energySig = (text: string) => `${text.length}:${text.slice(0, 48)}`;
const LEVELS_MAX_AGE_MS = 3_600_000;

function readUrgeLevels(key: string | undefined): UrgeLevels {
  if (!key) return { states: {}, unprompted: [], learnedIds: [], energy: null, directed: '' };
  try {
    const raw = getScopedItem(key);
    const data = raw ? JSON.parse(raw) as Partial<UrgeLevels> : null;
    const states: Record<string, NpcUrgeState> = {};
    const now = Date.now();
    for (const [k, v] of Object.entries(data?.states ?? {})) {
      if (v && typeof v.urge === 'number' && typeof v.at === 'number' && typeof v.lastSpokeAt === 'number' && now - v.at < LEVELS_MAX_AGE_MS) {
        states[k] = { urge: v.urge, at: v.at, lastSpokeAt: v.lastSpokeAt, reasons: Array.isArray(v.reasons) ? v.reasons : [] };
      }
    }
    const energy = data?.energy && typeof data.energy.sig === 'string' && typeof data.energy.at === 'number' ? { sig: data.energy.sig, at: data.energy.at } : null;
    return {
      states,
      unprompted: Array.isArray(data?.unprompted) ? data.unprompted.filter(x => typeof x === 'string').slice(-60) : [],
      learnedIds: Array.isArray(data?.learnedIds) ? data.learnedIds.filter(x => typeof x === 'string').slice(-60) : [],
      energy,
      directed: typeof data?.directed === 'string' ? data.directed : '',
    };
  } catch {
    return { states: {}, unprompted: [], learnedIds: [], energy: null, directed: '' };
  }
}

function readUrgeSettings(key: string | undefined): UrgeSettings {
  if (!key) return DEFAULT_URGE_SETTINGS;
  try {
    const raw = getScopedItem(key);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object') return DEFAULT_URGE_SETTINGS;
    return {
      enabled: (data as UrgeSettings).enabled !== false,
      perNpc: typeof (data as UrgeSettings).perNpc === 'object' && (data as UrgeSettings).perNpc ? (data as UrgeSettings).perNpc : {},
      learned: typeof (data as UrgeSettings).learned === 'object' && (data as UrgeSettings).learned ? (data as UrgeSettings).learned : {},
      judge: (data as UrgeSettings).judge !== false,
      huddles: (data as UrgeSettings).huddles !== false,
    };
  } catch {
    return DEFAULT_URGE_SETTINGS;
  }
}

/** Keys of NPCs named in a DM post, capped. Pure, for tests. */
export function stageFromStory(text: string, roster: RosterEntry[]): string[] {
  if (!text) return [];
  const alive = roster.filter(e => e.status !== 'dead' && e.status !== 'hidden');
  return Array.from(new Set(matchNames(text, rosterNameEntries(alive)))).slice(0, MAX_STAGE);
}

/** One table line as an NPC hears it: "Name: words", or null when it has no words. Pure, for tests. */
export function heardLine(m: Pick<RoundChatMessage, 'content' | 'character_name' | 'npc_id' | 'in_character'>): string | null {
  const body = stripActionCard(parseReply(m.content || '').body).trim();
  const text = (m.npc_id ? npcLineForDm(body) : body).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const name = (m.character_name || 'Rider').trim();
  const said = text.length > LINE_CHARS ? `${text.slice(0, LINE_CHARS)}…` : text;
  return m.in_character ? `${name}: ${said}` : `${name} (out of character, the characters don't hear this): ${said}`;
}

/** What an NPC heard at the table before answering, oldest first, newest kept when it's too long. Pure, for tests. */
export function tableHeard(lines: Array<Pick<RoundChatMessage, 'id' | 'content' | 'character_name' | 'npc_id' | 'in_character'>>, excludeId?: string, listenerKey?: string): string {
  const out: string[] = [];
  let size = 0;
  // A whisper reaches only the rider and the NPC who whispered it.
  const recent = lines.filter(l => l.id !== excludeId && !(listenerKey !== undefined && isWhisper(l) && l.npc_id !== listenerKey)).slice(-TABLE_HEARD_LINES);
  for (let i = recent.length - 1; i >= 0; i--) {
    const h = heardLine(recent[i]);
    if (!h) continue;
    if (size + h.length > TABLE_HEARD_CHARS) break;
    out.unshift(h);
    size += h.length + 1;
  }
  return out.join('\n');
}

/** The roster as the Live Table lists it: canon characters carry their built-in portrait (People shows the same one). Pure, for tests. */
export function tableNpcsFor(roster: RosterEntry[], stage: string[]) {
  return roster
    .filter(e => e.status !== 'hidden')
    .map(e => ({ id: e.key, name: e.name, portrait_url: castPortrait(e.key) ?? null, on_stage: stage.includes(e.key) && e.status !== 'dead', archived: false }));
}

export function useSoloLiveTable({ userId, riderName, npcs, latestDmText, voiceNPC, sendToDm, busy, storageKey, characterContext, check, paused = false, judge = askJudge, huddleTimeScale = 1, sparAvailable = false, travelPlaces, traveling = false }: {
  userId: string | undefined;
  riderName: string;
  npcs: SoloNpcs;
  latestDmText: string;
  voiceNPC: VoiceFn;
  /** Hands the sealed lines to the DM. Resolves true only when the DM replied. */
  sendToDm: (prompt: string, liveTable: SoloLiveTableContext) => Promise<boolean>;
  /** The story screen is busy (the DM, or an NPC, is writing). */
  busy: boolean;
  /** Where this campaign's table is kept on the phone. */
  storageKey?: string;
  characterContext?: CharacterContext;
  check?: (input: { d20: number; modifier: number; dc: number | null; risk: ReturnType<typeof checkRisk>; label: string }) => Promise<RulesCheck | null>;
  /** Freezes the urge meter (a fight is open, say). */
  paused?: boolean;
  /** The AI judge (tests pass their own). */
  judge?: (ask: JudgeAsk) => Promise<JudgedLine | null>;
  /** Shrinks the pauses between huddle lines (tests). */
  huddleTimeScale?: number;
  /** The screen can open a bout with an NPC (the rules engine is on): an NPC may square up. */
  sparAvailable?: boolean;
  /** Places a trip can start for right now (from the map): an NPC may propose going to one with the rider. */
  travelPlaces?: string[];
  /** A journey is under way. */
  traveling?: boolean;
}) {
  const chat = useArenaRoundChat(userId, riderName, 'solo-live-table', storageKey);
  const me = userId || 'arena-player';
  const [called, setCalled] = useState<string[]>([]);
  // NPCs who walked out since the DM's last post (an action of theirs): off stage until the story or the rider brings them back.
  const [left, setLeft] = useState<string[]>([]);
  const leftRef = useRef(left);
  leftRef.current = left;
  /** An NPC squared up to the rider: a bout is on offer. */
  const [challenge, setChallenge] = useState<{ key: string; name: string } | null>(null);
  const challengeRef = useRef(challenge);
  challengeRef.current = challenge;
  const clearChallenge = useCallback(() => setChallenge(null), []);
  const sparAvailableRef = useRef(sparAvailable);
  sparAvailableRef.current = sparAvailable;
  /** An NPC proposed going somewhere with the rider. */
  const [travelOffer, setTravelOffer] = useState<{ key: string; name: string; place: string } | null>(null);
  const travelOfferRef = useRef(travelOffer);
  travelOfferRef.current = travelOffer;
  const clearTravelOffer = useCallback(() => setTravelOffer(null), []);
  const travelPlacesRef = useRef<string[]>([]);
  travelPlacesRef.current = travelPlaces ?? [];
  const travelingRef = useRef(traveling);
  travelingRef.current = traveling;
  const latestDmRef = useRef(latestDmText);
  latestDmRef.current = latestDmText;
  // NPCs who set out with the rider: on stage through the trip and the first DM post after it; then the story decides.
  const [companions, setCompanionKeys] = useState<string[]>([]);
  const companionPostsRef = useRef({ sig: '', posts: 0 });
  const setCompanions = useCallback((keys: string[]) => {
    companionPostsRef.current = { sig: latestDmRef.current, posts: 0 };
    setCompanionKeys(Array.from(new Set(keys)).slice(0, MAX_STAGE));
  }, []);
  useEffect(() => {
    if (busy || travelingRef.current || companionPostsRef.current.sig === latestDmText) return;
    companionPostsRef.current = { sig: latestDmText, posts: companionPostsRef.current.posts + 1 };
    if (companionPostsRef.current.posts >= 2) setCompanionKeys(prev => (prev.length ? [] : prev));
  }, [busy, latestDmText]);
  const [thinking, setThinking] = useState<Array<{ key: string; npcId: string; name: string; messageId: string; kind: 'answer' | 'banter' }>>([]);
  const [dmSending, setDmSending] = useState(false);
  const [sceneRunning, setSceneRunning] = useState(false);

  // Latest values for async work (an answer can wait a while in the queue).
  const voiceRef = useRef(voiceNPC);
  voiceRef.current = voiceNPC;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const linesRef = useRef(chat.messages);
  linesRef.current = chat.messages;
  const npcsRef = useRef(npcs);
  npcsRef.current = npcs;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const judgeRef = useRef(judge);
  judgeRef.current = judge;
  const sceneRunningRef = useRef(sceneRunning);
  sceneRunningRef.current = sceneRunning;
  const dmSendingRef = useRef(false);

  // The DM's hidden directions. Its STAGE list decides who is here; without one, the names in the post do.
  const directions = useMemo(() => parseDirections(latestDmText), [latestDmText]);
  const storyStage = useMemo(
    () => stageFromStory(directions.stage ? directions.stage.join('; ') : stripLiveTags(latestDmText), npcs.roster),
    [directions, latestDmText, npcs.roster],
  );
  // A new DM post resets who the rider called over; the post decides who is still here.
  useEffect(() => { setCalled([]); setLeft([]); setChallenge(null); setTravelOffer(null); }, [latestDmText]);
  const stage = useMemo(() => Array.from(new Set([...storyStage, ...called, ...companions])).filter(k => !left.includes(k)).slice(0, MAX_STAGE), [storyStage, called, left, companions]);

  const tableNpcs = useMemo(() => tableNpcsFor(npcs.roster, stage), [npcs.roster, stage]);

  const callOver = useCallback((key: string) => {
    setCalled(prev => (prev.includes(key) ? prev : [...prev, key].slice(-MAX_STAGE)));
    setLeft(prev => prev.filter(k => k !== key));
  }, []);

  const mindFor = useCallback((e: RosterEntry) => npcVoiceContext(e.mind, riderName || 'the rider', e.attitude, e.memories, CANON_ERA_LABELS[npcs.era]), [riderName, npcs.era]);

  /** Waits until the story screen is free (the DM or another answer is writing). False if it never frees up. */
  const waitUntilFree = useCallback(async () => {
    const start = Date.now();
    while (busyRef.current) {
      if (Date.now() - start > WAIT_FOR_DM_MS) return false;
      await new Promise(r => setTimeout(r, 250));
    }
    return true;
  }, []);

  // Every NPC call runs one after another, in the order asked.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(job, job);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  /** One NPC speaks. Resolves to the new line (id and words), or null when it said nothing.
   *  unprompted (urge meter): no roll or join controls, and the cheap urge model. */
  const deliveryForRef = useRef<(e: RosterEntry, o: { whisper: boolean; insight: boolean; moment: SpeakMoment }) => string>(() => '');
  const afterTurnRef = useRef<(e: RosterEntry, lineId: string, shown: string, note: MindNote | null, action: NpcAction | null) => void>(() => {});
  /** The shape each NPC's turn in flight was asked for (set when its delivery is built, read when its reply lands). */
  const plannedShapeRef = useRef<Record<string, TurnShape>>({});
  const speak = useCallback(async (e: RosterEntry, said: string, mindExtra: string, kind: 'answer' | 'banter', replyToId: string | null, social?: SocialCheckResult, unprompted = false, whisper = false, moment: SpeakMoment = {}) => {
    const t = { key: `${replyToId || 'scene'}:${e.key}:${Date.now()}`, npcId: e.key, name: e.name, messageId: replyToId || '', kind };
    setThinking(prev => [...prev, t]);
    try {
      if (!(await waitUntilFree())) {
        toast.error(`${e.name} didn't answer`, { description: 'The DM is still writing. Try again in a moment.' });
        return null;
      }
      const controls = unprompted ? undefined : `

SOLO TABLE CONTROLS: Only when this beat genuinely calls for a rider roll, append ⟪ROLL⟫{"to":${JSON.stringify(me)},"name":${JSON.stringify(riderName)},"check":"Insight","save":false,"dc":12}⟪/ROLL⟫, using the appropriate existing skill, save and difficulty. Only if you willingly offer to accompany the rider, append ⟪JOIN⟫{"to":${JSON.stringify(me)},"name":${JSON.stringify(riderName)}}⟪/JOIN⟫. These optional control markers follow the dialogue; never add one merely because controls exist.`;
      const reply = await voiceRef.current(e.name, said, social ? {
        skill: social.skill, opposingSkillLabel: social.opposingSkillLabel, playerTotal: social.playerRoll.total,
        npcTotal: social.npcRoll.total, outcome: social.outcome, rollBlockText: social.rollBlockText,
      } : undefined, `${mindFor(e)}\n\n${mindExtra}`, true, controls, unprompted && !moment.keyLine ? URGE_LINE_MODEL : undefined,
      deliveryForRef.current(e, { whisper, insight: social?.skill === 'insight' && social.outcome === 'success', moment }));
      // The private note and any action are taken out here: they are never shown or sent to the DM as words.
      const turn = readTurn(reply || '', Date.now());
      // The table already names the speaker; a turn that badly overshoots the shape it was asked for is trimmed at a sentence end.
      const text = fitToShape(stripSpeaker(turn.text), plannedShapeRef.current[e.key]);
      if (!text) {
        toast.error(`${e.name} didn't answer`, { description: 'Try again in a moment.' });
        return null;
      }
      const content = formatReply(replyToId, whisper ? `${WHISPER_MARK} ${text}` : text);
      const id = chat.appendLine({ content, characterName: e.name, npcId: e.key, userId: `npc:${e.key}` });
      // The next NPC in the queue may speak before the screen re-renders: let it hear this line now.
      linesRef.current = [...linesRef.current, {
        id, party_id: 'arena-practice', user_id: `npc:${e.key}`, character_name: e.name, content, in_character: true,
        round_id: 'solo-live-table', consumed: false, selected: false, created_at: new Date().toISOString(), npc_id: e.key,
      }];
      afterTurnRef.current(e, id, text, turn.note, turn.action);
      return { id, text };
    } finally {
      setThinking(prev => prev.filter(x => x.key !== t.key));
    }
  }, [chat, mindFor, waitUntilFree, me, riderName]);

  // ── Urge meter (D-40) ──
  const urgeKey = storageKey ? `${storageKey}:urge` : undefined;
  const [urgeSettings, setUrgeSettings] = useState<UrgeSettings>(() => readUrgeSettings(urgeKey));
  const urgeSettingsRef = useRef(urgeSettings);
  urgeSettingsRef.current = urgeSettings;
  // Another campaign = its own switches.
  const urgeKeyRef = useRef(urgeKey);
  useEffect(() => {
    if (urgeKeyRef.current === urgeKey) return;
    urgeKeyRef.current = urgeKey;
    setUrgeSettings(readUrgeSettings(urgeKey));
  }, [urgeKey]);
  const saveUrgeSettings = useCallback((next: UrgeSettings) => {
    setUrgeSettings(next);
    if (urgeKey) { try { setScopedItem(urgeKey, JSON.stringify(next)); } catch { /* best effort */ } }
  }, [urgeKey]);
  const setUrgeEnabled = useCallback((enabled: boolean) => {
    saveUrgeSettings({ ...urgeSettingsRef.current, enabled });
    if (!enabled) endHuddleRef.current('interrupted');
  }, [saveUrgeSettings]);
  const setNpcTalkativeness = useCallback((key: string, talk: Talkativeness) => {
    saveUrgeSettings({ ...urgeSettingsRef.current, perNpc: { ...urgeSettingsRef.current.perNpc, [key]: talk } });
  }, [saveUrgeSettings]);
  const setJudgeEnabled = useCallback((on: boolean) => saveUrgeSettings({ ...urgeSettingsRef.current, judge: on }), [saveUrgeSettings]);
  const setHuddlesEnabled = useCallback((on: boolean) => {
    saveUrgeSettings({ ...urgeSettingsRef.current, huddles: on });
    if (!on) endHuddleRef.current('interrupted');
  }, [saveUrgeSettings]);
  const talkFor = useCallback((key: string): Talkativeness => urgeSettingsRef.current.perNpc[key] ?? 'normal', []);
  /** The rider liked (sealed) or disliked (deleted, hushed) an unprompted line: that NPC's bar moves. */
  const learn = useCallback((key: string, liked: boolean) => {
    const cur = urgeSettingsRef.current;
    const next = { ...cur, learned: { ...cur.learned, [key]: learnTaste(cur.learned[key], liked) } };
    urgeSettingsRef.current = next;
    saveUrgeSettings(next);
  }, [saveUrgeSettings]);

  // The drawer reports open/closed; the meter only wakes anyone while the table is open.
  const tableOpenRef = useRef(false);
  const endHuddleRef = useRef<(end: HuddleEnd) => void>(() => {});
  const partingLineRef = useRef<(key: string, h: Huddle) => void>(() => {});
  const applyDirectionsRef = useRef<() => void>(() => {});
  const setTableOpen = useCallback((open: boolean) => {
    tableOpenRef.current = open;
    if (!open) endHuddleRef.current('interrupted');
    else applyDirectionsRef.current();
  }, []);
  // The drawer reports typing: a huddle waits for the rider to finish their line.
  const typingRef = useRef({ since: 0, last: 0 });
  const setTyping = useCallback((typing: boolean) => {
    const now = Date.now();
    typingRef.current = typing ? { since: typingRef.current.since || now, last: now } : { since: 0, last: 0 };
  }, []);

  const urgeRef = useRef<Record<string, NpcUrgeState>>({});
  // Kept on the phone per campaign: meter levels (they fade while away) and which lines were unprompted.
  const levelsKey = storageKey ? `${storageKey}:urge-levels` : undefined;
  const levelsKeyRef = useRef(levelsKey);
  const savedLevelsRef = useRef<Record<string, NpcUrgeState>>({});
  const unpromptedIdsRef = useRef<Set<string>>(new Set());
  // Unprompted lines as last seen on the table (sealed or not), and the ones already learned from.
  const seenUnpromptedRef = useRef<Map<string, { selected: boolean; npc: string }>>(new Map());
  const learnedIdsRef = useRef<Set<string>>(new Set());
  // The latest DM post's energy, and when it arrived (kept, so reopening the app does not restart the clock).
  const energyRef = useRef<{ energy: ReturnType<typeof tableEnergy>; at: number; sig: string }>({ energy: 'normal', at: 0, sig: '' });
  const savedEnergyRef = useRef<{ sig: string; at: number } | null>(null);
  // DM directions: the post whose cue and huddle already ran, and the ones waiting for the table to open.
  const directedSigRef = useRef('');
  const pendingDirectionsRef = useRef<{ sig: string; d: DmDirections } | null>(null);
  /** The huddle that just ended, for the next hand-off's note to the DM. */
  const lastHuddleReportRef = useRef<TableStateInput['lastHuddle']>(null);
  const levelsLoadedRef = useRef(false);
  if (!levelsLoadedRef.current || levelsKeyRef.current !== levelsKey) {
    const loaded = readUrgeLevels(levelsKey);
    savedLevelsRef.current = loaded.states;
    unpromptedIdsRef.current = new Set(loaded.unprompted);
    learnedIdsRef.current = new Set(loaded.learnedIds);
    savedEnergyRef.current = loaded.energy;
    directedSigRef.current = loaded.directed;
    pendingDirectionsRef.current = null;
    if (levelsLoadedRef.current) urgeRef.current = {};
    levelsLoadedRef.current = true;
    levelsKeyRef.current = levelsKey;
  }
  const saveLevels = useCallback(() => {
    const now = Date.now();
    const merged: Record<string, NpcUrgeState> = {};
    // NPCs long gone from the stage are dropped here, not only on the next load.
    for (const [k, v] of Object.entries({ ...savedLevelsRef.current, ...urgeRef.current })) {
      if (urgeRef.current[k] || now - v.at < LEVELS_MAX_AGE_MS) merged[k] = v;
    }
    savedLevelsRef.current = merged;
    const key = levelsKeyRef.current;
    if (!key) return;
    try {
      setScopedItem(key, JSON.stringify({
        states: merged,
        unprompted: Array.from(unpromptedIdsRef.current).slice(-60),
        learnedIds: Array.from(learnedIdsRef.current).slice(-60),
        energy: energyRef.current.sig ? { sig: energyRef.current.sig, at: energyRef.current.at } : null,
        directed: directedSigRef.current,
      }));
    } catch { /* best effort */ }
  }, []);
  // An NPC's open question to the rider, and how many rider lines have passed it by.
  const questionsRef = useRef<Record<string, { at: number; missed: number }>>({});
  useEffect(() => {
    const sig = energySig(latestDmText);
    const saved = savedEnergyRef.current;
    // The DM's ROOM direction wins; without one the words of the post decide.
    energyRef.current = { energy: directions.room ?? tableEnergy(stripLiveTags(latestDmText)), at: saved && saved.sig === sig ? saved.at : Date.now(), sig };
    savedEnergyRef.current = null;
  }, [latestDmText, directions]);
  // A memory that just triggered rests a while before it can trigger again (per NPC).
  const usedMemoriesRef = useRef<Record<string, Record<string, number>>>({});
  const lastJudgeAtRef = useRef(0);
  const memoryFor = useCallback((key: string, text: string, memories: string[], names: string[], now: number): string | null => {
    const hit = memoryMatch(text, memories, [...names, riderName]);
    if (!hit) return null;
    const used = usedMemoriesRef.current[key] ?? {};
    if (now - (used[hit.memory] ?? 0) < URGE_TIER3.memoryRestMs) return null;
    usedMemoriesRef.current[key] = { ...used, [hit.memory]: now };
    return hit.memory;
  }, [riderName]);

  // ── Huddles ──
  const huddleKey = storageKey ? `${storageKey}:huddle` : undefined;
  const huddleKeyRef = useRef<string | undefined>(undefined);
  const tasteRef = useRef<HuddleTaste>(freshTaste());
  const tasteLoadedRef = useRef(false);
  if (!tasteLoadedRef.current || huddleKeyRef.current !== huddleKey) {
    let raw: unknown = null;
    try { raw = huddleKey ? JSON.parse(getScopedItem(huddleKey) || 'null') : null; } catch { raw = null; }
    tasteRef.current = readTaste(raw);
    tasteLoadedRef.current = true;
    huddleKeyRef.current = huddleKey;
  }
  const saveTaste = useCallback((next: HuddleTaste) => {
    tasteRef.current = next;
    const key = huddleKeyRef.current;
    if (key) { try { setScopedItem(key, JSON.stringify(next)); } catch { /* best effort */ } }
  }, []);
  const huddleRef = useRef<Huddle | null>(null);
  const pressureRef = useRef<Record<string, PairPressure>>({});
  const lastHuddleAtRef = useRef(0);
  const huddleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const huddleSeqRef = useRef(0);
  /** The last line in the huddle (an NPC's or the rider's), and when it landed. */
  const huddleLastRef = useRef<{ id: string | null; name: string; text: string; at: number; byRider: boolean } | null>(null);
  /** Every line of the current or last huddle, for "Seal this conversation". */
  const huddleLinesRef = useRef<{ id: string; pair: [string, string]; ids: string[]; liked: boolean } | null>(null);
  const [huddleInfo, setHuddleInfo] = useState<{ active: boolean; names: string[]; heat: number; ids: string[] } | null>(null);
  const showHuddle = useCallback(() => {
    const h = huddleRef.current;
    const lines = huddleLinesRef.current;
    if (!h && !lines) { setHuddleInfo(null); return; }
    const names = (h ? h.members : lines ? [...lines.pair] : []).map(k => npcsRef.current.entry(k)?.name.trim().split(/\s+/)[0] || k);
    setHuddleInfo({ active: !!h, names, heat: h?.heat ?? 0, ids: lines ? [...lines.ids] : [] });
  }, []);
  /** Learned taste × rank × table energy: what multiplies this NPC's threshold right now. */
  const scaleFor = useCallback((key: string, now: number): number => {
    const roster = npcsRef.current;
    const own = roster.entry(key);
    const others = Object.keys(urgeRef.current)
      .filter(k => k !== key)
      .map(k => roster.entry(k))
      .filter((e): e is RosterEntry => !!e && e.status !== 'dead')
      .map(e => rankFromRole(e.mind.role, e.name));
    return (urgeSettingsRef.current.learned[key] ?? 1)
      * rankScale(rankFromRole(own?.mind.role, own?.name), others)
      * energyScale(energyRef.current.energy, now - energyRef.current.at);
  }, []);
  /** An NPC as the huddle rules see it. */
  const huddleNpc = useCallback((key: string): HuddleNpc | null => {
    const e = npcsRef.current.entry(key);
    return e && e.status !== 'dead' ? { key, name: e.name, temperament: temperamentFor(key), attitude: e.attitude } : null;
  }, []);
  /** Someone of higher rank than this NPC is on stage. */
  const outranked = useCallback((key: string): boolean => {
    const roster = npcsRef.current;
    const own = roster.entry(key);
    const others = Object.keys(urgeRef.current).filter(k => k !== key).map(k => roster.entry(k))
      .filter((e): e is RosterEntry => !!e && e.status !== 'dead').map(e => rankFromRole(e.mind.role, e.name));
    return rankScale(rankFromRole(own?.mind.role, own?.name), others) > 1;
  }, []);
  const [tells, setTells] = useState<Record<string, string>>({});
  const lastRiderLineRef = useRef('');
  const lastTickWakeRef = useRef(0);
  const lastTickAtRef = useRef(Date.now());
  const idleAccumRef = useRef(0);
  const silenceStepsCountedRef = useRef(0);

  /** Every name an NPC answers to, for the engine's matching. */
  const namesByKey = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const en of rosterNameEntries(npcs.roster)) map[en.key] = en.names;
    return map;
  }, [npcs.roster]);
  const namesByKeyRef = useRef(namesByKey);
  namesByKeyRef.current = namesByKey;

  /** Who's near or over the line right now (id → the strongest reason). */
  const refreshTells = useCallback(() => {
    const now = Date.now();
    const out: Record<string, string> = {};
    if (urgeSettingsRef.current.enabled && !pausedRef.current) {
      for (const [key, s] of Object.entries(urgeRef.current)) {
        const e = npcsRef.current.entry(key);
        if (!e || e.status === 'dead') continue;
        if (urgeStanding(s, temperamentFor(key), talkFor(key), now, scaleFor(key, now))) {
          out[key] = s.reasons[0]?.text || 'something is on their mind';
        }
      }
    }
    saveLevels();
    setTells(prev => {
      const keys = Object.keys(out);
      if (keys.length === Object.keys(prev).length && keys.every(k => prev[k] === out[k])) return prev;
      return out;
    });
  }, [talkFor, scaleFor, saveLevels]);

  // Stage changes: new arrivals start cold (their entry time starts the cooldown); leavers are dropped.
  useEffect(() => {
    const now = Date.now();
    const next: Record<string, NpcUrgeState> = {};
    for (const key of stage) next[key] = urgeRef.current[key] ?? savedLevelsRef.current[key] ?? freshUrge(now);
    urgeRef.current = next;
    // A huddle member the story moved away leaves it; with fewer than two it ends.
    const h = huddleRef.current;
    if (h) {
      let left: Huddle | null = h;
      const gone = h.members.filter(key => !stage.includes(key));
      for (const key of gone) if (left) left = leaveHuddle(left, key);
      if (gone.length && h.npcLines > 0) partingLineRef.current(gone[0], h);
      if (!left) endHuddleRef.current('interrupted');
      else if (left !== h) { huddleRef.current = left; showHuddle(); }
    }
    refreshTells();
  }, [stage, refreshTells, showHuddle]);

  // processHeardLine and speakUnprompted call each other (a wake makes a line, a line can wake
  // one reaction), so each reaches the other through a ref.
  const speakUnpromptedRef = useRef<(key: string, triggerText: string, allowReaction: boolean) => void>(() => {});
  const processHeardLineRef = useRef<(text: string, speaker: 'rider' | 'npc', speakerKey: string | undefined, speakerName: string | undefined, addressed: string[], maxWakes: number, lineId?: string | null) => void>(() => {});
  const scheduleHuddleTurnRef = useRef<(ms: number) => void>(() => {});
  const startHuddleRef = useRef<(pair: [string, string], kind: Huddle['kind'], about: string) => boolean>(() => false);

  /** Score a heard line for everyone on stage; maybe wake somebody (capped). */
  const processHeardLine = useCallback((text: string, speaker: 'rider' | 'npc', speakerKey: string | undefined, speakerName: string | undefined, addressed: string[], maxWakes: number, lineId?: string | null) => {
    // Any line breaks the silence, even while the meter is off or frozen.
    idleAccumRef.current = 0;
    silenceStepsCountedRef.current = 0;
    if (!urgeSettingsRef.current.enabled || pausedRef.current || sceneRunningRef.current) return;
    const now = Date.now();
    const era = npcsRef.current.era;
    // The most the word lists made of this line for anyone (a bare name, or being passed by, does not count).
    let bestListPts = 0;
    for (const [key, s] of Object.entries(urgeRef.current)) {
      const e = npcsRef.current.entry(key);
      if (!e || e.status === 'dead') continue;
      const names = namesByKeyRef.current[key] ?? [e.name];
      const reasons = scoreLine({
        text, speaker, speakerKey, speakerName, era,
        npc: { key, name: e.name, aliases: names },
        temperament: temperamentFor(key),
        addressed: addressed.includes(key),
      });
      bestListPts = Math.max(bestListPts, reasons.filter(r => !PLAIN_REASONS.has(r.text)).reduce((sum, r) => sum + r.pts, 0));
      // Something they remember about the rider (free word match; the judge can find subtler ones).
      if (speaker === 'rider' && !addressed.includes(key)) {
        const memory = memoryFor(key, text, e.memories, names, now);
        if (memory) { reasons.push(memoryReason(memory)); bestListPts = Math.max(bestListPts, URGE_TIER3.memoryPts); }
      }
      if (speaker === 'rider' && !addressed.includes(key) && key !== speakerKey) {
        const bonus = spotlightBonus(s, now);
        if (bonus) reasons.push({ pts: bonus, text: 'you have been quiet a long while' });
      }
      // A question this NPC put to the rider: answered (addressed or named) clears it; passed by, it pushes.
      const asked = questionsRef.current[key];
      if (speaker === 'rider' && asked) {
        if (addressed.includes(key) || mentionsAny(text, names) || now - asked.at > URGE_TUNING.questionExpiresMs) {
          delete questionsRef.current[key];
        } else {
          asked.missed += 1;
          reasons.push(...ignoredQuestionReasons(asked.missed));
        }
      }
      if (reasons.length) urgeRef.current[key] = addReasons(s, reasons, now);
    }

    const huddle = huddleRef.current;
    const open = tableOpenRef.current;
    let woken = 0;
    /** Wake whoever is ready (capped). In a huddle its members never wake: a whisperer may still whisper, anyone else steps into the huddle. */
    const wake = (budget: number) => {
      if (budget <= 0 || !tableOpenRef.current) return;
      const h = huddleRef.current;
      const candidates = Object.entries(urgeRef.current)
        .filter(([key]) => !addressed.includes(key) && key !== speakerKey && !(h && h.members.includes(key)))
        .map(([key, state]) => ({ key, state, temperament: temperamentFor(key), talk: talkFor(key), scale: scaleFor(key, now) }));
      for (const key of pickWakes(candidates, now, budget)) {
        woken += 1;
        const joiner = h && temperamentFor(key).intent !== 'whisper' ? huddleNpc(key) : null;
        if (h && joiner) {
          if (h.members.length < HUDDLE_RULES.maxMembers) { huddleRef.current = joinHuddle(huddleRef.current ?? h, joiner); showHuddle(); }
        } else {
          speakUnpromptedRef.current(key, text, speaker === 'rider' && !h);
        }
      }
    };

    if (huddle && speaker === 'rider') {
      // The rider cut in: they are a third voice, and whoever they named answers first.
      const named = huddle.members.filter(k => addressed.includes(k) || mentionsAny(text, namesByKeyRef.current[k] ?? []));
      const last = huddleLastRef.current;
      if (last && !last.byRider) saveTaste(learnPace(tasteRef.current, now - last.at));
      huddleRef.current = afterRiderLine(huddle, { named });
      huddleLastRef.current = { id: lineId ?? null, name: riderName || 'The rider', text, at: now, byRider: true };
      if (lineId && huddleLinesRef.current) huddleLinesRef.current.ids.push(lineId);
      showHuddle();
      // A Talk-to answer is already on its way from that member; otherwise the huddle answers.
      if (!huddle.members.some(k => addressed.includes(k))) scheduleHuddleTurnRef.current(HUDDLE_RULES.afterRiderMs);
    } else if (!huddle && open && urgeSettingsRef.current.huddles !== false && !dmSendingRef.current) {
      // Sparks: this line may push a pair into talking among themselves.
      const stageNpcs = Object.keys(urgeRef.current)
        .filter(k => talkFor(k) !== 'spoken-to')
        .map(k => huddleNpc(k)).filter((n): n is HuddleNpc => !!n);
      pressureRef.current = addPressure(pressureRef.current, { text, speaker, speakerKey, stage: stageNpcs, era, now }, tasteRef.current);
      const tense = energyScale(energyRef.current.energy, now - energyRef.current.at) < 1;
      const spark = maxWakes > 0 || speaker === 'npc' ? readySpark(pressureRef.current, tasteRef.current, { now, lastHuddleAt: lastHuddleAtRef.current, tense }) : null;
      if (spark && startHuddleRef.current(spark.pair, spark.kind, spark.about)) {
        refreshTells();
        return;
      }
    }

    wake(maxWakes);

    // The judge: lines the lists made little of, and every line the rider throws into a huddle.
    const inHuddle = !!huddleRef.current && speaker === 'rider';
    const stageNames = Object.keys(urgeRef.current).flatMap(k => namesByKeyRef.current[k] ?? []);
    const judgeDue = inHuddle || (now - lastJudgeAtRef.current >= URGE_TIER3.judgeGapMs && needsJudge(text, bestListPts, stageNames));
    if (speaker === 'rider' && urgeSettingsRef.current.judge !== false && open && judgeDue) {
      lastJudgeAtRef.current = now;
      const keys = (inHuddle && huddleRef.current ? huddleRef.current.members : Object.keys(urgeRef.current)).filter(k => !addressed.includes(k) || inHuddle);
      const asked = keys.map(k => npcsRef.current.entry(k)).filter((e): e is RosterEntry => !!e && e.status !== 'dead').slice(0, 8);
      const huddleId = huddleRef.current?.id ?? null;
      if (asked.length) {
        const memoriesByKey: Record<string, string[]> = {};
        for (const e of asked) memoriesByKey[e.key] = e.memories.slice(-8);
        void judgeRef.current({
          riderName: riderName || 'the rider', line: text.slice(0, 600), heard: tableHeard(linesRef.current, lineId ?? undefined).slice(-1500), huddle: inHuddle,
          npcs: asked.map(e => ({ key: e.key, name: e.name, personality: e.mind.personality, attitude: e.attitude, memories: memoriesByKey[e.key] })),
        }).then(judged => {
          if (!judged || !urgeSettingsRef.current.enabled || urgeSettingsRef.current.judge === false || pausedRef.current) return;
          const at = Date.now();
          for (const item of judged.items) {
            const s = urgeRef.current[item.key];
            if (!s || addressed.includes(item.key)) continue;
            const r = judgeReasons(item, temperamentFor(item.key), memoriesByKey[item.key] ?? []);
            if (r.length) urgeRef.current[item.key] = addReasons(s, r, at);
          }
          const h = huddleRef.current;
          if (h && h.id === huddleId) {
            huddleRef.current = applyRead(h, { sidesWith: judged.sidesWith, tone: judged.tone });
            showHuddle();
          } else if (!h && !huddleId) {
            wake(maxWakes - woken);
          }
          refreshTells();
        }).catch(() => undefined);
      }
    }
    refreshTells();
  }, [refreshTells, talkFor, scaleFor, memoryFor, huddleNpc, showHuddle, saveTaste, riderName]);
  processHeardLineRef.current = processHeardLine;

  /** An NPC speaks on its own (a wake, or the rider tapping the tell). Runs in the same queue as answers. */
  const speakUnprompted = useCallback((key: string, triggerText: string, allowReaction: boolean) => enqueue(async () => {
    if (!urgeSettingsRef.current.enabled || pausedRef.current || sceneRunningRef.current) return null;
    const e = npcsRef.current.entry(key);
    if (!e || e.status === 'dead') return null;
    const s = urgeRef.current[key] ?? freshUrge(Date.now());
    const whisper = temperamentFor(key).intent === 'whisper';
    const heard = tableHeard(linesRef.current, undefined, key);
    const extra = [
      heard ? `## AT THE TABLE JUST NOW (oldest first; everyone here heard it)\n${heard}` : '',
      whyBlock(e.name, riderName || 'the rider', s, temperamentFor(key).intent),
    ].filter(Boolean).join('\n\n');
    const bar = effectiveThreshold(temperamentFor(key), talkFor(key), scaleFor(key, Date.now())) ?? URGE_RULES.threshold;
    const moment: SpeakMoment = { stir: s.urge / bar, keyLine: isKeyLine({ reasons: s.reasons.map(r => r.text) }) };
    urgeRef.current = { ...urgeRef.current, [key]: resetUrge(s, Date.now()) };
    refreshTells();
    const spoken = await speak(e, triggerText.trim() || 'The scene carries on around you.', extra, 'answer', null, undefined, true, whisper, moment);
    if (spoken) {
      unpromptedIdsRef.current.add(spoken.id);
      seenUnpromptedRef.current.set(spoken.id, { selected: false, npc: key });
      if (asksQuestion(npcLineForDm(spoken.text))) questionsRef.current[key] = { at: Date.now(), missed: 0 };
      // An unprompted line may wake one reaction; a reaction wakes nobody (no chains). Nobody reacts to a whisper.
      if (!whisper) processHeardLineRef.current(spoken.text, 'npc', key, e.name, [], allowReaction ? URGE_RULES.maxReactionWakes : 0);
      saveLevels();
    }
    return spoken;
  }), [enqueue, riderName, speak, refreshTells, saveLevels, scaleFor, talkFor]);
  useEffect(() => { speakUnpromptedRef.current = (k, t, a) => { void speakUnprompted(k, t, a); }; }, [speakUnprompted]);

  // ── Delivery: voice, mood, the private note, sameness, and actions ──
  /** Recent lines as measured (length, where the movement sat, which parts of the body). */
  const shapeHistoryRef = useRef<LineShape[]>([]);
  const mindsKey = storageKey ? `${storageKey}:minds` : undefined;
  const mindsKeyRef = useRef<string | undefined>(undefined);
  const mindsRef = useRef<Record<string, MindNote>>({});
  const mindsLoadedRef = useRef(false);
  if (!mindsLoadedRef.current || mindsKeyRef.current !== mindsKey) {
    let raw: unknown = null;
    try { raw = mindsKey ? JSON.parse(getScopedItem(mindsKey) || 'null') : null; } catch { raw = null; }
    mindsRef.current = readNotes(raw, Date.now());
    mindsLoadedRef.current = true;
    mindsKeyRef.current = mindsKey;
    // The measured shapes of recent lines are kept with the notes, so variety carries across a reload.
    let savedShapes: unknown = null;
    try { savedShapes = mindsKey ? JSON.parse(getScopedItem(`${mindsKey}:shapes`) || 'null') : null; } catch { savedShapes = null; }
    shapeHistoryRef.current = readShapes(savedShapes);
  }
  /** Scene-changing things NPCs did, by the line they happened in (reported to the DM when that line is sealed). */
  const actionLogRef = useRef<Array<{ lineId: string; text: string }>>([]);
  useEffect(() => { actionLogRef.current = []; }, [latestDmText]);

  deliveryForRef.current = (e, o) => {
    const key = e.key;
    const now = Date.now();
    const t = temperamentFor(key);
    const h = huddleRef.current;
    const inHuddle = !!h && h.members.includes(key);
    const bar = effectiveThreshold(t, talkFor(key) === 'spoken-to' ? 'normal' : talkFor(key), scaleFor(key, now)) ?? URGE_RULES.threshold;
    const stir = o.moment.stir ?? (urgeRef.current[key]?.urge ?? 0) / bar;
    const low = outranked(key);
    const direct = !!o.moment.directQuestion;
    // The app chooses this turn's length and where its one movement goes (weighted chance, never the same three times running).
    const shape = planTurn({
      key,
      history: shapeHistoryRef.current,
      style: t.style,
      stir,
      directQuestion: direct,
      closing: !!o.moment.closing,
      whisper: o.whisper,
      riderWords: o.moment.riderWords ?? 0,
      needsRoom: o.insight || !!o.moment.keyLine,
      roll: Math.random,
    });
    plannedShapeRef.current = { ...plannedShapeRef.current, [key]: shape };
    return deliveryBlock({
      shape,
      name: e.name,
      riderName: riderName || 'the rider',
      voice: voiceFor(key, t.style),
      mood: moodFacts({ urgeRatio: stir, heat: inHuddle && h ? h.heat : null, attitude: e.attitude, style: t.style, outranked: low }, riderName || 'the rider'),
      note: mindsRef.current[key] ?? null,
      sameness: partsNote(key, shapeHistoryRef.current),
      directQuestion: direct,
      riderWords: o.moment.riderWords ?? 0,
      whisper: o.whisper,
      outranked: low,
      condition: e.status === 'knocked_out' ? 'knocked out and only just coming round' : '',
      closing: !!o.moment.closing,
      actions: {
        // Never the last one at the table, and one exit per DM post.
        leave: !direct && !o.whisper && leftRef.current.length === 0 && Object.keys(urgeRef.current).length > 1,
        between: !!h && h.members.filter(k => k !== key).length >= 2,
        squareUp: sparAvailableRef.current && !!e.fight && !challengeRef.current && !o.whisper,
        give: !o.whisper,
        // One proposal at a time, and never while a trip is already under way.
        travel: !o.whisper && !direct && !travelOfferRef.current && !travelingRef.current ? travelPlacesRef.current : [],
      },
      insight: o.insight,
    });
  };

  afterTurnRef.current = (e, lineId, shown, note, action) => {
    const key = e.key;
    if (note) {
      mindsRef.current = { ...mindsRef.current, [key]: note };
      const k = mindsKeyRef.current;
      if (k) { try { setScopedItem(k, JSON.stringify(mindsRef.current)); } catch { /* best effort */ } }
    }
    shapeHistoryRef.current = [...shapeHistoryRef.current, measureLine(key, shown)].slice(-12);
    const shapesKey = mindsKeyRef.current;
    if (shapesKey) { try { setScopedItem(`${shapesKey}:shapes`, JSON.stringify(shapeHistoryRef.current)); } catch { /* best effort */ } }
    if (!action) return;
    const rider = riderName || 'the rider';
    const log = (text: string) => { actionLogRef.current = [...actionLogRef.current, { lineId, text }].slice(-8); };
    if (action.kind === 'leave') {
      if (leftRef.current.length > 0 || Object.keys(urgeRef.current).length <= 1) return;
      leftRef.current = [key];
      setLeft([key]);
      log(`${e.name} walked out.`);
    } else if (action.kind === 'between') {
      const h = huddleRef.current;
      if (!h) return;
      const self = huddleNpc(key);
      const joined = self && !h.members.includes(key) ? joinHuddle(h, self) : h;
      huddleRef.current = { ...joined, heat: Math.max(0, joined.heat - 2), stances: { ...joined.stances, [key]: 'calming' } };
      showHuddle();
      log(`${e.name} stepped between them.`);
    } else if (action.kind === 'square-up') {
      if (!sparAvailableRef.current || !e.fight || challengeRef.current) return;
      setChallenge({ key, name: e.name });
      log(`${e.name} squared up to ${rider}: a bout on the mat is on offer.`);
    } else if (action.kind === 'travel') {
      // Only a place the map can really start a trip for; anything else is dropped.
      const wanted = action.place.toLowerCase().replace(/^the /, '');
      const place = travelPlacesRef.current.find(p => p.toLowerCase().replace(/^the /, '') === wanted);
      if (!place || travelOfferRef.current || travelingRef.current) return;
      setTravelOffer({ key, name: e.name, place });
      log(`${e.name} proposed going to ${place} with ${rider}.`);
    } else {
      log(`${e.name} handed ${rider}: ${action.what}.`);
    }
  };

  // ── Huddle runner ──
  const huddleMs = useCallback((ms: number) => Math.max(0, Math.round(ms * huddleTimeScale)), [huddleTimeScale]);
  const huddleTurnBusyRef = useRef(false);

  const endHuddle = useCallback((end: HuddleEnd) => {
    const h = huddleRef.current;
    if (!h) return;
    if (huddleTimerRef.current) { clearTimeout(huddleTimerRef.current); huddleTimerRef.current = null; }
    huddleRef.current = null;
    const now = Date.now();
    saveTaste(settleHuddle(tasteRef.current, { end, h }, now));
    lastHuddleAtRef.current = now;
    if (h.npcLines >= 2) {
      const nameOf = (k: string) => npcsRef.current.entry(k)?.name ?? k;
      lastHuddleReportRef.current = { names: h.members.map(nameOf), about: h.about, heat: h.heat, end, ally: h.ally ? nameOf(h.ally) : null, riderSpoke: h.riderLines > 0 };
    }
    const rest = { ...pressureRef.current };
    delete rest[pairKey(h.pair[0], h.pair[1])];
    pressureRef.current = rest;
    showHuddle();
  }, [saveTaste, showHuddle]);
  endHuddleRef.current = endHuddle;

  const startHuddle = useCallback((pair: [string, string], kind: Huddle['kind'], about: string): boolean => {
    const a = huddleNpc(pair[0]);
    const b = huddleNpc(pair[1]);
    if (!a || !b || huddleRef.current) return false;
    const now = Date.now();
    const tense = energyScale(energyRef.current.energy, now - energyRef.current.at) < 1;
    huddleSeqRef.current += 1;
    const h = openHuddle({ pair, kind, about }, a, b, tasteRef.current, {
      era: npcsRef.current.era, now, hushed: tense || (outranked(a.key) && outranked(b.key)), id: `huddle-${now}-${huddleSeqRef.current}`,
    });
    huddleRef.current = h;
    huddleLastRef.current = null;
    huddleLinesRef.current = { id: h.id, pair: h.pair, ids: [], liked: false };
    showHuddle();
    scheduleHuddleTurnRef.current(HUDDLE_RULES.afterRiderMs);
    return true;
  }, [huddleNpc, outranked, showHuddle]);
  startHuddleRef.current = startHuddle;

  /** One huddle line: the meter picks the speaker, the rules pick the beat, and the next line is scheduled. */
  const runHuddleTurn = useCallback(() => enqueue(async () => {
    const h0 = huddleRef.current;
    if (!h0) return;
    if (!urgeSettingsRef.current.enabled || urgeSettingsRef.current.huddles === false || pausedRef.current || !tableOpenRef.current || sceneRunningRef.current || dmSendingRef.current) {
      endHuddle('interrupted');
      return;
    }
    const now = Date.now();
    // The rider is typing (a key in the last few seconds): wait for their line, up to a limit, instead of talking over them.
    const typing = typingRef.current;
    if (typing.since && now - typing.last < huddleMs(HUDDLE_RULES.typingIdleMs) && now - typing.since < huddleMs(HUDDLE_RULES.typingHoldMs)) {
      huddleTurnBusyRef.current = false;
      scheduleHuddleTurnRef.current(2_000);
      return;
    }
    const urge: Record<string, number> = {};
    for (const k of h0.members) urge[k] = urgeRef.current[k]?.urge ?? 0;
    const key = nextSpeaker(h0, urge);
    const e = npcsRef.current.entry(key);
    const self = huddleNpc(key);
    if (!e || !self) { endHuddle('interrupted'); return; }
    const beat = nextBeat(h0);
    const others = h0.members.filter(k => k !== key).map(k => npcsRef.current.entry(k)?.name).filter((n): n is string => !!n);
    const last = huddleLastRef.current;
    const rec = tasteRef.current.pairs[pairKey(h0.pair[0], h0.pair[1])];
    const names = namesByKeyRef.current[key] ?? [e.name];
    const recent = linesRef.current.slice(-3).map(m => heardLine(m) || '').join(' ');
    const memory = memoryFor(key, recent, e.memories, names, now);
    const heard = tableHeard(linesRef.current, undefined, key);
    const extra = [
      heard ? `## AT THE TABLE JUST NOW (oldest first; everyone here heard it)\n${heard}` : '',
      huddleBlock({
        h: h0, self, others, riderName: riderName || 'the rider', beat, lastName: last?.name ?? null,
        lowVoice: outranked(key), doneBefore: (rec?.topics ?? []).filter(t => t !== h0.about), tension: rec?.tension ?? 0,
        memory,
      }),
    ].filter(Boolean).join('\n\n');
    const moment: SpeakMoment = {
      closing: beat === 'close' || beat === 'break',
      keyLine: isKeyLine({ reasons: [], heat: h0.heat, beat, memory: !!memory }),
      directQuestion: beat === 'answer-rider' && !!last?.byRider && /\?/.test(last.text),
      riderWords: last?.byRider ? last.text.trim().split(/\s+/).filter(Boolean).length : 0,
      stir: (urge[key] ?? 0) / (effectiveThreshold(temperamentFor(key), talkFor(key), scaleFor(key, now)) ?? URGE_RULES.threshold),
    };
    urgeRef.current = { ...urgeRef.current, [key]: resetUrge(urgeRef.current[key] ?? freshUrge(now), now) };
    const spoken = await speak(e, last ? `${last.name}: ${last.text}` : `The talk turns to ${h0.about}.`, extra, 'banter', last?.id ?? null, undefined, true, false, moment);
    const h1 = huddleRef.current;
    // Ended while this line was being written (Enough, Send to DM): the line stays, nothing follows.
    if (!h1 || h1.id !== h0.id) return;
    if (!spoken) { endHuddle('interrupted'); return; }
    const line = npcLineForDm(spoken.text).replace(/\s+/g, ' ').trim().slice(0, LINE_CHARS);
    // The rider cut in while this line was being written: their line still gets its answer next.
    const riderCutIn = h1.riderLines > h0.riderLines;
    let h2 = afterNpcLine(h1, key, line);
    if (riderCutIn) h2 = { ...h2, riderSpokeLast: true, sinceRider: 0, named: h1.named.filter(k => k !== key) };
    if (beat === 'turn-to-rider') h2 = { ...h2, turnedToRider: true };
    huddleRef.current = h2;
    if (!riderCutIn) huddleLastRef.current = { id: spoken.id, name: e.name, text: line, at: Date.now(), byRider: false };
    if (huddleLinesRef.current?.id === h0.id) huddleLinesRef.current.ids.push(spoken.id);
    // The others in it hear the line (it moves who speaks next), and it may pull one more voice in.
    processHeardLineRef.current(spoken.text, 'npc', key, e.name, [], 1);
    if (beat === 'close' || beat === 'break') { endHuddle(beat === 'break' ? 'broke' : 'dropped'); return; }
    showHuddle();
    huddleTurnBusyRef.current = false;
    scheduleHuddleTurnRef.current(pauseMs(tasteRef.current, riderCutIn));
  }).finally(() => { huddleTurnBusyRef.current = false; }), [enqueue, endHuddle, huddleMs, huddleNpc, outranked, memoryFor, riderName, speak, showHuddle, scaleFor, talkFor]);

  const scheduleHuddleTurn = useCallback((ms: number) => {
    // A line already being written schedules the next one itself.
    if (huddleTurnBusyRef.current) return;
    if (huddleTimerRef.current) clearTimeout(huddleTimerRef.current);
    huddleTimerRef.current = setTimeout(() => {
      huddleTimerRef.current = null;
      if (!huddleRef.current || huddleTurnBusyRef.current) return;
      huddleTurnBusyRef.current = true;
      void runHuddleTurn();
    }, huddleMs(ms));
  }, [huddleMs, runHuddleTurn]);
  scheduleHuddleTurnRef.current = scheduleHuddleTurn;
  useEffect(() => () => { if (huddleTimerRef.current) clearTimeout(huddleTimerRef.current); }, []);

  /** A member the story moved away gets one parting line. */
  partingLineRef.current = (key: string, h: Huddle) => {
    const e = npcsRef.current.entry(key);
    // Someone who walked out already said their piece on the way.
    if (!e || e.status === 'dead' || e.status === 'hidden' || leftRef.current.includes(key)) return;
    const others = h.members.filter(k => k !== key).map(k => npcsRef.current.entry(k)?.name).filter((n): n is string => !!n).join(' and ');
    void enqueue(async () => {
      if (!urgeSettingsRef.current.enabled || pausedRef.current || !tableOpenRef.current) return;
      const spoken = await speak(e, `The talk about ${h.about} is cut short.`, `## HUDDLE\nYou were in the middle of it with ${others} about ${h.about}, and you are called away. THIS LINE: one parting line as you go, a sentence at most. Speak only as ${e.name}; never speak for ${riderName || 'the rider'}; never ask for rolls.`, 'banter', null, undefined, true);
      if (spoken && huddleLinesRef.current?.id === h.id) { huddleLinesRef.current.ids.push(spoken.id); showHuddle(); }
    });
  };

  /** Run the DM's cue and huddle directions for its latest post, once, when the table is open. */
  const applyDirections = useCallback(() => {
    const pending = pendingDirectionsRef.current;
    if (!pending || !tableOpenRef.current || !urgeSettingsRef.current.enabled || pausedRef.current || dmSendingRef.current || sceneRunningRef.current) return;
    pendingDirectionsRef.current = null;
    directedSigRef.current = pending.sig;
    const now = Date.now();
    const entries = rosterNameEntries(npcsRef.current.roster);
    const onStage = (name: string) => matchNames(name, entries).find(k => !!urgeRef.current[k] && talkFor(k) !== 'spoken-to');
    let first: { key: string; reason: string } | null = null;
    for (const cue of pending.d.cues) {
      const key = onStage(cue.name);
      const s = key ? urgeRef.current[key] : undefined;
      if (!key || !s) continue;
      urgeRef.current = { ...urgeRef.current, [key]: addReasons(s, [{ pts: URGE_RULES.threshold, text: `the story just left you with something to say: ${cue.reason}` }], now) };
      if (!first) first = { key, reason: cue.reason };
    }
    const hd = pending.d.huddle;
    const a = hd ? onStage(hd.a) : undefined;
    const b = hd ? onStage(hd.b) : undefined;
    const started = !!hd && !!a && !!b && a !== b && urgeSettingsRef.current.huddles !== false && startHuddleRef.current([a, b], 'topic', hd.about);
    if (!started && first) speakUnpromptedRef.current(first.key, first.reason, true);
    refreshTells();
  }, [refreshTells, talkFor]);
  applyDirectionsRef.current = applyDirections;
  // A finished DM post: its directions wait until the table is open, then run once (also after a reload).
  useEffect(() => {
    if (busy || !latestDmText) return;
    const sig = directionsSig(latestDmText);
    if (sig === directedSigRef.current) return;
    if (!directions.cues.length && !directions.huddle) { directedSigRef.current = sig; pendingDirectionsRef.current = null; return; }
    pendingDirectionsRef.current = { sig, d: directions };
    applyDirections();
  }, [busy, latestDmText, directions, applyDirections]);

  /** "Enough": the rider ends the huddle. They learn from it. */
  const huddleEnough = useCallback(() => endHuddle('enough'), [endHuddle]);

  /** "Seal this conversation": tick every line of the huddle for the DM in one tap. */
  const huddleSeal = useCallback(() => {
    const lines = huddleLinesRef.current;
    if (!lines) return;
    for (const id of lines.ids) {
      const m = linesRef.current.find(x => x.id === id);
      if (m && !m.consumed && !m.selected) void chat.toggleSelected(id);
    }
    if (!lines.liked) { lines.liked = true; saveTaste(likedHuddle(tasteRef.current, lines.pair)); }
  }, [chat, saveTaste]);

  // A new DM post moves the story on: a finished huddle's lines are no longer offered for sealing.
  useEffect(() => {
    if (!huddleRef.current && huddleLinesRef.current) { huddleLinesRef.current = null; showHuddle(); }
  }, [latestDmText, showHuddle]);

  const huddleView = useMemo<HuddleView | null>(() => {
    if (!huddleInfo) return null;
    const canSeal = huddleInfo.ids.some(id => chat.messages.some(m => m.id === id && !m.consumed && !m.selected));
    return huddleInfo.active || canSeal ? { active: huddleInfo.active, names: huddleInfo.names, heat: huddleInfo.heat, canSeal } : null;
  }, [huddleInfo, chat.messages]);

  /** The clock: decay shows in the tells, silence builds urge, and a long lull can wake one NPC. */
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const dt = Math.max(0, now - lastTickAtRef.current);
      lastTickAtRef.current = now;
      if (!urgeSettingsRef.current.enabled || pausedRef.current) { endHuddleRef.current('interrupted'); return; }
      const idle = tableOpenRef.current && !busyRef.current && !sceneRunningRef.current && !dmSendingRef.current;
      if (idle) {
        idleAccumRef.current += dt;
        const steps = Math.floor(idleAccumRef.current / URGE_RULES.silenceStepMs);
        const fresh = steps - silenceStepsCountedRef.current;
        if (fresh > 0) {
          silenceStepsCountedRef.current = steps;
          for (const [key, s] of Object.entries(urgeRef.current)) {
            const e = npcsRef.current.entry(key);
            if (!e || e.status === 'dead') continue;
            const r = silenceReasons(temperamentFor(key), fresh * URGE_RULES.silenceStepMs);
            if (r.length) urgeRef.current[key] = addReasons(s, r, now);
          }
        }
        if (!huddleRef.current && now - lastTickWakeRef.current > URGE_RULES.tickWakeGapMs) {
          const candidates = Object.entries(urgeRef.current)
            .map(([key, state]) => ({ key, state, temperament: temperamentFor(key), talk: talkFor(key), scale: scaleFor(key, now) }));
          const woke = pickWakes(candidates, now, 1);
          if (woke.length) {
            lastTickWakeRef.current = now;
            speakUnpromptedRef.current(woke[0], lastRiderLineRef.current, true);
          }
        }
      } else {
        idleAccumRef.current = 0;
        silenceStepsCountedRef.current = 0;
      }
      refreshTells();
    }, URGE_TICK_MS);
    return () => clearInterval(iv);
  }, [refreshTells, talkFor, scaleFor]);

  /** Tap a tell: the NPC speaks now, whatever the meter says. */
  const inviteNpc = useCallback((key: string) => {
    speakUnpromptedRef.current(key, lastRiderLineRef.current, true);
  }, []);

  /** Hold a tell: the NPC swallows it (urge gone, cooldown started). */
  const hushNpc = useCallback((key: string) => {
    const s = urgeRef.current[key];
    if (s) {
      urgeRef.current = { ...urgeRef.current, [key]: resetUrge(s, Date.now()) };
      learn(key, false);
      refreshTells();
    }
  }, [refreshTells, learn]);

  /** Back to how everyone started: learned taste, meter levels and open questions (the switches stay). */
  const resetUrgeLearning = useCallback(() => {
    const now = Date.now();
    const cur = urgeSettingsRef.current;
    urgeSettingsRef.current = { ...cur, learned: {} };
    saveUrgeSettings(urgeSettingsRef.current);
    const fresh: Record<string, NpcUrgeState> = {};
    for (const key of Object.keys(urgeRef.current)) fresh[key] = freshUrge(now);
    urgeRef.current = fresh;
    savedLevelsRef.current = {};
    questionsRef.current = {};
    usedMemoriesRef.current = {};
    pressureRef.current = {};
    endHuddleRef.current('interrupted');
    saveTaste(freshTaste());
    refreshTells();
  }, [saveUrgeSettings, refreshTells, saveTaste]);

  // Learning from what the rider does with unprompted lines: sealing one = liked, deleting one = not.
  useEffect(() => {
    const nowSeen = new Map<string, { selected: boolean; npc: string }>();
    for (const m of chat.messages) {
      if (m.npc_id && unpromptedIdsRef.current.has(m.id)) nowSeen.set(m.id, { selected: !!m.selected, npc: m.npc_id });
    }
    const prev = seenUnpromptedRef.current;
    for (const [id, v] of nowSeen) {
      const before = prev.get(id);
      if (before && !before.selected && v.selected && !learnedIdsRef.current.has(id)) {
        learnedIdsRef.current.add(id);
        learn(v.npc, true);
      }
    }
    const gone = Array.from(prev.entries()).filter(([id]) => !nowSeen.has(id));
    // One or two lines deleted by hand count; a cleared table does not.
    if (gone.length > 0 && gone.length <= 2 && chat.messages.length > 0) {
      for (const [id, v] of gone) {
        unpromptedIdsRef.current.delete(id);
        if (!learnedIdsRef.current.has(id)) { learnedIdsRef.current.add(id); learn(v.npc, false); }
      }
    }
    seenUnpromptedRef.current = nowSeen;
  }, [chat.messages, learn]);

  /** The rider's own line (the drawer's plain send): post it, then let the meter hear it. */
  const postRiderLine = useCallback(async (content: string, inCharacter: boolean) => {
    const id = await chat.postLine(content, inCharacter);
    if (id && inCharacter) {
      lastRiderLineRef.current = content;
      processHeardLineRef.current(content, 'rider', undefined, undefined, [], URGE_RULES.maxWakesPerLine, id);
    }
    return id;
  }, [chat]);

  const answer = useCallback((lineId: string, line: string, keys: string[], social?: SocialCheckResult) => enqueue(async () => {
    for (const key of keys) {
      const e = npcs.entry(key);
      if (!e) continue;
      const heard = tableHeard(linesRef.current, lineId, key);
      const extra = [
        heard ? `## AT THE TABLE JUST NOW (oldest first; everyone here heard it)\n${heard}` : '',
        `${riderName || 'The rider'} now says the line you answer (in quotes). If other NPCs already answered it above, you heard them: you may react to them, but never repeat them or speak for them.`,
      ].filter(Boolean).join('\n\n');
      const asked = parseReply(line).body.trim() || line;
      const spoken = await speak(e, asked, extra, 'answer', lineId, social, false, false, { directQuestion: /\?/.test(asked), riderWords: asked.split(/\s+/).filter(Boolean).length });
      // The others overhear the answer (it can build urge, never wake anyone by itself).
      if (spoken) {
        if (asksQuestion(npcLineForDm(spoken.text))) questionsRef.current[key] = { at: Date.now(), missed: 0 };
        processHeardLineRef.current(spoken.text, 'npc', key, e.name, keys, 0);
        // A huddle member answered the rider directly: the huddle carries on from that answer.
        const h = huddleRef.current;
        if (h && h.members.includes(key)) {
          const said = npcLineForDm(spoken.text).replace(/\s+/g, ' ').trim().slice(0, LINE_CHARS);
          huddleRef.current = afterNpcLine(h, key, said);
          huddleLastRef.current = { id: spoken.id, name: e.name, text: said, at: Date.now(), byRider: false };
          if (huddleLinesRef.current?.id === h.id) huddleLinesRef.current.ids.push(spoken.id);
          showHuddle();
          scheduleHuddleTurnRef.current(pauseMs(tasteRef.current, false));
        }
      }
    }
  }), [enqueue, npcs, riderName, speak, showHuddle]);

  const onSendToNpcs = useCallback(async (content: string, npcIds: string[]) => {
    const id = await chat.postLine(content, true);
    if (!id) return false;
    lastRiderLineRef.current = content;
    processHeardLineRef.current(content, 'rider', undefined, undefined, npcIds, URGE_RULES.maxWakesPerLine, id);
    void answer(id, content, npcIds);
    return true;
  }, [chat, answer]);

  const onNpcSocialCheck = useCallback(async (content: string, npcId: string, result: SocialCheckResult) => {
    const id = await chat.postLine(`${content}\n\n${result.rollBlockText}`, true);
    if (!id) return false;
    lastRiderLineRef.current = content;
    processHeardLineRef.current(content, 'rider', undefined, undefined, [npcId], URGE_RULES.maxWakesPerLine, id);
    void answer(id, content, [npcId], result);
    return true;
  }, [chat, answer]);

  const onSpeakAsNpc = useCallback(async (content: string, npcId: string) => {
    const e = npcs.entry(npcId);
    if (!e || e.status === 'dead' || e.status === 'hidden') return false;
    chat.appendLine({ content, characterName: e.name, npcId, userId: `npc:${npcId}` });
    return true;
  }, [chat, npcs]);

  const onRegenerateNpcLine = useCallback((messageId: string, npcId: string | null) => {
    const original = linesRef.current.find(m => m.id === messageId && !m.consumed);
    const e = npcId ? npcs.entry(npcId) : undefined;
    if (!original || !e) return;
    const parentId = parseReply(original.content).replyToId;
    const parent = linesRef.current.find(m => m.id === parentId);
    if (!parent) return;
    void enqueue(async () => {
      const replacement = await speak(e, parseReply(parent.content).body, tableHeard(linesRef.current, messageId, e.key), 'answer', parent.id);
      if (!replacement) return;
      await chat.editMessage(messageId, keepNpcRoll(formatReply(parent.id, replacement.text), original.content));
      await chat.deleteMessage(replacement.id);
    });
  }, [chat, npcs, enqueue, speak]);

  const onNpcRoll = useCallback(async (lineId: string, npcId: string | null, request: NpcRollRequest) => {
    const line = linesRef.current.find(m => m.id === lineId && !m.consumed);
    const e = npcId ? npcs.entry(npcId) : undefined;
    const marker = line ? parseNpcRoll(parseReply(line.content).body).roll : null;
    if (!line || !e || marker?.to !== me || !Number.isFinite(request.dc)) return;
    const modifier = rollModifier(characterContext, request);
    const d20 = rollD20({ context: request.save ? 'save' : 'skill' });
    await awaitLatestD20Reveal();
    const content = buildRollAnswer({ characterName: riderName, npcName: e.name, npcLineId: lineId, request, d20: d20.kept, modifier });
    const ruled = await soloRollLine(content, { kind: 'test', rolls: d20.rolls, kept: d20.kept, die: 20, modifier, total: d20.kept + modifier, rollMode: d20.mode, mode: resolveOddsForContext(request.save ? 'save' : 'skill') }, request.dc, checkRisk(request.check), request.check, check);
    await onSendToNpcs(ruled, [e.key]);
  }, [characterContext, check, me, npcs, onSendToNpcs, riderName]);

  const onNpcJoin = useCallback(async (lineId: string, npcId: string | null) => {
    const line = linesRef.current.find(m => m.id === lineId && !m.consumed);
    const e = npcId ? npcs.entry(npcId) : undefined;
    if (!line || !e || e.status === 'dead' || e.status === 'hidden') return;
    const offer = parseNpcJoin(parseReply(line.content).body);
    if (offer.join?.to !== me) return;
    await npcs.setStatus(e.key, 'met');
    callOver(e.key);
    await chat.editMessage(lineId, formatReply(parseReply(line.content).replyToId, offer.body));
    await chat.postLine(`${riderName} accepts ${e.name}'s offer to accompany them.`, true);
  }, [chat, npcs, me, riderName, callOver]);

  /** "Let them talk": 2 or 3 NPCs on stage talk to each other for 2 to 4 lines, in the order picked. Any rider line stops it. */
  const onStartScene = useCallback(async (npcIds: string[], topic: string, turns: number): Promise<boolean> => {
    if (sceneRunning) return false;
    const cast = npcIds.map(id => npcs.entry(id)).filter((e): e is RosterEntry => !!e && e.status !== 'dead').slice(0, 3);
    if (cast.length < 2) { toast.info('Pick 2 or 3 NPCs on stage.'); return false; }
    const total = Math.min(4, Math.max(2, Math.round(turns) || 3));
    const startedAt = new Date().toISOString();
    endHuddleRef.current('interrupted');
    setSceneRunning(true);
    sceneRunningRef.current = true;
    void enqueue(async () => {
      let previous: { id: string; name: string; text: string } | null = null;
      try {
        for (let turn = 1; turn <= total; turn++) {
          const riderSpoke = linesRef.current.some(m => m.user_id === me && !m.npc_id && m.created_at > startedAt);
          if (turn > 1 && riderSpoke) { toast.info(`${riderName || 'You'} spoke, so the scene stopped.`); break; }
          const e = cast[(turn - 1) % cast.length];
          const others = cast.filter(c => c.key !== e.key).map(c => c.name).join(' and ');
          const heard = tableHeard(linesRef.current, undefined, e.key);
          const step = turn === 1
            ? `Open the scene: say your first line to ${others}.`
            : turn === total
              ? `Line ${turn} of ${total}, the last one: answer ${others} and bring this exchange to a natural pause.`
              : `Line ${turn} of ${total}: answer what ${previous?.name || others} just said (in quotes).`;
          const extra = [
            heard ? `## AT THE TABLE JUST NOW (oldest first; everyone here heard it)\n${heard}` : '',
            `## NPC SCENE\nThis is a short scene between NPCs while ${riderName || 'the rider'} watches: ${e.name} and ${others}.${topic.trim() ? ` The rider set it up like this: ${topic.trim().slice(0, 500)}` : ''}`,
            step,
            `The quoted line is ${previous ? `what ${previous.name} just said to you` : 'how the scene opens'}, not something ${riderName || 'the rider'} said. Speak only as ${e.name}, to the other NPCs. Never speak for ${riderName || 'the rider'}, and never ask for rolls.`,
          ].filter(Boolean).join('\n\n');
          const said = previous ? `${previous.name}: ${previous.text}` : (topic.trim() || 'The scene opens.');
          const spoken = await speak(e, said, extra, 'banter', previous?.id ?? null);
          if (!spoken) break;
          previous = { id: spoken.id, name: e.name, text: npcLineForDm(spoken.text).replace(/\s+/g, ' ').trim().slice(0, LINE_CHARS) };
        }
      } finally {
        setSceneRunning(false);
        sceneRunningRef.current = false;
      }
    });
    return true;
  }, [sceneRunning, npcs, enqueue, me, riderName, speak]);

  const sendingRef = useRef(false);
  const onSendToDMNow = useCallback(async () => {
    if (sendingRef.current) return;
    if (busy) { toast('One moment', { description: 'Someone is still answering. Send to DM when they finish.' }); return; }
    const prompt = chat.buildRoundPrompt();
    const talk = chat.orderedSelected.filter(m => !m.in_character).map(m => stripActionCard(parseReply(m.content).body).trim()).filter(Boolean);
    const full = [prompt, talk.length ? `TABLE TALK (out of character)\n${talk.join('\n')}` : ''].filter(Boolean).join('\n\n');
    if (!full) { toast('Seal a line first', { description: 'Tick the lines that really happened, then Send to DM.' }); return; }
    const selected = chat.orderedSelected;
    // Lines left unsealed when the rider taps Send to DM: removed once the DM replies, so they never carry into the next round.
    const leftUnsealed = chat.pendingMessages.filter(m => !m.selected).map(m => m.id);
    // A huddle still running ends here, so the note below can tell the DM how it went.
    endHuddleRef.current('interrupted');
    const nameOf = (k: string) => npcsRef.current.entry(k)?.name ?? k;
    const stageKeys = Object.keys(urgeRef.current);
    const pairs: TableStateInput['pairs'] = [];
    for (let i = 0; i < stageKeys.length; i++) {
      for (let j = i + 1; j < stageKeys.length; j++) {
        const rec = tasteRef.current.pairs[pairKey(stageKeys[i], stageKeys[j])];
        if (rec && rec.tension >= 1) pairs.push({ a: nameOf(stageKeys[i]), b: nameOf(stageKeys[j]), tension: rec.tension, lastAbout: rec.topics[rec.topics.length - 1] ?? null });
      }
    }
    const dmNotes = tableStateForDm({
      riderName,
      onStage: stageKeys.map(k => ({ name: nameOf(k), wants: tells[k] ?? null, aim: mindsRef.current[k]?.want || null, hiding: mindsRef.current[k]?.truth || null })),
      // Only what happened in lines the rider sealed.
      actions: actionLogRef.current.filter(a => selected.some(m => m.id === a.lineId)).map(a => a.text),
      companions: companions.map(nameOf),
      whispered: selected.some(m => isWhisper(m)),
      pairs,
      lastHuddle: lastHuddleReportRef.current,
      ignored: stageKeys.filter(k => (questionsRef.current[k]?.missed ?? 0) >= URGE_TUNING.questionGraceLines).map(nameOf),
    });
    const liveTable: SoloLiveTableContext = {
      mode: 'live',
      // Solo keeps the Empyrean DM's own tone: the table rules, played straight (no comedy dial).
      chaosLevel: SOLO_CHAOS_LEVEL,
      hasTableTalk: selected.some(m => !m.in_character),
      hasInCharacter: selected.some(m => m.in_character),
      hasNpcLines: selected.some(m => !!m.npc_id),
      hasCombat: false,
      dmNotes,
    };
    sendingRef.current = true;
    dmSendingRef.current = true;
    setDmSending(true);
    try {
      const replied = await sendToDm(full, liveTable);
      if (replied) {
        lastHuddleReportRef.current = null;
        actionLogRef.current = [];
        await chat.consumePending();
        // Not a verdict on the NPC: forget these lines first, so removing them never counts as the rider deleting an unprompted line.
        for (const id of leftUnsealed) {
          seenUnpromptedRef.current.delete(id);
          unpromptedIdsRef.current.delete(id);
          await chat.deleteMessage(id);
        }
        // Everything on the table has now been dealt with: the unread badge on the PLAY button starts again from zero.
        void chat.markRead(new Date().toISOString());
      }
      else toast.error('The DM did not reply', { description: 'Your sealed lines are still here. Try Send to DM again.' });
    } finally {
      sendingRef.current = false;
      dmSendingRef.current = false;
      setDmSending(false);
    }
  }, [chat, sendToDm, busy, riderName, tells, companions]);

  return {
    chat, tableNpcs, thinking, dmSending, sceneRunning, callOver, onSendToNpcs, onNpcSocialCheck, onStartScene, onSendToDMNow, onSpeakAsNpc, onRegenerateNpcLine, onNpcRoll, onNpcJoin,
    // Urge meter (D-40)
    postRiderLine, tells, inviteNpc, hushNpc, setTableOpen,
    urge: { enabled: urgeSettings.enabled, perNpc: urgeSettings.perNpc, learned: urgeSettings.learned, setEnabled: setUrgeEnabled, setNpc: setNpcTalkativeness, reset: resetUrgeLearning, judge: urgeSettings.judge !== false, setJudge: setJudgeEnabled, huddles: urgeSettings.huddles !== false, setHuddles: setHuddlesEnabled },
    // Huddles: NPCs talking among themselves, with the rider as a third voice.
    huddle: huddleView, huddleEnough, huddleSeal, setTyping,
    // An NPC squared up to the rider: the screen can open the bout.
    challenge, clearChallenge,
    // Travel: an NPC's proposal to go somewhere together, and who is travelling with the rider.
    travelOffer, clearTravelOffer, companions, setCompanions,
  };
}
