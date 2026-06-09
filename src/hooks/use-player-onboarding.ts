import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OnboardingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface FinalizedCharacter {
  character_name: string;
  dragon_name: string;
  dragon_color: string;
  signet_type: string;
  year_at_basgiath: string;
  backstory: string;
  personality: string;
}

interface UsePlayerOnboardingOptions {
  partyId: string | null;
  userId: string | null;
  campaignPlan?: string;
  hostCharacterSummary?: string;
  playerExistingCharacter?: string;
}

export function usePlayerOnboarding({ partyId, userId, campaignPlan, hostCharacterSummary, playerExistingCharacter }: UsePlayerOnboardingOptions) {
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFinalized, setPendingFinalized] = useState<FinalizedCharacter | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Greeting on first open. Tailored to whether the player arrives with an existing build.
  useEffect(() => {
    if (messages.length === 0 && partyId && userId) {
      const hasExisting = (playerExistingCharacter || '').trim().length > 0;
      const greeting = hasExisting
        ? "Welcome to the campaign. I can already see the character you built — let's just confirm the details fit the host's world, fill in anything missing, and get you in. Ready when you are."
        : "Welcome to the campaign. The host has set up the world — let me catch you up, and we'll build your character together. What kind of rider do you want to play?";
      setMessages([{
        id: `msg_${Date.now()}_seed`,
        role: 'assistant',
        content: greeting,
        timestamp: Date.now(),
      }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, userId]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setError(null);

    const userMsg: OnboardingMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsSending(true);

    try {
      const history = messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
      const { data, error: invokeErr } = await supabase.functions.invoke('party-player-onboarding', {
        body: {
          user_message: trimmed,
          chat_history: history,
          campaign_plan: campaignPlan || '',
          host_character_summary: hostCharacterSummary || '',
          player_existing_character: playerExistingCharacter || '',
        },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);

      const reply = typeof data?.reply === 'string' ? data.reply : '';
      const finalized = data?.character_finalized || null;

      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      }]);

      if (finalized) {
        setPendingFinalized(finalized);
      }
    } catch (e: any) {
      console.error('[player-onboarding] send failed:', e);
      setError(e?.message || 'Onboarding request failed.');
    } finally {
      setIsSending(false);
    }
  }, [messages, isSending, campaignPlan, hostCharacterSummary, playerExistingCharacter]);

  const apply = useCallback(async (): Promise<boolean> => {
    if (!pendingFinalized || !partyId || !userId) return false;
    setIsApplying(true);
    try {
      const characterStatus = {
        dragon_name: pendingFinalized.dragon_name,
        dragon_color: pendingFinalized.dragon_color,
        signet_type: pendingFinalized.signet_type,
        year_at_basgiath: pendingFinalized.year_at_basgiath,
        backstory: pendingFinalized.backstory,
        personality: pendingFinalized.personality,
      };

      const { error: updateErr } = await supabase
        .from('party_members')
        .update({
          character_name: pendingFinalized.character_name,
          character_status: characterStatus,
          onboarding_status: 'complete',
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('party_id', partyId)
        .eq('user_id', userId);

      if (updateErr) {
        console.error('[player-onboarding] apply failed:', updateErr);
        setError(updateErr.message || 'Failed to apply character.');
        return false;
      }

      setPendingFinalized(null);
      return true;
    } catch (e: any) {
      console.error('[player-onboarding] apply unexpected error:', e);
      setError(e?.message || 'Failed to apply character.');
      return false;
    } finally {
      setIsApplying(false);
    }
  }, [pendingFinalized, partyId, userId]);

  const dismissFinalized = useCallback(() => {
    setPendingFinalized(null);
  }, []);

  return {
    messages,
    isSending,
    error,
    pendingFinalized,
    isApplying,
    send,
    apply,
    dismissFinalized,
  };
}
