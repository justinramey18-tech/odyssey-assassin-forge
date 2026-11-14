// One place for the server's Claude model choices and the Lovable AI fallback (CL-047).
//
// Claude Sonnet 5.5 rejects three things older Claude models accepted: temperature/top_p/top_k,
// a forced tool_choice ("tool" or "any"), and a reply that ends on an assistant message (prefill).
// Every request built here leaves those out. When Claude can't answer (no key, an error, a busy
// signal, or no result), the request goes to a Lovable AI model instead.

export const CLAUDE_MODEL = "claude-sonnet-5-5";
export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const LOVABLE_FALLBACK_MODEL = "google/gemini-2.5-flash";

// App model ids (as the phone sends them) -> Claude API ids. Retired or retiring ids move forward.
export const CLAUDE_MODEL_IDS: Record<string, string> = {
  "anthropic/claude-fable-5-1": "claude-fable-5-1",
  "anthropic/claude-opus-5-5": "claude-opus-5-5",
  "anthropic/claude-sonnet-5-5": "claude-sonnet-5-5",
  "anthropic/claude-haiku-5-5": "claude-haiku-5-5",
  "anthropic/claude-sonnet-4": "claude-sonnet-5-5",
  "anthropic/claude-sonnet-4-5": "claude-sonnet-5-5",
  "anthropic/claude-sonnet-4-6": "claude-sonnet-4-6",
  "anthropic/claude-opus-4-6": "claude-opus-4-6",
  "anthropic/claude-haiku-4-5": "claude-haiku-5-5",
};

export interface ChatMessage {
  role: string;
  content: string;
}

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface OpenAITool {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}

// Extra request fields a Claude model needs. Sonnet 5.5 skips up-front thinking with
// "between_tools" (it rejects "disabled"), so a reply without tools is text only, like the old
// models. Same settings ai-dm already sends for short requests.
export function claudeModelOptions(model: string): Record<string, unknown> {
  if (model === "claude-sonnet-5-5") return { thinking: { type: "between_tools" } };
  if (model === "claude-haiku-5-5") return { thinking: { type: "disabled" } };
  return {};
}

// Claude wants user/assistant turns that end on the user. System turns become user turns, and
// a trailing assistant turn (a prefill) is dropped because Sonnet 5.5 rejects it.
export function cleanMessages(messages: ChatMessage[]): ChatMessage[] {
  const out = (messages || [])
    .filter((m) => m && typeof m.content === "string")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  while (out.length > 0 && out[out.length - 1].role === "assistant") out.pop();
  return out;
}

export function toOpenAITools(tools: AnthropicTool[]): OpenAITool[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

export function toAnthropicTools(tools: OpenAITool[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

export function claudeBody(opts: {
  model?: string;
  system: string;
  cacheSystem?: boolean;
  messages: ChatMessage[];
  maxTokens: number;
  stream?: boolean;
  tools?: AnthropicTool[];
}): Record<string, unknown> {
  const model = opts.model || CLAUDE_MODEL;
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens,
    system: opts.cacheSystem
      ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
      : opts.system,
    messages: cleanMessages(opts.messages),
    ...claudeModelOptions(model),
  };
  if (opts.stream) body.stream = true;
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = { type: "auto" };
  }
  return body;
}

// All text blocks of a Claude reply, in order. Never assumes the first block is text.
export function claudeText(json: any): string {
  const blocks = Array.isArray(json?.content) ? json.content : [];
  return blocks
    .filter((b: any) => b?.type === "text" && typeof b.text === "string")
    .map((b: any) => b.text)
    .join("");
}

export function claudeToolInput(json: any, name?: string): Record<string, unknown> | null {
  const blocks = Array.isArray(json?.content) ? json.content : [];
  const block = blocks.find((b: any) => b?.type === "tool_use" && (!name || b.name === name));
  return block && block.input && typeof block.input === "object" ? block.input : null;
}

export function lovableBody(opts: {
  model?: string;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  toolName?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: opts.model || LOVABLE_FALLBACK_MODEL,
    messages: [
      { role: "system", content: opts.system },
      ...(opts.messages || []).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ],
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.stream) body.stream = true;
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    if (opts.toolName) body.tool_choice = { type: "function", function: { name: opts.toolName } };
  }
  return body;
}

export function lovableText(json: any): string {
  const content = json?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

export function lovableToolInput(json: any, name?: string): Record<string, unknown> | null {
  const calls = json?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return null;
  const call = calls.find((c: any) => !name || c?.function?.name === name);
  if (!call?.function?.arguments) return null;
  try {
    const parsed = JSON.parse(call.function.arguments);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function signalFor(req: { signal?: AbortSignal; timeoutMs?: number }): AbortSignal | undefined {
  return req.signal ?? (req.timeoutMs ? AbortSignal.timeout(req.timeoutMs) : undefined);
}

function postClaude(key: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

function postLovable(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return fetch(LOVABLE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

export const BAD_PLAYER_KEY = "Invalid Anthropic API key. Please update your key in Settings.";

function lovableError(status: number): { status: number; error: string } {
  if (status === 429) return { status: 429, error: "Rate limit exceeded. Please wait and try again." };
  if (status === 402) return { status: 402, error: "AI credits exhausted. Please add credits to continue." };
  return { status: 502, error: "AI service error" };
}

export interface ClaudeRequest {
  claudeKey?: string | null; // a player's own key or the server's ANTHROPIC_API_KEY
  playerKey?: boolean; // true when claudeKey is the player's own key
  model?: string; // Claude API id; default CLAUDE_MODEL
  system: string;
  cacheSystem?: boolean;
  messages: ChatMessage[];
  maxTokens: number;
  fallbackModel?: string; // Lovable AI model; default LOVABLE_FALLBACK_MODEL
  tag: string; // log label, e.g. "[guide-creator]"
  signal?: AbortSignal;
  timeoutMs?: number; // a fresh time limit for each try (Claude, then Lovable AI)
}

export type AskResult =
  | { ok: true; via: "claude" | "lovable"; text: string; toolInput: Record<string, unknown> | null }
  | { ok: false; status: number; error: string };

// One answer, not streamed: Claude first, then a Lovable AI model. With toolName, the answer
// must be a call to that tool; Claude is offered the tool (tool_choice auto), and if it answers
// in plain text instead, the Lovable model is asked with the tool forced. A player's own key
// that Claude rejects (401) returns an error so the player can fix it.
export async function askClaudeThenLovable(
  req: ClaudeRequest & { tools?: AnthropicTool[]; toolName?: string },
): Promise<AskResult> {
  const key = req.claudeKey?.trim();
  if (key) {
    try {
      const res = await postClaude(key, claudeBody({ ...req, tools: req.tools }), signalFor(req));
      if (res.ok) {
        const json = await res.json();
        const text = claudeText(json);
        const toolInput = req.toolName ? claudeToolInput(json, req.toolName) : null;
        if (req.toolName ? toolInput : text.trim()) return { ok: true, via: "claude", text, toolInput };
        console.warn(`${req.tag} Claude gave no ${req.toolName ? "tool call" : "text"}; using Lovable AI`);
      } else {
        const detail = await res.text().catch(() => "");
        if (res.status === 401 && req.playerKey) return { ok: false, status: 401, error: BAD_PLAYER_KEY };
        console.warn(`${req.tag} Claude ${res.status}; using Lovable AI`, detail.slice(0, 300));
      }
    } catch (e) {
      console.warn(`${req.tag} Claude call failed; using Lovable AI`, e instanceof Error ? e.message : e);
    }
  }
  try {
    const res = await postLovable(
      lovableBody({
        model: req.fallbackModel,
        system: req.system,
        messages: req.messages,
        maxTokens: req.maxTokens,
        tools: req.tools ? toOpenAITools(req.tools) : undefined,
        toolName: req.toolName,
      }),
      signalFor(req),
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`${req.tag} Lovable AI ${res.status}`, detail.slice(0, 300));
      return { ok: false, ...lovableError(res.status) };
    }
    const json = await res.json();
    const text = lovableText(json);
    const toolInput = req.toolName ? lovableToolInput(json, req.toolName) : null;
    if (req.toolName && !toolInput) return { ok: false, status: 502, error: "The AI did not return a result" };
    return { ok: true, via: "lovable", text, toolInput };
  } catch (e) {
    console.error(`${req.tag} Lovable AI call failed`, e instanceof Error ? e.message : e);
    return { ok: false, status: 502, error: "AI service error" };
  }
}

export type StreamResult =
  | { kind: "claude"; response: Response } // Claude's own event stream (content_block_delta events)
  | { kind: "lovable"; response: Response } // OpenAI-style stream (choices[0].delta.content), ends with [DONE]
  | { kind: "error"; status: number; error: string };

// A streamed answer: Claude first, then a Lovable AI model. Falls back only before the first
// word arrives (a stream that breaks part-way can't switch models).
export async function streamClaudeThenLovable(req: ClaudeRequest): Promise<StreamResult> {
  const key = req.claudeKey?.trim();
  if (key) {
    try {
      const res = await postClaude(key, claudeBody({ ...req, stream: true }), signalFor(req));
      if (res.ok && res.body) return { kind: "claude", response: res };
      const detail = await res.text().catch(() => "");
      if (res.status === 401 && req.playerKey) return { kind: "error", status: 401, error: BAD_PLAYER_KEY };
      console.warn(`${req.tag} Claude ${res.status}; using Lovable AI`, detail.slice(0, 300));
    } catch (e) {
      console.warn(`${req.tag} Claude call failed; using Lovable AI`, e instanceof Error ? e.message : e);
    }
  }
  try {
    const res = await postLovable(
      lovableBody({
        model: req.fallbackModel,
        system: req.system,
        messages: req.messages,
        maxTokens: req.maxTokens,
        stream: true,
      }),
      signalFor(req),
    );
    if (res.ok && res.body) return { kind: "lovable", response: res };
    const detail = await res.text().catch(() => "");
    console.error(`${req.tag} Lovable AI ${res.status}`, detail.slice(0, 300));
    return { kind: "error", ...lovableError(res.status) };
  } catch (e) {
    console.error(`${req.tag} Lovable AI call failed`, e instanceof Error ? e.message : e);
    return { kind: "error", status: 502, error: "AI service error" };
  }
}
