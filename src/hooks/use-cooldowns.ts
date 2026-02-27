import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { toast } from 'sonner';
import { CharacterAbility } from '@/lib/types';
import {
  AbilityCooldownState,
  CooldownModifier,
  SessionState,
  CooldownSettings,
  CooldownSaveState,
  SessionStatistics,
  DEFAULT_COOLDOWN_SETTINGS,
  DEFAULT_SESSION_STATE,
} from '@/lib/cooldowns/types';
import {
  COOLDOWN_CONFIGS,
  SHORT_REST_THRESHOLD,
  calculateEffectiveCooldown,
} from '@/lib/cooldowns/config';
import {
  sendCooldownReadyNotification,
  playCooldownReadySound,
  formatRemainingTime as formatTime,
} from '@/lib/cooldowns/notifications';

const STORAGE_KEY = 'odyssey-cooldown-state';
const SETTINGS_KEY = 'odyssey-cooldown-settings';
const UPDATE_INTERVAL = 1000; // 1 second updates for TTRPG-length cooldowns
const SAVE_DEBOUNCE = 5000; // Save every 5 seconds

interface UseCooldownsOptions {
  characterAbilities: CharacterAbility[];
  isHonestMode: boolean;
  enforceCooldowns: boolean;
}

export function useCooldowns({
  characterAbilities,
  isHonestMode,
  enforceCooldowns,
}: UseCooldownsOptions) {
  // State
  const [cooldowns, setCooldowns] = useState<Map<string, AbilityCooldownState>>(new Map());
  const [modifiers, setModifiers] = useState<CooldownModifier[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>(DEFAULT_SESSION_STATE);
  const [settings, setSettings] = useState<CooldownSettings>(() => {
    try {
      const saved = getScopedItem(SETTINGS_KEY);
      return saved ? { ...DEFAULT_COOLDOWN_SETTINGS, ...JSON.parse(saved) } : DEFAULT_COOLDOWN_SETTINGS;
    } catch {
      return DEFAULT_COOLDOWN_SETTINGS;
    }
  });

  // Refs for debouncing and tracking
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<number>(Date.now());
  const notifiedAbilitiesRef = useRef<Set<string>>(new Set());

  // ═══════════════════════════════════════════════════════════════
  // TIER RETRIEVAL
  // ═══════════════════════════════════════════════════════════════
  
  const getAbilityTier = useCallback((abilityId: string): 1 | 2 | 3 => {
    const charAbility = characterAbilities.find(ca => ca.abilityId === abilityId);
    const tier = charAbility?.currentTier || 1;
    return Math.max(1, Math.min(3, tier)) as 1 | 2 | 3;
  }, [characterAbilities]);

  // ═══════════════════════════════════════════════════════════════
  // CORE OPERATIONS
  // ═══════════════════════════════════════════════════════════════
  
  const triggerCooldown = useCallback((abilityId: string) => {
    if (!settings.enabled) return;
    
    const config = COOLDOWN_CONFIGS[abilityId];
    if (!config || config.isPassive) return;
    
    const tier = getAbilityTier(abilityId);
    const effective = calculateEffectiveCooldown(abilityId, tier, modifiers);
    const now = Date.now();
    
    setCooldowns(prev => {
      const updated = new Map(prev);
      const existing = prev.get(abilityId);
      updated.set(abilityId, {
        abilityId,
        tier,
        lastUsed: now,
        availableAt: now + (effective * 1000),
        isOnCooldown: true,
        usageCount: (existing?.usageCount || 0) + 1,
        effectiveCooldown: effective,
      });
      return updated;
    });
    
    // Clear from notified set so it can notify again when ready
    notifiedAbilitiesRef.current.delete(abilityId);
    
    // Start session if not already started
    if (!sessionState.sessionStart) {
      setSessionState(prev => ({
        ...prev,
        sessionStart: now,
      }));
    }
  }, [settings.enabled, getAbilityTier, modifiers, sessionState.sessionStart]);

  const resetCooldown = useCallback((abilityId: string) => {
    setCooldowns(prev => {
      const updated = new Map(prev);
      const existing = prev.get(abilityId);
      if (existing) {
        updated.set(abilityId, {
          ...existing,
          isOnCooldown: false,
          availableAt: null,
        });
      }
      return updated;
    });
    notifiedAbilitiesRef.current.delete(abilityId);
  }, []);

  const resetAllCooldowns = useCallback(() => {
    if (isHonestMode && enforceCooldowns) {
      toast.error('Manual cooldown resets disabled in Honest Mode');
      return;
    }
    
    setCooldowns(prev => {
      const updated = new Map(prev);
      updated.forEach((state, id) => {
        updated.set(id, {
          ...state,
          isOnCooldown: false,
          availableAt: null,
        });
      });
      return updated;
    });
    notifiedAbilitiesRef.current.clear();
    toast.success('All cooldowns reset!');
  }, [isHonestMode, enforceCooldowns]);

  const resetShortRestCooldowns = useCallback(() => {
    setCooldowns(prev => {
      const updated = new Map(prev);
      
      // Reset abilities with BASE cooldown < 30 minutes (D&D consistency)
      Object.entries(COOLDOWN_CONFIGS).forEach(([id, config]) => {
        if (config.baseCooldown < SHORT_REST_THRESHOLD && !config.isPassive) {
          const existing = updated.get(id);
          if (existing && existing.isOnCooldown) {
            updated.set(id, {
              ...existing,
              isOnCooldown: false,
              availableAt: null,
            });
            notifiedAbilitiesRef.current.delete(id);
          }
        }
      });
      
      return updated;
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // PAUSE / RESUME
  // ═══════════════════════════════════════════════════════════════
  
  const pauseAllCooldowns = useCallback(() => {
    if (sessionState.isPaused) return;
    
    setSessionState(prev => ({
      ...prev,
      isPaused: true,
      pausedAt: Date.now(),
    }));
  }, [sessionState.isPaused]);

  const resumeAllCooldowns = useCallback(() => {
    if (!sessionState.isPaused || !sessionState.pausedAt) return;
    
    const pauseDuration = Date.now() - sessionState.pausedAt;
    
    // Adjust all active cooldown availableAt times
    setCooldowns(prev => {
      const updated = new Map(prev);
      updated.forEach((state, key) => {
        if (state.isOnCooldown && state.availableAt) {
          updated.set(key, {
            ...state,
            availableAt: state.availableAt + pauseDuration,
          });
        }
      });
      return updated;
    });
    
    setSessionState(prev => ({
      ...prev,
      isPaused: false,
      pausedAt: null,
      totalPausedTime: prev.totalPausedTime + pauseDuration,
    }));
  }, [sessionState.isPaused, sessionState.pausedAt]);

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════
  
  const isOnCooldown = useCallback((abilityId: string): boolean => {
    if (!settings.enabled) return false;
    const state = cooldowns.get(abilityId);
    return state?.isOnCooldown ?? false;
  }, [cooldowns, settings.enabled]);

  const getRemainingTime = useCallback((abilityId: string): number => {
    const state = cooldowns.get(abilityId);
    if (!state?.isOnCooldown || !state.availableAt) return 0;
    
    const remaining = Math.ceil((state.availableAt - Date.now()) / 1000);
    return Math.max(0, remaining);
  }, [cooldowns]);

  const getEffectiveCooldown = useCallback((abilityId: string): number => {
    const tier = getAbilityTier(abilityId);
    return calculateEffectiveCooldown(abilityId, tier, modifiers);
  }, [getAbilityTier, modifiers]);

  const formatRemainingTime = useCallback((seconds: number): string => {
    return formatTime(seconds, settings.timeFormat);
  }, [settings.timeFormat]);

  // Memoized effective cooldowns for performance
  const effectiveCooldowns = useMemo(() => {
    const map = new Map<string, number>();
    Object.keys(COOLDOWN_CONFIGS).forEach(id => {
      const tier = getAbilityTier(id);
      map.set(id, calculateEffectiveCooldown(id, tier, modifiers));
    });
    return map;
  }, [getAbilityTier, modifiers]);

  // ═══════════════════════════════════════════════════════════════
  // SESSION STATISTICS
  // ═══════════════════════════════════════════════════════════════
  
  const generateSessionStats = useCallback((): SessionStatistics => {
    const now = Date.now();
    const duration = sessionState.sessionStart ? now - sessionState.sessionStart : 0;
    
    const abilitiesUsed: Record<string, { name: string; count: number; totalCooldownTime: number }> = {};
    let totalActivations = 0;
    let mostUsedCount = 0;
    let mostUsedAbility = '';
    
    cooldowns.forEach((state, id) => {
      if (state.usageCount > 0) {
        const config = COOLDOWN_CONFIGS[id];
        abilitiesUsed[id] = {
          name: config?.displayName || id,
          count: state.usageCount,
          totalCooldownTime: state.effectiveCooldown * state.usageCount,
        };
        totalActivations += state.usageCount;
        
        if (state.usageCount > mostUsedCount) {
          mostUsedCount = state.usageCount;
          mostUsedAbility = config?.displayName || id;
        }
      }
    });
    
    return {
      sessionStart: sessionState.sessionStart || 0,
      sessionEnd: now,
      duration,
      totalPausedTime: sessionState.totalPausedTime,
      activeDuration: duration - sessionState.totalPausedTime,
      abilitiesUsed,
      mostUsedAbility,
      totalAbilityActivations: totalActivations,
    };
  }, [cooldowns, sessionState]);

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════
  
  const updateSettings = useCallback((newSettings: Partial<CooldownSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        setScopedItem(SETTINGS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save cooldown settings:', e);
      }
      return updated;
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════
  
  // Update timer and check for completed cooldowns
  useEffect(() => {
    if (!settings.enabled || sessionState.isPaused) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      
      cooldowns.forEach((state, id) => {
        if (state.isOnCooldown && state.availableAt && state.availableAt <= now) {
          // Mark as ready
          setCooldowns(prev => {
            const updated = new Map(prev);
            updated.set(id, { ...state, isOnCooldown: false });
            return updated;
          });
          
          // Send notification (only once per completion)
          if (!notifiedAbilitiesRef.current.has(id)) {
            notifiedAbilitiesRef.current.add(id);
            const config = COOLDOWN_CONFIGS[id];
            if (config && settings.notifications) {
              sendCooldownReadyNotification(config.displayName);
            }
            if (config && settings.soundEffects) {
              playCooldownReadySound(settings);
            }
          }
        }
      });
    }, UPDATE_INTERVAL);
    
    return () => clearInterval(interval);
  }, [cooldowns, settings, sessionState.isPaused]);

  // Modifier expiration cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setModifiers(prev => {
        const active = prev.filter(mod => !mod.expiresAt || mod.expiresAt > now);
        if (active.length < prev.length) {
          toast.info('Temporary cooldown modifier expired.');
        }
        return active;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-pause on app blur
  useEffect(() => {
    if (!settings.enabled || !settings.autoPause) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseAllCooldowns();
      }
      // Don't auto-resume - user can manually resume
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [settings.enabled, settings.autoPause, pauseAllCooldowns]);

  // Anti-cheat: detect system time manipulation (Honest Mode only)
  useEffect(() => {
    if (!settings.enabled || !isHonestMode || !enforceCooldowns) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const expectedDiff = 60000; // 1 minute
      const actualDiff = now - lastCheckRef.current;
      
      // Allow for system sleep/wake (>10s discrepancy threshold)
      // Only flag if time went BACKWARDS (clock set back)
      if (actualDiff < expectedDiff - 10000) {
        pauseAllCooldowns();
        toast.error('Time discrepancy detected. Cooldowns paused.');
      }
      
      lastCheckRef.current = now;
    }, 60000);
    
    return () => clearInterval(interval);
  }, [settings.enabled, isHonestMode, enforceCooldowns, pauseAllCooldowns]);

  // Debounced localStorage persistence
  useEffect(() => {
    if (!settings.enabled) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const saveState: CooldownSaveState = {
          cooldowns: Array.from(cooldowns.entries()),
          session: sessionState,
          modifiers,
          settings,
        };
        setScopedItem(STORAGE_KEY, JSON.stringify(saveState));
      } catch (e) {
        console.error('Failed to save cooldown state:', e);
      }
    }, SAVE_DEBOUNCE);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [cooldowns, sessionState, modifiers, settings]);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = getScopedItem(STORAGE_KEY);
      if (!saved) return;
      
      const { cooldowns: savedCooldowns, session, modifiers: savedMods }: CooldownSaveState = JSON.parse(saved);
      const now = Date.now();
      
      // Restore cooldowns, checking for expired ones
      const restoredCooldowns = new Map<string, AbilityCooldownState>();
      const readyAbilities: string[] = [];
      
      savedCooldowns.forEach(([id, state]) => {
        if (state.isOnCooldown && state.availableAt) {
          if (state.availableAt <= now) {
            // Expired while offline
            restoredCooldowns.set(id, { ...state, isOnCooldown: false, availableAt: null });
            const config = COOLDOWN_CONFIGS[id];
            if (config) {
              readyAbilities.push(config.displayName);
            }
          } else {
            // Still cooling
            restoredCooldowns.set(id, state);
          }
        } else {
          restoredCooldowns.set(id, state);
        }
      });
      
      setCooldowns(restoredCooldowns);
      setSessionState(session);
      setModifiers(savedMods);
      
      // Notify about abilities that became ready while offline
      if (readyAbilities.length > 0) {
        toast.success(`⚡ ${readyAbilities.length} ability(s) ready: ${readyAbilities.slice(0, 3).join(', ')}${readyAbilities.length > 3 ? '...' : ''}`);
      }
    } catch (e) {
      console.error('Failed to restore cooldown state:', e);
    }
  }, []);

  // Listen for rest events dispatched from Index.tsx
  useEffect(() => {
    const handleRestEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'long') {
        // Long rest resets ALL cooldowns
        setCooldowns(prev => {
          const updated = new Map(prev);
          updated.forEach((state, id) => {
            updated.set(id, { ...state, isOnCooldown: false, availableAt: null });
          });
          return updated;
        });
        notifiedAbilitiesRef.current.clear();
      } else if (detail?.type === 'short') {
        // Short rest resets only short-rest cooldowns
        resetShortRestCooldowns();
      }
    };

    window.addEventListener('odyssey-rest', handleRestEvent);
    return () => window.removeEventListener('odyssey-rest', handleRestEvent);
  }, [resetShortRestCooldowns]);

  return {
    // State
    cooldowns,
    modifiers,
    sessionState,
    settings,
    effectiveCooldowns,
    
    // Core operations
    triggerCooldown,
    resetCooldown,
    resetAllCooldowns,
    resetShortRestCooldowns,
    
    // Pause/Resume
    pauseAllCooldowns,
    resumeAllCooldowns,
    
    // Getters
    isOnCooldown,
    getRemainingTime,
    getEffectiveCooldown,
    formatRemainingTime,
    getAbilityTier,
    
    // Session
    generateSessionStats,
    
    // Settings
    updateSettings,
    
    // Modifiers
    setModifiers,
  };
}
