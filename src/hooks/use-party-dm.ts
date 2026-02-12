import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { CharacterContext } from '@/components/oracle/types';

const AI_DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;
const SUMMARIZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm-summarize`;
const SUMMARY_INTERVAL = 10;

export interface PartyDmMessage {
  id: string;
  party_id: string;
  role: 'user' | 'assistant';
  content: string;
  sender_user_id: string | null;
  sender_name: string;
  created_at: string;
}

export interface PartyDmPrompt {
  id: string;
  party_id: string;
  user_id: string;
  character_name: string;
  prompt: string;
  is_ready: boolean;
  round_id: string;
  created_at: string;
}

export interface DmSessionConfig {
  active: boolean;
  mode: 'shared' | 'private';
  currentRoundId: string;
  campaignSummary: string | null;
  isGenerating: boolean;
}

interface UsePartyDmOptions {
  partyId: string | null;
  isCreator: boolean;
  memberCount: number;
  characterName: string;
  characterContext: CharacterContext;
  partyMembers: Array<{ character_name: string; character_status: Record<string, unknown>; user_id: string }>;
  customGuidesContent?: string;
}

export function usePartyDm({ partyId, isCreator, memberCount, characterName, characterContext, partyMembers, customGuidesContent }: UsePartyDmOptions) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PartyDmMessage[]>([]);
  const [currentPrompts, setCurrentPrompts] = useState<PartyDmPrompt[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [sessionConfig, setSessionConfig] = useState<DmSessionConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoGenTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isActive = sessionConfig?.active === true;

  // Derived: all members ready
  const allReady = currentPrompts.length > 0 &&
    currentPrompts.length >= memberCount &&
    currentPrompts.every(p => p.is_ready);

  // Load existing data when session becomes active
  useEffect(() => {
    if (!partyId || !isActive) return;

    (async () => {
      const { data: msgs } = await (supabase.from('party_dm_messages') as any)
        .select('*')
        .eq('party_id', partyId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (msgs) setMessages(msgs);

      if (sessionConfig?.currentRoundId) {
        const { data: prompts } = await (supabase.from('party_dm_prompts') as any)
          .select('*')
          .eq('party_id', partyId)
          .eq('round_id', sessionConfig.currentRoundId);
        if (prompts) setCurrentPrompts(prompts);
      }
    })();
  }, [partyId, isActive, sessionConfig?.currentRoundId]);

  // Load session config from party_shared_state
  useEffect(() => {
    if (!partyId) return;

    (async () => {
      const { data } = await (supabase.from('party_shared_state') as any)
        .select('*')
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session')
        .maybeSingle();
      if (data?.state_data) {
        setSessionConfig(data.state_data as DmSessionConfig);
      }
    })();
  }, [partyId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!partyId) return;

    const msgChannel = supabase
      .channel(`party-dm-msgs-${partyId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'party_dm_messages',
        filter: `party_id=eq.${partyId}`,
      }, (payload) => {
        const newMsg = payload.new as PartyDmMessage;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();

    const promptChannel = supabase
      .channel(`party-dm-prompts-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_dm_prompts',
        filter: `party_id=eq.${partyId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const p = payload.new as PartyDmPrompt;
          setCurrentPrompts(prev => {
            if (prev.some(x => x.id === p.id)) return prev;
            return [...prev, p];
          });
        } else if (payload.eventType === 'UPDATE') {
          const p = payload.new as PartyDmPrompt;
          setCurrentPrompts(prev => prev.map(x => x.id === p.id ? p : x));
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { id?: string };
          if (old.id) {
            setCurrentPrompts(prev => prev.filter(x => x.id !== old.id));
          } else {
            // Full round cleared — refetch
            setCurrentPrompts([]);
          }
        }
      })
      .subscribe();

    const stateChannel = supabase
      .channel(`party-dm-state-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { state_type?: string };
          if (old.state_type === 'dm_session') {
            setSessionConfig(null);
            setMessages([]);
            setCurrentPrompts([]);
          }
          return;
        }
        const row = (payload.new || payload.old) as { state_type: string; state_data: unknown };
        if (row.state_type === 'dm_session') {
          setSessionConfig(row.state_data as DmSessionConfig);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(promptChannel);
      supabase.removeChannel(stateChannel);
    };
  }, [partyId]);

  // Auto-trigger generation when all ready (host only)
  useEffect(() => {
    if (!isCreator || !allReady || isGenerating) return;
    if (autoGenTimerRef.current) clearTimeout(autoGenTimerRef.current);
    autoGenTimerRef.current = setTimeout(() => {
      generateResponse();
    }, 2000);
    return () => {
      if (autoGenTimerRef.current) clearTimeout(autoGenTimerRef.current);
    };
  }, [allReady, isCreator, isGenerating]);

  const startSession = useCallback(async (mode: 'shared' | 'private', initialCampaignSummary?: string | null) => {
    if (!partyId || !user) return;
    const roundId = crypto.randomUUID();
    const config: DmSessionConfig = {
      active: true,
      mode,
      currentRoundId: roundId,
      campaignSummary: initialCampaignSummary || null,
      isGenerating: false,
    };

    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: user.id,
      state_type: 'dm_session',
      state_data: config,
    }, { onConflict: 'party_id,user_id,state_type' });

    setSessionConfig(config);
    toast.success('Party DM session started!');
  }, [partyId, user]);

  const endSession = useCallback(async () => {
    if (!partyId || !user) return;
    await (supabase.from('party_shared_state') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');
    setSessionConfig(null);
    setMessages([]);
    setCurrentPrompts([]);
    toast.info('Party DM session ended');
  }, [partyId, user]);

  const submitPrompt = useCallback(async (text: string) => {
    if (!partyId || !user || !sessionConfig) return;
    // Check if already submitted this round
    const existing = currentPrompts.find(p => p.user_id === user.id);
    if (existing) {
      toast.error('You already submitted a prompt this round');
      return;
    }
    await (supabase.from('party_dm_prompts') as any).insert({
      party_id: partyId,
      user_id: user.id,
      character_name: characterName,
      prompt: text.trim(),
      is_ready: false,
      round_id: sessionConfig.currentRoundId,
    });
  }, [partyId, user, sessionConfig, characterName, currentPrompts]);

  const setReady = useCallback(async () => {
    if (!user) return;
    const myPrompt = currentPrompts.find(p => p.user_id === user.id);
    if (!myPrompt) return;
    await (supabase.from('party_dm_prompts') as any)
      .update({ is_ready: true })
      .eq('id', myPrompt.id);
  }, [user, currentPrompts]);

  const editPrompt = useCallback(async (newText: string) => {
    if (!user) return;
    const myPrompt = currentPrompts.find(p => p.user_id === user.id);
    if (!myPrompt || myPrompt.is_ready) return;
    await (supabase.from('party_dm_prompts') as any)
      .update({ prompt: newText.trim() })
      .eq('id', myPrompt.id);
  }, [user, currentPrompts]);

  const retractPrompt = useCallback(async () => {
    if (!user) return;
    const myPrompt = currentPrompts.find(p => p.user_id === user.id);
    if (!myPrompt || myPrompt.is_ready) return;
    await (supabase.from('party_dm_prompts') as any)
      .delete()
      .eq('id', myPrompt.id);
  }, [user, currentPrompts]);

  // Auto-summarize after every Nth assistant message
  const triggerSummaryIfNeeded = useCallback(async (allMessages: PartyDmMessage[]) => {
    if (!partyId || !isCreator || !sessionConfig) return;
    const assistantCount = allMessages.filter(m => m.role === 'assistant' && m.content).length;
    if (assistantCount === 0 || assistantCount % SUMMARY_INTERVAL !== 0) return;

    setIsSummarizing(true);
    try {
      const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await fetch(SUMMARIZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          previousSummary: sessionConfig.campaignSummary || undefined,
        }),
      });

      if (!response.ok) {
        console.error('Party DM summary generation failed:', response.status);
        return;
      }

      const data = await response.json();
      if (data.summary) {
        const updatedConfig: DmSessionConfig = {
          ...sessionConfig,
          campaignSummary: data.summary,
        };
        await (supabase.from('party_shared_state') as any)
          .update({ state_data: updatedConfig })
          .eq('party_id', partyId)
          .eq('state_type', 'dm_session');
        toast.success('Party campaign summary updated', { duration: 2000 });
      }
    } catch (error) {
      console.error('Party summary generation error:', error);
    } finally {
      setIsSummarizing(false);
    }
  }, [partyId, isCreator, sessionConfig]);

  const generateResponse = useCallback(async () => {
    if (!partyId || !user || !sessionConfig || isGenerating) return;
    if (currentPrompts.length === 0) {
      toast.error('No prompts to generate from');
      return;
    }

    setIsGenerating(true);

    // Update session state to isGenerating
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...sessionConfig, isGenerating: true } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');

    // Build combined user message
    const combined = currentPrompts
      .map(p => `[${p.character_name}]: ${p.prompt}`)
      .join('\n');

    // Insert combined user message
    await (supabase.from('party_dm_messages') as any).insert({
      party_id: partyId,
      role: 'user',
      content: combined,
      sender_user_id: user.id,
      sender_name: 'Party',
    });

    // Build party members section for system prompt
    const partyMembersSummary = partyMembers.map(m => {
      const s = m.character_status as Record<string, unknown>;
      return `- ${m.character_name} (Level ${s.level || '?'} ${s.className || 'Adventurer'}, ${s.currentHP || '?'}/${s.maxHP || '?'} HP)`;
    }).join('\n');

    // Build API messages from history
    const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
    apiMessages.push({ role: 'user', content: combined });

    // Augment character context with party info
    const augmentedContext = {
      ...characterContext,
    };

    abortRef.current = new AbortController();

    try {
      const response = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages.slice(-100),
          characterContext: augmentedContext,
          campaignSummary: sessionConfig.campaignSummary || undefined,
          customGuides: [
            customGuidesContent || '',
            `\n\n## PARTY MEMBERS\nThis is a multiplayer session. Multiple players are acting simultaneously each round.\n${partyMembersSummary}\nResolve all player actions in order, describing the scene as a cohesive narrative. Address each player character by name.`,
          ].filter(Boolean).join('\n\n'),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'AI request failed');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) assistantContent += delta;
          } catch { /* skip */ }
        }
      }

      // Insert assistant message
      if (assistantContent) {
        await (supabase.from('party_dm_messages') as any).insert({
          party_id: partyId,
          role: 'assistant',
          content: assistantContent,
          sender_user_id: null,
          sender_name: 'DM',
        });
      }

      // Clear prompts and start new round
      await (supabase.from('party_dm_prompts') as any)
        .delete()
        .eq('party_id', partyId)
        .eq('round_id', sessionConfig.currentRoundId);

      const newRoundId = crypto.randomUUID();
      const newConfig: DmSessionConfig = {
        ...sessionConfig,
        currentRoundId: newRoundId,
        isGenerating: false,
      };
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: newConfig })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');

      // Trigger summary generation (fire-and-forget, host only)
      if (assistantContent) {
        const updatedMessages = [...messages, 
          { id: '', party_id: partyId, role: 'user' as const, content: combined, sender_user_id: user.id, sender_name: 'Party', created_at: '' },
          { id: '', party_id: partyId, role: 'assistant' as const, content: assistantContent, sender_user_id: null, sender_name: 'DM', created_at: '' },
        ];
        triggerSummaryIfNeeded(updatedMessages);
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Party DM generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Generation failed');

      // Reset isGenerating
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [partyId, user, sessionConfig, isGenerating, currentPrompts, messages, characterContext, partyMembers, customGuidesContent, triggerSummaryIfNeeded]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!partyId || !isCreator) return;
    await (supabase.from('party_dm_messages') as any)
      .update({ content: newContent })
      .eq('id', messageId)
      .eq('party_id', partyId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent } : m));
    toast.success('Message updated');
  }, [partyId, isCreator]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!partyId || !isCreator) return;
    await (supabase.from('party_dm_messages') as any)
      .delete()
      .eq('id', messageId)
      .eq('party_id', partyId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
    toast.success('Message deleted');
  }, [partyId, isCreator]);

  const regenerateMessage = useCallback(async (messageId: string) => {
    if (!partyId || !user || !sessionConfig || isGenerating) return;
    // Find the message index, delete it and all messages after it
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Get the user message just before this assistant message for context
    const precedingUserMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (!precedingUserMsg) {
      toast.error('No preceding prompt found to regenerate from');
      return;
    }

    // Delete the assistant message from DB
    await (supabase.from('party_dm_messages') as any)
      .delete()
      .eq('id', messageId)
      .eq('party_id', partyId);
    setMessages(prev => prev.filter(m => m.id !== messageId));

    // Re-generate using messages up to (but not including) the deleted assistant message
    setIsGenerating(true);

    await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...sessionConfig, isGenerating: true } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');

    const historyMessages = messages.slice(0, msgIndex);
    const apiMessages = historyMessages.map(m => ({ role: m.role, content: m.content }));

    const partyMembersSummary = partyMembers.map(m => {
      const s = m.character_status as Record<string, unknown>;
      return `- ${m.character_name} (Level ${s.level || '?'} ${s.className || 'Adventurer'}, ${s.currentHP || '?'}/${s.maxHP || '?'} HP)`;
    }).join('\n');

    abortRef.current = new AbortController();

    try {
      const response = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages.slice(-100),
          characterContext,
          campaignSummary: sessionConfig.campaignSummary || undefined,
          customGuides: [
            customGuidesContent || '',
            `\n\n## PARTY MEMBERS\nThis is a multiplayer session. Multiple players are acting simultaneously each round.\n${partyMembersSummary}\nResolve all player actions in order, describing the scene as a cohesive narrative. Address each player character by name.`,
          ].filter(Boolean).join('\n\n'),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'AI request failed');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) assistantContent += delta;
          } catch { /* skip */ }
        }
      }

      if (assistantContent) {
        await (supabase.from('party_dm_messages') as any).insert({
          party_id: partyId,
          role: 'assistant',
          content: assistantContent,
          sender_user_id: null,
          sender_name: 'DM',
        });
      }

      // Reset isGenerating
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');

      toast.success('Response regenerated');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Party DM regeneration error:', error);
      toast.error(error instanceof Error ? error.message : 'Regeneration failed');

      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [partyId, user, sessionConfig, isGenerating, messages, characterContext, partyMembers, customGuidesContent]);

  const myPrompt = currentPrompts.find(p => p.user_id === user?.id) || null;

  return {
    messages,
    currentPrompts,
    sessionConfig,
    isActive,
    isGenerating: isGenerating || (sessionConfig?.isGenerating ?? false),
    isSummarizing,
    allReady,
    myPrompt,
    startSession,
    endSession,
    submitPrompt,
    editPrompt,
    retractPrompt,
    setReady,
    generateResponse,
    editMessage,
    deleteMessage,
    regenerateMessage,
  };
}
