// npc-reply: one short, non-streamed call to the NPC's model, using the server's own keys.
// Players' keys never reach the server, so an NPC can use Venice, the Lovable AI gateway
// (Gemini, GPT) or Claude, each only if the matching server secret is set.

/** ok: true with text (and cost when the provider reports it), or ok: false with a plain reason. */
export interface ModelResult {
  ok: boolean;
  text?: string;
  costUsd?: number | null;
  reason?: string;
}

export type CallModel = (model: string, system: string, user: string) => Promise<ModelResult>;

export interface ModelEnv {
  VENICE_API_KEY?: string | null;
  LOVABLE_API_KEY?: string | null;
  ANTHROPIC_API_KEY?: string | null;
}

const TIMEOUT_MS = 45_000;

/** App model ids for Claude, mapped to Anthropic's ids (old ids go to their replacements, like ai-dm). */
const CLAUDE_IDS: Record<string, string> = {
  'anthropic/claude-fable-5-1': 'claude-fable-5-1',
  'anthropic/claude-opus-5-5': 'claude-opus-5-5',
  'anthropic/claude-sonnet-5-5': 'claude-sonnet-5-5',
  'anthropic/claude-haiku-5-5': 'claude-haiku-5-5',
  'anthropic/claude-sonnet-4': 'claude-sonnet-5-5',
  'anthropic/claude-sonnet-4-5': 'claude-sonnet-5-5',
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6',
  'anthropic/claude-haiku-4-5': 'claude-haiku-5-5',
};

export function providerOf(model: string): 'venice' | 'gateway' | 'anthropic' | null {
  if (model.startsWith('venice/')) return 'venice';
  if (model.startsWith('google/') || model.startsWith('openai/')) return 'gateway';
  if (model.startsWith('anthropic/')) return 'anthropic';
  return null;
}

/** OpenAI-style message content: a string, or a list of text parts. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p: any) => (typeof p === 'string' ? p : typeof p?.text === 'string' ? p.text : ''))
      .join('');
  }
  return '';
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = await res.text();
    return body.slice(0, 200);
  } catch {
    return '';
  }
}

export function createModelCaller(env: ModelEnv, fetchFn: typeof fetch = fetch): CallModel {
  const post = async (url: string, headers: Record<string, string>, body: unknown): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  return async (model, system, user) => {
    const provider = providerOf(model);
    try {
      if (provider === 'venice') {
        const key = env.VENICE_API_KEY?.trim();
        if (!key) return { ok: false, reason: 'no Venice key on the server (VENICE_API_KEY)' };
        const res = await post('https://api.venice.ai/api/v1/chat/completions', { Authorization: `Bearer ${key}` }, {
          model: model.slice('venice/'.length),
          max_tokens: 600,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          stream: false,
          venice_parameters: {
            include_venice_system_prompt: false,
            strip_thinking_response: true,
            disable_thinking: true,
            enable_web_search: 'off',
          },
        });
        if (res.status === 402) return { ok: false, reason: 'Venice is out of credit' };
        if (res.status === 401) return { ok: false, reason: 'Venice rejected the server key' };
        if (res.status === 429) return { ok: false, reason: 'Venice is busy (rate limit)' };
        if (!res.ok) return { ok: false, reason: `Venice error ${res.status} ${await errorDetail(res)}`.trim() };
        const json: any = await res.json();
        const cost = Number(json?.cost?.usd);
        return { ok: true, text: contentText(json?.choices?.[0]?.message?.content), costUsd: Number.isFinite(cost) ? cost : null };
      }

      if (provider === 'gateway') {
        const key = env.LOVABLE_API_KEY?.trim();
        if (!key) return { ok: false, reason: 'no Lovable AI key on the server (LOVABLE_API_KEY)' };
        const res = await post('https://ai.gateway.lovable.dev/v1/chat/completions', { Authorization: `Bearer ${key}` }, {
          model,
          // Gemini may think before it writes; leave room for both.
          max_tokens: 1500,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          stream: false,
        });
        if (res.status === 402) return { ok: false, reason: 'Lovable AI credits are out' };
        if (res.status === 429) return { ok: false, reason: 'Lovable AI is busy (rate limit)' };
        if (!res.ok) return { ok: false, reason: `Lovable AI error ${res.status} ${await errorDetail(res)}`.trim() };
        const json: any = await res.json();
        return { ok: true, text: contentText(json?.choices?.[0]?.message?.content), costUsd: null };
      }

      if (provider === 'anthropic') {
        const key = env.ANTHROPIC_API_KEY?.trim();
        if (!key) return { ok: false, reason: 'no Anthropic key on the server (ANTHROPIC_API_KEY)' };
        const id = CLAUDE_IDS[model];
        if (!id) return { ok: false, reason: `unknown Claude model ${model}` };
        // A short NPC line: ask the Claude 5 models for little or no thinking (same rule as ai-dm).
        const extra: Record<string, unknown> =
          id === 'claude-sonnet-5-5' ? { output_config: { effort: 'low' }, thinking: { type: 'between_tools' } }
          : id === 'claude-haiku-5-5' ? { output_config: { effort: 'low' }, thinking: { type: 'disabled' } }
          : id === 'claude-opus-5-5' || id === 'claude-fable-5-1' ? { output_config: { effort: 'low' } }
          : {};
        const maxTokens = id === 'claude-opus-5-5' || id === 'claude-fable-5-1' ? 600 + 1024 : 600;
        const res = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, {
          model: id,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
          ...extra,
        });
        if (res.status === 401) return { ok: false, reason: 'Anthropic rejected the server key' };
        if (res.status === 429) return { ok: false, reason: 'Anthropic is busy (rate limit)' };
        if (!res.ok) return { ok: false, reason: `Anthropic error ${res.status} ${await errorDetail(res)}`.trim() };
        const json: any = await res.json();
        const text = Array.isArray(json?.content)
          ? json.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text || '').join('')
          : '';
        return { ok: true, text, costUsd: null };
      }

      return { ok: false, reason: `the model ${model} can't run on the server` };
    } catch (err) {
      const aborted = (err as { name?: string })?.name === 'AbortError';
      return { ok: false, reason: aborted ? `${model} took too long` : `could not reach ${model}` };
    }
  };
}
