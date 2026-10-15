import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  boundDraft, clearFallback, fallbackKey, readFallback, sanitizeDraft, writeFallback,
  type PartyDraft, type PartyRules,
} from '@/lib/ai-creation/party-creation-state';
import type { PartySavePayload, PartyCreationReceipt } from '@/lib/ai-creation/party-build-save';

export type FinalizeResult =
  | { ok: true; receipt: Omit<PartyCreationReceipt, 'consumed'> }
  | { ok: false; message: string; reload?: boolean; committed?: boolean };

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
  reservedSaveId: string | null;
  completedSaveId: string | null;
}

const INITIAL: PartyCreationState = {
  phase: 'loading', message: null, userId: null, partyId: null, campaignLabel: 'Party campaign',
  brief: null, rules: null, roster: [], contextRevision: null, draftRevision: 0, initialDraft: null, draftConflict: false,
  reservedSaveId: null, completedSaveId: null,
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
    const reservedSaveId = typeof data.reservedSaveId === 'string' ? data.reservedSaveId : null;
    const completedSaveId = typeof data.completedSaveId === 'string' ? data.completedSaveId : null;
    setState(s => ({ ...s, partyId, draftRevision: serverRev, initialDraft, reservedSaveId, completedSaveId, phase: status === 'complete' ? 'unavailable' : 'loading',
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

  /**
   * Commit the reviewed build: finish the latest draft save, finalize with exact
   * revisions, then verify the owned save + seat. Never clears the draft on failure.
   */
  const finalize = useCallback(async (payload: PartySavePayload): Promise<FinalizeResult> => {
    const s0 = stateRef.current;
    if (!sessionId || !s0.userId || !s0.partyId) return { ok: false, message: 'This character isn’t ready yet.' };
    await saveChain.current; // let the latest draft save land first
    const s = stateRef.current;
    if (s.draftConflict) return { ok: false, message: 'This character was changed on another device. Reload it first.', reload: true };
    if (pendingDraft.current) return { ok: false, message: 'Your latest changes are still saving. Try again in a moment.' };
    if (s.contextRevision == null) return { ok: false, message: 'The campaign is still being prepared.' };

    const verify = async (saveId: string | null): Promise<FinalizeResult> => {
      if (!saveId || (s.reservedSaveId && saveId !== s.reservedSaveId)) return { ok: false, message: 'The saved character didn’t match this invite. Ask the host for help.' };
      const { data: row, error } = await supabase.from('character_saves').select('id, extended_data').eq('id', saveId).eq('user_id', s.userId!).maybeSingle();
      if (error) return { ok: false, message: 'Your character was saved, but we couldn’t read it back. Try again.', committed: true };
      const ext = (row?.extended_data ?? {}) as Record<string, unknown>;
      if (!row || ext.partyId !== s.partyId) return { ok: false, message: 'The saved character didn’t match this party. Ask the host for help.' };
      clearFallback(fallbackKey(s.userId!, s.partyId!, sessionId));
      return { ok: true, receipt: { sessionId, partyId: s.partyId!, saveId, userId: s.userId! } };
    };
    const fromResume = async (): Promise<FinalizeResult | null> => {
      const { data } = await supabase.functions.invoke('party-link', { body: { action: 'onboarding_resume', sessionId } });
      if (data?.status === 'complete' && data.partyId === s.partyId) return verify(data.completedSaveId ?? null);
      return null;
    };

    const { data, error } = await supabase.functions.invoke('party-link', {
      body: { action: 'onboarding_finalize', sessionId, expectedDraftRevision: s.draftRevision, expectedContextRevision: s.contextRevision, savePayload: payload },
    });
    const status = data?.status as string | undefined;
    if (status === 'complete') {
      if (data.partyId !== s.partyId) return { ok: false, message: 'The saved character didn’t match this party.' };
      return verify(data.completedSaveId ?? null);
    }
    if (error || !status || status === 'error') {
      // Uncertain (timeout / dropped reply): check the server receipt before any retry.
      const resumed = await fromResume().catch(() => null);
      if (resumed) return resumed;
      return { ok: false, message: 'We couldn’t confirm your join. Your character is safe — try again.' };
    }
    const msg: Record<string, string> = {
      stale_draft: 'This character was changed somewhere else. Reload it before joining.',
      stale_context: 'The campaign’s rules were just updated. Ask the creator to re-check your build.',
      preparing: 'The campaign is still being prepared. Try again shortly.',
      rules_unresolved: 'The campaign rules have a conflict the host needs to settle.',
      full: 'This party is full.',
      party_inactive: 'This party is no longer running.',
      already_member: 'You already have a seat in this party.',
      conflict: 'You’re already in another party. Leave it first to join this one.',
      not_found: 'We couldn’t find this character in progress.',
      not_editable: 'This invite has expired or was cancelled.',
      rate_limited: 'Too many tries. Wait a little and try again.',
      name_taken: 'You have too many characters with this name. Rename this one.',
      receipt_invalid: data?.message || 'This finished character no longer matches its seat. Ask the host for help.',
      rule_mismatch: `This build breaks a campaign rule (${data?.field ?? 'unknown'}).`,
      invalid_payload: `Part of the character couldn’t be saved (${data?.field ?? 'unknown'}).`,
    };
    if (status === 'stale_context') retry();
    return { ok: false, message: msg[status] || 'We couldn’t join right now. Your character is safe.', reload: status === 'stale_draft' };
  }, [sessionId, retry]);

  return { ...state, saveDraft, retry, reloadFromServer, finalize };
}
