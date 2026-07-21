import { useEffect, useRef } from 'react';
import type { Message } from '@/components/oracle/types';
import type { CampaignSession } from '@/hooks/use-campaign-sessions';

export type AutoCampaignMode = 'empyrean' | 'solo';

interface Options {
  mode: AutoCampaignMode;
  isSignedIn: boolean;
  userId?: string | null;
  activeCampaignId: string | null;
  setActiveCampaignId: (id: string | null) => void;
  messages: Message[];
  campaignSummary: string | null;
  characterName?: string;
  sessions: CampaignSession[];
  sessionsLoading?: boolean;
  saveSession: (
    name: string,
    messages: Message[],
    summary: string | null,
    existingId?: string,
    memoryAnchors?: any[],
    options?: { silent?: boolean },
  ) => Promise<string | null>;
  loadCampaign: (
    messages: Message[],
    summary: string | null,
    campaignId?: string,
    guideIds?: string[] | null,
  ) => void;
  memoryAnchors?: any[];
}

const STORAGE_KEYS: Record<AutoCampaignMode, string> = {
  empyrean: 'empyrean-active-campaign-id',
  solo: 'solo-active-campaign-id',
};

// Legacy keys — read once as fallback so existing users don't lose their link.
const LEGACY_STORAGE_KEYS: Record<AutoCampaignMode, string> = {
  empyrean: 'empyrean-active-campaign',
  solo: 'solo-active-campaign',
};

function readStoredId(mode: AutoCampaignMode): string | null {
  try {
    const current = localStorage.getItem(STORAGE_KEYS[mode]);
    if (current) return current;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEYS[mode]);
    if (legacy) {
      // Migrate forward
      try { localStorage.setItem(STORAGE_KEYS[mode], legacy); } catch { /* ignore */ }
      try { localStorage.removeItem(LEGACY_STORAGE_KEYS[mode]); } catch { /* ignore */ }
      return legacy;
    }
  } catch { /* ignore */ }
  return null;
}

function autoName(characterName?: string): string {
  const who = (characterName || 'Adventurer').trim() || 'Adventurer';
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `Autosave — ${who} · ${stamp}`;
}

/**
 * Ensures a persistent campaign row exists for signed-in players and restores
 * the last-active campaign across app restarts. Once a campaign id exists,
 * any universe link tied to it survives automatically.
 */
export function useAutoCampaign(opts: Options) {
  const {
    mode,
    isSignedIn,
    userId,
    activeCampaignId,
    setActiveCampaignId,
    messages,
    campaignSummary,
    characterName,
    sessions,
    sessionsLoading,
    saveSession,
    loadCampaign,
    memoryAnchors,
  } = opts;

  const storageKey = STORAGE_KEYS[mode];
  const hasAutoCreatedRef = useRef(false);
  const hasRestoredRef = useRef(false);
  const inFlightRef = useRef(false);

  // 1) Mirror activeCampaignId to localStorage ONLY when we have a real id.
  //    Never clear on transition to null — that path fires on unmount / clearMessages
  //    and would wipe the id the user expects to reconnect to. The stored id is only
  //    overwritten by a different real id, or removed by the stale-id branch in step 2
  //    when it no longer belongs to any of the user's campaigns.
  useEffect(() => {
    if (!activeCampaignId) return;
    try { localStorage.setItem(storageKey, activeCampaignId); } catch { /* ignore quota */ }
  }, [activeCampaignId, storageKey]);

  // 2) Restore the last active campaign for this signed-in user, once sessions are loaded.
  //    Guard is per-mount, so re-opening the DM screen always gets a fresh chance to restore.
  useEffect(() => {
    if (!isSignedIn) return;
    if (activeCampaignId) return;
    if (sessionsLoading) return;
    if (hasRestoredRef.current) return;

    const storedId = readStoredId(mode);
    if (!storedId) {
      hasRestoredRef.current = true;
      return;
    }

    const match = sessions.find(s => s.id === storedId);
    if (!match) {
      // stale — id no longer belongs to any of this user's campaigns
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      hasRestoredRef.current = true;
      return;
    }

    // Only auto-restore full state if there's no in-progress conversation locally.
    if (messages.length === 0) {
      loadCampaign(match.messages, match.campaign_summary, match.id, (match as any).gm_guide_ids);
    } else {
      // There's already play in progress — just re-attach the id so autosaves and
      // the linked-universe hook target the right campaign.
      setActiveCampaignId(match.id);
    }
    hasRestoredRef.current = true;
  }, [isSignedIn, activeCampaignId, sessionsLoading, sessions, storageKey, mode, messages.length, loadCampaign, setActiveCampaignId]);

  // 3) Auto-create a campaign row on first play so linking is always available
  useEffect(() => {
    if (!isSignedIn) return;
    if (activeCampaignId) return;
    if (messages.length < 1) return;
    if (hasAutoCreatedRef.current) return;
    if (inFlightRef.current) return;
    // Wait for the initial restore attempt so we don't create a duplicate
    if (!hasRestoredRef.current && !sessionsLoading) {
      // Give the restore effect a tick to run
      return;
    }
    if (sessionsLoading) return;

    hasAutoCreatedRef.current = true;
    inFlightRef.current = true;
    (async () => {
      try {
        const name = autoName(characterName);
        const id = await saveSession(name, messages, campaignSummary, undefined, memoryAnchors, { silent: true });
        if (id) {
          setActiveCampaignId(id);
          try { localStorage.setItem(storageKey, id); } catch { /* ignore */ }
        } else {
          // allow retry on next play beat if it failed
          hasAutoCreatedRef.current = false;
        }
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [isSignedIn, activeCampaignId, messages, campaignSummary, characterName, sessionsLoading, saveSession, setActiveCampaignId, storageKey, memoryAnchors]);

  // 4) Reset guards when the user signs out or switches account
  useEffect(() => {
    if (!isSignedIn) {
      hasAutoCreatedRef.current = false;
      hasRestoredRef.current = false;
    }
  }, [isSignedIn, userId]);
}
