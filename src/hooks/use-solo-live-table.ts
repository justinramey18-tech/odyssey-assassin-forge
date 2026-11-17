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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useArenaRoundChat } from '@/hooks/use-arena-round-chat';
import { CANON_ERA_LABELS, matchNames, npcVoiceContext } from '@/lib/empyreanCanon/castNpcs';
import { castPortrait } from '@/lib/empyreanCanon/castPortraits';
import { temperamentFor } from '@/lib/empyreanCanon/castNpcs/temperament';
import { rosterNameEntries, type RosterEntry } from '@/lib/solo-npcs';
import {
  URGE_LINE_MODEL, URGE_RULES, addReasons, freshUrge, pickWakes, resetUrge, scoreLine,
  silenceReasons, spotlightBonus, urgeStanding, whyBlock, type NpcUrgeState, type Talkativeness,
  URGE_TUNING, asksQuestion, energyScale, ignoredQuestionReasons, learnTaste, mentionsAny, rankFromRole, rankScale, tableEnergy,
} from '@/lib/npc-urge';
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
  mind?: string, offFeed?: boolean, tableControls?: string, modelOverride?: string,
) => Promise<string | undefined>;

/** The Live Table rules for the DM (ai-dm `liveTable`), for a solo hand-off. */
export interface SoloLiveTableContext {
  mode: 'live';
  chaosLevel: number;
  hasTableTalk: boolean;
  hasInCharacter: boolean;
  hasNpcLines: boolean;
  hasCombat: false;
}

/** The urge meter's switches, kept on this phone per campaign. */
export interface UrgeSettings { enabled: boolean; perNpc: Record<string, Talkativeness>; /** Learned taste per NPC: a threshold factor (below 1 = chattier). */ learned: Record<string, number> }
const DEFAULT_URGE_SETTINGS: UrgeSettings = { enabled: true, perNpc: {}, learned: {} };

/** A whispered line: only the rider and the whisperer hear it. */
export const WHISPER_MARK = '🤫';
export function isWhisper(m: Pick<RoundChatMessage, 'content' | 'npc_id'>): boolean {
  return !!m.npc_id && parseReply(m.content || '').body.trimStart().startsWith(WHISPER_MARK);
}

/** Meter levels kept on the phone, and which table lines were unprompted (for learning). */
interface UrgeLevels { states: Record<string, NpcUrgeState>; unprompted: string[] }
const LEVELS_MAX_AGE_MS = 3_600_000;

function readUrgeLevels(key: string | undefined): UrgeLevels {
  if (!key) return { states: {}, unprompted: [] };
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
    return { states, unprompted: Array.isArray(data?.unprompted) ? data.unprompted.filter(x => typeof x === 'string').slice(-60) : [] };
  } catch {
    return { states: {}, unprompted: [] };
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

export function useSoloLiveTable({ userId, riderName, npcs, latestDmText, voiceNPC, sendToDm, busy, storageKey, characterContext, check, paused = false }: {
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
}) {
  const chat = useArenaRoundChat(userId, riderName, 'solo-live-table', storageKey);
  const me = userId || 'arena-player';
  const [called, setCalled] = useState<string[]>([]);
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
  const sceneRunningRef = useRef(sceneRunning);
  sceneRunningRef.current = sceneRunning;
  const dmSendingRef = useRef(false);

  const storyStage = useMemo(() => stageFromStory(latestDmText, npcs.roster), [latestDmText, npcs.roster]);
  // A new DM post resets who the rider called over; the post decides who is still here.
  useEffect(() => { setCalled([]); }, [latestDmText]);
  const stage = useMemo(() => Array.from(new Set([...storyStage, ...called])).slice(0, MAX_STAGE), [storyStage, called]);

  const tableNpcs = useMemo(() => tableNpcsFor(npcs.roster, stage), [npcs.roster, stage]);

  const callOver = useCallback((key: string) => {
    setCalled(prev => (prev.includes(key) ? prev : [...prev, key].slice(-MAX_STAGE)));
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
  const speak = useCallback(async (e: RosterEntry, said: string, mindExtra: string, kind: 'answer' | 'banter', replyToId: string | null, social?: SocialCheckResult, unprompted = false, whisper = false) => {
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
      } : undefined, `${mindFor(e)}\n\n${mindExtra}`, true, controls, unprompted ? URGE_LINE_MODEL : undefined);
      const text = (reply || '').trim();
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
  const setUrgeEnabled = useCallback((enabled: boolean) => saveUrgeSettings({ ...urgeSettingsRef.current, enabled }), [saveUrgeSettings]);
  const setNpcTalkativeness = useCallback((key: string, talk: Talkativeness) => {
    saveUrgeSettings({ ...urgeSettingsRef.current, perNpc: { ...urgeSettingsRef.current.perNpc, [key]: talk } });
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
  const setTableOpen = useCallback((open: boolean) => { tableOpenRef.current = open; }, []);

  const urgeRef = useRef<Record<string, NpcUrgeState>>({});
  // Kept on the phone per campaign: meter levels (they fade while away) and which lines were unprompted.
  const levelsKey = storageKey ? `${storageKey}:urge-levels` : undefined;
  const levelsKeyRef = useRef(levelsKey);
  const savedLevelsRef = useRef<Record<string, NpcUrgeState>>({});
  const unpromptedIdsRef = useRef<Set<string>>(new Set());
  const levelsLoadedRef = useRef(false);
  if (!levelsLoadedRef.current || levelsKeyRef.current !== levelsKey) {
    const loaded = readUrgeLevels(levelsKey);
    savedLevelsRef.current = loaded.states;
    unpromptedIdsRef.current = new Set(loaded.unprompted);
    if (levelsLoadedRef.current) urgeRef.current = {};
    levelsLoadedRef.current = true;
    levelsKeyRef.current = levelsKey;
  }
  const saveLevels = useCallback(() => {
    savedLevelsRef.current = { ...savedLevelsRef.current, ...urgeRef.current };
    const key = levelsKeyRef.current;
    if (!key) return;
    try {
      setScopedItem(key, JSON.stringify({ states: savedLevelsRef.current, unprompted: Array.from(unpromptedIdsRef.current).slice(-60) }));
    } catch { /* best effort */ }
  }, []);
  // Unprompted lines as last seen on the table (sealed or not), and the ones already learned from.
  const seenUnpromptedRef = useRef<Map<string, { selected: boolean; npc: string }>>(new Map());
  const learnedIdsRef = useRef<Set<string>>(new Set());
  // An NPC's open question to the rider, and how many rider lines have passed it by.
  const questionsRef = useRef<Record<string, { at: number; missed: number }>>({});
  // The latest DM post's energy, and when it arrived.
  const energyRef = useRef<{ energy: ReturnType<typeof tableEnergy>; at: number }>({ energy: 'normal', at: 0 });
  useEffect(() => { energyRef.current = { energy: tableEnergy(latestDmText), at: Date.now() }; }, [latestDmText]);
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
    refreshTells();
  }, [stage, refreshTells]);

  // processHeardLine and speakUnprompted call each other (a wake makes a line, a line can wake
  // one reaction), so each reaches the other through a ref.
  const speakUnpromptedRef = useRef<(key: string, triggerText: string, allowReaction: boolean) => void>(() => {});
  const processHeardLineRef = useRef<(text: string, speaker: 'rider' | 'npc', speakerKey: string | undefined, speakerName: string | undefined, addressed: string[], maxWakes: number) => void>(() => {});

  /** Score a heard line for everyone on stage; maybe wake somebody (capped). */
  const processHeardLine = useCallback((text: string, speaker: 'rider' | 'npc', speakerKey: string | undefined, speakerName: string | undefined, addressed: string[], maxWakes: number) => {
    // Any line breaks the silence, even while the meter is off or frozen.
    idleAccumRef.current = 0;
    silenceStepsCountedRef.current = 0;
    if (!urgeSettingsRef.current.enabled || pausedRef.current || sceneRunningRef.current) return;
    const now = Date.now();
    const era = npcsRef.current.era;
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
    if (maxWakes > 0 && tableOpenRef.current) {
      const candidates = Object.entries(urgeRef.current)
        .filter(([key]) => !addressed.includes(key) && key !== speakerKey)
        .map(([key, state]) => ({ key, state, temperament: temperamentFor(key), talk: talkFor(key), scale: scaleFor(key, now) }));
      for (const key of pickWakes(candidates, now, maxWakes)) {
        speakUnpromptedRef.current(key, text, speaker === 'rider');
      }
    }
    refreshTells();
  }, [refreshTells, talkFor, scaleFor]);
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
    urgeRef.current = { ...urgeRef.current, [key]: resetUrge(s, Date.now()) };
    refreshTells();
    const spoken = await speak(e, triggerText.trim() || 'The scene carries on around you.', extra, 'answer', null, undefined, true, whisper);
    if (spoken) {
      unpromptedIdsRef.current.add(spoken.id);
      seenUnpromptedRef.current.set(spoken.id, { selected: false, npc: key });
      if (asksQuestion(npcLineForDm(spoken.text))) questionsRef.current[key] = { at: Date.now(), missed: 0 };
      // An unprompted line may wake one reaction; a reaction wakes nobody (no chains). Nobody reacts to a whisper.
      if (!whisper) processHeardLineRef.current(spoken.text, 'npc', key, e.name, [], allowReaction ? URGE_RULES.maxReactionWakes : 0);
      saveLevels();
    }
    return spoken;
  }), [enqueue, riderName, speak, refreshTells, saveLevels]);
  useEffect(() => { speakUnpromptedRef.current = (k, t, a) => { void speakUnprompted(k, t, a); }; }, [speakUnprompted]);

  /** The clock: decay shows in the tells, silence builds urge, and a long lull can wake one NPC. */
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const dt = Math.max(0, now - lastTickAtRef.current);
      lastTickAtRef.current = now;
      if (!urgeSettingsRef.current.enabled || pausedRef.current) return;
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
        if (now - lastTickWakeRef.current > URGE_RULES.tickWakeGapMs) {
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
    refreshTells();
  }, [saveUrgeSettings, refreshTells]);

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
      processHeardLineRef.current(content, 'rider', undefined, undefined, [], URGE_RULES.maxWakesPerLine);
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
      const spoken = await speak(e, parseReply(line).body.trim() || line, extra, 'answer', lineId, social);
      // The others overhear the answer (it can build urge, never wake anyone by itself).
      if (spoken) {
        if (asksQuestion(npcLineForDm(spoken.text))) questionsRef.current[key] = { at: Date.now(), missed: 0 };
        processHeardLineRef.current(spoken.text, 'npc', key, e.name, keys, 0);
      }
    }
  }), [enqueue, npcs, riderName, speak]);

  const onSendToNpcs = useCallback(async (content: string, npcIds: string[]) => {
    const id = await chat.postLine(content, true);
    if (!id) return false;
    lastRiderLineRef.current = content;
    processHeardLineRef.current(content, 'rider', undefined, undefined, npcIds, URGE_RULES.maxWakesPerLine);
    void answer(id, content, npcIds);
    return true;
  }, [chat, answer]);

  const onNpcSocialCheck = useCallback(async (content: string, npcId: string, result: SocialCheckResult) => {
    const id = await chat.postLine(`${content}\n\n${result.rollBlockText}`, true);
    if (!id) return false;
    lastRiderLineRef.current = content;
    processHeardLineRef.current(content, 'rider', undefined, undefined, [npcId], URGE_RULES.maxWakesPerLine);
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
    const liveTable: SoloLiveTableContext = {
      mode: 'live',
      // Solo keeps the Empyrean DM's own tone: the table rules, played straight (no comedy dial).
      chaosLevel: SOLO_CHAOS_LEVEL,
      hasTableTalk: selected.some(m => !m.in_character),
      hasInCharacter: selected.some(m => m.in_character),
      hasNpcLines: selected.some(m => !!m.npc_id),
      hasCombat: false,
    };
    sendingRef.current = true;
    dmSendingRef.current = true;
    setDmSending(true);
    try {
      const replied = await sendToDm(full, liveTable);
      if (replied) await chat.consumePending();
      else toast.error('The DM did not reply', { description: 'Your sealed lines are still here. Try Send to DM again.' });
    } finally {
      sendingRef.current = false;
      dmSendingRef.current = false;
      setDmSending(false);
    }
  }, [chat, sendToDm, busy]);

  return {
    chat, tableNpcs, thinking, dmSending, sceneRunning, callOver, onSendToNpcs, onNpcSocialCheck, onStartScene, onSendToDMNow, onSpeakAsNpc, onRegenerateNpcLine, onNpcRoll, onNpcJoin,
    // Urge meter (D-40)
    postRiderLine, tells, inviteNpc, hushNpc, setTableOpen,
    urge: { enabled: urgeSettings.enabled, perNpc: urgeSettings.perNpc, learned: urgeSettings.learned, setEnabled: setUrgeEnabled, setNpc: setNpcTalkativeness, reset: resetUrgeLearning },
  };
}
