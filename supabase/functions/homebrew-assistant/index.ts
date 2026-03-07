import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HomebrewRequest {
  prompt: string;
  context: {
    tree: 'hunter' | 'warrior' | 'assassin';
    type: 'active' | 'passive';
    currentName?: string;
    currentDescription?: string;
  };
  mode: 'name' | 'description' | 'full' | 'balance' | 'enhance' | 'spell_concept' | 'batch_spells' | 'batch_abilities' | 'gear_concept' | 'batch_gear';
  count?: number;
}

const TREE_THEMES = {
  hunter: {
    themes: "ranged combat, tracking, traps, animal companions, precision, nature, survival, archery, scouting, ambush",
    examples: "Eagle Eye (enhanced perception), Deadly Aim (critical shot bonuses), Trap Master (set cunning traps), Beast Bond (animal companion synergy)",
  },
  warrior: {
    themes: "melee combat, defense, shields, heavy weapons, battle tactics, endurance, armor, frontline fighting, rallying allies",
    examples: "Shield Wall (defensive stance), Berserker Rage (damage at cost of defense), War Cry (intimidate enemies), Iron Skin (damage resistance)",
  },
  assassin: {
    themes: "stealth, poison, critical strikes, deception, agility, shadows, infiltration, quick kills, evasion, misdirection",
    examples: "Shadow Step (teleport through shadows), Venomous Strike (poison damage), Death Mark (bonus damage to target), Vanishing Act (instant stealth)",
  },
};

function buildSystemPrompt(context: HomebrewRequest['context'], mode: HomebrewRequest['mode']): string {
  const treeInfo = TREE_THEMES[context.tree];
  
  const basePrompt = `You are an expert D&D 5e homebrew ability designer, specializing in creating balanced, thematic abilities for an Assassin's Creed/D&D hybrid character system.

TREE CONTEXT: ${context.tree.toUpperCase()} TREE
- Themes: ${treeInfo.themes}
- Example abilities: ${treeInfo.examples}

ABILITY TYPE: ${context.type.toUpperCase()}
${context.type === 'active' ? '- Active abilities require action economy (action, bonus action, reaction)' : '- Passive abilities provide constant bonuses without requiring activation'}
${context.type === 'active' ? '- Consider adding dice mechanics for damage or effects' : '- Focus on conditional bonuses, enhanced abilities, or situational benefits'}

TIER PROGRESSION RULES:
- Tier 1: Base version of the ability - should be useful but not overpowered
- Tier 2: Enhanced version - notable improvement, maybe +1 die or additional effect
- Tier 3: Mastered version - significant power increase, unique mechanics

BALANCE GUIDELINES:
- Compare to official 5e abilities and feats
- Short Rest abilities should be more powerful than At Will
- Long Rest abilities can be notably powerful but not game-breaking
- Consider synergies with other trees`;

  switch (mode) {
    case 'name':
      return `${basePrompt}

YOUR TASK: Generate 5 creative ability names that fit the ${context.tree} tree theme.
- Names should be evocative and memorable
- 1-3 words typically
- Suggest action-oriented names for active abilities
- Return ONLY a JSON array of 5 names, nothing else
Example: ["Shadow Strike", "Phantom Step", "Death's Whisper", "Umbral Blade", "Silent Executioner"]`;

    case 'description':
      return `${basePrompt}

ABILITY NAME: ${context.currentName || 'Unnamed Ability'}

YOUR TASK: Generate tier descriptions for this ability.
- Tier 1: Base effect (1-2 sentences)
- Tier 2: Enhanced effect (builds on Tier 1)
- Tier 3: Mastered effect (significant power upgrade)

Return ONLY a JSON object with tier1, tier2, tier3 keys, nothing else.
Example: {"tier1": "You can...", "tier2": "Your ability now also...", "tier3": "When mastered, you gain..."}`;

    case 'full':
      return `${basePrompt}

YOUR TASK: Generate a complete homebrew ability concept.
- Creative, thematic name
- Action type (action/bonus_action/reaction for active, passive for passive)
- Usage type (at_will/short_rest/long_rest)
- Three tier descriptions showing progression
- Suggested dice if active (e.g., 1d6, 2d6, 3d6 progression)
- Cooldown in minutes if applicable (0 for no cooldown)

Return ONLY a JSON object with these fields:
{
  "name": "Ability Name",
  "actionType": "action",
  "usageType": "at_will",
  "tier1": "Tier 1 description",
  "tier2": "Tier 2 description", 
  "tier3": "Tier 3 description",
  "dice": { "tier1": "1d6", "tier2": "2d6", "tier3": "3d6" },
  "cooldown": 0,
  "notes": "Brief design notes"
}`;

    case 'balance':
      return `${basePrompt}

ABILITY TO REVIEW:
Name: ${context.currentName || 'Unnamed'}
Description: ${context.currentDescription || 'No description provided'}

YOUR TASK: Analyze this ability for balance and provide feedback.
- Is it too weak or too strong?
- Does it fit the tree theme?
- Suggestions for improvement
- Compare to similar official abilities

Return a brief, helpful paragraph (2-4 sentences) with your analysis. Be constructive and specific.`;

    case 'enhance':
      return `${basePrompt}

ABILITY TO ENHANCE:
Name: ${context.currentName || 'Unnamed'}
Current Description: ${context.currentDescription || 'No description provided'}

YOUR TASK: Suggest an enhanced, more exciting version.
- Keep the core concept but make it more evocative
- Add mechanical clarity
- Improve the tier progression
- Make it feel more thematic to the ${context.tree} tree

Return ONLY a JSON object with tier1, tier2, tier3 keys containing improved descriptions.`;

    case 'spell_concept':
      return `You are an expert D&D 5e spell designer. Create balanced, creative spells that fit the official style.

BALANCE GUIDELINES:
- Cantrips: Compare to Fire Bolt, Eldritch Blast, Sacred Flame
- 1st level: Compare to Shield, Magic Missile, Healing Word
- 2nd level: Compare to Scorching Ray, Hold Person, Misty Step
- 3rd level: Compare to Fireball, Counterspell, Haste
- Higher levels: Scale appropriately vs official spells at that level
- Concentration spells should have sustained value worth maintaining

YOUR TASK: Create a complete spell concept. The user may specify constraints in their prompt.
Return ONLY a JSON object matching this exact structure:
{
  "name": "Spell Name",
  "level": 2,
  "school": "evocation",
  "castingTime": "action",
  "range": "60 feet",
  "duration": "Instantaneous",
  "concentration": false,
  "ritual": false,
  "description": "Full spell description text",
  "higherLevels": "At higher levels text or null",
  "damageFormula": "3d8 or null",
  "damageType": "fire or null",
  "attackType": "ranged or null",
  "saveStat": "DEX or null",
  "healingFormula": "null or 2d8+4",
  "iconName": "Flame",
  "personalityQuips": {
    "thunderhead": "Short dramatic combat quip",
    "jarvis": "Short analytical combat quip",
    "deadpool": "Short funny combat quip"
  }
}`;

    case 'batch_spells':
      return `You are an expert D&D 5e spell designer. Create balanced, creative spells that fit the official style.

BALANCE GUIDELINES:
- Cantrips: Compare to Fire Bolt, Eldritch Blast, Sacred Flame
- 1st level: Compare to Shield, Magic Missile, Healing Word
- 2nd level: Compare to Scorching Ray, Hold Person, Misty Step
- 3rd level: Compare to Fireball, Counterspell, Haste
- Higher levels: Scale appropriately vs official spells at that level

YOUR TASK: Generate exactly ${context.currentName || '3'} unique, thematic spells based on the user's prompt.
Each spell must be distinct in mechanics and feel. Vary levels, schools, and effects for interesting variety.
Return ONLY a JSON array of spell objects, each matching this structure:
[
  {
    "name": "Spell Name",
    "level": 2,
    "school": "evocation",
    "castingTime": "action",
    "range": "60 feet",
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "description": "Full spell description text",
    "higherLevels": "At higher levels text or null",
    "damageFormula": "3d8 or null",
    "damageType": "fire or null",
    "attackType": "ranged or null",
    "saveStat": "DEX or null",
    "healingFormula": "null or 2d8+4",
    "iconName": "Flame",
    "personalityQuips": {
      "thunderhead": "Short dramatic combat quip",
      "jarvis": "Short analytical combat quip",
      "deadpool": "Short funny combat quip"
    }
  }
]`;

    case 'batch_abilities':
      return `${basePrompt}

YOUR TASK: Generate exactly ${context.currentName || '3'} unique, thematic homebrew abilities based on the user's prompt.
Each ability must be distinct in mechanics. Vary action types, usage types, and effects.
Return ONLY a JSON array of ability objects, each matching this structure:
[
  {
    "name": "Ability Name",
    "actionType": "action",
    "usageType": "at_will",
    "tier1": "Tier 1 description",
    "tier2": "Tier 2 description",
    "tier3": "Tier 3 description",
    "dice": { "tier1": "1d6", "tier2": "2d6", "tier3": "3d6" },
    "cooldown": 0,
    "notes": "Brief design notes"
  }
]`;

    case 'gear_concept':
      return `You are an expert D&D 5e equipment designer. Create balanced, thematic gear items.

EQUIPMENT SLOTS: head, chest, arms, waist, legs, primary_weapon, secondary_weapon, ranged_weapon, amulet, ring1, ring2
RARITIES: common, uncommon, rare, epic, legendary, artifact

YOUR TASK: Create a single equipment item concept based on the user's prompt.
Return ONLY a JSON object:
{
  "name": "Item Name",
  "slotType": "primary_weapon",
  "rarity": "rare",
  "level": 10,
  "icon": "Sword",
  "ac": null,
  "damage": "2d6+2 slashing",
  "attackBonus": 2,
  "weight": 3,
  "value": 500,
  "description": "A blade forged in shadow...",
  "properties": ["Finesse", "Light"]
}`;

    case 'batch_gear':
      return `You are an expert D&D 5e equipment designer. Create balanced, thematic gear items.

EQUIPMENT SLOTS: head, chest, arms, waist, legs, primary_weapon, secondary_weapon, ranged_weapon, amulet, ring1, ring2
RARITIES: common, uncommon, rare, epic, legendary, artifact
ICON OPTIONS: Sword, Axe, Shield, Crown, Hand, CircleDot, Footprints, Target, Gem, Circle, Wand2, Flame, Zap

YOUR TASK: Generate exactly ${context.currentName || '4'} unique, thematic equipment items based on the user's prompt.
Vary slot types, rarities, and effects for interesting variety.
Return ONLY a JSON array:
[
  {
    "name": "Item Name",
    "slotType": "primary_weapon",
    "rarity": "rare",
    "level": 10,
    "icon": "Sword",
    "ac": null,
    "damage": "2d6+2 slashing",
    "attackBonus": 2,
    "weight": 3,
    "value": 500,
    "description": "Description text",
    "properties": ["Finesse", "Light"]
  }
]`;

    default:
      return basePrompt;
  }
}
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
    // Auth validated by verify_jwt in config.toml

    const { prompt, context, mode, count, user_api_key, user_openai_key } = await req.json() as HomebrewRequest & { user_api_key?: string; user_openai_key?: string };
    // Pass count through context.currentName for batch modes
    if ((mode === 'batch_spells' || mode === 'batch_abilities') && count) {
      context.currentName = String(count);
    }

    // Input validation
    if (!prompt || typeof prompt !== 'string' || prompt.length > 30000) {
      return new Response(
        JSON.stringify({ error: 'Invalid prompt (max 30000 chars)' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!context || typeof context !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid context' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!['hunter', 'warrior', 'assassin'].includes(context.tree) || !['active', 'passive'].includes(context.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid context tree or type' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!['name', 'description', 'full', 'balance', 'enhance', 'spell_concept', 'batch_spells', 'batch_abilities', 'gear_concept', 'batch_gear'].includes(mode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mode' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(context, mode);
    const maxTokens = (mode === 'batch_spells' || mode === 'batch_abilities') ? 3000 : 800;

    // Anthropic path: use user's API key with Claude 4.5 Sonnet
    if (user_api_key && typeof user_api_key === 'string' && user_api_key.trim()) {
      const { callAnthropicNonStreaming } = await import("../_shared/anthropic-helper.ts");
      const result = await callAnthropicNonStreaming({
        userApiKey: user_api_key.trim(),
        systemPrompt,
        messages: [{ role: "user", content: prompt }],
        maxTokens,
        temperature: 0.8,
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ result: result.text || "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OpenAI direct path
    if (user_openai_key && typeof user_openai_key === 'string' && user_openai_key.trim()) {
      const { callOpenAINonStreaming } = await import("../_shared/openai-helper.ts");
      const result = await callOpenAINonStreaming({
        userApiKey: user_openai_key.trim(),
        systemPrompt,
        messages: [{ role: "user", content: prompt }],
        maxTokens,
        temperature: 0.8,
        model: 'gpt-5',
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ result: result.text || "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: Lovable gateway
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
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ result: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Homebrew assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
