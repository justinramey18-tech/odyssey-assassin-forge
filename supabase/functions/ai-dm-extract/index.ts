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
    name: "extract_state_changes",
    description:
      "Extract game state changes from a Dungeon Master narrative response. Only extract changes that are explicitly stated or clearly implied in the text.",
    parameters: {
      type: "object",
      properties: {
        hp_changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Positive number representing the magnitude" },
              type: { type: "string", enum: ["damage", "healing"] },
              source: { type: "string", description: "What caused the damage/healing" },
            },
            required: ["amount", "type", "source"],
            additionalProperties: false,
          },
          description: "HP changes with specific numbers mentioned in the text",
        },
        xp_gained: {
          type: ["number", "null"],
          description: "XP amount if explicitly stated, null otherwise",
        },
        gold_changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Positive number" },
              action: { type: "string", enum: ["gained", "spent"] },
              source: { type: "string" },
            },
            required: ["amount", "action", "source"],
            additionalProperties: false,
          },
        },
        conditions_added: {
          type: "array",
          items: { type: "string" },
          description: "Conditions explicitly applied (e.g. poisoned, frightened)",
        },
        conditions_removed: {
          type: "array",
          items: { type: "string" },
          description: "Conditions explicitly removed or ended",
        },
        items_acquired: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "number" },
            },
            required: ["name", "quantity"],
            additionalProperties: false,
          },
        },
        rest_occurred: {
          type: ["string", "null"],
          enum: ["short", "long", null],
          description: "If a rest explicitly occurred in the narrative",
        },
        map_entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Creature/object name (e.g. 'Goblin')" },
              count: { type: "number", description: "How many appeared" },
              type: { type: "string", enum: ["enemy", "ally", "object"] },
            },
            required: ["name", "count", "type"],
            additionalProperties: false,
          },
          description: "Creatures/objects NEWLY introduced in this message only",
        },
        map_entities_removed: {
          type: "array",
          items: { type: "string" },
          description: "Names of creatures definitively killed, defeated, or fled",
        },
        companion_hp_changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Positive number representing the magnitude" },
              type: { type: "string", enum: ["damage", "healing"] },
              source: { type: "string", description: "What caused the damage/healing to the companion" },
            },
            required: ["amount", "type", "source"],
            additionalProperties: false,
          },
          description: "HP changes to the player's animal companion (e.g. Geralt the owlbear) with specific numbers mentioned",
        },
        companion_conditions_added: {
          type: "array",
          items: { type: "string" },
          description: "Conditions explicitly applied to the companion (e.g. frightened, restrained)",
        },
        companion_conditions_removed: {
          type: "array",
          items: { type: "string" },
          description: "Conditions explicitly removed from the companion",
        },
      },
      required: [
        "hp_changes",
        "xp_gained",
        "gold_changes",
        "conditions_added",
        "conditions_removed",
        "items_acquired",
        "rest_occurred",
        "map_entities",
        "map_entities_removed",
        "companion_hp_changes",
        "companion_conditions_added",
        "companion_conditions_removed",
      ],
      additionalProperties: false,
    },
  },
};

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

    const { message, characterContext } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a D&D 5e game state parser. Given a Dungeon Master's narrative response, extract ONLY changes that are explicitly stated or clearly implied.

Rules:
- Only extract damage/healing that has a specific number mentioned
- Only extract XP if a specific amount is stated
- Only extract gold if a specific amount is stated  
- Only extract items if specifically named as acquired or consumed
- Only extract conditions if explicitly applied or removed (e.g., "you are now poisoned")
- For map_entities, extract ONLY creatures or objects that are NEWLY introduced into the scene in THIS message. Do NOT re-extract creatures already mentioned previously. Include a count for groups (e.g., "three goblins" = count 3).
- For map_entities_removed, include creatures that are definitively killed, defeated, destroyed, or flee the scene.
- For companion_hp_changes, extract damage/healing specifically applied to the player's animal companion (e.g., Geralt the owlbear). Do NOT include player HP changes here.
- For companion_conditions_added/removed, extract conditions applied to or removed from the companion only.
- If no changes are found, return empty arrays and null values.

Character context: ${characterContext?.name || "Adventurer"} is Level ${characterContext?.level || 1}, currently at ${characterContext?.currentHP || "?"}/${characterContext?.maxHP || "?"} HP.${characterContext?.companionName ? ` Companion: ${characterContext.companionName} at ${characterContext.companionHP || "?"}/${characterContext.companionMaxHP || "?"} HP.` : ''}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          tools: [EXTRACT_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "extract_state_changes" },
          },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract the tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "extract_state_changes") {
      return new Response(
        JSON.stringify({
          hp_changes: [],
          xp_gained: null,
          gold_changes: [],
          conditions_added: [],
          conditions_removed: [],
          items_acquired: [],
          rest_occurred: null,
          map_entities: [],
          map_entities_removed: [],
          companion_hp_changes: [],
          companion_conditions_added: [],
          companion_conditions_removed: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extracted;
    try {
      extracted =
        typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
    } catch {
      extracted = {
        hp_changes: [],
        xp_gained: null,
        gold_changes: [],
        conditions_added: [],
        conditions_removed: [],
        items_acquired: [],
        rest_occurred: null,
        map_entities: [],
        map_entities_removed: [],
        companion_hp_changes: [],
        companion_conditions_added: [],
        companion_conditions_removed: [],
      };
    }

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
