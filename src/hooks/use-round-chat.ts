import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STYLE_STATE_TYPE = 'round_style';

export type RoundTriggerRule = 'total' | 'perPlayer' | 'distinct';
export type RoundStyleMode = 'ready' | 'chat';

export interface RoundStyle {
  mode: RoundStyleMode;
  triggerRule: RoundTriggerRule;
  messageCount: number;
}

export const DEFAULT_ROUND_STYLE: RoundStyle = {
  mode: 'ready',
  triggerRule: 'total',
  messageCount: 2,
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

const parseStyle = (raw: unknown): RoundStyle => {
  const data = (raw || {}) as Record<string, unknown>;
  const mode: RoundStyleMode = data.mode === 'chat' ? 'chat' : 'ready';
  const rule = data.triggerRule;
  const triggerRule: RoundTriggerRule =
    rule === 'perPlayer' || rule === 'distinct' ? rule : 'total';
  const rawCount = Number(data.messageCount);
  const messageCount = Number.isFinite(rawCount)
    ? Math.min(10, Math.max(1, Math.round(rawCount)))
    : DEFAULT_ROUND_STYLE.messageCount;
  return { mode, triggerRule, messageCount };
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

  /** In-character, not-yet-sent lines for the current round. */
  const pendingMessages = useMemo(
    () => messages.filter(m => m.round_id === roundId && m.in_character && !m.consumed),
    [messages, roundId],
  );

  /** How far along the round is, given the host's trigger rule. */
  const progress = useMemo(() => {
    const n = style.messageCount;
    if (style.triggerRule === 'total') {
      return { current: pendingMessages.length, target: n, met: pendingMessages.length >= n };
    }
    const byUser = new Map<string, number>();
    for (const m of pendingMessages) byUser.set(m.user_id, (byUser.get(m.user_id) || 0) + 1);
    if (style.triggerRule === 'distinct') {
      const distinct = byUser.size;
      return { current: distinct, target: n, met: distinct >= n };
    }
    // perPlayer: every player who has posted must reach n, and at least one has
    const counts = Array.from(byUser.values());
    const satisfied = counts.length > 0 && counts.every(c => c >= n);
    const lowest = counts.length > 0 ? Math.min(...counts) : 0;
    return { current: lowest, target: n, met: satisfied };
  }, [pendingMessages, style]);

  /** Bundle the round's in-character lines, grouped per character in order. */
  const buildRoundPrompt = useCallback(() => {
    const order: string[] = [];
    const grouped = new Map<string, string[]>();
    for (const m of pendingMessages) {
      const key = m.character_name || 'Player';
      if (!grouped.has(key)) { grouped.set(key, []); order.push(key); }
      grouped.get(key)!.push(m.content.trim());
    }
    return order
      .map(name => `[${name}]: ${grouped.get(name)!.join(' ')}`)
      .join('\n');
  }, [pendingMessages]);

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
