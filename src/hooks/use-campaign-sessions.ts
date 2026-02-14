import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Message } from '@/components/oracle/types';

export interface CampaignSession {
  id: string;
  name: string;
  messages: Message[];
  campaign_summary: string | null;
  gm_guide_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useCampaignSessions() {
  const [sessions, setSessions] = useState<CampaignSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Check auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load sessions when user is available
  const loadSessions = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_dm_campaigns')
        .select('id, name, messages, campaign_summary, gm_guide_ids, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const mapped: CampaignSession[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        messages: Array.isArray(row.messages)
          ? row.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
          : [],
        campaign_summary: row.campaign_summary,
        gm_guide_ids: row.gm_guide_ids,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
      setSessions(mapped);
    } catch (error) {
      console.error('Failed to load campaign sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadSessions();
  }, [userId, loadSessions]);

  const saveSession = useCallback(async (
    name: string,
    messages: Message[],
    campaignSummary: string | null,
    existingId?: string,
  ): Promise<string | null> => {
    if (!userId) {
      toast.error('Sign in to save campaigns');
      return null;
    }
    try {
      const serializedMessages = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      }));

      if (existingId) {
        const { error } = await supabase
          .from('ai_dm_campaigns')
          .update({
            name,
            messages: serializedMessages as any,
            campaign_summary: campaignSummary,
          })
          .eq('id', existingId)
          .eq('user_id', userId);
        if (error) throw error;
        toast.success('Campaign saved');
        await loadSessions();
        return existingId;
      } else {
        const { data, error } = await supabase
          .from('ai_dm_campaigns')
          .insert({
            user_id: userId,
            name,
            messages: serializedMessages as any,
            campaign_summary: campaignSummary,
          })
          .select('id')
          .single();
        if (error) throw error;
        toast.success('Campaign saved');
        await loadSessions();
        return data.id;
      }
    } catch (error) {
      console.error('Failed to save campaign:', error);
      toast.error('Failed to save campaign');
      return null;
    }
  }, [userId, loadSessions]);

  const deleteSession = useCallback(async (id: string) => {
    if (!userId) {
      toast.error('Sign in to delete campaigns');
      return;
    }
    try {
      const { error, count } = await supabase
        .from('ai_dm_campaigns')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      toast.success('Campaign deleted');
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      toast.error('Failed to delete campaign');
    }
  }, [userId]);

  const renameSession = useCallback(async (id: string, name: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('ai_dm_campaigns')
        .update({ name })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    } catch (error) {
      console.error('Failed to rename campaign:', error);
      toast.error('Failed to rename campaign');
    }
  }, [userId]);

  // Silent upsert for background auto-save (no toasts, no session list refresh)
  const silentSave = useCallback(async (
    name: string,
    messages: Message[],
    campaignSummary: string | null,
    existingId?: string,
  ): Promise<string | null> => {
    if (!userId) return null;
    try {
      const serializedMessages = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      }));

      if (existingId) {
        const { error } = await supabase
          .from('ai_dm_campaigns')
          .update({
            name,
            messages: serializedMessages as any,
            campaign_summary: campaignSummary,
          })
          .eq('id', existingId)
          .eq('user_id', userId);
        if (error) throw error;
        return existingId;
      } else {
        const { data, error } = await supabase
          .from('ai_dm_campaigns')
          .insert({
            user_id: userId,
            name,
            messages: serializedMessages as any,
            campaign_summary: campaignSummary,
          })
          .select('id')
          .single();
        if (error) throw error;
        return data.id;
      }
    } catch (error) {
      console.warn('[Cloud Auto-Save] Failed:', error);
      return null;
    }
  }, [userId]);

  return {
    sessions,
    isLoading,
    isSignedIn: !!userId,
    saveSession,
    silentSave,
    deleteSession,
    renameSession,
    refreshSessions: loadSessions,
  };
}
