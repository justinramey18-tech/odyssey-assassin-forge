import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './use-auth';
import { useCloudSave } from './use-cloud-save';
import { SaveData } from './use-auto-save';
import { setScopedItem, migrateToScoped } from '@/lib/scoped-storage';
import { SCOPED_KEYS } from '@/lib/scoped-keys';

const CLOUD_DEBOUNCE_MS = 10000; // 10 seconds debounce for cloud saves
const LOCAL_DEBOUNCE_MS = 1000; // 1 second for local saves
const STORAGE_KEY = 'odyssey-character-autosave';
const CURRENT_VERSION = 2;

export interface AutoCloudSyncResult {
  lastCloudSyncTime: string | null;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  lastLocalSaveTime: string | null;
  /** Resolves when any in-flight cloud save completes. Use before character switch. */
  pendingFlush: () => Promise<void>;
}

/**
 * Enhanced auto-save hook that saves locally AND to cloud when authenticated.
 * Local saves happen frequently (1s debounce), cloud saves are less frequent (30s debounce).
 * 
 * Local saves write to the scoped autosave key (character-isolated) so
 * each character's monolithic snapshot stays separated in localStorage.
 */
export function useAutoCloudSync(
  data: Omit<SaveData, 'savedAt' | 'version'>,
  enabled: boolean = true
): AutoCloudSyncResult {
  const { user, isAuthenticated } = useAuth();
  const { saveToCloud, cloudSaves, fetchSaves, saving } = useCloudSave(user?.id);
  
  const localTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cloudTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocalSaveRef = useRef<string>('');
  const lastCloudSaveRef = useRef<string>('');
  const pendingCloudSaveRef = useRef<boolean>(false);
  // Promise that resolves when the current in-flight cloud save completes
  const flushResolveRef = useRef<(() => void) | null>(null);
  const flushPromiseRef = useRef<Promise<void> | null>(null);
  
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(() => {
    return null;
  });
  const [lastLocalSaveTime, setLastLocalSaveTime] = useState<string | null>(null);

  // Fetch cloud saves on mount to get last sync time
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchSaves().then(() => {});
    }
  }, [isAuthenticated, user?.id, fetchSaves]);

  // Update last sync time when cloud saves are fetched
  useEffect(() => {
    if (cloudSaves.length === 0) return;

    const activeSaveId = localStorage.getItem('odyssey-active-cloud-save-id');
    if (activeSaveId) {
      const activeSave = cloudSaves.find(s => s.id === activeSaveId);
      if (activeSave) {
        setLastCloudSyncTime(activeSave.updated_at);
        return;
      }
    }

    const characterName = data.character?.name;
    const matchingSave = cloudSaves.find(s => 
      s.character_name === characterName || s.save_name === characterName
    );
    if (matchingSave) {
      setLastCloudSyncTime(matchingSave.updated_at);
    } else if (cloudSaves[0]) {
      setLastCloudSyncTime(cloudSaves[0].updated_at);
    }
  }, [cloudSaves, data.character?.name]);

  // Local save function — writes to SCOPED autosave key for character isolation
  const saveLocally = useCallback(() => {
    if (!enabled) return;
    
    const saveData: SaveData = {
      ...data,
      savedAt: new Date().toISOString(),
      version: CURRENT_VERSION,
    };
    
    const serialized = JSON.stringify(saveData);
    
    // Only save if data changed
    if (serialized !== lastLocalSaveRef.current) {
      try {
        // Write to scoped key so each character gets its own local snapshot
        setScopedItem(STORAGE_KEY, serialized);
        lastLocalSaveRef.current = serialized;
        setLastLocalSaveTime(saveData.savedAt);
        console.log('[AutoSave] Local save at', new Date().toLocaleTimeString());
        
        // Mark that we need a cloud save
        if (isAuthenticated) {
          pendingCloudSaveRef.current = true;
        }
      } catch (error) {
        console.error('[AutoSave] Failed to save locally:', error);
      }
    }
  }, [data, enabled, isAuthenticated]);

  // Cloud save function
  const saveToCloudNow = useCallback(async () => {
    if (!enabled || !isAuthenticated || !user?.id || !data.character?.name) return;
    
    const serialized = JSON.stringify(data);
    
    // Only save if data changed since last cloud save
    if (serialized === lastCloudSaveRef.current) {
      console.log('[AutoSave] Cloud data unchanged, skipping');
      // Resolve any pending flush even if we skip
      flushResolveRef.current?.();
      flushResolveRef.current = null;
      flushPromiseRef.current = null;
      return;
    }
    
    try {
      const activeSaveId = localStorage.getItem('odyssey-active-cloud-save-id');
      let targetSaveId: string | undefined = activeSaveId ?? undefined;

      if (!targetSaveId) {
        const existingSave = cloudSaves.find(s => 
          s.character_name === data.character?.name || s.save_name === data.character?.name
        );
        targetSaveId = existingSave?.id;
      }
      
      const result = await saveToCloud(
        data,
        data.character.name,
        targetSaveId
      );
      
      if (!result.error && result.data) {
        lastCloudSaveRef.current = serialized;
        pendingCloudSaveRef.current = false;
        const now = new Date().toISOString();
        setLastCloudSyncTime(now);

        // Persist the returned save ID so future auto-saves update the same record
        // instead of creating duplicates via name-matching fallback
        const returnedId = result.data.id;
        if (returnedId) {
          const currentActiveId = localStorage.getItem('odyssey-active-cloud-save-id');
          if (!currentActiveId || currentActiveId !== returnedId) {
            localStorage.setItem('odyssey-active-cloud-save-id', returnedId);
            console.log('[AutoSave] Stored active cloud save ID:', returnedId);
            // Migrate any unscoped data to the new scoped keys so hooks
            // don't lose track of data that was written before the ID existed
            for (const key of SCOPED_KEYS) {
              migrateToScoped(key);
            }
            console.log('[AutoSave] Migrated unscoped keys to save ID:', returnedId);
          }
        }

        console.log('[AutoSave] Cloud sync at', new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('[AutoSave] Cloud sync failed:', error);
    } finally {
      // Always resolve flush promise so character switching isn't blocked
      flushResolveRef.current?.();
      flushResolveRef.current = null;
      flushPromiseRef.current = null;
    }
  }, [data, enabled, isAuthenticated, user?.id, cloudSaves, saveToCloud]);

  // Manual sync function for external use
  const syncNow = useCallback(async () => {
    saveLocally();
    await saveToCloudNow();
  }, [saveLocally, saveToCloudNow]);

  /**
   * Returns a promise that resolves when any in-flight or pending cloud save completes.
   * If no save is pending, resolves immediately.
   * Used by character switching to guarantee flush-before-switch.
   */
  const pendingFlush = useCallback((): Promise<void> => {
    if (!pendingCloudSaveRef.current && !saving) {
      return Promise.resolve();
    }

    // If there's already a flush promise, return it
    if (flushPromiseRef.current) {
      return flushPromiseRef.current;
    }

    // Create a new flush promise and trigger immediate save
    flushPromiseRef.current = new Promise<void>((resolve) => {
      flushResolveRef.current = resolve;
      // Timeout after 3s to prevent blocking forever
      setTimeout(() => {
        if (flushResolveRef.current === resolve) {
          console.warn('[AutoSave] Flush timed out after 3s');
          resolve();
          flushResolveRef.current = null;
          flushPromiseRef.current = null;
        }
      }, 3000);
    });

    // Trigger immediate cloud save
    saveLocally();
    saveToCloudNow();

    return flushPromiseRef.current;
  }, [saving, saveLocally, saveToCloudNow]);

  // Debounced local auto-save on data change
  useEffect(() => {
    if (!enabled) return;
    
    if (localTimeoutRef.current) {
      clearTimeout(localTimeoutRef.current);
    }
    
    localTimeoutRef.current = setTimeout(() => {
      saveLocally();
    }, LOCAL_DEBOUNCE_MS);
    
    return () => {
      if (localTimeoutRef.current) {
        clearTimeout(localTimeoutRef.current);
      }
    };
  }, [data, saveLocally, enabled]);

  // Debounced cloud auto-save (less frequent)
  useEffect(() => {
    if (!enabled || !isAuthenticated || !pendingCloudSaveRef.current) return;
    
    if (cloudTimeoutRef.current) {
      clearTimeout(cloudTimeoutRef.current);
    }
    
    cloudTimeoutRef.current = setTimeout(() => {
      if (pendingCloudSaveRef.current) {
        saveToCloudNow();
      }
    }, CLOUD_DEBOUNCE_MS);
    
    return () => {
      if (cloudTimeoutRef.current) {
        clearTimeout(cloudTimeoutRef.current);
      }
    };
  }, [data, saveToCloudNow, enabled, isAuthenticated]);

  // Save on page close/hide — uses multiple events for cross-platform reliability
  useEffect(() => {
    if (!enabled) return;

    // Immediate local save (synchronous, always works)
    const saveLocallySync = () => {
      try {
        const saveData: SaveData = {
          ...data,
          savedAt: new Date().toISOString(),
          version: CURRENT_VERSION,
        };
        setScopedItem(STORAGE_KEY, JSON.stringify(saveData));
        lastLocalSaveRef.current = JSON.stringify(saveData);
      } catch (error) {
        console.error('[AutoSave] Failed local save on hide:', error);
      }
    };

    // Cloud save attempt (async, best-effort on page close)
    const triggerCloudSave = () => {
      if (isAuthenticated && pendingCloudSaveRef.current) {
        saveToCloudNow();
      }
    };

    // beforeunload — works on desktop, unreliable on mobile
    const handleBeforeUnload = () => {
      saveLocallySync();
      triggerCloudSave();
    };

    // visibilitychange — fires reliably on mobile when user switches apps,
    // goes to home screen, or switches tabs. This is the PRIMARY mobile save event.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[AutoSave] Page hidden — saving immediately');
        saveLocallySync();
        triggerCloudSave();
      }
    };

    // pagehide — fires on mobile when the page is being unloaded or put into
    // the back/forward cache. More reliable than beforeunload on iOS Safari.
    const handlePageHide = () => {
      console.log('[AutoSave] Page hide — saving immediately');
      saveLocallySync();
      triggerCloudSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [data, enabled, isAuthenticated, saveToCloudNow]);

  // Periodic cloud sync every 2 minutes if authenticated and data changed
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;
    
    const interval = setInterval(() => {
      if (pendingCloudSaveRef.current) {
        console.log('[AutoSave] Periodic cloud sync triggered');
        saveToCloudNow();
      }
    }, 120000);
    
    return () => clearInterval(interval);
  }, [enabled, isAuthenticated, saveToCloudNow]);

  // Listen for force-sync events (e.g. after party create/join)
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const handleForceSync = () => {
      console.log('[AutoSave] Force cloud sync triggered');
      saveLocally();
      saveToCloudNow();
    };

    window.addEventListener('odyssey-force-cloud-sync', handleForceSync);
    return () => window.removeEventListener('odyssey-force-cloud-sync', handleForceSync);
  }, [enabled, isAuthenticated, saveLocally, saveToCloudNow]);

  return {
    lastCloudSyncTime,
    isSyncing: saving,
    syncNow,
    lastLocalSaveTime,
    pendingFlush,
  };
}
