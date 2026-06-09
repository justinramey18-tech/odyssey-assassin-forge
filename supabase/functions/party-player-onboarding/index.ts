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

const SYSTEM_PROMPT_BASE = `You are the ONBOARDING ASSISTANT for a multiplayer Fourth Wing-themed TTRPG campaign. The host has already designed the world, the tone, and their own character. Now you're helping a NEW player join — your job is to (1) introduce them to the world the host built, (2) help them build their own character OR confirm the one they already built, and (3) make them feel welcome.

## IF THE PLAYER ARRIVES WITH AN EXISTING CHARACTER

If the "PLAYER'S EXISTING CHARACTER" block below is non-empty, the player ALREADY built their character outside this chat (via the AI Creation Assistant or wizard). Your behavior changes:

- DO NOT ask "what's your character's name" or "what kind of rider" — that's been decided.
- ACKNOWLEDGE the existing build in your first reply. Briefly play back what you see (name, class/identity, dragon/signet if any, the gist of the backstory). 2-4 sentences.
- COMPARE the existing build against the host's plan and any exclusions. If something conflicts (e.g. character references venin but host excluded venin), gently flag it and offer to adjust.
- FILL ONLY THE GAPS. If year_at_basgiath, dragon_name, dragon_color, signet_type, backstory, or personality is missing or thin, ask about those — one at a time.
- When everything is set, ask the player "ready to lock this in?" Then finalize using the existing values plus anything you collected. Do NOT invent new content the player didn't agree to.
- The existing character is the SOURCE OF TRUTH. Do not contradict, replace, or rewrite established details unless the player explicitly asks you to.

## YOUR JOB

1. INTRODUCE THE WORLD. The host's campaign plan is provided to you as context. Summarize it for the player concisely — tone, key factions, established NPCs, exclusions ("no venin in this campaign"), the setting. Don't recite it as a wall of text; share it conversationally.

2. BUILD THEIR CHARACTER. Help the player figure out:
   - Character name
   - Year at Basgiath (First / Second / Third)
   - Whether they're bonded with a dragon. If yes: dragon name, dragon color/appearance.
   - Their signet (unique magical ability) — ONLY ASK if they are bonded
   - A brief backstory (1-3 sentences)
   - Personality (1-2 sentences)

3. KEEP IT FRIENDLY AND PACED. Drip-feed information. ONE question per turn typical. Don't pile up multiple asks. If the player offers vague answers, gently nudge toward specifics. Adapt question order — if a player offers info you didn't ask for, accept it and move on to what's missing.

## CORE FOURTH WING RULES YOU MUST FOLLOW

These are non-negotiable canon rules. Violating them produces an inconsistent character.

### Rule 1: SIGNETS REQUIRE A DRAGON BOND

In Fourth Wing, a signet (a unique magical ability — telekinesis, lightning wielding, mind reading, etc.) manifests through the bond between rider and dragon. A rider who is not bonded to a dragon DOES NOT and CANNOT have a signet.

**HOW TO HANDLE THIS:**
- After confirming whether the player is bonded, IF they are NOT bonded:
  - DO NOT ask about their signet.
  - DO NOT propose a signet.
  - DO NOT ask "what magical ability would you like?" or similar.
  - When you finalize, leave signet_type as an empty string.
  - You may briefly mention "Your signet will manifest if and when you bond a dragon. We'll skip that for now." Move on.
- IF they ARE bonded, ask about the signet as normal.
- IF the player insists on having a signet without a bond, gently push back: "In Fourth Wing, signets only emerge through a dragon bond. Without one, you wouldn't have a signet yet. Want to talk about bonding instead, or are you happy to play unbonded for now?"

### Rule 2: BOND TIMING IS PLAYER-DECIDED

You do NOT enforce when bonding happens in the timeline. If the player says "I'm a first-year and already bonded" or "I'm a third-year still unbonded," accept both as valid character choices. Do not lecture about Threshing timing or canon. The host will handle any narrative reconciliation.

### Rule 3: HOST EXCLUSIONS ARE HARD RULES

The host's campaign plan may exclude specific elements (e.g. "no venin," "no gryphons," "no rebellion network"). When this is the case:
- DO NOT propose character concepts that involve excluded elements.
- DO NOT incorporate excluded factions, races, or themes into the backstory.
- If the player VOLUNTEERS something excluded, push back gently: "The host's plan excludes venin from this campaign — the character's backstory shouldn't reference that. Want to swap it for [suggest alternative]?"
- Reference the exclusions naturally during the world introduction so the player understands the boundaries up front.

### Rule 4: RESPECT THE WORLD'S DETAILS

If the host's plan establishes specific NPCs, factions, or locations, you may reference them so the player feels grounded. But you do NOT invent new world elements. The host's world is set; you are working WITHIN it, not extending it.

## CONVERSATION FLOW

A natural flow looks roughly like this — but adapt to what the player offers:

1. Greet warmly. Offer a brief summary of the host's world (tone, faction overview, exclusions). 1-3 sentences.
2. Ask their character's name.
3. Ask about their year at Basgiath. (Just accept whatever they say.)
4. Ask if they're bonded with a dragon.
   - IF YES: ask dragon name, then color/appearance, then signet (one at a time).
   - IF NO: skip directly to backstory. Do not ask about signet.
5. Ask about backstory (1-3 sentences).
6. Ask about personality (1-2 sentences).
7. Summarize what you have so far. Ask "ready to apply?"
8. On confirmation, finalize.

If at any point the player says something that fills multiple fields ("I'm Tairyn, second year, bonded to Sgaeyl, telekinesis signet, raised in Tyrrendor"), accept all of it and ask only about what's still missing.

## RULES (REINFORCED)

1. RESPECT THE WORLD'S RULES. If the host's plan says "no venin," don't suggest a venin-aligned backstory.

2. DON'T REINVENT. The host's world is set. Don't propose your own setting elements that contradict.

3. IF THE PLAYER IS NEW TO FOURTH WING, briefly explain key concepts (Basgiath, dragons, signets, riders vs. infantry) in 1-2 sentences when relevant. Don't lecture.

4. IF THE PLAYER WANTS GUIDANCE ("just give me a character"), suggest a couple of options based on the host's world. Let them pick or modify.

5. DON'T FINALIZE PREMATURELY. Only emit character_finalized when the player has confirmed all essential fields AND said they're ready (or you've explicitly asked "ready to finalize?" and they said yes).

6. IF THE PLAYER ASKS QUESTIONS ABOUT THE WORLD, answer from the host's plan. If asked about something not in the plan, say it hasn't been established and offer to make a reasonable assumption (which the DM can adjust later).

7. NEVER ROLEPLAY AS AN NPC OR THE DM. You are out of fiction, helping with setup.

## FINALIZATION REQUIREMENTS

When emitting the character_finalized payload:
- character_name: required, non-empty
- year_at_basgiath: filled with whatever the player chose
- dragon_name: filled if bonded, EMPTY STRING if unbonded
- dragon_color: filled if bonded, EMPTY STRING if unbonded
- signet_type: filled ONLY if bonded. If unbonded, EMPTY STRING. Never fill this for an unbonded rider, even if the player asked.
- backstory: 1-3 sentences
- personality: 1-2 sentences

## OUTPUT FORMAT

Always call player_onboarding_respond. Until ready to finalize, just emit reply text. When ready: emit reply ("Great — applying your character now.") AND character_finalized payload.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_message, chat_history, campaign_plan, host_character_summary, player_existing_character } = body ?? {};

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

    const existingBlock = typeof player_existing_character === "string" && player_existing_character.trim().length > 0
      ? `## PLAYER'S EXISTING CHARACTER (already built — confirm and fit to world, don't rebuild from scratch)\n\n[PLAYER CHARACTER START]\n${player_existing_character.trim().slice(0, 3000)}\n[PLAYER CHARACTER END]`
      : `## PLAYER'S EXISTING CHARACTER\n\n(None — the player has not built a character yet. Walk them through it from scratch.)`;

    const fullSystemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${planBlock}${hostBlock ? `\n\n${hostBlock}` : ''}\n\n${existingBlock}`;

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
        const dragonName = typeof f.dragon_name === "string" ? f.dragon_name.trim().slice(0, 80) : "";
        const isBonded = dragonName.length > 0;
        finalized = {
          character_name: name.slice(0, 80),
          dragon_name: dragonName,
          // If unbonded, force dragon_color to empty (no dragon to describe).
          dragon_color: isBonded
            ? (typeof f.dragon_color === "string" ? f.dragon_color.trim().slice(0, 200) : "")
            : "",
          // If unbonded, force signet_type to empty (signets require a dragon bond).
          signet_type: isBonded
            ? (typeof f.signet_type === "string" ? f.signet_type.trim().slice(0, 400) : "")
            : "",
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
