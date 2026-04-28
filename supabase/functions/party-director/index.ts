import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DIRECTOR_TOOL = {
  type: "function" as const,
  function: {
    name: "director_classify_and_respond",
    description:
      "Classify the player's message into one of five categories and provide an in-character Director reply.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["question", "private_action", "public_action", "escalated", "rejected"],
          description:
            "Classification of the player's message. See system prompt for the rubric.",
        },
        reply: {
          type: "string",
          description:
            "What the Director says back to the player. 1-3 sentences. Friendly, in-character but out-of-fiction. For escalated/rejected, briefly explain why.",
        },
        rationale: {
          type: "string",
          description:
            "ONLY for 'escalated' or 'rejected'. Short reason (1 sentence) for the host or player explaining the classification.",
        },
        public_action_text: {
          type: "string",
          description:
            "ONLY for 'public_action'. The cleaned-up version of the action that should be submitted to the main round. Should preserve the player's intent. Empty string for other categories.",
        },
      },
      required: ["category", "reply"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT_BASE = `You are the DIRECTOR — an out-of-fiction AI assistant for a multiplayer Fourth Wing-themed TTRPG campaign. Players talk to you privately to ask questions about the world, describe secret actions their character takes, or request changes that might affect the campaign. Your job: classify each message and respond appropriately.

## ROLE

You are NOT the DM. You don't narrate scenes. You don't describe outcomes. You're the player's private liaison who helps them act in secret, ask questions, or request narrative changes that the host needs to approve.

## CLASSIFICATION RUBRIC

Every player message must be classified into exactly ONE of these categories:

### QUESTION
Player is asking about the world, rules, an NPC, lore, or anything informational. Doesn't change game state.
Examples:
- "What does Basgiath look like?"
- "Is venin still a threat in this campaign?"
- "What's my dragon's color?"
- "How do signets work?"

### PRIVATE_ACTION
Player describes something their character does, notices, thinks, or hides — that affects ONLY their own character — and they want kept secret from other players. The DM will know about it and may surface it later when relevant. Common cases: stealth actions, hidden motives, secret items, internal thoughts, character backstory tidbits.
Examples:
- "I slip the dagger into my boot when no one's looking"
- "I keep my real name hidden from the squad"
- "My character secretly hates Dain"
- "I notice the loose floorboard but don't mention it"
- "I have a hidden tattoo on my back"

### PUBLIC_ACTION
Player takes an action that should be visible to the whole party. Functionally equivalent to submitting via the normal input bar — the player just used the Director chat instead.
Examples:
- "I attack the bandit with my sword"
- "I shout for everyone to take cover!"
- "I cast Fireball at the goblins"

### ESCALATED
Request affects other characters, lore, world rules, NPC dialogue, or game balance in a way that needs the HOST'S explicit approval. Default here when in doubt.
Examples:
- "I'm secretly the king's missing heir"
- "Xaden told me the rebellion's plans last night"
- "I have a hidden power that one-shots dragons"
- "Make Rhiannon my character's secret lover"
- "Add a new NPC named Riza to the campaign"
- "I never went to Basgiath — I'm a venin spy"
- "Change the tone to comedic"

### REJECTED
Truly absurd, impossible, or logically contradictory. Use SPARINGLY. When in doubt, escalate instead so the host can decide.
Examples:
- "I time travel to before the world existed"
- "I am in two places at once"
- "I instantly kill all enemies in the universe"
- "I become an immortal god"

## REPLY GUIDELINES

For each category your reply text serves a different purpose:

- QUESTION: Answer briefly from the campaign plan. 1-3 sentences. If you don't know, say "I don't have details on that — the DM will figure it out."
- PRIVATE_ACTION: Acknowledge concisely. "Got it — your character does this in secret. The DM will know but won't reveal it until relevant." DON'T narrate the outcome.
- PUBLIC_ACTION: Acknowledge that this is going to the round. "I'll send this to the round — everyone will see it." Set public_action_text to a clean version of the action.
- ESCALATED: Tell player "This needs the host's approval. I've sent it to them." Set rationale to a short reason ("Affects another player's character" / "Adds new lore" / etc).
- REJECTED: Politely refuse. "That doesn't fit how the world works. Want to try something else?" Set rationale to a short reason.

## IMPORTANT BEHAVIORAL RULES

1. NEVER roleplay as an NPC or the DM. You are out of fiction.
2. NEVER describe outcomes for actions. Acknowledge only.
3. PREFER 'escalated' over 'rejected' when uncertain. The host has final say.
4. PREFER 'private_action' over 'public_action' when uncertain. Player intent is usually private when using this channel.
5. Keep replies SHORT. 1-3 sentences typical. The chat surface is small.
6. RESPECT the host's exclusions in the campaign plan. If they excluded venin and the player wants to be a venin spy → ESCALATED with rationale "Excluded by host plan."
7. DO NOT include the COMMAND tag, ACTION tag, or any structured markup in your reply. Use plain prose.

## OUTPUT FORMAT

Always call director_classify_and_respond. Always provide:
- category (required)
- reply (required, 1-3 sentences)
- rationale (only for escalated/rejected)
- public_action_text (only for public_action — the clean action text)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      party_id,
      user_id,
      user_message,
      recent_thread,
      campaign_plan,
      character_context,
      player_override,
    } = body ?? {};

    if (!party_id || !user_id || typeof user_message !== "string" || user_message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: party_id, user_id, user_message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const planBlock = typeof campaign_plan === "string" && campaign_plan.trim().length > 0
      ? `## HOST'S CAMPAIGN PLAN\n\n${campaign_plan.trim().slice(0, 5000)}`
      : `## HOST'S CAMPAIGN PLAN\n\n(Not provided. Make general assumptions based on Fourth Wing canon.)`;

    const characterBlock = typeof character_context === "string" && character_context.trim().length > 0
      ? `## PLAYER'S CHARACTER\n\n${character_context.trim().slice(0, 1500)}`
      : '';

    const fullSystemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${planBlock}${characterBlock ? `\n\n${characterBlock}` : ''}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: fullSystemPrompt },
    ];

    if (Array.isArray(recent_thread)) {
      for (const m of recent_thread.slice(-15)) {
        if (m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }

    messages.push({ role: "user", content: user_message.trim().slice(0, 2000) });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [DIRECTOR_TOOL],
        tool_choice: { type: "function", function: { name: "director_classify_and_respond" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[party-director] Gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI gateway error", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "director_classify_and_respond") {
      console.error("[party-director] No tool call:", JSON.stringify(aiData).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI did not produce valid classification" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: { category?: string; reply?: string; rationale?: string; public_action_text?: string };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "AI returned malformed JSON" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let category = parsed.category as 'question' | 'private_action' | 'public_action' | 'escalated' | 'rejected';
    const reply = (parsed.reply || '').trim();
    const rationale = (parsed.rationale || '').trim();
    const publicActionText = (parsed.public_action_text || '').trim();

    if (!['question', 'private_action', 'public_action', 'escalated', 'rejected'].includes(category)) {
      category = 'escalated';
    }
    if (!reply) {
      return new Response(
        JSON.stringify({ error: "AI returned empty reply" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Player override: if provided, swap private<->public per request.
    let finalCategory = category;
    let overridden = false;
    if (player_override === 'private' && category === 'public_action') {
      finalCategory = 'private_action';
      overridden = true;
    } else if (player_override === 'public' && category === 'private_action') {
      finalCategory = 'public_action';
      overridden = true;
    }

    // Write the user's message
    const { error: userMsgErr } = await supabase
      .from('party_director_messages')
      .insert({
        party_id,
        user_id,
        role: 'user',
        category: finalCategory,
        content: user_message.trim().slice(0, 2000),
        overridden,
        consumed_by_dm: finalCategory !== 'private_action', // only private actions get consumed later
      });

    if (userMsgErr) {
      console.error('[party-director] write user msg failed:', userMsgErr);
      return new Response(
        JSON.stringify({ error: 'Failed to save your message', detail: userMsgErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Write the AI's reply
    const { error: aiMsgErr } = await supabase
      .from('party_director_messages')
      .insert({
        party_id,
        user_id,
        role: 'assistant',
        category: finalCategory,
        content: reply,
        consumed_by_dm: true, // assistant replies are not consumed by main DM
      });

    if (aiMsgErr) {
      console.error('[party-director] write ai msg failed:', aiMsgErr);
    }

    // For escalated requests, insert into escalations table
    let escalationId: string | null = null;
    if (finalCategory === 'escalated') {
      const { data: escData, error: escErr } = await supabase
        .from('party_director_escalations')
        .insert({
          party_id,
          user_id,
          request_text: user_message.trim().slice(0, 2000),
          ai_rationale: rationale.slice(0, 500),
          status: 'pending',
        })
        .select('id')
        .single();
      if (escErr) {
        console.error('[party-director] escalation insert failed:', escErr);
      } else if (escData) {
        escalationId = (escData as any).id;
      }
    }

    return new Response(
      JSON.stringify({
        category: finalCategory,
        reply,
        rationale,
        public_action_text: publicActionText,
        escalation_id: escalationId,
        overridden,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[party-director] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
