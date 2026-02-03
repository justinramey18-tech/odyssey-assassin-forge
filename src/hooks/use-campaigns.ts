// Campaign Management Hook
// CRUD operations for campaigns with localStorage persistence

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './use-toast';
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

export function useCampaigns(): UseCampaignsResult {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sessionsCache, setSessionsCache] = useState<Record<string, CampaignSession[]>>({});
  const [loading, setLoading] = useState(true);

  // Load campaigns from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      if (stored) {
        setCampaigns(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
    setLoading(false);
  }, []);

  // Save campaigns to localStorage
  const saveCampaigns = useCallback((newCampaigns: Campaign[]) => {
    try {
      localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(newCampaigns));
    } catch (error) {
      console.error('Failed to save campaigns:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not save campaign data.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Load sessions for a campaign
  const loadCampaignSessions = useCallback((campaignId: string): CampaignSession[] => {
    // Check cache first
    if (sessionsCache[campaignId]) {
      return sessionsCache[campaignId];
    }
    
    try {
      const key = `${CAMPAIGN_SESSIONS_KEY_PREFIX}${campaignId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const sessions = JSON.parse(stored);
        setSessionsCache(prev => ({ ...prev, [campaignId]: sessions }));
        return sessions;
      }
    } catch (error) {
      console.error('Failed to load campaign sessions:', error);
    }
    return [];
  }, [sessionsCache]);

  // Save sessions for a campaign
  const saveCampaignSessions = useCallback((campaignId: string, sessions: CampaignSession[]) => {
    try {
      const key = `${CAMPAIGN_SESSIONS_KEY_PREFIX}${campaignId}`;
      localStorage.setItem(key, JSON.stringify(sessions));
      setSessionsCache(prev => ({ ...prev, [campaignId]: sessions }));
    } catch (error) {
      console.error('Failed to save campaign sessions:', error);
    }
  }, []);

  // Create a new campaign
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
      saveCampaigns(updated);
      return updated;
    });
    
    toast({
      title: 'Campaign Created',
      description: `"${newCampaign.name}" is ready for sessions.`,
    });
    
    return newCampaign;
  }, [saveCampaigns, toast]);

  // Update an existing campaign
  const updateCampaign = useCallback((id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt'>>) => {
    setCampaigns(prev => {
      const updated = prev.map(c => 
        c.id === id 
          ? { ...c, ...data, updatedAt: new Date().toISOString() }
          : c
      );
      saveCampaigns(updated);
      return updated;
    });
  }, [saveCampaigns]);

  // Delete a campaign
  const deleteCampaign = useCallback((id: string) => {
    const campaign = campaigns.find(c => c.id === id);
    
    setCampaigns(prev => {
      const updated = prev.filter(c => c.id !== id);
      saveCampaigns(updated);
      return updated;
    });
    
    // Also delete sessions
    try {
      const key = `${CAMPAIGN_SESSIONS_KEY_PREFIX}${id}`;
      localStorage.removeItem(key);
      setSessionsCache(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      console.error('Failed to delete campaign sessions:', error);
    }
    
    toast({
      title: 'Campaign Deleted',
      description: campaign ? `"${campaign.name}" has been removed.` : 'Campaign removed.',
      variant: 'destructive',
    });
  }, [campaigns, saveCampaigns, toast]);

  // Get a single campaign
  const getCampaign = useCallback((id: string): Campaign | undefined => {
    return campaigns.find(c => c.id === id);
  }, [campaigns]);

  // Get sessions for a campaign
  const getCampaignSessions = useCallback((campaignId: string): CampaignSession[] => {
    return loadCampaignSessions(campaignId);
  }, [loadCampaignSessions]);

  // Add a session to a campaign
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
    
    saveCampaignSessions(campaignId, updatedSessions);
    
    // Update campaign session count and last session date
    updateCampaign(campaignId, {
      sessionCount: updatedSessions.length,
      lastSessionDate: session.sessionDate || newSession.createdAt,
    });
    
    return newSession;
  }, [loadCampaignSessions, saveCampaignSessions, updateCampaign]);

  // Delete a session
  const deleteSession = useCallback((campaignId: string, sessionId: string) => {
    const sessions = loadCampaignSessions(campaignId);
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    
    saveCampaignSessions(campaignId, updatedSessions);
    
    // Update campaign session count
    updateCampaign(campaignId, {
      sessionCount: updatedSessions.length,
      lastSessionDate: updatedSessions.length > 0 
        ? updatedSessions[updatedSessions.length - 1].sessionDate || updatedSessions[updatedSessions.length - 1].createdAt
        : undefined,
    });
  }, [loadCampaignSessions, saveCampaignSessions, updateCampaign]);

  // Calculate cumulative stats for a campaign
  const getCampaignStats = useCallback((campaignId: string): CumulativeStats => {
    const sessions = loadCampaignSessions(campaignId);
    
    let stats = createEmptyCumulativeStats();
    
    for (const session of sessions) {
      if (session.summary) {
        stats = mergeCumulativeStats(stats, session.summary);
      }
    }
    
    // Add timeline info
    if (sessions.length > 0) {
      const sortedByDate = [...sessions].sort(
        (a, b) => new Date(a.sessionDate || a.createdAt).getTime() - new Date(b.sessionDate || b.createdAt).getTime()
      );
      stats.firstSessionDate = sortedByDate[0].sessionDate || sortedByDate[0].createdAt;
      stats.lastSessionDate = sortedByDate[sortedByDate.length - 1].sessionDate || sortedByDate[sortedByDate.length - 1].createdAt;
    }
    
    return stats;
  }, [loadCampaignSessions]);

  // Batch import sessions
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
    
    saveCampaignSessions(campaignId, allSessions);
    
    // Update campaign
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
  }, [loadCampaignSessions, saveCampaignSessions, updateCampaign, toast]);

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
