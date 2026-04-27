import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ONBOARDING_TOOL = {
  type: "function" as const,
  function: {
    name: "player_onboarding_respond",
    description:
      "Respond to the player's message during character onboarding. Either continue the conversation (reply only) OR finalize the character (reply + character_finalized payload). Finalize ONLY when the player has confirmed all the essentials and explicitly said they're ready (or you've gathered enough and asked them to confirm).",
    parameters: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description:
            "Your conversational reply to the player. 1-4 sentences typical. Friendly, focused, asks at most one question per turn. Don't dump information — drip-feed.",
        },
        character_finalized: {
          type: "object",
          description:
            "Set this ONLY when the character is complete and confirmed. Once set, the client treats the conversation as ready to apply. Until then, omit this entirely.",
          properties: {
            character_name: { type: "string", description: "The character's name." },
            dragon_name: { type: "string", description: "The bonded dragon's name. Empty string if unbonded." },
            dragon_color: { type: "string", description: "Dragon color/description. Empty string if unbonded." },
            signet_type: { type: "string", description: "Description of the player's signet (their unique magical power). Empty string if unknown yet." },
            year_at_basgiath: { type: "string", description: "First Year, Second Year, Third Year, or similar." },
            backstory: { type: "string", description: "Brief 1-3 sentence backstory the player crafted." },
            personality: { type: "string", description: "1-2 sentence personality summary." },
          },
          required: ["character_name"],
          additionalProperties: false,
        },
      },
      required: ["reply"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT_BASE = `You are the ONBOARDING ASSISTANT for a multiplayer Fourth Wing-themed TTRPG campaign. The host has already designed the world, the tone, and their own character. Now you're helping a NEW player join — your job is to (1) introduce them to the world the host built, (2) help them build their own character, and (3) make them feel welcome.

## YOUR JOB

1. INTRODUCE THE WORLD. The host's campaign plan is provided to you as context. Summarize it for the player concisely — tone, key factions, established NPCs, exclusions ("no venin in this campaign"), the setting. Don't recite it as a wall of text; share it conversationally.

2. BUILD THEIR CHARACTER. Help the player figure out:
   - Character name
   - Whether they're bonded with a dragon (typical for Fourth Wing setting). If yes: dragon name, dragon color/appearance.
   - Their signet (unique magical ability). Examples: telekinesis, lightning wielding, sense emotions, etc.
   - Year at Basgiath (First / Second / Third)
   - A brief backstory (1-3 sentences)
   - Personality (1-2 sentences)

3. KEEP IT FRIENDLY AND PACED. Drip-feed information. ONE question per turn typical. Don't pile up multiple asks. If the player offers vague answers, gently nudge toward specifics.

## RULES

1. RESPECT THE WORLD'S RULES. If the host's plan says "no venin", don't suggest a venin-aligned backstory. Honor exclusions.

2. DON'T REINVENT. The host's world is set. Don't propose your own setting elements that contradict.

3. IF THE PLAYER IS NEW TO FOURTH WING, briefly explain key concepts (Basgiath, dragons, signets) in 1-2 sentences. Don't lecture.

4. IF THE PLAYER WANTS GUIDANCE ("just give me a character"), suggest a couple of options based on the host's world. Let them pick or modify.

5. DON'T FINALIZE PREMATURELY. Only emit character_finalized when the player has confirmed all essential fields AND said they're ready (or you've explicitly asked "ready to finalize?" and they said yes).

6. IF THE PLAYER ASKS QUESTIONS ABOUT THE WORLD, answer from the host's plan. If asked about something not in the plan, say it hasn't been established and offer to make a reasonable assumption (which the DM can adjust later).

7. NEVER ROLEPLAY AS AN NPC OR THE DM. You are out of fiction, helping with setup.

## OUTPUT FORMAT

Always call player_onboarding_respond. Until ready to finalize, just emit reply text. When ready: emit reply ("Great — applying your character now.") AND character_finalized payload.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_message, chat_history, campaign_plan, host_character_summary } = body ?? {};

    if (typeof user_message !== "string" || user_message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or empty 'user_message'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const planBlock = typeof campaign_plan === "string" && campaign_plan.trim().length > 0
      ? `## HOST'S CAMPAIGN PLAN\n\n${campaign_plan.trim().slice(0, 5000)}`
      : `## HOST'S CAMPAIGN PLAN\n\n(The host hasn't finalized their plan yet. Encourage the player to share what kind of character they want, and help them stay flexible.)`;

    const hostBlock = typeof host_character_summary === "string" && host_character_summary.trim().length > 0
      ? `## HOST'S CHARACTER (already taken — don't propose this concept)\n\n${host_character_summary.trim().slice(0, 1500)}`
      : '';

    const fullSystemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${planBlock}${hostBlock ? `\n\n${hostBlock}` : ''}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: fullSystemPrompt },
    ];

    if (Array.isArray(chat_history)) {
      for (const m of chat_history.slice(-20)) {
        if (m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }

    messages.push({ role: "user", content: user_message.trim().slice(0, 2000) });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [ONBOARDING_TOOL],
        tool_choice: { type: "function", function: { name: "player_onboarding_respond" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[onboarding] Gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI gateway error", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "player_onboarding_respond") {
      console.error("[onboarding] No tool call:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI did not produce a valid onboarding response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: { reply?: string; character_finalized?: any };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "AI returned malformed JSON" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    let finalized: any = null;
    if (parsed.character_finalized && typeof parsed.character_finalized === "object") {
      const f = parsed.character_finalized;
      const name = typeof f.character_name === "string" ? f.character_name.trim() : "";
      if (name) {
        finalized = {
          character_name: name.slice(0, 80),
          dragon_name: typeof f.dragon_name === "string" ? f.dragon_name.trim().slice(0, 80) : "",
          dragon_color: typeof f.dragon_color === "string" ? f.dragon_color.trim().slice(0, 200) : "",
          signet_type: typeof f.signet_type === "string" ? f.signet_type.trim().slice(0, 400) : "",
          year_at_basgiath: typeof f.year_at_basgiath === "string" ? f.year_at_basgiath.trim().slice(0, 50) : "",
          backstory: typeof f.backstory === "string" ? f.backstory.trim().slice(0, 1500) : "",
          personality: typeof f.personality === "string" ? f.personality.trim().slice(0, 800) : "",
        };
      }
    }

    if (!reply) {
      return new Response(
        JSON.stringify({ error: "Onboarding produced empty reply. Try rephrasing." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ reply, character_finalized: finalized }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[onboarding] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
