// Empyrean quest GM guides: the network half (rules in empyrean-quest-guide.ts).

// Asks the shared ai-dm function, with the guide writer's own instruction sheet, for one quest's

// guide. Tries the main writer once, then the backup once; never throws.

import { getAuthToken } from '@/lib/auth-token';

import { buildGuidePrompt, parseGuideReply, type GuideContext, type QuestGuide } from '@/lib/empyrean-quest-guide';

import type { Quest } from '@/lib/quests';



/** Justin's call (2026-11-19): GPT-6 Astra through Lovable AI writes the guide; Claude is the backup. */

export const GUIDE_MODEL = 'openai/gpt-6-astra';

export const GUIDE_BACKUP_MODEL = 'anthropic/claude-sonnet-5-5';



const GUIDE_MAX_TOKENS = 16000;

/** Each writer gets this long. A large guide takes a while. */

const GUIDE_TIMEOUT_MS = 240_000;



export interface GuideResult {

  guide: QuestGuide | null;

  /** Plain-words reason when no guide came back. */

  error?: string;

}



/** One streamed call to ai-dm with the guide writer's instruction sheet. Returns the full text. */

async function askGuideModel(model: string, system: string, user: string, signal: AbortSignal): Promise<string> {

  const token = await getAuthToken();

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },

    body: JSON.stringify({

      messages: [{ role: 'user', content: user }],

      systemPromptOverride: system,

      model,

      maxTokens: GUIDE_MAX_TOKENS,

    }),

    signal,

  });

  if (!response.ok) {

    const err = await response.json().catch(() => ({}));

    throw new Error((err as { error?: string }).error || `status ${response.status}`);

  }

  if (!response.body) throw new Error('no response');

  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  let buffer = '';

  let full = '';

  let finished = false;

  while (!finished) {

    const chunk = await reader.read();

    if (chunk.done) break;

    buffer += decoder.decode(chunk.value, { stream: true });

    let nl: number;

    while ((nl = buffer.indexOf('\n')) !== -1) {

      let line = buffer.slice(0, nl);

      buffer = buffer.slice(nl + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);

      if (!line.startsWith('data: ')) continue;

      const json = line.slice(6).trim();

      if (json === '[DONE]') { finished = true; break; }

      let parsed: { error?: unknown; choices?: Array<{ delta?: { content?: unknown } }> } | null = null;

      try { parsed = JSON.parse(json); } catch { /* partial line or usage chunk */ }

      if (parsed?.error) throw new Error(typeof parsed.error === 'string' ? parsed.error : 'stream error');

      const delta = parsed?.choices?.[0]?.delta?.content;

      if (typeof delta === 'string' && delta) full += delta;

    }

  }

  reader.cancel().catch(() => {});

  return full;

}



/** Write one quest's GM guide. Returns the guide, or null with a reason in plain words. */

export async function writeQuestGuide(quest: Quest, ctx: GuideContext): Promise<GuideResult> {

  const { system, user } = buildGuidePrompt(quest, ctx);

  let lastError = '';

  for (const model of [GUIDE_MODEL, GUIDE_BACKUP_MODEL]) {

    const controller = new AbortController();

    const timer = setTimeout(() => controller.abort(), GUIDE_TIMEOUT_MS);

    try {

      const text = await askGuideModel(model, system, user, controller.signal);

      const guide = parseGuideReply(text, quest, model, new Date().toISOString());

      if (guide) return { guide };

      lastError = 'The guide writer sent nothing usable.';

    } catch (e) {

      lastError = controller.signal.aborted ? 'The guide writer took too long.' : e instanceof Error ? e.message : 'The guide writer failed.';

    } finally {

      clearTimeout(timer);

    }

  }

  return { guide: null, error: lastError || 'No guide came back.' };

}
