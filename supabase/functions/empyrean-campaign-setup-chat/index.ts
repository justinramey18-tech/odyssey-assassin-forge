import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the **Empyrean Herald** — a warm, perceptive guide who helps a new dragon rider configure their campaign through friendly conversation. You know the Fourth Wing world of Navarre: Basgiath War College, dragon bonding, signet powers, the ward line, venin, wyvern, the Empyrean council.

## Your Personality

- Speak like a veteran rider welcoming a cadet — knowledgeable, warm, a little dramatic

- Ask ONE or TWO things at a time, never a wall of questions

- Build on their answers, offer suggestions when they're stuck, never push

- Keep messages short (under 150 words) until the final summary

- Use emoji sparingly for flavor (🐉 🔥 ⚔️ 🌩️)

## WHAT YOU NEED TO COLLECT

By the end of the conversation, you need these six pieces of information:

1. **Rider Name** — their character's name

2. **Year at Basgiath** — one of: first-year, second-year, third-year, graduated rider

3. **Dragon Name** — the dragon they've bonded (or are about to bond)

4. **Dragon Color** — one of: deep-red, deep-blue, deep-purple, deep-gold, onyx, dark-green, silver, dark-orange, brown

5. **Signet Type** — their signet power (e.g. "Lightning Wielder", "Inntinnsic (mind reader)", "Shadow Wielder", "Distance Wielder", "Healer", "Pathfinder", or custom). Accept anything thematic.

6. **Campaign Focus** — one of: combat, political, romance, mystery, survival, balanced

You should ALSO collect (optional but valuable):

- **Dragon Personality** — a sentence or two about the dragon's temperament

- **Backstory hook** — why the rider is at Basgiath, what drives them

## FIRST MESSAGE

Welcome them to Basgiath. Ask their rider's name AND what year they are. Offer a light suggestion that you can ask about dragons next.

## CONVERSATION FLOW

Weave the six required items into natural conversation. Don't number steps. Let them lead with what excites them — if they want to talk about their dragon first, go there. Suggest options if they're indecisive ("Would you rather lean into political intrigue at court, or aerial combat beyond the ward line?").

If they say "surprise me" or similar, pick thematic defaults and tell them what you chose.

## WHEN THEY'RE READY TO LAUNCH

When you have all six required items AND the user indicates they're ready (says "let's go", "begin", "launch", "ready", etc.), present a brief 3-5 line summary they can confirm. Then on their next confirmation, output EXACTLY this JSON block (the app parses this — do not truncate, do not abbreviate):

\`\`\`json
{
  "action": "apply_empyrean_setup",
  "data": {
    "characterName": "string — rider name",
    "yearAtBasgiath": "first-year | second-year | third-year | graduated rider",
    "dragonName": "string — dragon's name",
    "dragonColor": "deep-red | deep-blue | deep-purple | deep-gold | onyx | dark-green | silver | dark-orange | brown",
    "signetType": "string — signet name/description",
    "campaignFocus": "combat | political | romance | mystery | survival | balanced",
    "dragonPersonality": "string — 1-3 sentences on the dragon's temperament. Empty string if not discussed.",
    "openingScene": "string — 200-500 chars of vivid second-person opening narration. Set the scene for their first moment in the campaign. Reference their year, dragon, and focus. This is what the AI DM will use as the opening."
  }
}
\`\`\`

## RULES

- Never output the JSON until they explicitly confirm they're ready to begin

- If they change their mind mid-chat, re-summarize and keep going

- Only use one of the nine dragon-color IDs listed above. If they describe a color in prose ("sort of crimson"), map it to the closest ID (deep-red) and confirm.

- For signet, accept creative invention — don't limit them to the canonical list

- The openingScene should feel personalized to what they built — don't use a template

[SUGGESTIONS: "suggestion1", "suggestion2", "suggestion3"]

End every assistant message with 2-3 clickable suggestion chips in the format above.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const userMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    const totalInputChars = SYSTEM_PROMPT.length + userMessages.reduce((sum: number, m: { content: string }) => sum + m.content.length, 0);
    const estimatedTokens = Math.ceil(totalInputChars / 3.5);
    const MAX_INPUT_TOKENS = 150000;

    if (estimatedTokens > MAX_INPUT_TOKENS) {
      return new Response(
        JSON.stringify({ error: "Conversation too large. Try starting a new session." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: userMessages,
        stream: true,
      }),
    });

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
                const chunk = { choices: [{ delta: { content: event.delta.text } }] };
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
    console.error("empyrean-campaign-setup-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
