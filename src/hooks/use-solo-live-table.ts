// Solo Empyrean Live Table: the party Live Table, run on this phone for one rider.
// Reuses the Arena's local table (same message contract as the party table) and the
// solo roster: who is "on stage" = NPCs named in the latest DM post plus anyone the
// rider called over. NPC answers come from voiceNPC in off-feed mode, so nothing reaches
// the story until the rider taps Send to DM.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useArenaRoundChat } from '@/hooks/use-arena-round-chat';
import { CANON_ERA_LABELS, matchNames, npcVoiceContext } from '@/lib/empyreanCanon/castNpcs';
import { rosterNameEntries, type RosterEntry } from '@/lib/solo-npcs';
import type { SocialCheckResult } from '@/lib/npcSocialChecks';
import type { SoloNpcs } from '@/hooks/use-solo-npcs';

const MAX_STAGE = 8;

type VoiceFn = (
  names: string | string[], line: string,
  social?: { skill: SocialCheckResult['skill']; opposingSkillLabel: string; playerTotal: number; npcTotal: number; outcome: SocialCheckResult['outcome']; rollBlockText?: string },
  mind?: string, offFeed?: boolean,
) => Promise<string | undefined>;

/** Keys of NPCs named in a DM post, capped. Pure, for tests. */
export function stageFromStory(text: string, roster: RosterEntry[]): string[] {
  if (!text) return [];
  const alive = roster.filter(e => e.status !== 'dead' && e.status !== 'hidden');
  return Array.from(new Set(matchNames(text, rosterNameEntries(alive)))).slice(0, MAX_STAGE);
}

export function useSoloLiveTable({ userId, riderName, npcs, latestDmText, voiceNPC, sendToDm, busy }: {
  userId: string | undefined;
  riderName: string;
  npcs: SoloNpcs;
  latestDmText: string;
  voiceNPC: VoiceFn;
  sendToDm: (prompt: string) => void | Promise<void>;
  busy: boolean;
}) {
  const chat = useArenaRoundChat(userId, riderName, 'solo-live-table');
  const [called, setCalled] = useState<string[]>([]);
  const [thinking, setThinking] = useState<Array<{ key: string; npcId: string; name: string; messageId: string; kind: 'answer' }>>([]);

  const storyStage = useMemo(() => stageFromStory(latestDmText, npcs.roster), [latestDmText, npcs.roster]);
  // A new DM post resets who the rider called over; the post decides who is still here.
  useEffect(() => { setCalled([]); }, [latestDmText]);
  const stage = useMemo(() => Array.from(new Set([...storyStage, ...called])).slice(0, MAX_STAGE), [storyStage, called]);

  const tableNpcs = useMemo(() => npcs.roster
    .filter(e => e.status !== 'hidden')
    .map(e => ({ id: e.key, name: e.name, portrait_url: null, on_stage: stage.includes(e.key) && e.status !== 'dead', archived: false })),
  [npcs.roster, stage]);

  const callOver = useCallback((key: string) => {
    setCalled(prev => (prev.includes(key) ? prev : [...prev, key].slice(-MAX_STAGE)));
  }, []);

  const mindFor = useCallback((e: RosterEntry) => npcVoiceContext(e.mind, riderName || 'the rider', e.attitude, e.memories, CANON_ERA_LABELS[npcs.era]), [riderName, npcs.era]);

  const answer = useCallback(async (lineId: string, line: string, keys: string[], social?: SocialCheckResult) => {
    for (const key of keys) {
      const e = npcs.entry(key);
      if (!e) continue;
      const t = { key: `${lineId}:${key}`, npcId: key, name: e.name, messageId: lineId, kind: 'answer' as const };
      setThinking(prev => [...prev, t]);
      try {
        const reply = await voiceNPC(e.name, line, social ? {
          skill: social.skill, opposingSkillLabel: social.opposingSkillLabel, playerTotal: social.playerRoll.total,
          npcTotal: social.npcRoll.total, outcome: social.outcome, rollBlockText: social.rollBlockText,
        } : undefined, mindFor(e), true);
        const text = (reply || '').trim();
        if (text) chat.appendLine({ content: text, characterName: e.name, npcId: key, userId: `npc:${key}` });
        else toast.error(`${e.name} didn't answer`, { description: 'Try again in a moment.' });
      } finally {
        setThinking(prev => prev.filter(x => x.key !== t.key));
      }
    }
  }, [npcs, voiceNPC, mindFor, chat]);

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

  const sendingRef = useRef(false);
  const onSendToDMNow = useCallback(async () => {
    if (sendingRef.current || busy) return;
    const prompt = chat.buildRoundPrompt();
    const talk = chat.orderedSelected.filter(m => !m.in_character).map(m => m.content.trim()).filter(Boolean);
    const full = [prompt, talk.length ? `(Out of character: ${talk.join(' ')})` : ''].filter(Boolean).join('\n\n');
    if (!full) { toast('Seal a line first', { description: 'Tick the lines that really happened, then Send to DM.' }); return; }
    sendingRef.current = true;
    try {
      await sendToDm(full);
      await chat.consumePending();
    } finally { sendingRef.current = false; }
  }, [chat, sendToDm, busy]);

  return { chat, tableNpcs, thinking, callOver, onSendToNpcs, onNpcSocialCheck, onSendToDMNow };
}
