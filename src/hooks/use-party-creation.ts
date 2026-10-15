import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  boundDraft, clearFallback, fallbackKey, readFallback, sanitizeDraft, writeFallback,
  type PartyDraft, type PartyRules,
} from '@/lib/ai-creation/party-creation-state';

export interface PartyBrief {
  campaignLabel?: string; setting?: string; tone?: string; currentSituation?: string;
  whereThePartyIs?: string; entryHooks?: string[]; campaignType?: string;
}
export interface RosterEntry { name: string; race?: string; className?: string; level?: number }

export type PartyCreationPhase = 'auth' | 'loading' | 'preparing' | 'updating' | 'ready' | 'error' | 'unavailable';

export interface PartyCreationState {
  phase: PartyCreationPhase;
  message: string | null;
  userId: string | null;
  partyId: string | null;
  campaignLabel: string;
  brief: PartyBrief | null;
  rules: PartyRules | null;
  roster: RosterEntry[];
  contextRevision: number | null;
  draftRevision: number;
  initialDraft: PartyDraft | null;
  draftConflict: boolean;
}

const INITIAL: PartyCreationState = {
  phase: 'loading', message: null, userId: null, partyId: null, campaignLabel: 'Party campaign',
  brief: null, rules: null, roster: [], contextRevision: null, draftRevision: 0, initialDraft: null, draftConflict: false,
};

const PREPARING_POLL_MS = 5000;
const READY_REFRESH_MS = 90_000;

/** Owned party onboarding session: resume, automatic campaign context, revision-checked drafts. */
export function usePartyCreation(sessionId: string | null) {
  const [state, setState] = useState<PartyCreationState>(INITIAL);
  const stateRef = useRef(state); stateRef.current = state;
  const epoch = useRef(0); // bumps on account/session change so late replies are ignored
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const pendingDraft = useRef<PartyDraft | null>(null);
  const timer = useRef<number | null>(null);

  const clearTimer = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };

  const loadContext = useCallback(async (myEpoch: number, retry = false) => {
    if (!sessionId) return;
    const { data, error } = await supabase.functions.invoke('party-creation-context', { body: { action: retry ? 'retry' : 'context', sessionId } });
    if (myEpoch !== epoch.current) return;
    const status = data?.status as string | undefined;
    if (error || !status) {
      setState(s => ({ ...s, phase: s.phase === 'ready' ? 'ready' : 'error', message: data?.message || 'We couldn’t prepare your campaign. Your draft is safe — try again.' }));
      return;
    }
    if (status === 'preparing') {
      setState(s => ({ ...s, phase: s.contextRevision != null ? 'updating' : 'preparing', message: null, roster: Array.isArray(data.roster) ? data.roster : s.roster }));
      clearTimer();
      timer.current = window.setTimeout(() => loadContext(myEpoch), PREPARING_POLL_MS);
      return;
    }
    setState(s => ({
      ...s,
      phase: status === 'ready' ? 'ready' : 'error',
      message: data.message ?? null,
      campaignLabel: data.campaignLabel || 'Party campaign',
      brief: data.brief ?? null,
      rules: data.rules ?? null,
      roster: Array.isArray(data.roster) ? data.roster : [],
      contextRevision: Number.isInteger(data.revision) ? data.revision : s.contextRevision,
    }));
    if (status === 'ready') {
      clearTimer();
      timer.current = window.setTimeout(() => loadContext(myEpoch), READY_REFRESH_MS);
    }
  }, [sessionId]);

  const start = useCallback(async (userId: string) => {
    const myEpoch = ++epoch.current;
    clearTimer();
    setState({ ...INITIAL, userId });
    if (!sessionId) { setState(s => ({ ...s, phase: 'unavailable', message: 'This invite link is missing its session.' })); return; }
    const { data, error } = await supabase.functions.invoke('party-link', { body: { action: 'onboarding_resume', sessionId } });
    if (myEpoch !== epoch.current) return;
    const status = data?.status as string | undefined;
    if (error || !status || !['ready', 'preparing', 'context_error', 'complete'].includes(status)) {
      const msg: Record<string, string> = {
        not_found: 'We couldn’t find this character in progress.',
        party_inactive: 'This party is no longer running.',
        already_member: 'You’re already in this party.',
        conflict: 'You’re already in another party. Leave it first to join this one.',
        full: 'This party is full.',
        cancelled: 'This character was cancelled.',
      };
      setState(s => ({ ...s, phase: 'unavailable', message: msg[status ?? ''] || 'We couldn’t open this character right now.' }));
      return;
    }
    const partyId = data.partyId as string;
    const serverDraft = sanitizeDraft(data.draft);
    const serverRev = Number.isInteger(data.draftRevision) ? data.draftRevision : 0;
    const key = fallbackKey(userId, partyId, sessionId);
    const local = readFallback(key);
    // Server is canonical; a local copy is used only if it is ahead of the same revision (unsent edits).
    let initialDraft = serverDraft;
    if (local && local.draftRevision === serverRev && local.messages.length > (serverDraft?.messages.length ?? 0)) {
      initialDraft = { messages: local.messages, buildData: local.buildData, buildContextRevision: local.buildContextRevision };
    } else if (local && local.draftRevision !== serverRev) {
      clearFallback(key);
    }
    setState(s => ({ ...s, partyId, draftRevision: serverRev, initialDraft, phase: status === 'complete' ? 'unavailable' : 'loading',
      message: status === 'complete' ? 'This character has already joined the party.' : null }));
    if (status !== 'complete') await loadContext(myEpoch);
  }, [sessionId, loadContext]);

  // Auth: wait for a real session; reset on account changes.
  useEffect(() => {
    let lastUser: string | null = null;
    const apply = (uid: string | null) => {
      if (uid === lastUser) return;
      lastUser = uid;
      if (!uid) { epoch.current++; clearTimer(); setState({ ...INITIAL, phase: 'auth' }); return; }
      start(uid);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session?.user?.id ?? null));
    return () => { sub.subscription.unsubscribe(); epoch.current++; clearTimer(); };
  }, [start]);

  /** Serialized, revision-checked draft save. Never overwrites a newer server draft. */
  const saveDraft = useCallback((draft: PartyDraft) => {
    const s = stateRef.current;
    if (!sessionId || !s.userId || !s.partyId || s.draftConflict) return;
    const bounded = boundDraft(draft);
    const key = fallbackKey(s.userId, s.partyId, sessionId);
    writeFallback(key, bounded, s.draftRevision);
    pendingDraft.current = bounded;
    const myEpoch = epoch.current;
    saveChain.current = saveChain.current.then(async () => {
      const next = pendingDraft.current;
      if (!next || myEpoch !== epoch.current) return;
      pendingDraft.current = null;
      const rev = stateRef.current.draftRevision;
      const { data, error } = await supabase.functions.invoke('party-link', {
        body: { action: 'onboarding_save_draft', sessionId, expectedRevision: rev, draft: next },
      });
      if (myEpoch !== epoch.current) return;
      if (error || !data?.status) return; // keep local fallback; next save retries
      if (data.status === 'saved' && Number.isInteger(data.draftRevision)) {
        stateRef.current = { ...stateRef.current, draftRevision: data.draftRevision };
        setState(st => ({ ...st, draftRevision: data.draftRevision }));
        writeFallback(key, next, data.draftRevision);
      } else if (data.status === 'stale') {
        setState(st => ({ ...st, draftConflict: true }));
      }
    }).catch(() => { /* keep chain alive */ });
  }, [sessionId]);

  const retry = useCallback(() => {
    setState(s => ({ ...s, phase: s.contextRevision != null ? 'updating' : 'preparing', message: null }));
    loadContext(epoch.current, true);
  }, [loadContext]);

  const reloadFromServer = useCallback(() => {
    if (stateRef.current.userId) start(stateRef.current.userId);
  }, [start]);

  return { ...state, saveDraft, retry, reloadFromServer };
}
