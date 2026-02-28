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
        hp_absolute: {
          type: ["number", "null"],
          description: "If the DM states the player character's exact current HP (e.g. 'Momo: 26/38 HP'), extract the CURRENT number (26). null if not stated.",
        },
        companion_hp_absolute: {
          type: ["number", "null"],
          description: "If the DM states the companion's exact current HP (e.g. 'Geralt: 53/59 HP'), extract the CURRENT number (53). null if not stated.",
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
        "hp_absolute",
        "companion_hp_absolute",
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

    const { message, characterContext, user_api_key } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companionInfo = characterContext?.companionName
      ? `\n\nCOMPANION INFO (CRITICAL): The player has a companion named "${characterContext.companionName}" currently at ${characterContext.companionHP ?? "?"}/${characterContext.companionMaxHP ?? "?"} HP. Any damage or healing to "${characterContext.companionName}" MUST go in companion_hp_changes, NOT hp_changes. Any damage or healing to "${characterContext.name || "the player"}" MUST go in hp_changes, NOT companion_hp_changes. Never mix them up.`
      : '';

    const systemPrompt = `You are a precise D&D 5e game state parser. Given a Dungeon Master's narrative response, extract ONLY mechanical changes with EXACT numbers.

CRITICAL ACCURACY RULES:
- ONLY extract damage/healing when a SPECIFIC NUMBER is explicitly stated (e.g. "takes 8 damage", "heals 5 HP"). Do NOT infer or estimate numbers.
- If the text says "takes damage" without a number, do NOT extract it.
- Each damage/healing event should appear EXACTLY ONCE. Do not duplicate.
- hp_changes is ONLY for the PLAYER CHARACTER "${characterContext?.name || "the player"}". 
- companion_hp_changes is ONLY for the companion. NEVER put player damage in companion fields or vice versa.
- Damage amounts are always POSITIVE numbers. The "type" field indicates damage vs healing.
- Only extract XP if a specific amount is stated (e.g. "gain 50 XP").
- Only extract gold if a specific amount is stated (e.g. "find 10 gold").
- Only extract items if specifically named as acquired or consumed.
- Only extract conditions if explicitly applied or removed (e.g., "you are now poisoned").
- For map_entities, extract ONLY creatures/objects NEWLY introduced in THIS message. Include count for groups.
- For map_entities_removed, include creatures definitively killed, defeated, destroyed, or fled.
- ABSOLUTE HP EXTRACTION (CRITICAL): If the text shows an absolute HP value like "Geralt: 53/59 HP" or "Momo: 26/38 HP", extract the CURRENT number into hp_absolute (for the player) or companion_hp_absolute (for the companion). ALWAYS prefer extracting absolute values when available — they are more reliable than deltas.
- If no changes are found, return empty arrays and null values.

CHARACTER: "${characterContext?.name || "Adventurer"}" is Level ${characterContext?.level || 1}, currently at ${characterContext?.currentHP || "?"}/${characterContext?.maxHP || "?"} HP.${companionInfo}`;

    // Anthropic path with tool calling
    if (user_api_key && typeof user_api_key === 'string' && user_api_key.trim()) {
      const { callAnthropicNonStreaming } = await import("../_shared/anthropic-helper.ts");
      const result = await callAnthropicNonStreaming({
        userApiKey: user_api_key.trim(),
        systemPrompt,
        messages: [{ role: "user", content: message }],
        tools: [EXTRACT_TOOL],
        toolChoice: "extract_state_changes",
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const extracted = result.toolArguments || { hp_changes: [], xp_gained: null, gold_changes: [], conditions_added: [], conditions_removed: [], items_acquired: [], rest_occurred: null, map_entities: [], map_entities_removed: [], companion_hp_changes: [], companion_conditions_added: [], companion_conditions_removed: [], hp_absolute: null, companion_hp_absolute: null };
      return new Response(JSON.stringify(extracted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          hp_absolute: null,
          companion_hp_absolute: null,
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
        hp_absolute: null,
        companion_hp_absolute: null,
      };
    }

    // Validate and sanitize numeric values to prevent bad data
    if (Array.isArray(extracted.hp_changes)) {
      extracted.hp_changes = extracted.hp_changes.filter(
        (h: any) => typeof h.amount === 'number' && h.amount > 0 && Number.isFinite(h.amount) && h.amount <= 999
      );
    }
    if (Array.isArray(extracted.companion_hp_changes)) {
      extracted.companion_hp_changes = extracted.companion_hp_changes.filter(
        (h: any) => typeof h.amount === 'number' && h.amount > 0 && Number.isFinite(h.amount) && h.amount <= 999
      );
    }
    if (Array.isArray(extracted.gold_changes)) {
      extracted.gold_changes = extracted.gold_changes.filter(
        (g: any) => typeof g.amount === 'number' && g.amount > 0 && Number.isFinite(g.amount) && g.amount <= 99999
      );
    }
    if (typeof extracted.xp_gained === 'number') {
      if (!Number.isFinite(extracted.xp_gained) || extracted.xp_gained <= 0 || extracted.xp_gained > 99999) {
        extracted.xp_gained = null;
      }
    }

    // Deduplicate HP changes (same source + type + amount = likely duplicate)
    const dedup = (arr: any[]) => {
      const seen = new Set<string>();
      return arr.filter((item: any) => {
        const key = `${item.type}|${item.amount}|${(item.source || '').toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    if (Array.isArray(extracted.hp_changes)) extracted.hp_changes = dedup(extracted.hp_changes);
    if (Array.isArray(extracted.companion_hp_changes)) extracted.companion_hp_changes = dedup(extracted.companion_hp_changes);

    // Validate absolute HP values
    if (typeof extracted.hp_absolute === 'number') {
      if (!Number.isFinite(extracted.hp_absolute) || extracted.hp_absolute < 0 || extracted.hp_absolute > 999) {
        extracted.hp_absolute = null;
      }
    } else {
      extracted.hp_absolute = null;
    }
    if (typeof extracted.companion_hp_absolute === 'number') {
      if (!Number.isFinite(extracted.companion_hp_absolute) || extracted.companion_hp_absolute < 0 || extracted.companion_hp_absolute > 999) {
        extracted.companion_hp_absolute = null;
      }
    } else {
      extracted.companion_hp_absolute = null;
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
