import { supabase } from '@/integrations/supabase/client';
import type { Answer, PersonaResult, PersonalityProfile, TestProgress } from './types';

const PROFILE_LOCAL_KEY = 'dnd-personality-profile';
const PROGRESS_LOCAL_KEY = 'dnd-personality-progress';

// ─── Profile ────────────────────────────────────────────────────

export async function loadPersonalityProfile(userId: string): Promise<PersonalityProfile | null> {
  try {
    const { data, error } = await supabase
      .from('personality_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const profile: PersonalityProfile = {
        id: data.id,
        userId: data.user_id,
        playerArchetype: data.player_archetype,
        archetypeDescription: data.archetype_description,
        dmPersonaName: data.dm_persona_name,
        dmPersonaDescription: data.dm_persona_description,
        dmSystemPrompt: data.dm_system_prompt,
        questionsAnswered: data.questions_answered,
        testVersion: data.test_version,
        createdAt: data.created_at,
      };
      // Cache locally
      try { localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(profile)); } catch {}
      return profile;
    }
  } catch (err) {
    console.error('Failed to load personality profile from cloud:', err);
  }

  // Fallback to localStorage
  try {
    const cached = localStorage.getItem(PROFILE_LOCAL_KEY);
    if (cached) return JSON.parse(cached) as PersonalityProfile;
  } catch {}
  return null;
}

export async function savePersonalityProfile(
  userId: string,
  result: PersonaResult,
  questionsAnswered: number,
): Promise<void> {
  const row = {
    user_id: userId,
    player_archetype: result.playerArchetype,
    archetype_description: result.archetypeDescription,
    dm_persona_name: result.dmPersonaName,
    dm_persona_description: result.dmPersonaDescription,
    dm_system_prompt: result.dmSystemPrompt,
    questions_answered: questionsAnswered,
    test_version: 'v1',
  };

  try {
    const { error } = await supabase
      .from('personality_profiles')
      .upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  } catch (err) {
    console.error('Failed to save personality profile to cloud:', err);
  }

  // Always cache locally too
  try {
    const profile: PersonalityProfile = {
      id: '',
      userId,
      ...result,
      questionsAnswered,
      testVersion: 'v1',
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(profile));
  } catch {}
}

export async function deletePersonalityProfile(userId: string): Promise<void> {
  try {
    await supabase.from('personality_profiles').delete().eq('user_id', userId);
  } catch (err) {
    console.error('Failed to delete personality profile:', err);
  }
  try { localStorage.removeItem(PROFILE_LOCAL_KEY); } catch {}
}

// ─── Progress ───────────────────────────────────────────────────

export async function loadTestProgress(userId: string): Promise<TestProgress | null> {
  try {
    const { data, error } = await supabase
      .from('personality_test_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const progress: TestProgress = {
        userId: data.user_id,
        answers: data.answers as unknown as Answer[],
        currentQuestion: data.current_question,
        startedAt: data.started_at,
        updatedAt: data.updated_at,
      };
      try { localStorage.setItem(PROGRESS_LOCAL_KEY, JSON.stringify(progress)); } catch {}
      return progress;
    }
  } catch (err) {
    console.error('Failed to load test progress from cloud:', err);
  }

  try {
    const cached = localStorage.getItem(PROGRESS_LOCAL_KEY);
    if (cached) return JSON.parse(cached) as TestProgress;
  } catch {}
  return null;
}

export async function saveTestProgress(
  userId: string,
  answers: Answer[],
  currentQuestion: number,
): Promise<void> {
  const row = {
    user_id: userId,
    answers: JSON.parse(JSON.stringify(answers)),
    current_question: currentQuestion,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('personality_test_progress')
      .upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  } catch (err) {
    console.error('Failed to save test progress to cloud:', err);
  }

  try {
    const progress: TestProgress = {
      userId,
      answers,
      currentQuestion,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(PROGRESS_LOCAL_KEY, JSON.stringify(progress));
  } catch {}
}

export async function deleteTestProgress(userId: string): Promise<void> {
  try {
    await supabase.from('personality_test_progress').delete().eq('user_id', userId);
  } catch (err) {
    console.error('Failed to delete test progress:', err);
  }
  try { localStorage.removeItem(PROGRESS_LOCAL_KEY); } catch {}
}
