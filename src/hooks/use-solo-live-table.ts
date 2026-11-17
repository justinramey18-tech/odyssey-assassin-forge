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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useArenaRoundChat } from '@/hooks/use-arena-round-chat';
import { CANON_ERA_LABELS, matchNames, npcVoiceContext } from '@/lib/empyreanCanon/castNpcs';
import { castPortrait } from '@/lib/empyreanCanon/castPortraits';
import { rosterNameEntries, type RosterEntry } from '@/lib/solo-npcs';
import { formatReply, parseReply } from '@/lib/chatReply';
import { stripActionCard } from '@/lib/roundChatActionCard';
import { npcLineForDm } from '@/lib/live-npcs';
import type { RoundChatMessage } from '@/hooks/use-round-chat';
import type { SocialCheckResult } from '@/lib/npcSocialChecks';
import type { SoloNpcs } from '@/hooks/use-solo-npcs';

const MAX_STAGE = 8;
/** How many recent table lines an NPC hears, and their size. */
export const TABLE_HEARD_LINES = 16;
const TABLE_HEARD_CHARS = 3000;
const LINE_CHARS = 400;
/** The Live Table comedy dial for solo hand-offs: 1–3 = played straight, no fourth-wall breaks. */
export const SOLO_CHAOS_LEVEL = 2;
/** The longest an answer waits for the DM to finish writing. */
const WAIT_FOR_DM_MS = 180_000;

type VoiceFn = (
  names: string | string[], line: string,
  social?: { skill: SocialCheckResult['skill']; opposingSkillLabel: string; playerTotal: number; npcTotal: number; outcome: SocialCheckResult['outcome']; rollBlockText?: string },
  mind?: string, offFeed?: boolean,
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
export function tableHeard(lines: Array<Pick<RoundChatMessage, 'id' | 'content' | 'character_name' | 'npc_id' | 'in_character'>>, excludeId?: string): string {
  const out: string[] = [];
  let size = 0;
  const recent = lines.filter(l => l.id !== excludeId).slice(-TABLE_HEARD_LINES);
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

export function useSoloLiveTable({ userId, riderName, npcs, latestDmText, voiceNPC, sendToDm, busy, storageKey }: {
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

  /** One NPC speaks. Resolves to the new line (id and words), or null when it said nothing. */
  const speak = useCallback(async (e: RosterEntry, said: string, mindExtra: string, kind: 'answer' | 'banter', replyToId: string | null, social?: SocialCheckResult) => {
    const t = { key: `${replyToId || 'scene'}:${e.key}:${Date.now()}`, npcId: e.key, name: e.name, messageId: replyToId || '', kind };
    setThinking(prev => [...prev, t]);
    try {
      if (!(await waitUntilFree())) {
        toast.error(`${e.name} didn't answer`, { description: 'The DM is still writing. Try again in a moment.' });
        return null;
      }
      const reply = await voiceRef.current(e.name, said, social ? {
        skill: social.skill, opposingSkillLabel: social.opposingSkillLabel, playerTotal: social.playerRoll.total,
        npcTotal: social.npcRoll.total, outcome: social.outcome, rollBlockText: social.rollBlockText,
      } : undefined, `${mindFor(e)}\n\n${mindExtra}`, true);
      const text = (reply || '').trim();
      if (!text) {
        toast.error(`${e.name} didn't answer`, { description: 'Try again in a moment.' });
        return null;
      }
      const content = formatReply(replyToId, text);
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
  }, [chat, mindFor, waitUntilFree]);

  const answer = useCallback((lineId: string, line: string, keys: string[], social?: SocialCheckResult) => enqueue(async () => {
    for (const key of keys) {
      const e = npcs.entry(key);
      if (!e) continue;
      const heard = tableHeard(linesRef.current, lineId);
      const extra = [
        heard ? `## AT THE TABLE JUST NOW (oldest first; everyone here heard it)\n${heard}` : '',
        `${riderName || 'The rider'} now says the line you answer (in quotes). If other NPCs already answered it above, you heard them: you may react to them, but never repeat them or speak for them.`,
      ].filter(Boolean).join('\n\n');
      await speak(e, parseReply(line).body.trim() || line, extra, 'answer', lineId, social);
    }
  }), [enqueue, npcs, riderName, speak]);

  const onSendToNpcs = useCallback(async (content: string, npcIds: string[]) => {
    const id = await chat.postLine(content, true);
    if (!id) return false;
    void answer(id, content, npcIds);
    return true;
  }, [chat, answer]);

  const onNpcSocialCheck = useCallback(async (content: string, npcId: string, result: SocialCheckResult) => {
    const id = await chat.postLine(`${content}\n\n${result.rollBlockText}`, true);
    if (!id) return false;
    void answer(id, content, [npcId], result);
    return true;
  }, [chat, answer]);

  /** "Let them talk": 2 or 3 NPCs on stage talk to each other for 2 to 4 lines, in the order picked. Any rider line stops it. */
  const onStartScene = useCallback(async (npcIds: string[], topic: string, turns: number): Promise<boolean> => {
    if (sceneRunning) return false;
    const cast = npcIds.map(id => npcs.entry(id)).filter((e): e is RosterEntry => !!e && e.status !== 'dead').slice(0, 3);
    if (cast.length < 2) { toast.info('Pick 2 or 3 NPCs on stage.'); return false; }
    const total = Math.min(4, Math.max(2, Math.round(turns) || 3));
    const startedAt = new Date().toISOString();
    setSceneRunning(true);
    void enqueue(async () => {
      let previous: { id: string; name: string; text: string } | null = null;
      try {
        for (let turn = 1; turn <= total; turn++) {
          const riderSpoke = linesRef.current.some(m => m.user_id === me && !m.npc_id && m.created_at > startedAt);
          if (turn > 1 && riderSpoke) { toast.info(`${riderName || 'You'} spoke, so the scene stopped.`); break; }
          const e = cast[(turn - 1) % cast.length];
          const others = cast.filter(c => c.key !== e.key).map(c => c.name).join(' and ');
          const heard = tableHeard(linesRef.current);
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
    setDmSending(true);
    try {
      const replied = await sendToDm(full, liveTable);
      if (replied) await chat.consumePending();
      else toast.error('The DM did not reply', { description: 'Your sealed lines are still here. Try Send to DM again.' });
    } finally {
      sendingRef.current = false;
      setDmSending(false);
    }
  }, [chat, sendToDm, busy]);

  return { chat, tableNpcs, thinking, dmSending, sceneRunning, callOver, onSendToNpcs, onNpcSocialCheck, onStartScene, onSendToDMNow };
}
