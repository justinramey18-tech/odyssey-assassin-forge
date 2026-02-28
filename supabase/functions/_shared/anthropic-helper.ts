/**
 * Shared Anthropic API helper for edge functions.
 * Provides non-streaming and streaming calls + tool calling support.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

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

/** Non-streaming call to Anthropic. Returns the text content or tool_use result. */
export async function callAnthropicNonStreaming(opts: {
  userApiKey: string;
  systemPrompt: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
  tools?: any[]; // OpenAI-format tools
  toolChoice?: string; // tool name to force
}): Promise<{ text?: string; toolArguments?: any; error?: string; status?: number }> {
  const { userApiKey, systemPrompt, messages, maxTokens = 4096, temperature = 0.7, tools, toolChoice } = opts;

  const body: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
    temperature,
  };

  if (tools && tools.length > 0) {
    body.tools = convertToolsToAnthropic(tools);
    if (toolChoice) {
      body.tool_choice = { type: "tool", name: toolChoice };
    }
  }

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": userApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", response.status, errorText);
    if (response.status === 429) return { error: "Anthropic rate limit exceeded. Please wait and try again.", status: 429 };
    if (response.status === 401) return { error: "Invalid Anthropic API key. Please update your key in Settings.", status: 401 };
    return { error: "Anthropic API error", status: 500 };
  }

  const data = await response.json();

  // Check for tool_use blocks
  const toolUseBlock = data.content?.find((b: any) => b.type === "tool_use");
  if (toolUseBlock) {
    return { toolArguments: toolUseBlock.input };
  }

  // Return text content
  const textBlock = data.content?.find((b: any) => b.type === "text");
  return { text: textBlock?.text || "" };
}

/** Streaming call to Anthropic. Returns an OpenAI-compatible SSE Response. */
export async function callAnthropicStreaming(opts: {
  userApiKey: string;
  systemPrompt: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<Response> {
  const { userApiKey, systemPrompt, messages, maxTokens = 4096, temperature = 0.7 } = opts;

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": userApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
      stream: true,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic streaming error:", response.status, errorText);
    if (response.status === 429) throw { status: 429, message: "Anthropic rate limit exceeded." };
    if (response.status === 401) throw { status: 401, message: "Invalid Anthropic API key." };
    throw { status: 500, message: "Anthropic API error" };
  }

  // Transform Anthropic SSE → OpenAI-compatible SSE
  const reader = response.body!.getReader();
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
