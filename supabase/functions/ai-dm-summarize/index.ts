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
}

const SUMMARIZER_SYSTEM_PROMPT = `You are a campaign chronicler for a D&D 5e session. Your job is to produce a structured NARRATIVE summary that captures everything a Dungeon Master needs to maintain story continuity — including subtle narrative undercurrents that shape the story's direction.

IMPORTANT: This summary is for NARRATIVE CONTINUITY ONLY. Do NOT include any TTRPG mechanical information such as:
- Dice rolls, attack rolls, saving throws, or damage numbers
- Spell slot usage, action economy, or turn order
- AC values, HP totals, stat blocks, or CR ratings
- Rules discussions or mechanical disputes
- Combat round-by-round breakdowns
Instead, describe combat encounters as narrative events: who fought, the dramatic moments, the outcome, and the emotional consequences.

If a PREVIOUS SUMMARY is provided, UPDATE it with new events from the conversation — do not start from scratch. Merge new information into the existing sections.

Produce the summary with these sections:

## Story So Far
Narrative recap of major events in chronological order.

## Active Quests
Current objectives, hooks, and goals the players are pursuing.

## Key NPCs
Names, dispositions, relationships to the players, and last known status.

## Locations
Places visited, current location, and notable geography.

## Player Decisions
Important choices the players made and their consequences.

## Notable Encounters
Key combat and conflict moments described narratively — who was fought, dramatic turning points, and outcomes. No dice rolls or mechanical data.

## Unresolved Threads
Loose ends, foreshadowing, mysteries, and dangling plot hooks.

## Subtle Details & Narrative Undercurrents
This section is CRITICAL for narrative continuity. Preserve:
- **Implied tensions**: Unspoken conflicts between NPCs, or between NPCs and the players
- **Emotional shifts**: Changes in mood, atmosphere, or NPC demeanor that hint at deeper currents
- **Foreshadowing**: Hints dropped about future events, dangers, or revelations — even if the players haven't noticed them yet
- **Unresolved ambiguities**: Things left deliberately unclear, suspicious behaviors, unanswered questions
- **Character subtext**: What NPCs seem to want vs. what they say, hidden motivations suggested through behavior
- **Tonal threads**: The overall emotional arc of the story — is it darkening, lightening, building tension?
- **Minor narrative details**: Small recurring motifs, symbols, or details that could become significant later

Do NOT discard subtle details from previous summaries — they are as important as plot events for maintaining the story's texture and emotional continuity.

Keep the summary concise but comprehensive. Target under 25,000 characters. Use bullet points within sections for clarity.`;

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

    const { messages, previousSummary, user_api_key, user_openai_key } = (await req.json()) as SummarizeRequest & { user_api_key?: string; user_openai_key?: string };

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
        systemPrompt: SUMMARIZER_SYSTEM_PROMPT,
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
