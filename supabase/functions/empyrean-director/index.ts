import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DIRECTOR_TOOL = {
  type: "function" as const,
  function: {
    name: "director_respond",
    description:
      "Respond to the user's message as the Director. Emit reply text plus optional proposed actions. Propose actions ONLY when the user's intent clearly maps to one. Additive actions (install_guide, add_memory_anchor) may be proposed immediately. Destructive actions (delete_guide, update_campaign_summary, update_dragon_personality) must first be described and confirmed before the action is proposed — the client will surface the action as a yes/no to the user regardless, but phrase the reply so the user understands what they're confirming. If the user is just chatting with zero intent to change state, return reply text only with proposed_actions: [].",
    parameters: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description:
            "Your natural-language reply to the user. Keep it under 4 sentences unless the user asked for detail.",
        },
        proposed_actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "install_guide",
                  "disable_guide",
                  "delete_guide",
                  "update_campaign_summary",
                  "add_memory_anchor",
                  "update_dragon_personality",
                  "ooc_passthrough",
                ],
              },
              guide_name: { type: "string", description: "For install_guide. 2-5 words." },
              guide_content: { type: "string", description: "For install_guide. 50-500 words DM-facing." },
              guide_id: { type: "string", description: "For disable_guide / delete_guide. Must match existing id from state." },
              new_summary: { type: "string", description: "For update_campaign_summary. 100-800 words third-person past tense." },
              memory_anchor: { type: "string", description: "For add_memory_anchor. 10-40 words." },
              new_dragon_personality: { type: "string", description: "For update_dragon_personality. 30-300 words." },
              ooc_note: {
                type: "string",
                description: "For ooc_passthrough. The transient narrative fact to silently inject into the main DM's context on its upcoming turn(s). Written in third person past or present tense, as a fact the DM should know. 1-3 sentences. Examples: 'The character just farted in fear.' / 'The armor strap on the right shoulder is broken and hanging loose.' / 'There is a shallow cut across the character's left cheek, still bleeding.'",
              },
              turns_remaining: {
                type: "number",
                description: "For ooc_passthrough. How many main DM response turns this context should stay active before fading. Any positive integer. Choose based on the nature of the note: a brief reaction (fart, stumble) is 1-2 turns; an ongoing physical state (broken armor, fresh wound, charm still worn) can be 4-10. If the user's intent about duration is unclear, ASK in the reply before proposing — don't guess for substantial or ambiguous cases.",
              },
              rationale: { type: "string", description: "Brief 1-sentence justification shown in the confirmation UI." },
            },
            required: ["type", "rationale"],
            additionalProperties: false,
          },
        },
      },
      required: ["reply", "proposed_actions"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `You are the DIRECTOR — an AI that helps a player shape their Fourth Wing solo campaign without breaking roleplay. The player is using the Odyssey app, which runs their campaign through a separate main DM. The Director does NOT narrate the story — the main DM does. Your job is to be the player's production assistant: you reshape the tone, install reusable guides, pin memory details, update the campaign summary, adjust the dragon's personality, and pass out-of-character directives along to the main DM.

## YOUR TONE

Calm, collaborative, terse. You are the showrunner and the player is the executive producer. You don't argue, you don't pontificate, you don't add flavor the player didn't ask for. Your replies are 1-4 sentences unless the user asks for more. You never roleplay as an NPC or the dragon.

## HOW YOU WORK

The user will talk to you naturally. Examples:
- "Make the tone darker."
- "Remember that the innkeeper is secretly a venin informant."
- "I want my dragon to be more sarcastic."
- "Skip the travel sequence and start at the Basgiath gate next turn."
- "What guides do I have installed?"
- "Get rid of the 'Low Magic' guide."

You figure out which of the 7 action types (if any) they're asking for, and you emit a structured proposal via the director_respond tool.

## ACTION TYPES AVAILABLE

1. install_guide — Create a new GM guide. Use for: tone shifts, new rules, recurring NPC details, world setting modifiers. Fields: guide_name (2-5 words), guide_content (50-500 words of DM-facing instructions). Additive.
2. disable_guide — Turn off an active guide without deleting it. Field: guide_id (MUST match an existing guide id from the state context).
3. delete_guide — Permanently remove a guide. Use only when the user explicitly says "delete" or "remove". Field: guide_id (MUST match an existing guide id). Destructive.
4. update_campaign_summary — Rewrite the persistent campaign recap. Field: new_summary (100-800 words, third-person past tense). Destructive.
5. add_memory_anchor — Pin a single fact that should persist across sessions. Field: memory_anchor (10-40 words). Additive.
6. update_dragon_personality — Rewrite the dragon's personality notes. Field: new_dragon_personality (30-300 words). Destructive if replacing existing notes.
7. ooc_passthrough — Silently inject a transient fact into the main DM's system prompt for the next N turns, so the DM can work it into narration naturally without the user sending an OOC message. Fields: ooc_note (1-3 sentences, third person), turns_remaining (positive integer). Duration guidance:
   - Brief reactions, twitches, impulsive moments: 1-2 turns.
   - Physical states that would persist (wound, broken gear, borrowed item): 4-10 turns.
   - When unclear, ASK in your reply: "Should this linger a few turns or just this moment?" — then wait for the user to clarify before proposing.
   Example conversation:
     User: "My character farts in fear."
     Director: (reply) "Got it. Single-turn thing?"
     User: "Yeah just this one."
     Director: (proposes action) ooc_passthrough with ooc_note="The character just farted in fear." and turns_remaining=1
   Do NOT auto-fill the user's input. The note injects silently into the main DM's context.

## RULES

1. ONE PROPOSAL PER INTENT. If the user asks for one thing, propose one action. Only propose multiple actions if they clearly asked for multiple distinct changes.
2. ADDITIVE vs DESTRUCTIVE. For install_guide, add_memory_anchor, ooc_passthrough — propose directly with a short confirmation request. For delete_guide, update_campaign_summary, update_dragon_personality — describe what will be replaced/removed in the reply text BEFORE the confirmation.
3. IF THEY'RE JUST CHATTING, return reply text only with proposed_actions: []. Not every message is a command.
4. IF YOU DON'T HAVE ENOUGH INFO, ask for it in the reply. Don't propose with placeholders.
5. NEVER fabricate guide_ids. For disable_guide or delete_guide, the guide_id MUST match an id from the state context. If the user asks to delete a guide that doesn't exist, say so in the reply and propose no action.
6. NEVER roleplay as the dragon, an NPC, or the player's character. You are the Director, out of scene.
7. NEVER advance the story. If the user asks "what happens next", redirect them to the main DM.
8. KEEP GUIDE CONTENT DM-FACING. Guides are instructions sent to the main DM's system prompt. Write them accordingly.

## OUTPUT FORMAT

Always call the director_respond tool. Never reply in plain text.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { user_message, chat_history, state } = body ?? {};

    if (typeof user_message !== "string" || user_message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing or empty 'user_message'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stateSections: string[] = [];

    const guides = Array.isArray(state?.guides) ? state.guides : [];
    if (guides.length > 0) {
      const guideLines = guides.map((g: any) => {
        const name = typeof g?.name === "string" ? g.name : "(unnamed)";
        const id = typeof g?.id === "string" ? g.id : "(no id)";
        const enabled = g?.enabled === true ? "enabled" : "disabled";
        return `  - [${id}] "${name}" (${enabled})`;
      }).join("\n");
      stateSections.push(`## INSTALLED GUIDES\n${guideLines}`);
    } else {
      stateSections.push(`## INSTALLED GUIDES\n  (none)`);
    }

    if (typeof state?.dragon_personality === "string" && state.dragon_personality.trim().length > 0) {
      stateSections.push(`## DRAGON PERSONALITY NOTES\n${state.dragon_personality.trim().slice(0, 1200)}`);
    } else {
      stateSections.push(`## DRAGON PERSONALITY NOTES\n  (none set)`);
    }

    if (typeof state?.campaign_summary === "string" && state.campaign_summary.trim().length > 0) {
      stateSections.push(`## CAMPAIGN SUMMARY (current)\n${state.campaign_summary.trim().slice(0, 2000)}`);
    } else {
      stateSections.push(`## CAMPAIGN SUMMARY (current)\n  (empty)`);
    }

    const memories = Array.isArray(state?.memory_anchors) ? state.memory_anchors : [];
    if (memories.length > 0) {
      const memLines = memories.slice(0, 30).map((m: any, i: number) => `  ${i + 1}. ${String(m).slice(0, 300)}`).join("\n");
      stateSections.push(`## MEMORY ANCHORS\n${memLines}`);
    } else {
      stateSections.push(`## MEMORY ANCHORS\n  (none)`);
    }

    const dragonName = typeof state?.dragon_name === "string" ? state.dragon_name : "";
    const characterName = typeof state?.character_name === "string" ? state.character_name : "";
    if (dragonName || characterName) {
      stateSections.push(`## CAMPAIGN IDENTIFIERS\n  Rider: ${characterName || "(unknown)"}\n  Dragon: ${dragonName || "(unknown)"}`);
    }

    const contextBlock = stateSections.join("\n\n");
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n## CURRENT CAMPAIGN STATE\n\n${contextBlock}`;

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
        tools: [DIRECTOR_TOOL],
        tool_choice: { type: "function", function: { name: "director_respond" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[director] Gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error", detail: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "director_respond") {
      console.error("[director] No tool call in response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI did not produce a valid director response" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { reply?: string; proposed_actions?: any[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned malformed JSON" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    const rawActions = Array.isArray(parsed.proposed_actions) ? parsed.proposed_actions : [];

    const ALLOWED_TYPES = new Set([
      "install_guide", "disable_guide", "delete_guide", "update_campaign_summary",
      "add_memory_anchor", "update_dragon_personality", "ooc_passthrough",
    ]);

    const cleanActions: any[] = [];
    for (const action of rawActions) {
      if (!action || typeof action !== "object") continue;
      if (!ALLOWED_TYPES.has(action.type)) continue;
      const t = action.type as string;
      const rationale = typeof action.rationale === "string" ? action.rationale.trim().slice(0, 300) : "";

      if (t === "install_guide") {
        const name = typeof action.guide_name === "string" ? action.guide_name.trim().slice(0, 80) : "";
        const content = typeof action.guide_content === "string" ? action.guide_content.trim().slice(0, 5000) : "";
        if (!name || !content) continue;
        cleanActions.push({ type: t, guide_name: name, guide_content: content, rationale });
      } else if (t === "disable_guide" || t === "delete_guide") {
        const id = typeof action.guide_id === "string" ? action.guide_id.trim() : "";
        if (!id) continue;
        cleanActions.push({ type: t, guide_id: id, rationale });
      } else if (t === "update_campaign_summary") {
        const ns = typeof action.new_summary === "string" ? action.new_summary.trim().slice(0, 8000) : "";
        if (!ns) continue;
        cleanActions.push({ type: t, new_summary: ns, rationale });
      } else if (t === "add_memory_anchor") {
        const m = typeof action.memory_anchor === "string" ? action.memory_anchor.trim().slice(0, 500) : "";
        if (!m) continue;
        cleanActions.push({ type: t, memory_anchor: m, rationale });
      } else if (t === "update_dragon_personality") {
        const dp = typeof action.new_dragon_personality === "string" ? action.new_dragon_personality.trim().slice(0, 3000) : "";
        if (!dp) continue;
        cleanActions.push({ type: t, new_dragon_personality: dp, rationale });
      } else if (t === "ooc_passthrough") {
        const note = typeof action.ooc_note === "string" ? action.ooc_note.trim().slice(0, 800) : "";
        if (!note) continue;
        // Turn count: clamp to sensible floor; no upper cap — trust the Director.
        const rawTurns = typeof action.turns_remaining === "number" && Number.isFinite(action.turns_remaining)
          ? Math.floor(action.turns_remaining)
          : 2; // default if Director omits
        const turns = Math.max(1, rawTurns);
        cleanActions.push({ type: t, ooc_note: note, turns_remaining: turns, rationale });
      }
    }

    if (!reply && cleanActions.length === 0) {
      return new Response(JSON.stringify({ error: "Director produced empty response. Try rephrasing." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ reply: reply || "(Proposed below.)", proposed_actions: cleanActions }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[director] Unhandled error:", e);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
