// Chronicle Session History Hook
// Hybrid local + cloud storage for session history and analytics

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';
import {
  ChronicleSession,
  CampaignAnalytics,
  CHRONICLE_LOCAL_SESSIONS_KEY,
  CHRONICLE_LOCAL_ANALYTICS_KEY,
  MAX_LOCAL_SESSIONS,
} from '@/lib/chronicleSync/enhancedTypes';

// Simple hash function for deduplication
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Default analytics
function getDefaultAnalytics(): CampaignAnalytics {
  return {
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    totalHealingReceived: 0,
    totalCriticalHits: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalXpEarned: 0,
    totalGoldEarned: 0,
    totalGoldSpent: 0,
    totalItemsAcquired: 0,
    totalItemsConsumed: 0,
    totalSessionsImported: 0,
    totalShortRests: 0,
    totalLongRests: 0,
    totalSpellsCast: 0,
    spellSlotsUsedByLevel: {},
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function useChronicleHistory() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  // Local state
  const [sessions, setSessions] = useState<ChronicleSession[]>([]);
  const [analytics, setAnalytics] = useState<CampaignAnalytics>(getDefaultAnalytics());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load sessions from local storage
  const loadLocalSessions = useCallback((): ChronicleSession[] => {
    migrateToScoped(CHRONICLE_LOCAL_SESSIONS_KEY);
    try {
      const stored = getScopedItem(CHRONICLE_LOCAL_SESSIONS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load local sessions:', error);
    }
    return [];
  }, []);

  // Load analytics from local storage
  const loadLocalAnalytics = useCallback((): CampaignAnalytics => {
    migrateToScoped(CHRONICLE_LOCAL_ANALYTICS_KEY);
    try {
      const stored = getScopedItem(CHRONICLE_LOCAL_ANALYTICS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load local analytics:', error);
    }
    return getDefaultAnalytics();
  }, []);

  // Save sessions to local storage
  const saveLocalSessions = useCallback((newSessions: ChronicleSession[]) => {
    try {
      // Trim to max sessions, removing oldest
      const trimmed = newSessions.slice(-MAX_LOCAL_SESSIONS);
      setScopedItem(CHRONICLE_LOCAL_SESSIONS_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save local sessions:', error);
    }
  }, []);

  // Save analytics to local storage
  const saveLocalAnalytics = useCallback((newAnalytics: CampaignAnalytics) => {
    try {
      setScopedItem(CHRONICLE_LOCAL_ANALYTICS_KEY, JSON.stringify(newAnalytics));
    } catch (error) {
      console.error('Failed to save local analytics:', error);
    }
  }, []);

  // Fetch cloud sessions
  const fetchCloudSessions = useCallback(async (): Promise<ChronicleSession[]> => {
    if (!user) return [];
    
    try {
      // Cast to bypass auto-generated types until they're regenerated
      const { data, error } = await (supabase.from('chronicle_sessions') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Map database format to our interface
      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        sessionName: row.session_name,
        inputPreview: row.input_preview,
        inputHash: row.input_hash,
        parseMode: row.parse_mode as 'ai' | 'offline',
        parsedAt: row.parsed_at,
        changesApplied: row.changes_applied,
        xpTotal: row.xp_total,
        goldGained: row.gold_gained,
        goldSpent: row.gold_spent,
        itemsAcquired: row.items_acquired,
        itemsConsumed: row.items_consumed,
        achievementsTriggered: row.achievements_triggered,
        damageDealt: row.damage_dealt,
        damageTaken: row.damage_taken,
        healingReceived: row.healing_received,
        criticalHits: row.critical_hits,
        kills: row.kills,
        spellSlotsUsed: (row.spell_slots_used as Record<string, number>) || {},
        deathSaves: (row.death_saves as { successes: number; failures: number }) || { successes: 0, failures: 0 },
        restsTaken: (row.rests_taken as { short: number; long: number }) || { short: 0, long: 0 },
        combatRounds: row.combat_rounds,
        conditionsApplied: row.conditions_applied || [],
        fullParseResult: row.full_parse_result,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('Failed to fetch cloud sessions:', error);
      return [];
    }
  }, [user]);

  // Fetch cloud analytics
  const fetchCloudAnalytics = useCallback(async (): Promise<CampaignAnalytics | null> => {
    if (!user) return null;
    
    try {
      // Cast to bypass auto-generated types until they're regenerated
      const { data, error } = await (supabase.from('campaign_analytics') as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      return {
        userId: data.user_id,
        totalDamageDealt: data.total_damage_dealt,
        totalDamageTaken: data.total_damage_taken,
        totalHealingReceived: data.total_healing_received,
        totalCriticalHits: data.total_critical_hits,
        totalKills: data.total_kills,
        totalDeaths: data.total_deaths,
        totalXpEarned: data.total_xp_earned,
        totalGoldEarned: data.total_gold_earned,
        totalGoldSpent: data.total_gold_spent,
        totalItemsAcquired: data.total_items_acquired,
        totalItemsConsumed: data.total_items_consumed,
        totalSessionsImported: data.total_sessions_imported,
        totalShortRests: data.total_short_rests,
        totalLongRests: data.total_long_rests,
        totalSpellsCast: data.total_spells_cast,
        spellSlotsUsedByLevel: (data.spell_slots_used_by_level as Record<string, number>) || {},
        deathSaveSuccesses: data.death_save_successes,
        deathSaveFailures: data.death_save_failures,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error('Failed to fetch cloud analytics:', error);
      return null;
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      
      // Always load local first
      const localSessions = loadLocalSessions();
      const localAnalytics = loadLocalAnalytics();
      
      setSessions(localSessions);
      setAnalytics(localAnalytics);
      
      // If authenticated, merge with cloud
      if (isAuthenticated && user) {
        setSyncing(true);
        try {
          const cloudSessions = await fetchCloudSessions();
          const cloudAnalytics = await fetchCloudAnalytics();
          
          // Merge sessions (cloud takes precedence for same hash)
          const cloudHashes = new Set(cloudSessions.map(s => s.inputHash));
          const uniqueLocal = localSessions.filter(s => !cloudHashes.has(s.inputHash));
          const merged = [...cloudSessions, ...uniqueLocal].sort(
            (a, b) => new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime()
          );
          
          setSessions(merged);
          saveLocalSessions(merged);
          
          // Use cloud analytics if available, otherwise merge
          if (cloudAnalytics) {
            setAnalytics(cloudAnalytics);
            saveLocalAnalytics(cloudAnalytics);
          }
        } catch (error) {
          console.error('Cloud sync failed:', error);
        } finally {
          setSyncing(false);
        }
      }
      
      setLoading(false);
    };
    
    load();
  }, [isAuthenticated, user, loadLocalSessions, loadLocalAnalytics, fetchCloudSessions, fetchCloudAnalytics, saveLocalSessions, saveLocalAnalytics]);

  // Add a new session
  const addSession = useCallback(async (session: Omit<ChronicleSession, 'id' | 'inputHash' | 'createdAt'>) => {
    const inputHash = simpleHash(session.inputPreview);
    const newSession: ChronicleSession = {
      ...session,
      id: crypto.randomUUID(),
      inputHash,
      createdAt: new Date().toISOString(),
    };
    
    // Update local state immediately
    setSessions(prev => {
      const updated = [newSession, ...prev].slice(0, MAX_LOCAL_SESSIONS);
      saveLocalSessions(updated);
      return updated;
    });
    
    // Update analytics
    setAnalytics(prev => {
      const updated: CampaignAnalytics = {
        ...prev,
        totalDamageDealt: prev.totalDamageDealt + session.damageDealt,
        totalDamageTaken: prev.totalDamageTaken + session.damageTaken,
        totalHealingReceived: prev.totalHealingReceived + session.healingReceived,
        totalCriticalHits: prev.totalCriticalHits + session.criticalHits,
        totalKills: prev.totalKills + session.kills,
        totalXpEarned: prev.totalXpEarned + session.xpTotal,
        totalGoldEarned: prev.totalGoldEarned + session.goldGained,
        totalGoldSpent: prev.totalGoldSpent + session.goldSpent,
        totalItemsAcquired: prev.totalItemsAcquired + session.itemsAcquired,
        totalItemsConsumed: prev.totalItemsConsumed + session.itemsConsumed,
        totalSessionsImported: prev.totalSessionsImported + 1,
        totalShortRests: prev.totalShortRests + (session.restsTaken?.short || 0),
        totalLongRests: prev.totalLongRests + (session.restsTaken?.long || 0),
        totalSpellsCast: prev.totalSpellsCast + Object.values(session.spellSlotsUsed || {}).reduce((a, b) => a + b, 0),
        spellSlotsUsedByLevel: mergeSpellSlots(prev.spellSlotsUsedByLevel, session.spellSlotsUsed || {}),
        deathSaveSuccesses: prev.deathSaveSuccesses + (session.deathSaves?.successes || 0),
        deathSaveFailures: prev.deathSaveFailures + (session.deathSaves?.failures || 0),
        updatedAt: new Date().toISOString(),
      };
      saveLocalAnalytics(updated);
      return updated;
    });
    
    // Sync to cloud if authenticated
    if (isAuthenticated && user) {
      try {
        // Cast to bypass auto-generated types until they're regenerated
        await (supabase.from('chronicle_sessions') as any).insert({
          id: newSession.id,
          user_id: user.id,
          session_name: newSession.sessionName,
          input_preview: newSession.inputPreview,
          input_hash: newSession.inputHash,
          parse_mode: newSession.parseMode,
          parsed_at: newSession.parsedAt,
          changes_applied: newSession.changesApplied,
          xp_total: newSession.xpTotal,
          gold_gained: newSession.goldGained,
          gold_spent: newSession.goldSpent,
          items_acquired: newSession.itemsAcquired,
          items_consumed: newSession.itemsConsumed,
          achievements_triggered: newSession.achievementsTriggered,
          damage_dealt: newSession.damageDealt,
          damage_taken: newSession.damageTaken,
          healing_received: newSession.healingReceived,
          critical_hits: newSession.criticalHits,
          kills: newSession.kills,
          spell_slots_used: newSession.spellSlotsUsed,
          death_saves: newSession.deathSaves,
          rests_taken: newSession.restsTaken,
          combat_rounds: newSession.combatRounds,
          conditions_applied: newSession.conditionsApplied,
          full_parse_result: newSession.fullParseResult,
        });
        
        // Upsert analytics - first check if exists (cast to bypass types)
        const { data: existingAnalytics } = await (supabase.from('campaign_analytics') as any)
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (existingAnalytics) {
          await (supabase.from('campaign_analytics') as any).update({
            total_damage_dealt: analytics.totalDamageDealt + session.damageDealt,
            total_damage_taken: analytics.totalDamageTaken + session.damageTaken,
            total_healing_received: analytics.totalHealingReceived + session.healingReceived,
            total_critical_hits: analytics.totalCriticalHits + session.criticalHits,
            total_kills: analytics.totalKills + session.kills,
            total_xp_earned: analytics.totalXpEarned + session.xpTotal,
            total_gold_earned: analytics.totalGoldEarned + session.goldGained,
            total_gold_spent: analytics.totalGoldSpent + session.goldSpent,
            total_items_acquired: analytics.totalItemsAcquired + session.itemsAcquired,
            total_items_consumed: analytics.totalItemsConsumed + session.itemsConsumed,
            total_sessions_imported: analytics.totalSessionsImported + 1,
            total_short_rests: analytics.totalShortRests + (session.restsTaken?.short || 0),
            total_long_rests: analytics.totalLongRests + (session.restsTaken?.long || 0),
            total_spells_cast: analytics.totalSpellsCast + Object.values(session.spellSlotsUsed || {}).reduce((a, b) => a + b, 0),
            spell_slots_used_by_level: mergeSpellSlots(analytics.spellSlotsUsedByLevel, session.spellSlotsUsed || {}),
            death_save_successes: analytics.deathSaveSuccesses + (session.deathSaves?.successes || 0),
            death_save_failures: analytics.deathSaveFailures + (session.deathSaves?.failures || 0),
          }).eq('user_id', user.id);
        } else {
          await (supabase.from('campaign_analytics') as any).insert({
            user_id: user.id,
            total_damage_dealt: session.damageDealt,
            total_damage_taken: session.damageTaken,
            total_healing_received: session.healingReceived,
            total_critical_hits: session.criticalHits,
            total_kills: session.kills,
            total_xp_earned: session.xpTotal,
            total_gold_earned: session.goldGained,
            total_gold_spent: session.goldSpent,
            total_items_acquired: session.itemsAcquired,
            total_items_consumed: session.itemsConsumed,
            total_sessions_imported: 1,
            total_short_rests: session.restsTaken?.short || 0,
            total_long_rests: session.restsTaken?.long || 0,
            total_spells_cast: Object.values(session.spellSlotsUsed || {}).reduce((a, b) => a + b, 0),
            spell_slots_used_by_level: session.spellSlotsUsed || {},
            death_save_successes: session.deathSaves?.successes || 0,
            death_save_failures: session.deathSaves?.failures || 0,
          });
        }
      } catch (error) {
        console.error('Failed to sync session to cloud:', error);
        toast({
          title: 'Cloud sync failed',
          description: 'Session saved locally only.',
          variant: 'destructive',
        });
      }
    }
    
    return newSession;
  }, [isAuthenticated, user, analytics, saveLocalSessions, saveLocalAnalytics, toast]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      saveLocalSessions(updated);
      return updated;
    });
    
    if (isAuthenticated && user) {
      try {
        await (supabase.from('chronicle_sessions') as any)
          .delete()
          .eq('id', sessionId)
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Failed to delete cloud session:', error);
      }
    }
  }, [isAuthenticated, user, saveLocalSessions]);

  // Clear all history
  const clearHistory = useCallback(async () => {
    setSessions([]);
    setAnalytics(getDefaultAnalytics());
    saveLocalSessions([]);
    saveLocalAnalytics(getDefaultAnalytics());
    
    if (isAuthenticated && user) {
      try {
        await (supabase.from('chronicle_sessions') as any)
          .delete()
          .eq('user_id', user.id);
        
        await (supabase.from('campaign_analytics') as any)
          .delete()
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Failed to clear cloud history:', error);
      }
    }
  }, [isAuthenticated, user, saveLocalSessions, saveLocalAnalytics]);

  return {
    sessions,
    analytics,
    loading,
    syncing,
    isCloudEnabled: isAuthenticated,
    addSession,
    deleteSession,
    clearHistory,
  };
}

// Helper to merge spell slot counts
function mergeSpellSlots(
  existing: Record<string, number>,
  incoming: Record<string, number>
): Record<string, number> {
  const result = { ...existing };
  for (const [level, count] of Object.entries(incoming)) {
    result[level] = (result[level] || 0) + count;
  }
  return result;
}
