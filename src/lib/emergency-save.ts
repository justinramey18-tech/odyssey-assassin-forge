import { getScopedKey } from '@/lib/scoped-storage';
import { SCOPED_KEYS } from '@/lib/scoped-keys';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Cache the auth token so it's available synchronously during page close
let cachedAuthToken: string | null = null;
let cachedUserId: string | null = null;

export function setCachedAuth(token: string, userId: string): void {
  cachedAuthToken = token;
  cachedUserId = userId;
}

export function clearCachedAuth(): void {
  cachedAuthToken = null;
  cachedUserId = null;
}

/**
 * Emergency cloud save using fetch with keepalive: true.
 * This request survives page destruction (tab close, navigation, app switch).
 * It bypasses the Supabase JS client because the client doesn't support keepalive.
 *
 * Returns immediately — the request is fire-and-forget.
 * Only call this from beforeunload/pagehide handlers.
 */
export function emergencyCloudSave(saveData: Record<string, unknown>, characterName: string): void {
  if (!cachedAuthToken || !cachedUserId || !SUPABASE_URL || !SUPABASE_KEY) return;

  const activeCloudSaveId = localStorage.getItem('odyssey-active-cloud-save-id');
  if (!activeCloudSaveId) return; // Can't emergency-save without knowing which record to update

  // Build the scoped localStorage snapshot
  const scopedLocalStorage: Record<string, string | null> = {};
  for (const baseKey of SCOPED_KEYS) {
    try {
      const value = localStorage.getItem(getScopedKey(baseKey));
      if (value !== null) {
        scopedLocalStorage[baseKey] = value;
      }
    } catch { /* ignore */ }
  }

  const extendedData = {
    abilityScores: saveData.abilityScores,
    hpState: saveData.hpState,
    deathSaves: saveData.deathSaves,
    spellcasting: saveData.spellcasting,
    activeSpells: saveData.activeSpells,
    prestigeTree: saveData.prestigeTree,
    shopGold: saveData.shopGold,
    loot: saveData.loot,
    proficiencies: saveData.proficiencies,
    expertise: saveData.expertise,
    inspiration: saveData.inspiration,
    combatSettings: saveData.combatSettings,
    conditions: saveData.conditions,
    cooldownState: saveData.cooldownState,
    partyId: saveData.partyId,
    backgroundUrl: saveData.backgroundUrl,
    empyreanStatus: saveData.empyreanStatus,
    scopedLocalStorage,
  };

  const body = JSON.stringify({
    character_data: saveData.character,
    equipment_data: saveData.equipment,
    achievements_data: saveData.achievements,
    consumables_data: saveData.consumables,
    prestige_data: saveData.prestige,
    xp_data: saveData.xp,
    extended_data: extendedData,
    save_name: characterName,
  });

  try {
    fetch(`${SUPABASE_URL}/rest/v1/character_saves?id=eq.${activeCloudSaveId}&user_id=eq.${cachedUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${cachedAuthToken}`,
        'Prefer': 'return=minimal',
      },
      body,
      keepalive: true,
    });
    console.log('[EmergencySave] Keepalive save fired');
  } catch (e) {
    // Silently fail — this is best-effort
    console.warn('[EmergencySave] Failed:', e);
  }
}
