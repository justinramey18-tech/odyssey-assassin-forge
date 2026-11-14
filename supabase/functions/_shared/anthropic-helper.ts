/**
 * Shared Anthropic API helper for edge functions.
 * Used when a player turns on Claude Everywhere and sends their own Anthropic key.
 * Claude Sonnet 5.5 answers first; if it can't (an error, a busy signal, or no result), a Lovable AI
 * model answers instead (CL-047, rules in ./claude.ts). A rejected player key is reported, never hidden.
 */

import { askClaudeThenLovable, streamClaudeThenLovable, toAnthropicTools } from "./claude.ts";

interface AnthropicMessage {
  role: string;
  content: string;
}

interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Convert OpenAI-format tool definitions to Anthropic format */
export function convertToolsToAnthropic(openaiTools: any[]): AnthropicToolDef[] {
  return openaiTools.map((t: any) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

/** Non-streaming call. Returns the text content or the tool call's arguments. */
export async function callAnthropicNonStreaming(opts: {
  userApiKey: string;
  systemPrompt: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number; // ignored: Claude Sonnet 5.5 rejects temperature
  tools?: any[]; // OpenAI-format tools
  toolChoice?: string; // tool name the answer must call
  fallbackModel?: string; // Lovable AI model if Claude can't answer
}): Promise<{ text?: string; toolArguments?: any; error?: string; status?: number }> {
  const { userApiKey, systemPrompt, messages, maxTokens = 4096, tools, toolChoice, fallbackModel } = opts;
  const hasTools = Array.isArray(tools) && tools.length > 0;

  const result = await askClaudeThenLovable({
    claudeKey: userApiKey,
    playerKey: true,
    system: systemPrompt,
    messages,
    maxTokens,
    tools: hasTools ? toAnthropicTools(tools) : undefined,
    toolName: hasTools ? toolChoice : undefined,
    fallbackModel,
    tag: "[anthropic-helper]",
  });

  if (!result.ok) return { error: result.error, status: result.status };
  if (result.toolInput) return { toolArguments: result.toolInput };
  return { text: result.text || "" };
}

/** Streaming call. Returns an OpenAI-compatible SSE Response. */
export async function callAnthropicStreaming(opts: {
  userApiKey: string;
  systemPrompt: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number; // ignored: Claude Sonnet 5.5 rejects temperature
  fallbackModel?: string; // Lovable AI model if Claude can't answer
}): Promise<Response> {
  const { userApiKey, systemPrompt, messages, maxTokens = 4096, fallbackModel } = opts;

  const opened = await streamClaudeThenLovable({
    claudeKey: userApiKey,
    playerKey: true,
    system: systemPrompt,
    messages,
    maxTokens,
    fallbackModel,
    tag: "[anthropic-helper]",
  });

  if (opened.kind === "error") throw { status: opened.status, message: opened.error };
  // The Lovable AI stream is already OpenAI-compatible.
  if (opened.kind === "lovable") {
    return new Response(opened.response.body, { headers: { "Content-Type": "text/event-stream" } });
  }
  const response = opened.response;

  // Transform Anthropic SSE → OpenAI-compatible SSE
  const reader = response.body?.getReader();
  if (!reader) throw { status: 502, message: "AI service error" };
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: event.delta.text } }] })}\n\n`));
            } else if (event.type === 'message_stop') {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
          } catch { /* ignore */ }
        }
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}
