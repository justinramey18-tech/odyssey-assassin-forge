// Arena practice: the real Party DM contract with no real party behind it.
// The real usePartyDm runs with partyId null (inert, and the source of the full
// return type); a local in-memory session is layered over it. Nothing here
// writes to the server, locks a round, starts a timer callback or saves history.
import { useCallback, useMemo, useState } from 'react';
import { usePartyDm, type DmSessionConfig, type PartyDmMessage } from '@/hooks/use-party-dm';
import type { CharacterContext } from '@/components/oracle/types';

export type PartyDmApi = ReturnType<typeof usePartyDm>;

interface Options {
  characterName: string;
  characterContext: CharacterContext;
  userId?: string;
  openingText?: string;
}

const LOCAL_PARTY = 'arena-practice';

export function useArenaPartyDm({ characterName, characterContext, userId, openingText }: Options): PartyDmApi {
  const me = userId || 'arena-player';
  const partyMembers = useMemo(() => [{ character_name: characterName, character_status: {}, user_id: me }], [characterName, me]);
  const base = usePartyDm({ partyId: null, isCreator: true, memberCount: 1, characterName, characterContext, partyMembers });

  const [sessionConfig, setSessionConfig] = useState<DmSessionConfig>(() => ({
    active: true,
    mode: 'shared',
    currentRoundId: crypto.randomUUID(),
    campaignSummary: null,
    isGenerating: false,
    dmMode: 'dialogue',
    combatMode: true,
    timerEnabled: false,
  }));
  const [messages, setMessages] = useState<PartyDmMessage[]>(() => [{
    id: 'arena-opening',
    party_id: LOCAL_PARTY,
    role: 'assistant',
    content: openingText || 'The Training Grounds. Sawdust, a ring of rope, and an opponent waiting. Nothing here counts — fight, fail and try again.',
    sender_user_id: null,
    sender_name: 'Training Grounds',
    created_at: new Date().toISOString(),
  }]);

  const updateSessionConfig = useCallback(async (patch: Partial<DmSessionConfig>) => {
    setSessionConfig((c) => ({ ...c, ...patch }));
  }, []);
  const setTimerConfig = useCallback(async (enabled: boolean, durationSeconds: number) => {
    setSessionConfig((c) => ({ ...c, timerEnabled: enabled, timerDurationSeconds: durationSeconds, timerStartedAt: null, timerPausedRemaining: null }));
  }, []);
  const startTimer = useCallback(async () => {
    setSessionConfig((c) => (c.timerEnabled && c.timerDurationSeconds ? { ...c, timerStartedAt: new Date().toISOString(), timerPausedRemaining: null } : c));
  }, []);
  const pauseTimer = useCallback(async () => {
    setSessionConfig((c) => {
      if (!c.timerStartedAt) return c;
      const elapsed = (Date.now() - new Date(c.timerStartedAt).getTime()) / 1000;
      return { ...c, timerStartedAt: null, timerPausedRemaining: Math.max(0, (c.timerDurationSeconds || 0) - elapsed) };
    });
  }, []);
  const resumeTimer = useCallback(async () => {
    setSessionConfig((c) => {
      if (c.timerPausedRemaining == null) return c;
      const offset = (c.timerDurationSeconds || 0) - c.timerPausedRemaining;
      return { ...c, timerStartedAt: new Date(Date.now() - offset * 1000).toISOString(), timerPausedRemaining: null };
    });
  }, []);
  const cancelTimer = useCallback(async () => {
    setSessionConfig((c) => ({ ...c, timerStartedAt: null, timerPausedRemaining: null }));
  }, []);

  const addLocal = useCallback((content: string, senderName: string, role: PartyDmMessage['role'] = 'user') => {
    const text = content.trim();
    if (!text) return;
    setMessages((p) => [...p.slice(-199), { id: crypto.randomUUID(), party_id: LOCAL_PARTY, role, content: text, sender_user_id: role === 'user' ? me : null, sender_name: senderName, created_at: new Date().toISOString() }]);
  }, [me]);

  const overrides: Partial<PartyDmApi> = {
    messages,
    allMessages: messages,
    currentPrompts: [],
    sessionConfig,
    isActive: true,
    isGenerating: false,
    isSummarizing: false,
    isFullSummarizing: false,
    allReady: false,
    myPrompt: null,
    pendingDraft: null,
    activeCampaignId: null,
    initialLoadDone: true,
    updateSessionConfig,
    setPartyModel: async (modelId: string) => { setSessionConfig((c) => ({ ...c, dmModel: modelId })); },
    setBattleModel: async (modelId: string | null) => { setSessionConfig((c) => ({ ...c, battleModel: modelId ?? undefined })); },
    setTimerConfig,
    startTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    requestExtension: async () => {},
    approveExtension: async () => {},
    dismissExtensions: async () => {},
    addMediaMessage: async (content: string, senderName: string) => { addLocal(content, senderName); },
    sendDialogueMessage: async (content: string) => { addLocal(content, characterName); },
    sendManualDmMessage: async (content: string) => { addLocal(content, 'Training Grounds', 'assistant'); },
    editMessage: async (id: string, content: string) => { setMessages((p) => p.map((m) => (m.id === id ? { ...m, content } : m))); },
    deleteMessage: async (id: string) => { setMessages((p) => p.filter((m) => m.id !== id)); },
    // No DM in practice: anything that would generate, regenerate, save or end a real round does nothing.
    startSession: async () => {},
    endSession: async () => {},
    startNewCampaign: async () => {},
    saveCampaign: async () => {},
    loadCampaign: async () => {},
    generateResponse: async () => {},
    callDM: async () => {},
    regenerateMessage: async () => {},
    regenerateWhispers: async () => {},
    redoLastRound: async () => {},
    reclaimTurn: async () => {},
    stopGeneration: () => {},
    approveDraft: async () => {},
    discardDraft: () => {},
    submitPrompt: async () => {},
    editPrompt: async () => {},
    retractPrompt: async () => {},
    setReady: async () => {},
    unready: async () => {},
    sendWhisper: async () => {},
    postAssistedDmResponse: async () => {},
    voiceNPC: async () => {},
    startNpcScene: async () => {},
    stopNpcScene: async () => {},
    submitNpcInterjection: async () => {},
    generateDialogueRecap: async () => {},
    applyOocCommand: async () => {},
    initiateSplit: async () => {},
    regroupParty: async () => {},
    setActiveMoodPreset: async () => {},
    fullSummarize: async () => {},
  };

  const result: PartyDmApi = { ...base, ...overrides };
  return result;
}
