import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RARITY_BUDGET = {
  common:    { statCount: 1, values: [1] },
  uncommon:  { statCount: 1, values: [2] },
  rare:      { statCount: 2, values: [2, 1] },
  epic:      { statCount: 2, values: [3, 2] },
  legendary: { statCount: 3, values: [4, 3, 2] },
};

const RARITY_MIN_LEVEL = {
  common: 1, uncommon: 1, rare: 1, epic: 5, legendary: 10,
};

const SLOTS = ['head', 'chest', 'weapon', 'dagger', 'wings', 'potions'];
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const STATS = ['physical', 'mental', 'endurance', 'evasion', 'social'];

const FORGE_TOOL = {
  type: "function" as const,
  function: {
    name: "create_gear_item",
    description: "Create an Empyrean gear item from a prose description. The stats MUST match the rarity budget provided in the system prompt.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "A short evocative name for the item, 2-5 words. E.g. 'Venin's Shoulder', 'Oathbound Edge'.",
        },
        description: {
          type: "string",
          description: "1-2 sentences of flavor text describing the item's appearance, history, or feel. Vivid, grounded, Fourth Wing tone.",
        },
        stats: {
          type: "object",
          description: "Stat bonuses. MUST contain exactly the number of keys specified by the rarity budget, each with the exact values in the budget's 'values' array (in any assignment to stat keys).",
          properties: {
            physical:  { type: "number" },
            mental:    { type: "number" },
            endurance: { type: "number" },
            evasion:   { type: "number" },
            social:    { type: "number" },
          },
          additionalProperties: false,
        },
      },
      required: ["name", "description", "stats"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prose, slot, rarity, riderLevel, characterName } = body ?? {};

    if (typeof prose !== "string" || prose.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing or empty 'prose'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!SLOTS.includes(slot)) {
      return new Response(JSON.stringify({ error: `Invalid slot '${slot}'` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!RARITIES.includes(rarity)) {
      return new Response(JSON.stringify({ error: `Invalid rarity '${rarity}'` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const level = typeof riderLevel === "number" ? riderLevel : 1;
    const minLevel = RARITY_MIN_LEVEL[rarity as keyof typeof RARITY_MIN_LEVEL];
    if (level < minLevel) {
      return new Response(JSON.stringify({
        error: `${rarity} items require rider level ${minLevel}. Current level: ${level}.`
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const budget = RARITY_BUDGET[rarity as keyof typeof RARITY_BUDGET];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are the Empyrean Forge — an AI smith that crafts gear items for dragon riders in the Fourth Wing world of Navarre. The setting is grounded, military, and weather-worn: leather, bone, lightning-scarred steel, venin blood. Items should feel earned, not shiny.

## RESPONSE RULES (STRICT)

You MUST call the create_gear_item tool with these exact constraints:

- **Name**: 2-5 words, evocative, grounded. Examples: "Venin's Shoulder", "Oathbound Edge", "Cadet's First Mantle", "Tyrrendor Sigil".
- **Description**: 1-2 sentences, 20-50 words total. Vivid sensory detail, a hint of history. NOT a bullet list.
- **Stats**: The stats object MUST contain exactly ${budget.statCount} key(s) from this set: physical, mental, endurance, evasion, social. The numeric values assigned MUST be exactly ${JSON.stringify(budget.values)} — each value used once, in any order, across your chosen stats. Pick stats that make thematic sense for the item prose. Never invent new stat keys. Never use negative or zero values.

## CONTEXT FOR THIS FORGE

- Slot: ${slot}
- Rarity: ${rarity}  (must feel ${rarity}-grade — common = mundane, legendary = awe-inspiring)
- Stat budget: ${budget.statCount} stat(s) with values ${JSON.stringify(budget.values)}
- Rider: ${characterName || "the rider"}

## THEMATIC HINTS BY SLOT

- head: helm, circlet, hood, eyeband, brow-piece
- chest: armor, tunic, vest, mantle, cloak, cuirass
- weapon: sword, polearm, spear, axe, bow — primary rider weapon
- dagger: secondary blade, poignard, kukri, letter-opener for the venin
- wings: dragon saddle, flight harness, stirrups, glide-rig, wing guards
- potions: a flask, vial, pouch, or consumable kit (not a stack — treat as a single kit item)

## DO NOT

- Do not write in second person ("you feel...")
- Do not attribute mechanical combat numbers beyond the stats
- Do not reference lore beyond Fourth Wing's Basgiath/Navarre/Tyrrendor flavor
- Do not exceed the stat budget or invent stat keys`;

    const userPrompt = `Player's description: "${prose.trim()}"

Forge this into a ${rarity}-rarity ${slot} item. Use the create_gear_item tool.`;

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
            { role: "user", content: userPrompt },
          ],
          tools: [FORGE_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "create_gear_item" },
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[forge-item] Gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error", detail: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "create_gear_item") {
      console.error("[forge-item] No tool call in response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI did not produce a valid item" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { name?: string; description?: string; stats?: Record<string, number> };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned malformed JSON" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = typeof parsed.name === "string" ? parsed.name.trim().slice(0, 40) : "";
    const description = typeof parsed.description === "string" ? parsed.description.trim().slice(0, 300) : "";
    const rawStats = parsed.stats && typeof parsed.stats === "object" ? parsed.stats : {};

    const cleanStats: Record<string, number> = {};
    for (const key of STATS) {
      const v = (rawStats as Record<string, unknown>)[key];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        cleanStats[key] = Math.round(v);
      }
    }

    const entries = Object.entries(cleanStats);
    if (entries.length > budget.statCount) {
      entries.sort((a, b) => b[1] - a[1]);
      const trimmed = entries.slice(0, budget.statCount);
      Object.keys(cleanStats).forEach(k => delete cleanStats[k]);
      trimmed.forEach(([k, v]) => { cleanStats[k] = v; });
    }

    const sortedBudget = [...budget.values].sort((a, b) => b - a);
    const sortedEntries = Object.entries(cleanStats).sort((a, b) => b[1] - a[1]);
    const coerced: Record<string, number> = {};
    sortedEntries.forEach(([k], idx) => {
      const budgetValue = sortedBudget[idx];
      if (typeof budgetValue === "number") coerced[k] = budgetValue;
    });

    if (!name || !description || Object.keys(coerced).length === 0) {
      return new Response(JSON.stringify({ error: "AI produced incomplete item data. Try regenerating." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        item: {
          name,
          description,
          stats: coerced,
          rarity,
          slot,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[forge-item] Unhandled error:", e);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
