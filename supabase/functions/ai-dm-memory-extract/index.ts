import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACT_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_world_facts",
    description:
      "Extract newly introduced world facts (NPCs, locations, consequences, narrative subtext) from a DM narrative message. Only extract facts that are new and significant — skip atmospheric flavor or things already in existing anchors.",
    parameters: {
      type: "object",
      properties: {
        npcs: {
          type: "array",
          description: "Named characters introduced or meaningfully developed in this message",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Character's name" },
              relationship: {
                type: "string",
                description: "Their relationship to the player (ally, enemy, neutral, merchant, etc.)",
              },
              notes: {
                type: "string",
                description: "Brief key detail about them (one short sentence max)",
              },
            },
            required: ["name", "relationship", "notes"],
            additionalProperties: false,
          },
        },
        locations: {
          type: "array",
          description: "Named places the player entered, discovered, or that were made significant",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Location name" },
              type: {
                type: "string",
                description: "Type of place (tavern, dungeon, city, forest, etc.)",
              },
              notes: {
                type: "string",
                description: "Brief key detail (one short sentence max)",
              },
            },
            required: ["name", "type", "notes"],
            additionalProperties: false,
          },
        },
        consequences: {
          type: "array",
          description:
            "Major decisions, reputations earned, debts incurred, injuries suffered, or secrets discovered",
          items: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["reputation", "debt", "injury", "secret", "fact"],
                description: "Category of consequence",
              },
              key: {
                type: "string",
                description: "Short identifier (3-5 words, e.g. 'Tavern brawl reputation')",
              },
              value: {
                type: "string",
                description: "The fact to remember (one short sentence)",
              },
            },
            required: ["category", "key", "value"],
            additionalProperties: false,
          },
        },
        subtext: {
          type: "array",
          description:
            "Implied tensions, emotional shifts, foreshadowing, unresolved ambiguities, character motivations hinted at but not stated, or tonal changes in the narrative. These are the subtle undercurrents that shape the story's direction.",
          items: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "Short label for the subtext element (3-6 words, e.g. 'Innkeeper hiding something', 'Growing distrust in party', 'Foreshadowed betrayal')",
              },
              value: {
                type: "string",
                description: "The implied meaning or narrative thread to remember (one sentence describing what's hinted at, not what's explicitly stated)",
              },
            },
            required: ["key", "value"],
            additionalProperties: false,
          },
        },
      },
      required: ["npcs", "locations", "consequences", "subtext"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, existingAnchors = [], characterContext, user_api_key } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length < 20) {
      return new Response(
        JSON.stringify({ npcs: [], locations: [], consequences: [], subtext: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const characterName = characterContext?.name || "the adventurer";
    const existingKeys = existingAnchors.map((a: any) => `${a.category}:${a.key}`).join(", ");

    const systemPrompt = `You are a memory extraction engine for a D&D campaign. Your job is to extract meaningful world facts AND subtle narrative undercurrents from a DM's narrative response so they can be persisted for future sessions.

CHARACTER: ${characterName}

EXISTING MEMORY (do NOT re-extract these, they're already saved):
${existingKeys || "None yet"}

RULES:
- Only extract NEWLY introduced or meaningfully revealed facts from THIS message
- Skip anything purely atmospheric or flavor (weather, generic descriptions, passing mentions)
- NPCs: only named characters who have a meaningful role or interaction
- Locations: only named places the player actually enters, arrives at, or discovers
- Consequences: only significant choices, reputations, injuries, debts, or secrets
- Keep notes extremely brief (one short sentence each)
- Return empty arrays if nothing significant was introduced
- Never duplicate what's already in EXISTING MEMORY

SUBTEXT EXTRACTION (critical for narrative continuity):
- Look for IMPLIED tensions between characters (e.g. "her smile didn't reach her eyes")
- Capture EMOTIONAL SHIFTS in NPCs or the scene's mood (e.g. "the crowd grew uneasy")
- Note FORESHADOWING — hints about future events, dangers, or revelations
- Track UNRESOLVED AMBIGUITIES — things left deliberately unclear or suspicious
- Record unstated CHARACTER MOTIVATIONS hinted through behavior or dialogue
- Identify TONAL SHIFTS — when the narrative mood changes significantly
- Only extract subtext that matters for future storytelling; skip routine atmosphere
- Phrase subtext as what's IMPLIED, not what's explicitly stated`;

    // Anthropic path
    if (user_api_key && typeof user_api_key === 'string' && user_api_key.trim()) {
      const { callAnthropicNonStreaming } = await import("../_shared/anthropic-helper.ts");
      const result = await callAnthropicNonStreaming({
        userApiKey: user_api_key.trim(),
        systemPrompt,
        messages: [{ role: "user", content: `Extract world facts from this DM narrative:\n\n${message.slice(0, 4000)}` }],
        tools: [EXTRACT_TOOL],
        toolChoice: "extract_world_facts",
        temperature: 0.1,
      });
      if (result.error) {
        return new Response(JSON.stringify({ npcs: [], locations: [], consequences: [], subtext: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const extracted = result.toolArguments || { npcs: [], locations: [], consequences: [], subtext: [] };
      return new Response(JSON.stringify({
        npcs: extracted.npcs || [], locations: extracted.locations || [], consequences: extracted.consequences || [], subtext: extracted.subtext || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Extract world facts from this DM narrative:\n\n${message.slice(0, 4000)}`,
            },
          ],
          tools: [EXTRACT_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "extract_world_facts" },
          },
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", npcs: [], locations: [], consequences: [], subtext: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required", npcs: [], locations: [], consequences: [], subtext: [] }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", response.status, await response.text());
      return new Response(
        JSON.stringify({ npcs: [], locations: [], consequences: [], subtext: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ npcs: [], locations: [], consequences: [], subtext: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      extracted = { npcs: [], locations: [], consequences: [], subtext: [] };
    }

    return new Response(
      JSON.stringify({
        npcs: extracted.npcs || [],
        locations: extracted.locations || [],
        consequences: extracted.consequences || [],
        subtext: extracted.subtext || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-dm-memory-extract error:", err);
    return new Response(
      JSON.stringify({ npcs: [], locations: [], consequences: [], subtext: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
