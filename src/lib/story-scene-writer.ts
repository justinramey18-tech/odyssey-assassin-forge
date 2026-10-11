// Story scenes: the network half (see story-scene.ts). Asks the shared ai-dm function,
// with its own instruction sheet and no thinking, to write the scene, checks that every
// spoken line made it in word for word, asks once more if not, and otherwise falls back
// to the plain script. It never throws: when there are lines, a scene always comes back.

import { getAuthToken } from '@/lib/auth-token';
import { loadApiKey } from '@/lib/api-keys';
import {
  SCENE_BACKUP_MODEL,
  SCENE_MAX_TOKENS,
  SCENE_MODEL,
  buildScenePrompt,
  cleanSceneText,
  missingSpokenLines,
  sceneRetryNote,
  sceneScript,
  type StorySceneLine,
} from '@/lib/story-scene';

export interface StorySceneResult {
  text: string;
  /** 'ai' = the scene model wrote it, 'backup' = the backup model did, 'script' = no AI. */
  source: 'ai' | 'backup' | 'script';
  /** Why it fell back to the script, in plain words. Empty when an AI scene passed the check. */
  reason: string;
}

/** The scene runs next to the DM's reply; past this it is shown as a script so the post isn't held up. */
const SCENE_TIMEOUT_MS = 75_000;

type ChatTurn = { role: 'user' | 'assistant'; content: string };

/** One streamed call to ai-dm with the scene instruction sheet. Returns the full text. */
async function askSceneModel(model: string, system: string, messages: ChatTurn[], signal: AbortSignal): Promise<string> {
  const token = await getAuthToken();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages,
      systemPromptOverride: system,
      model,
      maxTokens: SCENE_MAX_TOKENS,
      noThinking: true,
      user_venice_key: loadApiKey('venice') || undefined,
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Write the scene for these sealed lines. Returns null when there are none.
 * `setting` is the end of the latest DM post (sceneSetting), so the scene knows where everyone is.
 */
export async function writeStoryScene(lines: StorySceneLine[], setting: string): Promise<StorySceneResult | null> {
  const spoken = lines.filter(l => (l.text || '').trim());
  if (spoken.length === 0) return null;
  const script = (reason: string): StorySceneResult => ({ text: sceneScript(spoken), source: 'script', reason });

  const { system, user } = buildScenePrompt(spoken, setting);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCENE_TIMEOUT_MS);
  const tooSlow = 'The scene writer took too long, so the scene is shown as a script.';
  const failures: string[] = [];
  try {
    const attempts: Array<[string, 'ai' | 'backup']> = [[SCENE_MODEL, 'ai'], [SCENE_BACKUP_MODEL, 'backup']];
    for (const [model, source] of attempts) {
      let first = '';
      try {
        first = cleanSceneText(await askSceneModel(model, system, [{ role: 'user', content: user }], controller.signal));
      } catch (err) {
        if (controller.signal.aborted) return script(tooSlow);
        failures.push(err instanceof Error ? err.message : String(err));
        continue;
      }
      if (!first) {
        failures.push('empty answer');
        continue;
      }
      const missing = missingSpokenLines(first, spoken);
      if (missing.length === 0) return { text: first, source, reason: '' };

      // One more try on the same model, naming exactly what went missing.
      try {
        const second = cleanSceneText(await askSceneModel(model, system, [
          { role: 'user', content: user },
          { role: 'assistant', content: first },
          { role: 'user', content: sceneRetryNote(missing) },
        ], controller.signal));
        if (second && missingSpokenLines(second, spoken).length === 0) return { text: second, source, reason: '' };
      } catch {
        if (controller.signal.aborted) return script(tooSlow);
      }
      console.warn('[story-scene] spoken lines missing from the scene:', missing);
      return script(`The scene writer changed or left out ${plural(missing.length, 'spoken line')}, so the scene is shown as a script.`);
    }
    console.warn('[story-scene] scene writer unavailable:', failures);
    return script(`The scene writer couldn't be reached (${failures.join('; ') || 'no answer'}), so the scene is shown as a script.`);
  } finally {
    clearTimeout(timer);
  }
}
