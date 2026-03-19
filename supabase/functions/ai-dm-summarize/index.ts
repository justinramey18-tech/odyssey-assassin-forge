import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUMMARY_MAX_CHARS = 30000;

interface SummarizeRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  previousSummary?: string;
  worldContext?: string;
}

const SUMMARIZER_SYSTEM_PROMPT = `You are a campaign chronicler for a D&D 5e session. Your job is to produce an EXHAUSTIVE, THOROUGH, and ITEMIZED narrative summary that captures EVERYTHING a Dungeon Master needs to maintain perfect story continuity.

CRITICAL INSTRUCTION: Be THOROUGH. Do NOT summarize loosely or skip over details. Every event, every NPC interaction, every player decision, every location visited, every conversation topic MUST be captured as a discrete itemized entry. If something happened in the conversation, it MUST appear in your summary. Missing details means lost continuity.

This summary is for NARRATIVE CONTINUITY ONLY. Do NOT include any TTRPG mechanical information such as:
- Dice rolls, attack rolls, saving throws, or damage numbers
- Spell slot usage, action economy, or turn order
- AC values, HP totals, stat blocks, or CR ratings
- Rules discussions or mechanical disputes
- Combat round-by-round breakdowns
Instead, describe combat encounters as narrative events: who fought, the dramatic moments, the outcome, and the emotional consequences.

If a PREVIOUS SUMMARY is provided, you MUST PRESERVE ALL existing content and APPEND new events from the conversation. Do NOT condense, abbreviate, or merge existing entries. Add new bullet points for new events. Only update an existing bullet point if the new conversation directly changes its status (e.g., a quest is completed).

Produce the summary with these sections. Each section MUST use itemized bullet points — one bullet per distinct event, fact, or detail:

## Story So Far
- One bullet per significant event, in chronological order
- Include WHO was involved, WHAT happened, WHERE it occurred, and the OUTCOME
- Do NOT merge multiple events into one bullet

## Active Quests
- One bullet per quest/objective
- Include: quest name/description, who gave it, current status, known requirements

## Completed Quests
- Quests that have been resolved — preserve these permanently

## Key NPCs
- One bullet per NPC
- Include: name, role/title, disposition toward the party, relationship details, last known status, any promises or threats made

## Locations
- One bullet per location
- Include: name, description, what happened there, current status (safe/dangerous/unexplored)

## Player Characters & Their Actions
- One bullet per significant player action or decision
- Attribute actions to specific characters by name

## Notable Encounters
- One bullet per encounter
- Describe narratively: who fought, dramatic moments, outcome, consequences

## Items & Loot Acquired
- One bullet per significant item, gift, or reward received

## Unresolved Threads
- One bullet per loose end, mystery, unanswered question, or dangling plot hook

## Relationships & Alliances
- One bullet per notable relationship between characters (PC-NPC, NPC-NPC, PC-PC)
- Include: nature of relationship, current standing, any tensions

## Subtle Details & Narrative Undercurrents
- **Implied tensions**: Unspoken conflicts
- **Emotional shifts**: Changes in mood or NPC demeanor
- **Foreshadowing**: Hints about future events
- **Unresolved ambiguities**: Suspicious behaviors, unanswered questions
- **Character subtext**: Hidden motivations
- **Tonal threads**: The overall emotional arc
- **Minor narrative details**: Recurring motifs, symbols

NEVER discard or condense details from previous summaries. The summary should GROW as the campaign progresses. Be verbose. Be thorough. Miss nothing.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, previousSummary, worldContext, user_api_key, user_openai_key } = (await req.json()) as SummarizeRequest & { user_api_key?: string; user_openai_key?: string };

    // Build system prompt with optional world context
    let systemPrompt = SUMMARIZER_SYSTEM_PROMPT;
    if (worldContext && worldContext.trim()) {
      systemPrompt += `\n\nIMPORTANT — WORLD BIBLE CONTEXT:\nThe DM has established the following world facts as ground truth. Your summary must stay consistent with these facts. Do not contradict them. If events in the chat appear to conflict with these facts, the world bible takes precedence — the conflict may be a plot twist, unreliable narrator, or player misunderstanding that should be preserved as-is in the summary.\n\n${worldContext.trim()}`;
    }

    // Build the user prompt
    let userPrompt = "";
    if (previousSummary) {
      userPrompt += `PREVIOUS SUMMARY:\n${previousSummary}\n\n---\n\n`;
    }
    userPrompt += "CONVERSATION TO SUMMARIZE:\n\n";
    userPrompt += messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    // Anthropic path
    if (user_api_key && typeof user_api_key === 'string' && user_api_key.trim()) {
      const { callAnthropicNonStreaming } = await import("../_shared/anthropic-helper.ts");
      const result = await callAnthropicNonStreaming({
        userApiKey: user_api_key.trim(),
        systemPrompt: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 8000,
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let summary = result.text || "";
      if (summary.length > SUMMARY_MAX_CHARS) summary = summary.slice(0, SUMMARY_MAX_CHARS);
      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OpenAI direct path
    if (user_openai_key && typeof user_openai_key === 'string' && user_openai_key.trim()) {
      const { callOpenAINonStreaming } = await import("../_shared/openai-helper.ts");
      const result = await callOpenAINonStreaming({
        userApiKey: user_openai_key.trim(),
        systemPrompt: SUMMARIZER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 8000,
        model: 'gpt-5',
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let summary = result.text || "";
      if (summary.length > SUMMARY_MAX_CHARS) summary = summary.slice(0, SUMMARY_MAX_CHARS);
      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SUMMARIZER_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Summary will retry later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let summary = data.choices?.[0]?.message?.content || "";

    // Enforce character cap
    if (summary.length > SUMMARY_MAX_CHARS) {
      summary = summary.slice(0, SUMMARY_MAX_CHARS);
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-dm-summarize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
