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
  /** Live DM: how hard the DM plays with out-of-character table talk. */
  banterLevel: BanterLevel;
  /** Live DM: does table talk advance the round counter? */
  countBanter: boolean;
}

export const DEFAULT_ROUND_STYLE: RoundStyle = {
  mode: 'ready',
  triggerRule: 'total',
  messageCount: 2,
  banterLevel: 'balanced',
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
  created_at: string;
}

export interface RoundChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  sender_name: string;
  emoji: string;
}

const BANTER_INSTRUCTIONS: Record<BanterLevel, string> = {
  light: 'Acknowledge the table talk with at most a passing nod or a single dry word, then get on with the scene.',
  balanced: 'Open with one quick quip or aside to the table about their banter, then deliver the scene beat.',
  heavy: 'Lean into the bit — riff on the banter, tease players by name, play with the joke for a couple of lines before steering back into the scene.',
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
  const lvl = data.banterLevel;
  const banterLevel: BanterLevel =
    lvl === 'light' || lvl === 'heavy' || lvl === 'balanced' ? lvl : DEFAULT_ROUND_STYLE.banterLevel;
  const countBanter = data.countBanter === undefined ? DEFAULT_ROUND_STYLE.countBanter : Boolean(data.countBanter);
  return { mode, triggerRule, messageCount, banterLevel, countBanter };
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
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', STYLE_STATE_TYPE)
      .maybeSingle();
    if (data?.state_data) setStyle(parseStyle(data.state_data));
  }, [partyId]);

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
   * Every not-yet-sent line the DM will receive. Deliberately NOT filtered by
   * round_id: a message posted a moment either side of a round rollover would
   * otherwise be stranded and never reach the DM.
   */
  const pendingMessages = useMemo(
    () => messages.filter(m => (
      !m.consumed && (isLive || m.in_character)
    )),
    [messages, isLive],
  );

  /** Players whose lines are in this bundle — they must not be treated as absent. */
  const pendingUserIds = useMemo(
    () => Array.from(new Set(pendingMessages.map(m => m.user_id))),
    [pendingMessages],
  );

  /** The subset that advances the round counter. */
  const countedMessages = useMemo(
    () => (isLive && !style.countBanter ? pendingMessages.filter(m => m.in_character) : pendingMessages),
    [pendingMessages, isLive, style.countBanter],
  );

  /** How far along the round is, given the host's trigger rule. */
  const progress = useMemo(() => {
    const n = style.messageCount;
    const banterExcluded = isLive && !style.countBanter;
    if (style.triggerRule === 'total') {
      return { current: countedMessages.length, target: n, met: countedMessages.length >= n, banterExcluded };
    }
    const byUser = new Map<string, number>();
    for (const m of countedMessages) byUser.set(m.user_id, (byUser.get(m.user_id) || 0) + 1);
    if (style.triggerRule === 'distinct') {
      const distinct = byUser.size;
      return { current: distinct, target: n, met: distinct >= n, banterExcluded };
    }
    // perPlayer: every player who has posted must reach n, and at least one has
    const counts = Array.from(byUser.values());
    const satisfied = counts.length > 0 && counts.every(c => c >= n);
    const lowest = counts.length > 0 ? Math.min(...counts) : 0;
    return { current: lowest, target: n, met: satisfied, banterExcluded };
  }, [countedMessages, style, isLive]);

  /**
   * Bundle the round for the DM. In-character lines are grouped per character;
   * in Live DM mode the table's out-of-character banter rides along in its own
   * clearly marked block, behind a persona directive.
   */
  const buildRoundPrompt = useCallback(() => {
    const order: string[] = [];
    const grouped = new Map<string, string[]>();
    for (const m of pendingMessages) {
      if (!m.in_character) continue;
      const key = m.character_name || 'Player';
      if (!grouped.has(key)) { grouped.set(key, []); order.push(key); }
      grouped.get(key)!.push(stripActionCard(m.content).trim());
    }
    const inCharacterBlock = order
      .map(name => `[${name}]: ${grouped.get(name)!.join(' ')}`)
      .join('\n');

    if (!isLive) return inCharacterBlock;

    const banter = pendingMessages.filter(m => !m.in_character);
    const banterBlock = banter.length
      ? `\n\nTABLE TALK (out of character):\n${banter.map(m => `${m.character_name || 'Player'}: ${stripActionCard(m.content).trim()}`).join('\n')}`
      : '';

    const directive = [
      'OOC: LIVE TABLE MODE. You are running this session like a live tabletop game master in the vein of Anthony Burch — fast, warm, funny, improv-minded, comfortable breaking for a joke and then snapping the table back into the fiction.',
      'Lines under TABLE TALK are the real people at the table talking out of character. They are NOT things the characters said or did. Never turn banter into a character action and never let the characters hear it.',
      BANTER_INSTRUCTIONS[style.banterLevel],
      'FORMAT: if you say anything to the table out of character (an aside, a joke, a rules note, an answer to banter), put it FIRST and wrap it exactly in [TABLE] ... [/TABLE]. Everything after that block is pure in-fiction narration with no [TABLE] tags. If you have no aside, omit the block entirely.',
      banter.length && !inCharacterBlock
        ? 'This round has only table talk and no character actions — answer the table briefly and conversationally; do not force a full scene beat.'
        : 'Keep any table-side aside short and clearly separate, then deliver a proper scene beat driven only by the in-character actions below.',
    ].join('\n');

    return `${directive}\n\n${inCharacterBlock}${banterBlock}`.trim();
  }, [pendingMessages, isLive, style.banterLevel]);

  /** Mark this round's lines as sent so they don't count toward the next round. */
  const consumePending = useCallback(async () => {
    if (!partyId || pendingMessages.length === 0) return;
    const ids = pendingMessages.map(m => m.id);
    setMessages(prev => prev.map(m => (ids.includes(m.id) ? { ...m, consumed: true } : m)));
    await (supabase.from('party_round_chat') as any).update({ consumed: true }).in('id', ids);
  }, [partyId, pendingMessages]);

  return {
    style,
    updateStyle,
    messages,
    reactions,
    sending,
    sendMessage,
    deleteMessage,
    toggleReaction,
    pendingMessages,
    progress,
    buildRoundPrompt,
    consumePending,
    reload: loadMessages,
  };
}
