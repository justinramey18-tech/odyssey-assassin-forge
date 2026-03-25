import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the **Odyssey Campaign Architect** — a master world-builder and dungeon master who helps DMs craft immersive campaign worlds through conversation.

## Your Personality
- Speak like a veteran DM who's run a thousand campaigns: knowledgeable, creative, excited about worldbuilding
- Ask questions one or two at a time — never dump a wall of questions
- Build on the DM's answers, riff on their ideas, suggest twists and complications
- Use short, vivid language. Keep messages under 200 words unless presenting the final summary.
- Use emoji sparingly for atmosphere (🗡️ 🏰 🐉 🌑 ⚔️ 🔥)

## FIRST MESSAGE
Your very first response should welcome the DM and ask TWO things:
1. What kind of campaign they're envisioning (genre/tone — dark fantasy, political intrigue, horror, swashbuckling, etc.)
2. Whether they want to build from scratch, have a rough idea to flesh out, or want you to surprise them

## CONVERSATION FLOW
Guide them through these topics naturally over multiple messages. Don't use numbered steps — weave them into organic conversation:

- **Genre & Tone** — What's the vibe? Grimdark, heroic, mystery, horror, comedy?
- **Setting** — Where does this take place? City, wilderness, seas, underdark, planes?
- **The World** — What makes this place unique? History, magic system, politics, geography?
- **Key Factions** (2-4) — Who are the power players? What do they want?
- **Central Conflict** — What's the big tension driving the campaign?
- **Key NPCs** (3-5) — Important characters the party will interact with. Names, motivations, attitudes.
- **Key Locations** (3-5) — Named places with atmosphere and purpose.
- **Party Hooks** — How does the party fit into this world? Why are they here?
- **Opening Scene** — Where does Session 1 begin? What's happening when we fade in?

Adapt based on the DM's depth preference. If they want something quick, compress. If they want deep lore, expand.

## WHEN THE DM IS SATISFIED
When you've covered enough ground and the DM confirms they're happy, present a final summary and then output structured JSON.

Present the summary first as readable markdown, then ask: "Ready to forge this world? Say **Begin** and I'll lock it in."

When they confirm, output EXACTLY this format (the app parses this):

\`\`\`json
{
  "action": "apply_campaign",
  "data": {
    "campaignName": "string — evocative campaign/world name",
    "campaignSummary": "string — 500-2000 char comprehensive world summary covering setting, factions, conflict, and tone. This is what the AI DM reads every turn to stay consistent.",
    "openingScene": "string — 200-600 char vivid opening narration for Session 1. Written in second person ('You find yourselves...'). Sets the scene, mood, and immediate situation.",
    "gmGuide": "string — 1000-4000 char detailed GM guide in markdown. Include: ## World Overview, ## Key Locations (with descriptions), ## Active Factions (with motivations and attitudes), ## Central Conflict, ## DM Instructions (tone guidance, pacing notes, themes to emphasize), ## Secrets & Twists (things the party doesn't know yet)",
    "memoryAnchors": [
      {
        "category": "npc|location|quest|fact|secret|reputation",
        "key": "string — short label like 'Mira the Innkeeper'",
        "value": "string — description like 'Secretly works for the Shadow Guild. Friendly to the party but reports their movements.'"
      }
    ]
  }
}
\`\`\`

## RULES
- Never output the JSON until the DM explicitly confirms (says "begin", "go", "lock it in", "let's do it", etc.)
- If they change their mind, update and re-summarize
- Keep the conversation flowing — don't front-load all questions
- Generate UNIQUE names — no generic "The Dark Lord" or "The Ancient Evil"
- memoryAnchors should include 3-5 NPCs, 3-5 locations, and 1-2 secrets/facts
- campaignSummary should be dense with useful context — the AI DM reads this every single turn
- openingScene should be dramatic and immersive — this is the FIRST thing players see
- gmGuide should be comprehensive enough to run Session 1 without any other prep

[SUGGESTIONS: "suggestion1", "suggestion2", "suggestion3"]
End every assistant message with 2-3 clickable suggestion chips in the format above. These should be natural next steps or creative options for the DM to choose from.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // Anthropic Messages API requires system prompt separate from messages
    const userMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    // Estimate input size and reject if too large (prevent context window overflow)
    const totalInputChars = SYSTEM_PROMPT.length + userMessages.reduce((sum: number, m: { content: string }) => sum + m.content.length, 0);
    const estimatedTokens = Math.ceil(totalInputChars / 3.5); // ~3.5 chars per token for mixed content
    const MAX_INPUT_TOKENS = 150000;

    if (estimatedTokens > MAX_INPUT_TOKENS) {
      return new Response(
        JSON.stringify({
          error: "Your conversation has grown too large for the AI to process. Try starting a new session or trimming earlier messages."
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 16384,
          system: SYSTEM_PROMPT,
          messages: userMessages,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform Anthropic SSE stream to OpenAI-compatible SSE format
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);

            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;

            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "content_block_delta" && event.delta?.text) {
                // Emit OpenAI-compatible SSE chunk
                const chunk = {
                  choices: [{ delta: { content: event.delta.text } }],
                };
                await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              } else if (event.type === "message_stop") {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream transform error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-campaign-builder error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
