import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Authenticate user and return user ID or error response
async function authenticateRequest(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized - Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims) {
    console.error('Authentication failed:', error?.message);
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    };
  }

  return { userId: data.claims.sub as string };
}

// Input validation constants
const MAX_SESSION_LOG_LENGTH = 50000;
const MIN_SESSION_LOG_LENGTH = 10;

// Sanitize input to remove potential prompt injection patterns
function sanitizeInput(text: string): string {
  // Remove common prompt injection patterns
  const injectionPatterns = [
    /ignore\s+(previous|above|all)\s+instructions?/gi,
    /disregard\s+(previous|above|all)\s+instructions?/gi,
    /forget\s+(everything|all|previous)/gi,
    /new\s+instructions?:/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
    /<<SYS>>/gi,
    /<\|im_start\|>/gi,
  ];
  
  let sanitized = text;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  
  return sanitized;
}

// Validate request body structure
function validateRequestBody(body: unknown): { valid: true; sessionLog: string } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: "Invalid request body" };
  }
  
  const { sessionLog } = body as { sessionLog?: unknown };
  
  if (sessionLog === undefined || sessionLog === null) {
    return { valid: false, error: "Missing sessionLog parameter" };
  }
  
  if (typeof sessionLog !== 'string') {
    return { valid: false, error: "sessionLog must be a string" };
  }
  
  if (sessionLog.length < MIN_SESSION_LOG_LENGTH) {
    return { valid: false, error: `sessionLog must be at least ${MIN_SESSION_LOG_LENGTH} characters` };
  }
  
  if (sessionLog.length > MAX_SESSION_LOG_LENGTH) {
    return { valid: false, error: `sessionLog exceeds maximum length of ${MAX_SESSION_LOG_LENGTH} characters` };
  }
  
  return { valid: true, sessionLog };
}

// Achievement categories for AI prompt
const ACHIEVEMENT_NAMES: Record<string, string> = {
  'distract-enemies': 'Distracting Enemies with Dialogue',
  'survive-zero-hp': 'Surviving After Being Reduced to 0 HP',
  'overkill-strikes': 'Overkill Strikes on Low-Health Enemies',
  'collect-items': 'Collecting Unique Items',
  'successful-leaps': 'Performing Successful Leaps',
  'post-kill-oneliners': 'Delivering Post-Kill One-Liners',
  'faction-quests': 'Completing Side Quests for Factions',
  'shots-no-miss': 'Firing Shots Without Missing',
  'food-in-combat': 'Consuming Food During Combat',
  'arrive-late': 'Arriving Late to Battles',
  'fail-wisdom-save': 'Failing Wisdom Saving Throws and Surviving',
  'zero-to-full': 'Healing from 0 to Full HP',
  'nonverbal-combat': 'Using Non-Verbal Communication in Combat',
  'quick-draw-attack': 'Drawing Weapons and Attacking Quickly',
  'dash-action': 'Using Dash Action',
  'predict-plot': 'Predicting Plot Twists',
  'survive-meant-lose': 'Surviving Meant-to-Lose Encounters',
  'recognize-tropes': 'Recognizing Narrative Tropes',
  'reverse-situations': 'Reversing Situations with Improbable Actions',
  'hidden-paths': 'Discovering Hidden Paths',
  'humor-defuse': 'Defusing Tension with Humor',
  'minor-injuries': 'Enduring Battles with Minor Injuries',
  'combat-flourishes': 'Performing Unnecessary Combat Flourishes',
  'share-food-enemies': 'Sharing Food with Enemies',
  'lucky-items': 'Finding Useful Items Against Odds',
  'survive-lethal': 'Surviving Lethal Damage',
  'come-back-death': 'Coming Back from Death',
  'counterattack-hit': 'Counterattacking After Being Hit',
  'reverse-time': 'Reversing Time or Outcomes',
  'avoid-area-effects': 'Avoiding Area Effects',
  'break-fourth-wall': 'Breaking the Fourth Wall',
  'befriend-enemies': 'Befriending Enemies',
  'defeat-with-words': 'Defeating Enemies with Words Alone',
  'lucky-accidents': 'Benefiting from Lucky Accidents',
  'dramatic-entrances': 'Making Dramatic Entrances',
  'perceive-meta': 'Perceiving Meta-Narrative Elements',
  'survive-impossible': 'Surviving Impossible Odds',
  'influence-story': 'Influencing Story Outcomes',
  'deus-ex-machina': 'Resolving Conflicts Through Improbable Means',
  'escape-last-second': 'Escaping at the Last Second',
};

// Known consumables for matching
const KNOWN_CONSUMABLES = [
  'Potion of Healing', 'Potion of Greater Healing', 'Potion of Superior Healing',
  'Antitoxin', 'Potion of Invisibility', 'Potion of Speed', 'Potion of Flying',
  'Potion of Fire Resistance', 'Potion of Heroism', 'Potion of Giant Strength',
  'Scroll of Fireball', 'Scroll of Lightning Bolt', 'Scroll of Cure Wounds',
  'Basic Poison', 'Serpent Venom', 'Wyvern Poison', 'Purple Worm Poison',
];

function buildSystemPrompt(): string {
  const achievementList = Object.entries(ACHIEVEMENT_NAMES)
    .map(([id, name]) => `  - ${id}: ${name}`)
    .join('\n');

  return `You are a TTRPG session log parser. Extract mechanical game data from the session transcript.

## Instructions
1. Identify all XP gains with amounts and context
2. Identify all HP changes (damage taken, healing received)
3. Identify items acquired or consumed (potions, scrolls, etc.)
4. Identify gold/currency changes
5. Identify conditions applied or removed
6. Identify if a level-up occurred
7. Match narrative events to achievement categories
8. Identify items offered FOR SALE by merchants, shopkeepers, or vendors
9. Identify enemies/monsters encountered in combat

## Achievement Categories
${achievementList}

## Known Consumables
${KNOWN_CONSUMABLES.join(', ')}

## Shop Item Detection
Look for items being SOLD by NPCs (merchants, shopkeepers, vendors). Key indicators:
- Price mentions: "for X gold", "costs X gp", "selling for X", "price: X", "X gold pieces"
- Commerce language: "offers", "selling", "for sale", "purchase", "buy"
- Merchant context: "shop", "store", "vendor", "merchant", "trader", "market"

For each shop item detected:
- Extract the item name and cost in gold
- Determine item_type: "consumable" (potions, scrolls, poisons) or "equipment" (weapons, armor, gear)
- Determine category: weapon, armor, potion, poison, scroll, ring, amulet, helm, boots, etc.
- If D&D mechanics are NOT stated in the log, GENERATE appropriate 5e stats based on item type/rarity
- Estimate rarity from price: common(<50gp), uncommon(50-500gp), rare(500-5000gp), very_rare(5000-25000gp), legendary(25000+gp)
- Generate a 1-2 sentence description AND 1-2 sentence lore if not present

## Enemy Detection
Identify all enemies/monsters the party fought or encountered:
- Extract name, quantity (e.g., "3 goblins" = quantity 3)
- Extract AC if mentioned (e.g., "AC 16", "armor class of 18")
- Estimate HP if mentioned or based on creature type
- Identify creature_type: aberration, beast, celestial, construct, dragon, elemental, fey, fiend, giant, humanoid, monstrosity, ooze, plant, undead
- Identify size: tiny, small, medium, large, huge, gargantuan
- Track status: "active" (still fighting), "defeated" (killed/incapacitated), "fled" (escaped)
- Include any notable characteristics in notes

## Response Format
Return ONLY valid JSON with this structure:
{
  "xp_changes": [{"amount": number, "context": "brief description", "confidence": "high"|"medium"|"low", "source_text": "quoted text"}],
  "hp_changes": [{"amount": number, "type": "damage"|"healing", "source": "what caused it", "source_text": "quoted text"}],
  "items": [{"name": "item name", "quantity": number, "action": "acquired"|"consumed", "confidence": "high"|"medium"|"low", "source_text": "quoted text"}],
  "gold_changes": [{"amount": number, "action": "gained"|"spent", "source_text": "quoted text"}],
  "conditions": [{"name": "condition name", "action": "applied"|"removed", "source_text": "quoted text"}],
  "level_up": {"new_level": number, "source_text": "quoted text"} or null,
  "achievements": [{"id": "achievement-id", "evidence": "key phrase matched", "confidence": "high"|"medium"|"low", "source_text": "quoted text"}],
  "shop_items": [
    {
      "name": "item name",
      "item_type": "consumable"|"equipment"|"miscellaneous",
      "category": "weapon|armor|potion|poison|scroll|ring|amulet|helm|boots|gloves|belt|cloak|etc",
      "cost_gold": number,
      "mechanics": {
        "damage": "dice expression (for weapons)",
        "ac": number (for armor),
        "properties": ["Magical", "Finesse", etc],
        "effect": "what it does (for consumables/magic items)",
        "duration": "how long effect lasts",
        "saving_throw": "DC and type if applicable"
      },
      "rarity": "common"|"uncommon"|"rare"|"very_rare"|"legendary",
      "description": "1-2 sentence physical/functional description",
      "lore": "1-2 sentence world/history flavor text",
      "source_text": "quoted text from log",
      "confidence": "high"|"medium"|"low"
    }
  ],
  "enemies": [
    {
      "name": "creature name",
      "quantity": number,
      "ac": number or null,
      "estimated_hp": number or null,
      "creature_type": "humanoid"|"beast"|"undead"|"dragon"|etc or null,
      "size": "medium"|"large"|etc or null,
      "notes": "wielding greataxe, spellcaster, etc" or null,
      "status": "active"|"defeated"|"fled",
      "source_text": "quoted text from log",
      "confidence": "high"|"medium"|"low"
    }
  ]
}

## Rules
- Only extract explicit game mechanics, not implied ones
- For items, match to known consumable names when possible
- Use "high" confidence for explicit mentions, "medium" for inferred, "low" for uncertain
- Include the source_text as a short quote from the log (max 100 chars)
- Achievement IDs must match the list above exactly
- Shop items must be FOR SALE, not loot, gifts, or already-owned possessions
- Generate D&D 5e-appropriate mechanics for shop items based on type and rarity
- For enemies, infer creature_type and size from the creature name when not explicitly stated
- Mark enemies as "defeated" if they were killed, slain, or otherwise neutralized
- Do not include any text outside the JSON response`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate request
    const authResult = await authenticateRequest(req);
    if ('error' in authResult) {
      return authResult.error;
    }
    const userId = authResult.userId;
    console.log(`Authenticated request from user: ${userId.slice(0, 8)}...`);
    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      console.error("Invalid JSON in request body");
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input
    const validation = validateRequestBody(body);
    if (!validation.valid) {
      console.error("Validation failed:", validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize input to prevent prompt injection
    const sanitizedLog = sanitizeInput(validation.sessionLog);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Parsing session log of ${sanitizedLog.length} characters (sanitized)`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: `Parse the following TTRPG session log and extract all game mechanics:\n\n${sanitizedLog}` },
        ],
        temperature: 0.1, // Low temperature for consistent extraction
      }),
    });

    // Handle rate limits
    if (response.status === 429) {
      console.error("Rate limit exceeded");
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded", 
          fallback: true,
          message: "AI parsing temporarily unavailable. Please use Pattern Match mode." 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle payment required
    if (response.status === 402) {
      console.error("Payment required");
      return new Response(
        JSON.stringify({ 
          error: "Payment required", 
          fallback: true,
          message: "AI credits exhausted. Please use Pattern Match mode." 
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: "AI gateway error", 
          fallback: true,
          message: "AI parsing failed. Please use Pattern Match mode." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("Empty response from AI");
      return new Response(
        JSON.stringify({ 
          error: "Empty AI response", 
          fallback: true,
          message: "AI returned empty response. Please use Pattern Match mode." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to extract JSON from the response
    let parsedResult;
    try {
      // Handle case where AI might wrap JSON in markdown code blocks
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }
      
      parsedResult = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      console.error("Response content:", content.slice(0, 500));
      return new Response(
        JSON.stringify({ 
          error: "Invalid AI response format", 
          fallback: true,
          message: "AI response was malformed. Please use Pattern Match mode." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the structure minimally
    const validatedResult = {
      xp_changes: Array.isArray(parsedResult.xp_changes) ? parsedResult.xp_changes : [],
      hp_changes: Array.isArray(parsedResult.hp_changes) ? parsedResult.hp_changes : [],
      items: Array.isArray(parsedResult.items) ? parsedResult.items : [],
      gold_changes: Array.isArray(parsedResult.gold_changes) ? parsedResult.gold_changes : [],
      conditions: Array.isArray(parsedResult.conditions) ? parsedResult.conditions : [],
      level_up: parsedResult.level_up || null,
      achievements: Array.isArray(parsedResult.achievements) ? parsedResult.achievements : [],
      shop_items: Array.isArray(parsedResult.shop_items) ? parsedResult.shop_items : [],
      enemies: Array.isArray(parsedResult.enemies) ? parsedResult.enemies : [],
    };

    console.log("Successfully parsed session log:", {
      xp: validatedResult.xp_changes.length,
      hp: validatedResult.hp_changes.length,
      items: validatedResult.items.length,
      gold: validatedResult.gold_changes.length,
      shop: validatedResult.shop_items.length,
      achievements: validatedResult.achievements.length,
      enemies: validatedResult.enemies.length,
    });

    return new Response(
      JSON.stringify(validatedResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Chronicle sync error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        fallback: true,
        message: "An error occurred. Please use Pattern Match mode."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
