// Arena practice: the real Live Table contract, kept entirely on this phone.
// The real useRoundChat runs with no party (so it reads and writes nothing) and
// supplies the full return type; local state is layered over it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { useRoundChat, DEFAULT_ROUND_STYLE, type RoundChatMessage, type RoundChatReaction, type RoundStyle } from '@/hooks/use-round-chat';
import { stripActionCard } from '@/lib/roundChatActionCard';
import { parseReply } from '@/lib/chatReply';
import { inCharacterBlock, npcLineForDm } from '@/lib/live-npcs';
import type { StorySceneLine } from '@/lib/story-scene';

export type RoundChatApi = ReturnType<typeof useRoundChat>;
export const ARENA_PARTY_ID = 'arena-practice';

/** A line added from outside the chat (the opponent, the fight log). */
export interface ArenaAppendLine {
  content: string;
  characterName: string;
  inCharacter?: boolean;
  npcId?: string | null;
  userId?: string;
}

export type ArenaRoundChatApi = RoundChatApi & {
  /** Add a line from the Arena fight runtime. Returns the new line's id. */
  appendLine: (line: ArenaAppendLine) => string;
};

/** Lines kept on the phone for a saved table: every unsent line, plus the latest sent ones. */
export function linesToKeep(lines: RoundChatMessage[], sentToKeep = 40): RoundChatMessage[] {
  const sent = lines.filter((m) => m.consumed);
  const keepSent = new Set(sent.slice(-sentToKeep).map((m) => m.id));
  return lines.filter((m) => !m.consumed || keepSent.has(m.id)).slice(-300);
}

function readSaved(key: string | undefined): { messages: RoundChatMessage[]; reactions: RoundChatReaction[]; readAt: string } {
  if (!key) return { messages: [], reactions: [], readAt: '' };
  try {
    const raw = getScopedItem(key);
    const data = raw ? JSON.parse(raw) : null;
    return {
      messages: Array.isArray(data?.messages) ? data.messages : [],
      reactions: Array.isArray(data?.reactions) ? data.reactions : [],
      // How far the table has been read, so the unread badge does not come back after reopening the app.
      readAt: typeof data?.readAt === 'string' ? data.readAt : '',
    };
  } catch {
    return { messages: [], reactions: [], readAt: '' };
  }
}

/**
 * storageKey (optional, solo Empyrean): keep the table on this phone under that key, so
 * unsent lines and NPC answers survive leaving the screen. Without it (the Arena) nothing is saved.
 */
export function useArenaRoundChat(userId: string | undefined, characterName: string, roundId: string, storageKey?: string): ArenaRoundChatApi {
  const base = useRoundChat(null, userId, characterName, roundId);
  const me = userId || 'arena-player';
  const [style, setStyle] = useState<RoundStyle>({ ...DEFAULT_ROUND_STYLE, mode: 'live' });
  const [messages, setMessages] = useState<RoundChatMessage[]>(() => readSaved(storageKey).messages);
  const [reactions, setReactions] = useState<RoundChatReaction[]>(() => readSaved(storageKey).reactions);
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>(() => {
    const at = readSaved(storageKey).readAt;
    return at ? { [me]: at } : {};
  });
  // A different key (another campaign) loads that table; saving waits until it has loaded.
  const loadedKeyRef = useRef<string | undefined>(storageKey);
  useEffect(() => {
    if (loadedKeyRef.current === storageKey) return;
    const saved = readSaved(storageKey);
    loadedKeyRef.current = storageKey;
    setMessages(saved.messages);
    setReactions(saved.reactions);
    setReadReceipts(saved.readAt ? { [me]: saved.readAt } : {});
  }, [storageKey, me]);
  useEffect(() => {
    if (!storageKey || loadedKeyRef.current !== storageKey) return;
    try {
      const kept = linesToKeep(messages);
      const ids = new Set(kept.map((m) => m.id));
      setScopedItem(storageKey, JSON.stringify({ messages: kept, reactions: reactions.filter((r) => ids.has(r.message_id)), readAt: readReceipts[me] ?? '' }));
    } catch { /* storage full or blocked: the table still works for this visit */ }
  }, [storageKey, messages, reactions, readReceipts, me]);
  const [orderOverride, setOrderOverride] = useState<string[]>([]);
  const roundRef = useRef(roundId);
  roundRef.current = roundId;

  const makeLine = useCallback((content: string, name: string, inCharacter: boolean, uid: string, npcId?: string | null): RoundChatMessage => ({
    id: crypto.randomUUID(),
    party_id: ARENA_PARTY_ID,
    user_id: uid,
    character_name: name,
    content,
    in_character: inCharacter,
    round_id: roundRef.current,
    consumed: false,
    selected: false,
    created_at: new Date().toISOString(),
    npc_id: npcId ?? null,
  }), []);

  const appendLine = useCallback((l: ArenaAppendLine) => {
    const line = makeLine(l.content, l.characterName, l.inCharacter ?? true, l.userId || me, l.npcId);
    setMessages((prev) => [...prev.slice(-299), line]);
    return line.id;
  }, [makeLine, me]);

  const postLine = useCallback(async (content: string, inCharacter: boolean, asNpc?: { npcId: string; name: string }): Promise<string | null> => {
    // Action cards are kept exactly as written; only blank lines are refused.
    if (!content.trim()) return null;
    const line = makeLine(content, asNpc ? asNpc.name : (characterName || 'Player'), asNpc ? true : inCharacter, me, asNpc?.npcId);
    setMessages((prev) => [...prev.slice(-299), line]);
    return line.id;
  }, [makeLine, characterName, me]);

  const sendMessage = useCallback(async (content: string, inCharacter: boolean) => (await postLine(content, inCharacter)) !== null, [postLine]);
  const deleteMessage = useCallback(async (id: string) => { setMessages((p) => p.filter((m) => m.id !== id)); }, []);
  const editMessage = useCallback(async (id: string, content: string) => {
    if (!content.trim()) return;
    setMessages((p) => p.map((m) => (m.id === id ? { ...m, content } : m)));
  }, []);
  const clearAllMessages = useCallback(async () => { setMessages([]); setReactions([]); }, []);
  const toggleReaction = useCallback(async (messageId: string, emoji: string, senderName: string) => {
    setReactions((p) => {
      const hit = p.find((r) => r.message_id === messageId && r.user_id === me && r.emoji === emoji);
      return hit ? p.filter((r) => r !== hit) : [...p, { id: crypto.randomUUID(), message_id: messageId, user_id: me, sender_name: senderName, emoji }];
    });
  }, [me]);
  const updateStyle = useCallback(async (patch: Partial<RoundStyle>) => { setStyle((s) => ({ ...s, ...patch })); }, []);
  const markRead = useCallback(async (iso: string) => {
    if (!iso) return;
    setReadReceipts((r) => (r[me] && r[me] >= iso ? r : { ...r, [me]: iso }));
  }, [me]);

  const pendingMessages = useMemo(() => messages.filter((m) => !m.consumed), [messages]);
  const selectedMessages = useMemo(() => pendingMessages.filter((m) => m.selected), [pendingMessages]);
  const orderedSelected = useMemo(() => {
    if (!orderOverride.length) return selectedMessages;
    const rank = new Map(orderOverride.map((id, i) => [id, i]));
    return [...selectedMessages].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  }, [selectedMessages, orderOverride]);
  const setSelectedOrder = useCallback((ids: string[]) => setOrderOverride(ids), []);
  const toggleSelected = useCallback(async (id: string) => {
    setMessages((p) => p.map((m) => (m.id === id && !m.consumed ? { ...m, selected: !m.selected } : m)));
  }, []);
  const selectAllPending = useCallback(async () => { setMessages((p) => p.map((m) => (m.consumed ? m : { ...m, selected: true }))); }, []);
  const clearSelection = useCallback(async () => { setMessages((p) => p.map((m) => ({ ...m, selected: false }))); }, []);
  const consumePending = useCallback(async () => {
    setMessages((p) => p.map((m) => (m.selected && !m.consumed ? { ...m, consumed: true, selected: false } : m)));
    setOrderOverride([]);
  }, []);

  const textOf = useCallback((m: RoundChatMessage) => {
    const body = stripActionCard(parseReply(m.content).body).trim();
    return m.npc_id ? npcLineForDm(body) : body;
  }, []);
  const pendingUserIds = useMemo(() => Array.from(new Set(selectedMessages.filter((m) => !m.npc_id).map((m) => m.user_id))), [selectedMessages]);
  const selectedParticipants = useMemo(() => {
    const map = new Map<string, { userId: string; characterName: string; text: string }>();
    for (const m of orderedSelected) {
      if (m.npc_id) continue;
      const t = textOf(m);
      if (!t) continue;
      const piece = m.in_character ? t : `(table talk) ${t}`;
      const e = map.get(m.user_id);
      if (e) e.text = `${e.text} ${piece}`; else map.set(m.user_id, { userId: m.user_id, characterName: m.character_name || 'Player', text: piece });
    }
    return Array.from(map.values());
  }, [orderedSelected, textOf]);
  const selectedNpcLines = useMemo(() => orderedSelected.filter((m) => !!m.npc_id)
    .map((m) => ({ id: m.id, npcId: m.npc_id as string, name: m.character_name || 'NPC', text: textOf(m) }))
    .filter((l) => l.text), [orderedSelected, textOf]);
  const selectedSceneLines = useMemo<StorySceneLine[]>(() => orderedSelected.filter((m) => m.in_character)
    .map((m) => ({ name: m.character_name || 'Player', npc: !!m.npc_id, text: textOf(m), replyTo: null }))
    .filter((l) => l.text), [orderedSelected, textOf]);
  const progress = useMemo(() => ({
    current: selectedMessages.length,
    waiting: pendingMessages.length,
    speakers: new Set(selectedMessages.map((m) => (m.npc_id ? `npc:${m.npc_id}` : m.user_id))).size,
    met: selectedMessages.length > 0,
  }), [selectedMessages, pendingMessages]);
  const buildRoundPrompt = useCallback(() => inCharacterBlock(orderedSelected.filter((m) => m.in_character)
    .map((m) => ({ name: m.character_name || 'Player', npc: !!m.npc_id, text: textOf(m) }))).trim(), [orderedSelected, textOf]);
  const liveTableContext = useMemo((): RoundChatApi['liveTableContext'] => ({
    ...base.liveTableContext,
    mode: 'live',
    chaosLevel: style.chaosLevel,
    hasTableTalk: orderedSelected.some((m) => !m.in_character),
    hasInCharacter: orderedSelected.some((m) => m.in_character),
    hasNpcLines: orderedSelected.some((m) => !!m.npc_id),
    hasCombat: false,
    partyId: undefined,
    combatSince: undefined,
    combatUntil: undefined,
  }), [base.liveTableContext, style.chaosLevel, orderedSelected]);

  const result: ArenaRoundChatApi = {
    ...base,
    style,
    styleLoaded: true,
    updateStyle,
    messages,
    reactions,
    sending: false,
    sendMessage,
    postLine,
    deleteMessage,
    editMessage,
    clearAllMessages,
    toggleReaction,
    pendingMessages,
    selectedMessages,
    orderedSelected,
    setSelectedOrder,
    selectedParticipants,
    selectedNpcLines,
    selectedSceneLines,
    toggleSelected,
    selectAllPending,
    clearSelection,
    pendingUserIds,
    progress,
    buildRoundPrompt,
    liveTableContext,
    consumePending,
    reload: async () => {},
    readReceipts,
    readReceiptsLoaded: true,
    markRead,
    myUnreadCount: 0,
    appendLine,
  };
  return result;
}
