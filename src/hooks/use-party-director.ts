import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DirectorCategory = 'question' | 'private_action' | 'public_action' | 'escalated' | 'rejected';

export interface DirectorMessage {
  id: string;
  party_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  category: DirectorCategory | null;
  content: string;
  consumed_by_dm: boolean;
  overridden: boolean;
  created_at: string;
}

interface UsePartyDirectorOptions {
  partyId: string | null;
  userId: string | null;
  campaignPlan?: string;
  characterContext?: string;
  /** Called when the AI classifies a message as 'public_action' — parent should submit it to the round. */
  onPublicAction?: (actionText: string) => void;
}

export function usePartyDirector({ partyId, userId, campaignPlan, characterContext, onPublicAction }: UsePartyDirectorOptions) {
  const [messages, setMessages] = useState<DirectorMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onPublicActionRef = useRef(onPublicAction);
  useEffect(() => { onPublicActionRef.current = onPublicAction; }, [onPublicAction]);

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!partyId || !userId) return;
    let cancelled = false;
    setIsLoading(true);

    supabase
      .from('party_director_messages')
      .select('*')
      .eq('party_id', partyId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return;
        if (fetchErr) {
          console.error('[party-director] fetch failed:', fetchErr);
        } else {
          setMessages((data || []) as DirectorMessage[]);
        }
        setIsLoading(false);
      });

    const channel = supabase
      .channel(`party-director-${partyId}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_director_messages', filter: `party_id=eq.${partyId}` },
        (payload) => {
          const newRow = payload.new as DirectorMessage | undefined;
          const oldRow = payload.old as DirectorMessage | undefined;
          const matchesUser = (r: DirectorMessage | undefined) => r && r.user_id === userId;
          if (!matchesUser(newRow) && !matchesUser(oldRow)) return;
          if (payload.eventType === 'INSERT' && newRow) {
            setMessages(prev => prev.some(m => m.id === newRow.id) ? prev : [...prev, newRow]);
          } else if (payload.eventType === 'UPDATE' && newRow) {
            setMessages(prev => prev.map(m => m.id === newRow.id ? newRow : m));
          } else if (payload.eventType === 'DELETE' && oldRow) {
            setMessages(prev => prev.filter(m => m.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [partyId, userId]);

  const send = useCallback(async (text: string, override?: 'private' | 'public') => {
    if (!partyId || !userId || !text.trim() || isSending) return;
    setError(null);
    setIsSending(true);
    try {
      const recentThread = messages.slice(-15).map(m => ({ role: m.role, content: m.content }));

      const { data, error: invokeErr } = await supabase.functions.invoke('party-director', {
        body: {
          party_id: partyId,
          user_id: userId,
          user_message: text.trim(),
          recent_thread: recentThread,
          campaign_plan: campaignPlan || '',
          character_context: characterContext || '',
          player_override: override || null,
        },
      });

      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);

      if (data?.category === 'public_action' && data?.public_action_text && onPublicActionRef.current) {
        onPublicActionRef.current(data.public_action_text);
      }
    } catch (e: any) {
      console.error('[party-director] send failed:', e);
      setError(e?.message || 'Director request failed.');
    } finally {
      setIsSending(false);
    }
  }, [partyId, userId, messages, campaignPlan, characterContext, isSending]);

  const overrideMessage = useCallback(async (messageId: string, newMode: 'private' | 'public') => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || msg.role !== 'user') return;
    await send(msg.content, newMode);
  }, [messages, send]);

  const clear = useCallback(async () => {
    if (!partyId || !userId) return;
    const { error: delErr } = await supabase
      .from('party_director_messages')
      .delete()
      .eq('party_id', partyId)
      .eq('user_id', userId);
    if (delErr) {
      console.error('[party-director] clear failed:', delErr);
      setError(delErr.message);
    } else {
      setMessages([]);
    }
  }, [partyId, userId]);

  return {
    messages,
    isLoading,
    isSending,
    error,
    send,
    overrideMessage,
    clear,
  };
}
