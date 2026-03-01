/**
 * Shared OpenAI API helper for edge functions.
 * Provides non-streaming and streaming calls + tool calling support.
 * Mirrors the anthropic-helper.ts API surface.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5";

/** Map from our openai-direct/ prefixed IDs to actual OpenAI model IDs */
export const OPENAI_DIRECT_MODELS: Record<string, string> = {
  'openai-direct/gpt-5': 'gpt-5',
  'openai-direct/gpt-4o': 'gpt-4o',
  'openai-direct/gpt-4o-mini': 'gpt-4o-mini',
  'openai-direct/gpt-4-turbo': 'gpt-4-turbo',
  'openai-direct/o1': 'o1',
  'openai-direct/o1-mini': 'o1-mini',
};

interface OpenAIMessage {
  role: string;
  content: string;
}

/** Non-streaming call to OpenAI. Returns text content or tool_use result. */
export async function callOpenAINonStreaming(opts: {
  userApiKey: string;
  systemPrompt: string;
  messages: OpenAIMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
  tools?: any[];
  toolChoice?: string;
}): Promise<{ text?: string; toolArguments?: any; error?: string; status?: number }> {
  const {
    userApiKey, systemPrompt, messages, maxTokens = 4096,
    temperature = 0.7, model = DEFAULT_MODEL, tools, toolChoice,
  } = opts;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
    ],
    temperature,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    if (toolChoice) {
      body.tool_choice = { type: "function", function: { name: toolChoice } };
    }
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${userApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    if (response.status === 429) return { error: "OpenAI rate limit exceeded. Please wait and try again.", status: 429 };
    if (response.status === 401) return { error: "Invalid OpenAI API key. Please update your key in Settings.", status: 401 };
    return { error: "OpenAI API error", status: 500 };
  }

  const data = await response.json();

  // Check for tool calls
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      return { toolArguments: JSON.parse(toolCall.function.arguments) };
    } catch {
      return { toolArguments: toolCall.function.arguments };
    }
  }

  return { text: data.choices?.[0]?.message?.content || "" };
}

/** Streaming call to OpenAI. Returns an OpenAI-compatible SSE Response (already in correct format). */
export async function callOpenAIStreaming(opts: {
  userApiKey: string;
  systemPrompt: string;
  messages: OpenAIMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}): Promise<Response> {
  const {
    userApiKey, systemPrompt, messages, maxTokens = 4096,
    temperature = 0.7, model = DEFAULT_MODEL,
  } = opts;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${userApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
      ],
      stream: true,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI streaming error:", response.status, errorText);
    if (response.status === 429) throw { status: 429, message: "OpenAI rate limit exceeded." };
    if (response.status === 401) throw { status: 401, message: "Invalid OpenAI API key." };
    throw { status: 500, message: "OpenAI API error" };
  }

  // OpenAI's SSE format is already in the correct format, just pass through
  return new Response(response.body, { headers: { "Content-Type": "text/event-stream" } });
}
