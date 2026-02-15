// Campaign Management Hook
// CRUD operations for campaigns with dual-layer persistence (localStorage + cloud)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Campaign,
  CampaignSession,
  CumulativeStats,
  SessionSummary,
  CAMPAIGNS_STORAGE_KEY,
  CAMPAIGN_SESSIONS_KEY_PREFIX,
  createEmptyCumulativeStats,
  createEmptySessionSummary,
  mergeCumulativeStats,
} from '@/lib/chronicleSync/multiSession/types';

export interface UseCampaignsResult {
  campaigns: Campaign[];
  loading: boolean;
  
  // Campaign CRUD
  createCampaign: (data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'sessionCount' | 'tags'> & { tags?: string[] }) => Campaign;
  updateCampaign: (id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt'>>) => void;
  deleteCampaign: (id: string) => void;
  getCampaign: (id: string) => Campaign | undefined;
  
  // Session management
  getCampaignSessions: (campaignId: string) => CampaignSession[];
  addSessionToCampaign: (campaignId: string, session: Omit<CampaignSession, 'id' | 'campaignId' | 'createdAt'>) => CampaignSession;
  deleteSession: (campaignId: string, sessionId: string) => void;
  
  // Stats
  getCampaignStats: (campaignId: string) => CumulativeStats;
  
  // Batch operations
  importSessions: (campaignId: string, sessions: Array<Omit<CampaignSession, 'id' | 'campaignId' | 'createdAt'>>) => CampaignSession[];
}

// ===== localStorage helpers =====

function loadLocalCampaigns(): Campaign[] {
  try {
    const stored = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveLocalCampaigns(campaigns: Campaign[]): void {
  try { localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns)); }
  catch (e) { console.error('Failed to save campaigns:', e); }
}

function loadLocalSessions(campaignId: string): CampaignSession[] {
  try {
    const stored = localStorage.getItem(`${CAMPAIGN_SESSIONS_KEY_PREFIX}${campaignId}`);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveLocalSessions(campaignId: string, sessions: CampaignSession[]): void {
  try { localStorage.setItem(`${CAMPAIGN_SESSIONS_KEY_PREFIX}${campaignId}`, JSON.stringify(sessions)); }
  catch (e) { console.error('Failed to save sessions:', e); }
}

// ===== Cloud helpers =====

function campaignToCloudRow(c: Campaign, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    description: c.description ?? null,
    dm_name: c.dmName ?? null,
    setting: c.setting ?? null,
    start_date: c.startDate ?? null,
    current_arc: c.currentArc ?? null,
    session_count: c.sessionCount,
    last_session_date: c.lastSessionDate ?? null,
    tags: c.tags,
    gm_guide_ids: c.gmGuideIds ?? [],
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function cloudRowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    dmName: row.dm_name ?? undefined,
    setting: row.setting ?? undefined,
    startDate: row.start_date ?? undefined,
    currentArc: row.current_arc ?? undefined,
    sessionCount: row.session_count ?? 0,
    lastSessionDate: row.last_session_date ?? undefined,
    tags: row.tags ?? [],
    gmGuideIds: row.gm_guide_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sessionToCloudRow(s: CampaignSession, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    campaign_id: s.campaignId,
    session_number: s.sessionNumber,
    session_name: s.sessionName,
    session_date: s.sessionDate ?? null,
    input_preview: s.inputPreview,
    input_hash: s.inputHash,
    input_length: s.inputLength,
    parse_mode: s.parseMode,
    parsed_at: s.parsedAt,
    parse_result: s.parseResult as any ?? null,
    enhanced_patterns: s.enhancedPatterns as any ?? null,
    summary: s.summary as any ?? null,
    arc_markers: s.arcMarkers as any ?? [],
    notes: s.notes ?? null,
    created_at: s.createdAt,
  };
}

function cloudRowToSession(row: any): CampaignSession {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    sessionNumber: row.session_number,
    sessionName: row.session_name,
    sessionDate: row.session_date ?? undefined,
    inputPreview: row.input_preview,
    inputHash: row.input_hash,
    inputLength: row.input_length,
    parseMode: row.parse_mode,
    parsedAt: row.parsed_at,
    parseResult: row.parse_result ?? undefined,
    enhancedPatterns: row.enhanced_patterns ?? undefined,
    summary: row.summary ?? undefined,
    arcMarkers: row.arc_markers ?? [],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ===== Hook =====

export function useCampaigns(): UseCampaignsResult {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadLocalCampaigns());
  const [sessionsCache, setSessionsCache] = useState<Record<string, CampaignSession[]>>({});
  const [loading, setLoading] = useState(true);

  // Cloud sync on mount
  useEffect(() => {
    let cancelled = false;

    const syncCloud = async () => {
      const session = await getSession();
      if (!session || cancelled) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('chronicle_campaigns')
        .select('*')
        .order('created_at', { ascending: true });

      if (error || cancelled) { setLoading(false); return; }

      if (data && data.length > 0) {
        const cloudCampaigns = data.map(cloudRowToCampaign);
        const cloudIds = new Set(cloudCampaigns.map(c => c.id));
        const local = loadLocalCampaigns();
        const localOnly = local.filter(c => !cloudIds.has(c.id));
        const merged = [...cloudCampaigns, ...localOnly];

        if (!cancelled) {
          setCampaigns(merged);
          saveLocalCampaigns(merged);
        }

        // Push local-only campaigns to cloud
        for (const c of localOnly) {
          await supabase.from('chronicle_campaigns').upsert(campaignToCloudRow(c, session.user.id));
          // Also push their sessions
          const sessions = loadLocalSessions(c.id);
          for (const s of sessions) {
            await supabase.from('chronicle_campaign_sessions').upsert(sessionToCloudRow(s, session.user.id));
          }
        }
      } else {
        // No cloud data — push all local to cloud
        const local = loadLocalCampaigns();
        for (const c of local) {
          await supabase.from('chronicle_campaigns').upsert(campaignToCloudRow(c, session.user.id));
          const sessions = loadLocalSessions(c.id);
          for (const s of sessions) {
            await supabase.from('chronicle_campaign_sessions').upsert(sessionToCloudRow(s, session.user.id));
          }
        }
      }

      if (!cancelled) setLoading(false);
    };

    syncCloud();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Cloud persist helpers =====

  const persistCampaignToCloud = useCallback(async (campaign: Campaign) => {
    const session = await getSession();
    if (!session) return;
    await supabase.from('chronicle_campaigns').upsert(campaignToCloudRow(campaign, session.user.id));
  }, []);

  const deleteCampaignFromCloud = useCallback(async (id: string) => {
    const session = await getSession();
    if (!session) return;
    await supabase.from('chronicle_campaigns').delete().eq('id', id);
    // Sessions cascade-deleted automatically
  }, []);

  const persistSessionToCloud = useCallback(async (s: CampaignSession) => {
    const session = await getSession();
    if (!session) return;
    await supabase.from('chronicle_campaign_sessions').upsert(sessionToCloudRow(s, session.user.id));
  }, []);

  const deleteSessionFromCloud = useCallback(async (sessionId: string) => {
    const session = await getSession();
    if (!session) return;
    await supabase.from('chronicle_campaign_sessions').delete().eq('id', sessionId);
  }, []);

  // ===== Session cache helpers =====

  const loadCampaignSessions = useCallback((campaignId: string): CampaignSession[] => {
    if (sessionsCache[campaignId]) return sessionsCache[campaignId];

    const sessions = loadLocalSessions(campaignId);
    if (sessions.length > 0) {
      setSessionsCache(prev => ({ ...prev, [campaignId]: sessions }));
    }
    return sessions;
  }, [sessionsCache]);

  const saveSessions = useCallback((campaignId: string, sessions: CampaignSession[]) => {
    saveLocalSessions(campaignId, sessions);
    setSessionsCache(prev => ({ ...prev, [campaignId]: sessions }));
  }, []);

  // ===== Campaign CRUD =====

  const createCampaign = useCallback((
    data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'sessionCount' | 'tags'> & { tags?: string[] }
  ): Campaign => {
    const now = new Date().toISOString();
    const newCampaign: Campaign = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      sessionCount: 0,
      tags: data.tags || [],
    };

    setCampaigns(prev => {
      const updated = [...prev, newCampaign];
      saveLocalCampaigns(updated);
      return updated;
    });

    persistCampaignToCloud(newCampaign);

    toast({
      title: 'Campaign Created',
      description: `"${newCampaign.name}" is ready for sessions.`,
    });

    return newCampaign;
  }, [persistCampaignToCloud, toast]);

  const updateCampaign = useCallback((id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt'>>) => {
    setCampaigns(prev => {
      const updated = prev.map(c => {
        if (c.id !== id) return c;
        const merged = { ...c, ...data, updatedAt: new Date().toISOString() };
        persistCampaignToCloud(merged);
        return merged;
      });
      saveLocalCampaigns(updated);
      return updated;
    });
  }, [persistCampaignToCloud]);

  const deleteCampaign = useCallback((id: string) => {
    const campaign = campaigns.find(c => c.id === id);

    setCampaigns(prev => {
      const updated = prev.filter(c => c.id !== id);
      saveLocalCampaigns(updated);
      return updated;
    });

    // Delete local sessions
    try {
      localStorage.removeItem(`${CAMPAIGN_SESSIONS_KEY_PREFIX}${id}`);
      setSessionsCache(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      console.error('Failed to delete campaign sessions:', error);
    }

    deleteCampaignFromCloud(id);

    toast({
      title: 'Campaign Deleted',
      description: campaign ? `"${campaign.name}" has been removed.` : 'Campaign removed.',
      variant: 'destructive',
    });
  }, [campaigns, deleteCampaignFromCloud, toast]);

  const getCampaign = useCallback((id: string): Campaign | undefined => {
    return campaigns.find(c => c.id === id);
  }, [campaigns]);

  // ===== Session management =====

  const getCampaignSessions = useCallback((campaignId: string): CampaignSession[] => {
    return loadCampaignSessions(campaignId);
  }, [loadCampaignSessions]);

  const addSessionToCampaign = useCallback((
    campaignId: string,
    session: Omit<CampaignSession, 'id' | 'campaignId' | 'createdAt'>
  ): CampaignSession => {
    const sessions = loadCampaignSessions(campaignId);

    const newSession: CampaignSession = {
      ...session,
      id: crypto.randomUUID(),
      campaignId,
      createdAt: new Date().toISOString(),
    };

    const updatedSessions = [...sessions, newSession].sort(
      (a, b) => a.sessionNumber - b.sessionNumber
    );

    saveSessions(campaignId, updatedSessions);
    persistSessionToCloud(newSession);

    updateCampaign(campaignId, {
      sessionCount: updatedSessions.length,
      lastSessionDate: session.sessionDate || newSession.createdAt,
    });

    return newSession;
  }, [loadCampaignSessions, saveSessions, persistSessionToCloud, updateCampaign]);

  const deleteSession = useCallback((campaignId: string, sessionId: string) => {
    const sessions = loadCampaignSessions(campaignId);
    const updatedSessions = sessions.filter(s => s.id !== sessionId);

    saveSessions(campaignId, updatedSessions);
    deleteSessionFromCloud(sessionId);

    updateCampaign(campaignId, {
      sessionCount: updatedSessions.length,
      lastSessionDate: updatedSessions.length > 0
        ? updatedSessions[updatedSessions.length - 1].sessionDate || updatedSessions[updatedSessions.length - 1].createdAt
        : undefined,
    });
  }, [loadCampaignSessions, saveSessions, deleteSessionFromCloud, updateCampaign]);

  // ===== Stats =====

  const getCampaignStats = useCallback((campaignId: string): CumulativeStats => {
    const sessions = loadCampaignSessions(campaignId);

    let stats = createEmptyCumulativeStats();

    for (const session of sessions) {
      if (session.summary) {
        stats = mergeCumulativeStats(stats, session.summary);
      }
    }

    if (sessions.length > 0) {
      const sortedByDate = [...sessions].sort(
        (a, b) => new Date(a.sessionDate || a.createdAt).getTime() - new Date(b.sessionDate || b.createdAt).getTime()
      );
      stats.firstSessionDate = sortedByDate[0].sessionDate || sortedByDate[0].createdAt;
      stats.lastSessionDate = sortedByDate[sortedByDate.length - 1].sessionDate || sortedByDate[sortedByDate.length - 1].createdAt;
    }

    return stats;
  }, [loadCampaignSessions]);

  // ===== Batch import =====

  const importSessions = useCallback((
    campaignId: string,
    sessions: Array<Omit<CampaignSession, 'id' | 'campaignId' | 'createdAt'>>
  ): CampaignSession[] => {
    const existingSessions = loadCampaignSessions(campaignId);
    const startNumber = existingSessions.length + 1;

    const newSessions: CampaignSession[] = sessions.map((session, index) => ({
      ...session,
      id: crypto.randomUUID(),
      campaignId,
      sessionNumber: session.sessionNumber || startNumber + index,
      createdAt: new Date().toISOString(),
    }));

    const allSessions = [...existingSessions, ...newSessions].sort(
      (a, b) => a.sessionNumber - b.sessionNumber
    );

    saveSessions(campaignId, allSessions);

    // Persist all new sessions to cloud
    for (const s of newSessions) {
      persistSessionToCloud(s);
    }

    const lastSession = allSessions[allSessions.length - 1];
    updateCampaign(campaignId, {
      sessionCount: allSessions.length,
      lastSessionDate: lastSession?.sessionDate || lastSession?.createdAt,
    });

    toast({
      title: 'Batch Import Complete',
      description: `Added ${newSessions.length} sessions to campaign.`,
    });

    return newSessions;
  }, [loadCampaignSessions, saveSessions, persistSessionToCloud, updateCampaign, toast]);

  return {
    campaigns,
    loading,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaign,
    getCampaignSessions,
    addSessionToCampaign,
    deleteSession,
    getCampaignStats,
    importSessions,
  };
}
