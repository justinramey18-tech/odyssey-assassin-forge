import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function buildSystemPrompt(characterName: string): string {
  return `You are a friendly, enthusiastic TTRPG character coach helping a player create an AFK personality guide for their character "${characterName}". This guide tells the AI how to roleplay the character when the player is away.

Your job is to conduct a SHORT guided interview (4-5 questions max), asking ONE question at a time. Be conversational, warm, and brief — no walls of text.

**Interview flow — ask these one at a time:**
1. Combat approach: "What's ${characterName}'s go-to approach in combat? Are they aggressive frontliners, cautious support, ranged attackers, sneaky opportunists?" Include a few fun examples.
2. Personality & demeanor: "How does ${characterName} act around the party? Are they the serious leader, comic relief, quiet observer, reckless daredevil?"
3. Speech patterns: "Does ${characterName} have any speech quirks? Formal speech, one-liners, third-person, sarcasm, silence?"
4. Risk tolerance: "When should ${characterName} retreat or play it safe? At what HP threshold? Do they ever flee, or fight to the death?"
5. Hard rules: "Any absolute rules? Things ${characterName} would NEVER do, or ALWAYS do no matter what?"

**After gathering enough answers (usually after question 4 or 5):**
- Synthesize everything into a concise, actionable AFK personality guide (150-300 words)
- Wrap it in [GUIDE_START] and [GUIDE_END] markers exactly like this:

[GUIDE_START]
(the generated guide text here)
[GUIDE_END]

- After outputting the guide, say something like "Here's your guide! You can insert it with the button below, or tell me what to change."

**Rules:**
- Ask ONE question per message. Don't combine questions.
- Keep responses under 100 words (except the final guide synthesis).
- Use the character's name naturally.
- If the player gives short answers, that's fine — work with what you get.
- If they want to refine the guide, regenerate it with updated [GUIDE_START]...[GUIDE_END] markers.
- Be encouraging and make it feel like a fun character-building exercise, not a boring form.`;
}

async function streamAnthropicDirect(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
): Promise<Response> {
  const anthropicMessages = messages.map((m) => ({
    role: m.role === "system" ? "user" : m.role,
    content: m.content,
  }));

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic error:", response.status, errorText);
    throw { status: response.status, message: errorText };
  }

  // Transform Anthropic SSE → OpenAI-compatible SSE
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ choices: [{ delta: { content: event.delta.text } }] })}\n\n`,
                ),
              );
            } else if (event.type === "message_stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
          } catch {
            /* ignore */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

async function streamLovableGateway(
  systemPrompt: string,
  messages: { role: string; content: string }[],
): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch(LOVABLE_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error(`Gateway error: ${status}`);
  }

  return new Response(response.body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, characterName, user_api_key } = await req.json();

    if (!messages || !characterName) {
      return new Response(JSON.stringify({ error: "Missing messages or characterName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(characterName);

    // Use user's Anthropic key if provided, otherwise fall back to Lovable AI
    if (user_api_key) {
      try {
        return await streamAnthropicDirect(user_api_key, systemPrompt, messages);
      } catch (err: any) {
        if (err.status === 401) {
          return new Response(JSON.stringify({ error: "Invalid Anthropic API key." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (err.status === 429) {
          return new Response(JSON.stringify({ error: "Anthropic rate limit exceeded." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("Anthropic failed, falling back to gateway:", err);
      }
    }

    return await streamLovableGateway(systemPrompt, messages);
  } catch (e) {
    console.error("afk-guide-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
