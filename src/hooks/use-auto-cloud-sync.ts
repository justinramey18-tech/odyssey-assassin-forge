import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './use-auth';
import { useCloudSave } from './use-cloud-save';
import { SaveData } from './use-auto-save';

const CLOUD_DEBOUNCE_MS = 30000; // 30 seconds debounce for cloud saves
const LOCAL_DEBOUNCE_MS = 1000; // 1 second for local saves
const STORAGE_KEY = 'odyssey-character-autosave';
const CURRENT_VERSION = 2;

export interface AutoCloudSyncResult {
  lastCloudSyncTime: string | null;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  lastLocalSaveTime: string | null;
}

/**
 * Enhanced auto-save hook that saves locally AND to cloud when authenticated.
 * Local saves happen frequently (1s debounce), cloud saves are less frequent (30s debounce).
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
  
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(() => {
    // Try to get from existing cloud saves on mount
    return null;
  });
  const [lastLocalSaveTime, setLastLocalSaveTime] = useState<string | null>(null);

  // Fetch cloud saves on mount to get last sync time
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchSaves().then(() => {
        // Will be set when cloudSaves updates
      });
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

    // Fallback: match by character name, then most recent
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

  // Local save function
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
        localStorage.setItem(STORAGE_KEY, serialized);
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
      return;
    }
    
    try {
      // Prefer active save ID for strict per-character isolation
      const activeSaveId = localStorage.getItem('odyssey-active-cloud-save-id');
      let targetSaveId: string | undefined = activeSaveId ?? undefined;

      // Fallback for legacy sessions without active save ID
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
      
      if (!result.error) {
        lastCloudSaveRef.current = serialized;
        pendingCloudSaveRef.current = false;
        const now = new Date().toISOString();
        setLastCloudSyncTime(now);
        console.log('[AutoSave] Cloud sync at', new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('[AutoSave] Cloud sync failed:', error);
    }
  }, [data, enabled, isAuthenticated, user?.id, cloudSaves, saveToCloud]);

  // Manual sync function for external use
  const syncNow = useCallback(async () => {
    saveLocally();
    await saveToCloudNow();
  }, [saveLocally, saveToCloudNow]);

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

  // Save on page unload
  useEffect(() => {
    if (!enabled) return;
    
    const handleBeforeUnload = () => {
      // Force local save immediately
      const saveData: SaveData = {
        ...data,
        savedAt: new Date().toISOString(),
        version: CURRENT_VERSION,
      };
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
        
        // Try to sync to cloud if authenticated (best effort, may not complete)
        if (isAuthenticated && pendingCloudSaveRef.current) {
          // Note: This is best-effort, sync may not complete before page closes
          saveToCloudNow();
        }
      } catch (error) {
        console.error('[AutoSave] Failed on unload:', error);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
    }, 120000); // 2 minutes
    
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
  };
}
