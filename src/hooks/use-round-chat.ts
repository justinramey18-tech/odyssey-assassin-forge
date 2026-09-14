import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stripActionCard } from '@/lib/roundChatActionCard';
import { supabase } from '@/integrations/supabase/client';

const STYLE_STATE_TYPE = 'round_style';

export type RoundTriggerRule = 'total' | 'perPlayer' | 'distinct';
export type RoundStyleMode = 'ready' | 'chat' | 'live';
export type BanterLevel = 'light' | 'balanced' | 'heavy';

export interface RoundStyle {
  mode: RoundStyleMode;
  triggerRule: RoundTriggerRule;
  messageCount: number;
  /** How much comedic chaos the DM brings to asides and narration (1-10). */
  chaosLevel: number;
  /** Live DM: does table talk advance the round counter? */
  countBanter: boolean;
}

export const DEFAULT_ROUND_STYLE: RoundStyle = {
  mode: 'ready',
  triggerRule: 'total',
  messageCount: 2,
  chaosLevel: 5,
  countBanter: true,
};


export interface RoundChatMessage {
  id: string;
  party_id: string;
  user_id: string;
  character_name: string;
  content: string;
  in_character: boolean;
  round_id: string;
  consumed: boolean;
  /** Ticked by a player to be included in the next hand-off to the DM. */
  selected: boolean;
  created_at: string;
}

export interface RoundChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  sender_name: string;
  emoji: string;
}

/** Short human label for each notch of the chaos dial. */
export const CHAOS_LABELS: Record<number, string> = {
  1: 'Straight bat — pure scene, no jokes',
  2: 'Barely a smirk',
  3: 'Dry aside, then back to work',
  4: 'A quip on the way in',
  5: 'Live table host — riffs, then plays the beat',
  6: 'Teasing players by name',
  7: 'Comedy first, scene second',
  8: 'Fourth wall creaking',
  9: 'Openly unhinged commentary',
  10: 'Maximum chaos — full Deadpool energy',
};

const parseStyle = (raw: unknown): RoundStyle => {
  const data = (raw || {}) as Record<string, unknown>;
  const mode: RoundStyleMode =
    data.mode === 'chat' || data.mode === 'live' ? data.mode : 'ready';
  const rule = data.triggerRule;
  const triggerRule: RoundTriggerRule =
    rule === 'perPlayer' || rule === 'distinct' ? rule : 'total';
  const rawCount = Number(data.messageCount);
  const messageCount = Number.isFinite(rawCount)
    ? Math.min(10, Math.max(1, Math.round(rawCount)))
    : DEFAULT_ROUND_STYLE.messageCount;
  // Migrate the retired light/balanced/heavy banter picker onto the 1-10 dial.
  const rawChaos = Number(data.chaosLevel);
  const legacy = data.banterLevel;
  const chaosLevel = Number.isFinite(rawChaos)
    ? Math.min(10, Math.max(1, Math.round(rawChaos)))
    : legacy === 'light' ? 2
      : legacy === 'heavy' ? 8
      : legacy === 'balanced' ? 5
      : DEFAULT_ROUND_STYLE.chaosLevel;
  const countBanter = data.countBanter === undefined ? DEFAULT_ROUND_STYLE.countBanter : Boolean(data.countBanter);
  return { mode, triggerRule, messageCount, chaosLevel, countBanter };
};



/**
 * Chat Rounds: a live mini party-chat feed that drives the AI DM.
 * Settings live once per party (host row) in party_shared_state.
 */
export function useRoundChat(
  partyId: string | null,
  userId: string | undefined,
  characterName: string,
  roundId: string | undefined,
  ownerUserId?: string | null,
) {
  const [style, setStyle] = useState<RoundStyle>(DEFAULT_ROUND_STYLE);
  const [messages, setMessages] = useState<RoundChatMessage[]>([]);
  const [reactions, setReactions] = useState<RoundChatReaction[]>([]);
  const [sending, setSending] = useState(false);
  const roundIdRef = useRef<string | undefined>(roundId);
  useEffect(() => { roundIdRef.current = roundId; }, [roundId]);

  // ── Style ──
  const loadStyle = useCallback(async () => {
    if (!partyId) return;
    // More than one member may have written a settings row. Never fail on that:
    // prefer the host's row, otherwise the most recently saved one.
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('user_id, state_data, updated_at')
      .eq('party_id', partyId)
      .eq('state_type', STYLE_STATE_TYPE)
      .order('updated_at', { ascending: false })
      .limit(10);
    const rows = (data || []) as Array<{ user_id: string; state_data: unknown }>;
    if (rows.length === 0) return;
    const preferred = (ownerUserId && rows.find(r => r.user_id === ownerUserId)) || rows[0];
    if (preferred?.state_data) setStyle(parseStyle(preferred.state_data));
  }, [partyId, ownerUserId]);

  useEffect(() => { loadStyle(); }, [loadStyle]);

  const updateStyle = useCallback(async (patch: Partial<RoundStyle>) => {
    if (!partyId || !userId) return;
    const next = parseStyle({ ...style, ...patch });
    setStyle(next);
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: ownerUserId || userId,
      state_type: STYLE_STATE_TYPE,
      state_data: next as unknown as Record<string, unknown>,
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [partyId, userId, ownerUserId, style]);

  // ── Messages ──
  const loadMessages = useCallback(async () => {
    if (!partyId) return;
    const { data } = await (supabase.from('party_round_chat') as any)
      .select('*')
      .eq('party_id', partyId)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data || []) as RoundChatMessage[]);

    const { data: rx } = await (supabase.from('party_round_chat_reactions') as any)
      .select('id, message_id, user_id, sender_name, emoji')
      .eq('party_id', partyId);
    setReactions((rx || []) as RoundChatReaction[]);
  }, [partyId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`round-chat-${partyId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'party_round_chat',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as RoundChatMessage;
          setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, row]));
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as RoundChatMessage;
          setMessages(prev => prev.map(m => (m.id === row.id ? row : m)));
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any)?.id;
          setMessages(prev => prev.filter(m => m.id !== oldId));
        }
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'party_round_chat_reactions',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as RoundChatReaction;
          setReactions(prev => (prev.some(r => r.id === row.id) ? prev : [...prev, row]));
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any)?.id;
          setReactions(prev => prev.filter(r => r.id !== oldId));
        }
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        const row = payload.new as any;
        if (row?.state_type === STYLE_STATE_TYPE) setStyle(parseStyle(row.state_data));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  const sendMessage = useCallback(async (content: string, inCharacter: boolean) => {
    const text = content.trim();
    const round = roundIdRef.current;
    if (!partyId || !userId || !text || !round) return;
    setSending(true);
    try {
      await (supabase.from('party_round_chat') as any).insert({
        party_id: partyId,
        user_id: userId,
        character_name: characterName || 'Player',
        content: text,
        in_character: inCharacter,
        round_id: round,
      });
    } finally {
      setSending(false);
    }
  }, [partyId, userId, characterName]);

  const deleteMessage = useCallback(async (messageId: string) => {
    await (supabase.from('party_round_chat') as any).delete().eq('id', messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  /** Edit the text of a line you already sent (only before it goes to the DM). */
  const editMessage = useCallback(async (messageId: string, content: string) => {
    const text = content.trim();
    if (!text) return;
    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, content: text } : m)));
    await (supabase.from('party_round_chat') as any).update({ content: text }).eq('id', messageId);
  }, []);


  const toggleReaction = useCallback(async (messageId: string, emoji: string, senderName: string) => {
    if (!partyId || !userId) return;
    const existing = reactions.find(r => r.message_id === messageId && r.user_id === userId && r.emoji === emoji);
    if (existing) {
      setReactions(prev => prev.filter(r => r.id !== existing.id));
      await (supabase.from('party_round_chat_reactions') as any).delete().eq('id', existing.id);
    } else {
      await (supabase.from('party_round_chat_reactions') as any).insert({
        message_id: messageId,
        party_id: partyId,
        user_id: userId,
        sender_name: senderName || 'Player',
        emoji,
      });
    }
  }, [partyId, userId, reactions]);

  const isLive = style.mode === 'live';

  /**
   * Lines that are still eligible to be ticked and handed to the DM.
   * Table talk is tickable in every chat mode — whatever is ticked goes.
   */
  const pendingMessages = useMemo(
    () => messages.filter(m => !m.consumed),
    [messages],
  );

  /** Host-chosen send order (message ids). Anything not listed keeps chat order. */
  const [orderOverride, setOrderOverride] = useState<string[]>([]);

  /** Only ticked lines go to the DM. Nothing is sent automatically. */
  const selectedMessages = useMemo(
    () => pendingMessages.filter(m => m.selected),
    [pendingMessages],
  );

  /** Ticked lines in the order the host wants the DM to read them. */
  const orderedSelected = useMemo(() => {
    if (orderOverride.length === 0) return selectedMessages;
    const rank = new Map(orderOverride.map((id, i) => [id, i]));
    return [...selectedMessages].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [selectedMessages, orderOverride]);

  /** Replace the send order with an explicit list of ticked message ids. */
  const setSelectedOrder = useCallback((ids: string[]) => {
    setOrderOverride(ids);
  }, []);

  /** Tick / untick a line. Anyone at the table may do this. */
  const toggleSelected = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || msg.consumed) return;
    const next = !msg.selected;
    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, selected: next } : m)));
    await (supabase.from('party_round_chat') as any).update({ selected: next }).eq('id', messageId);
  }, [messages]);

  /** Tick every line that is still waiting. */
  const selectAllPending = useCallback(async () => {
    const ids = pendingMessages.filter(m => !m.selected).map(m => m.id);
    if (ids.length === 0) return;
    setMessages(prev => prev.map(m => (ids.includes(m.id) ? { ...m, selected: true } : m)));
    await (supabase.from('party_round_chat') as any).update({ selected: true }).in('id', ids);
  }, [pendingMessages]);

  /** Untick everything currently ticked. */
  const clearSelection = useCallback(async () => {
    const ids = selectedMessages.map(m => m.id);
    if (ids.length === 0) return;
    setMessages(prev => prev.map(m => (ids.includes(m.id) ? { ...m, selected: false } : m)));
    await (supabase.from('party_round_chat') as any).update({ selected: false }).in('id', ids);
  }, [selectedMessages]);

  /** Players whose lines are in this bundle — they must not be treated as absent. */
  const pendingUserIds = useMemo(
    () => Array.from(new Set(selectedMessages.map(m => m.user_id))),
    [selectedMessages],
  );

  /**
   * Per-player view of the ticked bundle, used for the transcript rows and so
   * the DM knows exactly who acted this round.
   */
  const selectedParticipants = useMemo(() => {
    const map = new Map<string, { userId: string; characterName: string; text: string }>();
    for (const m of orderedSelected) {
      const line = stripActionCard(m.content).trim();
      if (!line) continue;
      const entry = map.get(m.user_id);
      const piece = m.in_character ? line : `(table talk) ${line}`;
      if (entry) entry.text = `${entry.text} ${piece}`.trim();
      else map.set(m.user_id, { userId: m.user_id, characterName: m.character_name || 'Player', text: piece });
    }
    return Array.from(map.values());
  }, [orderedSelected]);

  /** How many lines are ticked and ready to be handed over. */
  const progress = useMemo(() => ({
    current: selectedMessages.length,
    waiting: pendingMessages.length,
    speakers: new Set(selectedMessages.map(m => m.user_id)).size,
    met: selectedMessages.length > 0,
  }), [selectedMessages, pendingMessages]);

  /**
   * Bundle the ticked lines for the DM. Player text only — every behavioural
   * rule (table-talk handling, [TABLE] format, chaos tone) is applied backend
   * side so the visible transcript stays clean.
   */
  const buildRoundPrompt = useCallback(() => {
    const order: string[] = [];
    const grouped = new Map<string, string[]>();
    for (const m of orderedSelected) {
      if (!m.in_character) continue;
      const key = m.character_name || 'Player';
      if (!grouped.has(key)) { grouped.set(key, []); order.push(key); }
      grouped.get(key)!.push(stripActionCard(m.content).trim());
    }
    const inCharacterBlock = order
      .map(name => `[${name}]: ${grouped.get(name)!.join(' ')}`)
      .join('\n');

    const banter = orderedSelected.filter(m => !m.in_character);
    const banterBlock = banter.length
      ? `\n\nTABLE TALK (out of character):\n${banter.map(m => `${m.character_name || 'Player'}: ${stripActionCard(m.content).trim()}`).join('\n')}`
      : '';

    return `${inCharacterBlock}${banterBlock}`.trim();
  }, [orderedSelected]);

  /** What the backend needs to apply the right table rules for this hand-off. */
  const liveTableContext = useMemo(() => ({
    mode: isLive ? ('live' as const) : ('chat' as const),
    chaosLevel: style.chaosLevel,
    hasTableTalk: orderedSelected.some(m => !m.in_character),
    hasInCharacter: orderedSelected.some(m => m.in_character),
  }), [isLive, style.chaosLevel, orderedSelected]);


  /** Mark the ticked lines as sent. Unticked lines stay available for later. */
  const consumePending = useCallback(async () => {
    if (!partyId || selectedMessages.length === 0) return;
    const ids = selectedMessages.map(m => m.id);
    setMessages(prev => prev.map(m => (ids.includes(m.id) ? { ...m, consumed: true, selected: false } : m)));
    setOrderOverride([]);
    await (supabase.from('party_round_chat') as any).update({ consumed: true, selected: false }).in('id', ids);
  }, [partyId, selectedMessages]);

  return {
    style,
    updateStyle,
    messages,
    reactions,
    sending,
    sendMessage,
    deleteMessage,
    editMessage,

    toggleReaction,
    pendingMessages,
    selectedMessages,
    orderedSelected,
    setSelectedOrder,
    selectedParticipants,
    toggleSelected,
    selectAllPending,
    clearSelection,
    pendingUserIds,
    progress,
    buildRoundPrompt,
    liveTableContext,

    consumePending,
    reload: loadMessages,
  };
}

