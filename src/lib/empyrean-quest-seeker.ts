// Empyrean quest hub: the network half of "Seek a quest" (rules in empyrean-quest-hub.ts).
// Asks the shared ai-dm function, with its own instruction sheet and no thinking, for 2–3
// offers in one category; tries a backup model once; never throws.
import { getAuthToken } from '@/lib/auth-token';
import { buildSeekPrompt, parseSeekReply, type HubCategoryId, type SeekContext } from '@/lib/empyrean-quest-hub';
import type { RawQuestOffer } from '@/lib/quests';

export const SEEK_MODEL = 'google/gemini-2.5-flash';
export const SEEK_BACKUP_MODEL = 'google/gemini-2.5-flash-lite';

const SEEK_MAX_TOKENS = 2000;
const SEEK_TIMEOUT_MS = 45_000;

export interface SeekResult {
  offers: RawQuestOffer[];
  /** Plain-words reason when no offers came back. */
  error?: string;
}

/** One streamed call to ai-dm with the hub instruction sheet. Returns the full text. */
async function askSeekModel(model: string, system: string, user: string, signal: AbortSignal): Promise<string> {
  const token = await getAuthToken();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: [{ role: 'user', content: user }],
      systemPromptOverride: system,
      model,
      maxTokens: SEEK_MAX_TOKENS,
      noThinking: true,
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

/** Ask for 2–3 offers in one category. Returns the offers it could read, or an error in plain words. */
export async function seekQuests(category: HubCategoryId, rankIndex: number, ctx: SeekContext): Promise<SeekResult> {
  const { system, user } = buildSeekPrompt(category, rankIndex, ctx);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEEK_TIMEOUT_MS);
  let lastError = '';
  try {
    for (const model of [SEEK_MODEL, SEEK_BACKUP_MODEL]) {
      try {
        const text = await askSeekModel(model, system, user, controller.signal);
        const offers = parseSeekReply(text, category, rankIndex, ctx.existingTitles);
        if (offers.length > 0) return { offers };
        lastError = 'The quest writer sent nothing usable.';
      } catch (e) {
        if (controller.signal.aborted) return { offers: [], error: 'The quest writer took too long. Try again.' };
        lastError = e instanceof Error ? e.message : 'The quest writer failed.';
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return { offers: [], error: lastError || 'No quests came back. Try again.' };
}
