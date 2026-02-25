import { useState, useEffect, useCallback } from 'react';
import type { Answer, PersonaResult, PersonalityProfile, TestProgress } from '@/lib/personality-test/types';
import {
  loadPersonalityProfile,
  savePersonalityProfile,
  deletePersonalityProfile,
  loadTestProgress,
  saveTestProgress,
  deleteTestProgress,
} from '@/lib/personality-test/api';
import { calculatePersona } from '@/lib/personality-test/scoring';
import { TOTAL_QUESTIONS } from '@/lib/personality-test/questions';

interface UsePersonalityGateOptions {
  userId: string | undefined;
}

interface UsePersonalityGateReturn {
  /** Whether the initial load is in progress */
  loading: boolean;
  /** The user's completed personality profile, or null */
  profile: PersonalityProfile | null;
  /** In-progress test answers, or null */
  progress: TestProgress | null;
  /** Whether the user has completed the personality test */
  hasCompletedTest: boolean;
  /** Start or resume the test wizard */
  showWizard: boolean;
  setShowWizard: (v: boolean) => void;
  /** Show the results screen after completion */
  showResults: boolean;
  setShowResults: (v: boolean) => void;
  /** The newly computed persona (before navigating to DM) */
  pendingPersona: PersonaResult | null;
  /** Called when the test wizard completes */
  handleTestComplete: (answers: Answer[]) => Promise<void>;
  /** Called when the user taps "Begin Adventure" on the results screen */
  handleBeginAdventure: () => void;
  /** Attempt to open Solo DM — returns true if allowed, false if gated */
  attemptOpenDM: () => boolean;
  /** Retake the test (deletes profile + progress) */
  retakeTest: () => Promise<void>;
}

export function usePersonalityGate({ userId }: UsePersonalityGateOptions): UsePersonalityGateReturn {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PersonalityProfile | null>(null);
  const [progress, setProgress] = useState<TestProgress | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [pendingPersona, setPendingPersona] = useState<PersonaResult | null>(null);

  // Load profile + progress on mount / userId change
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [prof, prog] = await Promise.all([
        loadPersonalityProfile(userId),
        loadTestProgress(userId),
      ]);
      if (cancelled) return;
      setProfile(prof);
      setProgress(prog);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const hasCompletedTest = !!profile;

  const attemptOpenDM = useCallback((): boolean => {
    return true;
  }, []);

  const handleTestComplete = useCallback(async (answers: Answer[]) => {
    if (!userId) return;
    const persona = calculatePersona(answers);
    setPendingPersona(persona);

    // Save profile + delete progress
    await Promise.all([
      savePersonalityProfile(userId, persona, answers.length),
      deleteTestProgress(userId),
    ]);

    // Reload profile
    const prof = await loadPersonalityProfile(userId);
    setProfile(prof);
    setProgress(null);

    setShowWizard(false);
    setShowResults(true);
  }, [userId]);

  const handleBeginAdventure = useCallback(() => {
    setShowResults(false);
    setPendingPersona(null);
  }, []);

  const retakeTest = useCallback(async () => {
    if (!userId) return;
    await Promise.all([
      deletePersonalityProfile(userId),
      deleteTestProgress(userId),
    ]);
    setProfile(null);
    setProgress(null);
    setPendingPersona(null);
    setShowWizard(true);
  }, [userId]);

  return {
    loading,
    profile,
    progress,
    hasCompletedTest,
    showWizard,
    setShowWizard,
    showResults,
    setShowResults,
    pendingPersona,
    handleTestComplete,
    handleBeginAdventure,
    attemptOpenDM,
    retakeTest,
  };
}
