import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';
import { loadGMGuides } from '@/lib/gm-guides-storage';
import { loadBondState } from '@/lib/dragonBondState';
import { loadCampaignSummary } from '@/lib/campaign-summary-storage';
import { loadEmpyreanDMConfig } from '@/lib/empyreanDMPersona';
import { EMPYREAN_LORE_GUIDES, EMPYREAN_TONE_GUIDES, EMPYREAN_SESSION_GUIDES } from '@/lib/empyreanGMGuides';

// ─── Types ─────────────────────────────────────────────────────────────────

export type DirectorActionType =
  | 'install_guide'
  | 'disable_guide'
  | 'delete_guide'
  | 'update_campaign_summary'
  | 'add_memory_anchor'
  | 'update_dragon_personality'
  | 'ooc_passthrough'
  | 'update_character_identity'
  | 'update_campaign_settings';

export interface DirectorProposedAction {
  /** Unique client-assigned id so dismiss/confirm can target the right card. */
  id: string;
  type: DirectorActionType;
  rationale: string;
  // Per-type fields (any subset may be present).
  guide_name?: string;
  guide_content?: string;
  guide_id?: string;
  new_summary?: string;
  memory_anchor?: string;
  new_dragon_personality?: string;
  ooc_note?: string;
  turns_remaining?: number;
  // update_character_identity
  new_character_name?: string;
  new_dragon_name?: string;
  new_dragon_color?: string;
  new_signet_type?: string;
  new_year_at_basgiath?: string;
  // update_campaign_settings
  new_campaign_focus?: string;
  set_lore_guides?: string[];
  set_tone_guides?: string[];
  set_session_template?: string | null;
}

export interface DirectorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Present only on assistant messages that had proposed actions. */
  actions?: DirectorProposedAction[];
  timestamp: number;
}

const STORAGE_KEY = 'empyrean-director-chat';
const MAX_PERSISTED_MESSAGES = 40;

interface UseDirectorChatOptions {
  /** Dragon name for the state payload. */
  dragonName?: string;
  /** Character name for the state payload. */
  characterName?: string;
  /** Dragon personality notes — passed in so it picks up live edits. */
  dragonNotes?: string;
}

export function useDirectorChat(opts: UseDirectorChatOptions = {}) {
  const { dragonName, characterName, dragonNotes } = opts;

  const [messages, setMessages] = useState<DirectorMessage[]>(() => loadPersisted());
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Per-action dismissed tracking. Ids in here are hidden from render. */
  const [dismissedActionIds, setDismissedActionIds] = useState<Set<string>>(new Set());

  // Persist to scoped storage on change.
  useEffect(() => {
    try {
      const trimmed = messages.slice(-MAX_PERSISTED_MESSAGES);
      setScopedItem(STORAGE_KEY, JSON.stringify({ messages: trimmed }));
    } catch { /* ignore */ }
  }, [messages]);

  // Re-init on character switch.
  useEffect(() => {
    const handleCharacterLoaded = () => {
      setMessages(loadPersisted());
      setDismissedActionIds(new Set());
      setError(null);
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  const buildStatePayload = useCallback(() => {
    const guides = loadGMGuides('solo-empyrean').map(g => ({
      id: g.id,
      name: g.name,
      enabled: g.enabled,
    }));
    const bond = loadBondState();
    const memoryAnchors = (bond.memories || [])
      .filter((m: any) => m && typeof m.text === 'string')
      .map((m: any) => m.text);
    const campaignSummary = loadCampaignSummary() ?? '';
    const campaignCfg = loadEmpyreanDMConfig();
    return {
      guides,
      dragon_personality: dragonNotes || '',
      campaign_summary: campaignSummary,
      memory_anchors: memoryAnchors,
      dragon_name: dragonName || '',
      character_name: characterName || '',
      campaign_config: campaignCfg ? {
        character_name: campaignCfg.characterName || '',
        dragon_name: campaignCfg.dragonName || '',
        dragon_color: campaignCfg.dragonColor || '',
        signet_type: campaignCfg.signetType || '',
        year_at_basgiath: campaignCfg.yearAtBasgiath || '',
        campaign_focus: campaignCfg.campaignFocus || 'balanced',
        session_template: campaignCfg.selectedSessionTemplate || null,
        active_lore_guide_ids: campaignCfg.selectedLoreGuides || [],
        active_tone_guide_ids: campaignCfg.selectedToneGuides || [],
      } : null,
      lore_guide_catalog: EMPYREAN_LORE_GUIDES.map(g => ({ id: g.id, name: g.name, description: g.description })),
      tone_guide_catalog: EMPYREAN_TONE_GUIDES.map(g => ({ id: g.id, name: g.name, description: g.description })),
      session_template_catalog: EMPYREAN_SESSION_GUIDES.map(g => ({ id: g.id, name: g.name, description: g.description })),
    };
  }, [dragonName, characterName, dragonNotes]);

  const send = useCallback(async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || isSending) return;

    setError(null);
    const userMsg: DirectorMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsSending(true);

    try {
      // Shape the history for the edge function — role+content only, exclude actions.
      const history = messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
      const statePayload = buildStatePayload();

      const { data, error: invokeErr } = await supabase.functions.invoke('empyrean-director', {
        body: { user_message: trimmed, chat_history: history, state: statePayload },
      });

      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);

      const reply = typeof data?.reply === 'string' ? data.reply : '';
      const rawActions = Array.isArray(data?.proposed_actions) ? data.proposed_actions : [];

      // Assign ids to each proposed action so dismiss/confirm can target them.
      const actions: DirectorProposedAction[] = rawActions.map((a: any, i: number) => ({
        id: `act_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        type: a.type,
        rationale: typeof a.rationale === 'string' ? a.rationale : '',
        guide_name: a.guide_name,
        guide_content: a.guide_content,
        guide_id: a.guide_id,
        new_summary: a.new_summary,
        memory_anchor: a.memory_anchor,
        new_dragon_personality: a.new_dragon_personality,
        ooc_note: a.ooc_note,
        turns_remaining: typeof a.turns_remaining === 'number' ? a.turns_remaining : undefined,
        new_character_name: a.new_character_name,
        new_dragon_name: a.new_dragon_name,
        new_dragon_color: a.new_dragon_color,
        new_signet_type: a.new_signet_type,
        new_year_at_basgiath: a.new_year_at_basgiath,
        new_campaign_focus: a.new_campaign_focus,
        set_lore_guides: a.set_lore_guides,
        set_tone_guides: a.set_tone_guides,
        set_session_template: a.set_session_template,
      }));

      const assistantMsg: DirectorMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: reply,
        actions: actions.length > 0 ? actions : undefined,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      console.error('[DirectorChat] send failed:', e);
      setError(e?.message || 'Director request failed.');
    } finally {
      setIsSending(false);
    }
  }, [isSending, messages, buildStatePayload]);

  const dismissAction = useCallback((actionId: string) => {
    setDismissedActionIds(prev => {
      const next = new Set(prev);
      next.add(actionId);
      return next;
    });
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setDismissedActionIds(new Set());
    setError(null);
    try { removeScopedItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return {
    messages,
    isSending,
    error,
    dismissedActionIds,
    send,
    dismissAction,
    clearChat,
    /** For Prompt 7: lookup a proposed action by id across the message log. */
    findAction: (actionId: string): DirectorProposedAction | null => {
      for (const m of messages) {
        if (!m.actions) continue;
        const found = m.actions.find(a => a.id === actionId);
        if (found) return found;
      }
      return null;
    },
  };
}

// ─── Persistence helpers ───────────────────────────────────────────────────

function loadPersisted(): DirectorMessage[] {
  try {
    const raw = getScopedItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages)) return [];
    return parsed.messages.filter((m: any): m is DirectorMessage =>
      m && typeof m === 'object' &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string'
    );
  } catch {
    return [];
  }
}
