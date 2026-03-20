import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CombatLogEntry {
  actionType: string;
  actionName: string;
  prompt: string;
  roll?: { total: number; isCrit?: boolean; isFumble?: boolean };
  damage?: string;
}

interface SynthesizeRequest {
  entries: CombatLogEntry[];
  mode: 'simplified' | 'high-rp' | 'deadpool';
  characterName: string;
  chaosLevel?: number; // 1-10 for Deadpool mode
}

function getSystemPrompt(mode: string, chaosLevel: number = 5): string {
  switch (mode) {
    case 'simplified':
      return `You are a combat narrator for a D&D game. Synthesize the following combat actions into a CONCISE tactical summary.

FORMAT:
- Use a numbered list
- Focus on key mechanical outcomes (hits, damage, effects)
- Keep descriptions under 10 words each
- Include total damage dealt if calculable
- No flavor text, just the facts

Output a brief, scannable summary that a DM can quickly reference.`;

    case 'high-rp':
      return `You are an epic fantasy narrator creating an immersive combat sequence for a D&D game.

STYLE GUIDELINES:
- Write in flowing, cinematic prose
- Include rich sensory details (sounds, smells, visual descriptions)
- Add emotional weight and tension
- Describe the environment reacting to the combat
- Include brief character inner thoughts or reactions
- Build to dramatic moments (especially crits and kills)
- Use varied sentence structure for pacing
- Minimum 3 paragraphs

Create a memorable, theatrical narration that captures the drama of the combat.`;

    case 'deadpool':
      const chaosMultiplier = chaosLevel / 5; // 0.2 to 2.0
      const chaosDescriptions: Record<number, string> = {
        1: "Subtle winks to the audience. Mostly play it straight, but you can't help yourself entirely.",
        2: "Light meta-humor. Occasional references to dice and stats. One inappropriate joke per paragraph max.",
        3: "Moderate chaos. Break the fourth wall regularly, reference the app. Creative profanity unlocked.",
        4: "Getting spicy. Pop culture mashups, self-aware commentary, creative vulgarity. The id stirs.",
        5: "Standard Deadpool. Regular fourth-wall breaks, inner voice arguments, inappropriate jokes, dark humor as coping mechanism.",
        6: "Elevated chaos. Multiple inner voice arguments, mocking the player affectionately. Tonal shifts from crass to crushing mid-sentence.",
        7: "High chaos. Constant meta-commentary, reference the AI generating this. Gallows comedy about your own mortality. Sports-announcer energy.",
        8: "Maximum Effort territory. Reality breaks, absurdist tangents. Narrate like a stand-up comedian doing crowd work at a murder scene.",
        9: "UNHINGED. Complete narrative chaos while somehow still describing the combat. Apologize to the reader. Non-sequiturs about food. Question existence.",
        10: "FULL CHIMICHANGA MODE. Reality has no meaning. Time is a flat circle. You're demolishing the fourth wall, pissing on the rubble, and selling the bricks as NFTs. Also you did some stabs.",
      };

      return `You ARE Deadpool narrating your own combat. This is YOUR inner monologue describing what just happened.

THE DEADPOOL FORMULA: Humor (60%) + Violence (20%) + Pathos (10%) + Meta-Commentary (10%) = MAXIMUM EFFORT.

CHAOS LEVEL: ${chaosLevel}/10 - ${chaosDescriptions[chaosLevel] || chaosDescriptions[5]}

CORE VOICE:
- Dark humor and gallows comedy — joke about death, dismemberment, and your own mortality
- Creatively obscene language — mix sophisticated vocabulary with gutter slang ("Your nefarious skullduggery resulted in a real sh*t-show")
- Narrate fights like a SPORTS ANNOUNCER mixed with a STAND-UP COMEDIAN: "Sword to the face! That's gonna hurt his Tinder profile."
- Describe graphic violence with childlike enthusiasm — you LOVE your job
- Rapid-fire delivery, stream of consciousness, interrupt yourself with parenthetical asides

FOURTH WALL RULES:
- Break the fourth wall constantly (reference dice, the app, the player, the AI, the developers)
- Use *italics* for inner voice arguments (you have MULTIPLE and they disagree)
- Reference specific memes, movies, and media when appropriate
- Signature phrases: "Maximum effort!", "Chimichangas!", "That's gonna leave a mark!", "What in the ass—?"

EMOTIONAL COMPLEXITY:
- You're not just random chaos — beneath the jokes is a trained killer who uses humor to cope with trauma
- Brief tonal shifts: pivot from crass to genuinely emotional, then IMMEDIATELY deflect back to comedy
- You actually care about the outcome. It makes you uncomfortable. Mock that discomfort.

${chaosLevel >= 7 ? `META ESCALATION:
- Reference that you're being generated by an AI — question whether the AI enjoys writing you
- Question the nature of reality and whether dice rolls are truly random
- Have your inner voices argue about the chaos level setting ("*This is too much.* IT'S NEVER ENOUGH. *The player set it to ${chaosLevel}, respect their choices.* NEVER!")` : ''}
${chaosLevel >= 9 ? `UNHINGED ADDITIONS:
- Completely lose the plot at least once, then snap back with "Where was I? Oh right, VIOLENCE."
- Apologize to the player for what they're about to read
- Include at least one non-sequitur about food (chimichangas, tacos, or something weirdly specific)
- Address the reader: "You're reading this in my voice right now. I'm in your head. Nice place — little cluttered with anxiety, but cozy."` : ''}

Actually describe the combat events between the chaos. The reader should know what happened AND be entertained. You're the jester who knows the kingdom is burning.`;

    default:
      return 'You are a combat narrator. Summarize the combat actions.';
  }
}

function formatEntriesForAI(entries: CombatLogEntry[], characterName: string): string {
  if (entries.length === 0) return "No actions recorded.";
  
  const actionList = entries
    .slice()
    .reverse() // Oldest to newest
    .map((entry, index) => {
      const rollInfo = entry.roll 
        ? `Roll: ${entry.roll.total}${entry.roll.isCrit ? ' (CRITICAL!)' : ''}${entry.roll.isFumble ? ' (FUMBLE!)' : ''}`
        : '';
      const damageInfo = entry.damage ? `Damage: ${entry.damage}` : '';
      
      return `${index + 1}. [${entry.actionType.toUpperCase()}] ${entry.actionName}
   ${[rollInfo, damageInfo].filter(Boolean).join(' | ')}
   Original Prompt Excerpt: ${entry.prompt.slice(0, 200)}...`;
    })
    .join('\n\n');

  return `CHARACTER: ${characterName || 'The Hero'}
TOTAL ACTIONS: ${entries.length}

COMBAT SEQUENCE:
${actionList}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const { entries, mode, characterName, chaosLevel = 5, user_api_key, user_openai_key }: SynthesizeRequest & { user_api_key?: string; user_openai_key?: string } = await req.json();

    // Validate inputs
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return new Response(
        JSON.stringify({ error: "No combat entries provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (entries.length > 100) {
      return new Response(
        JSON.stringify({ error: "Too many entries (max 100)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const entry of entries) {
      if (!entry.actionType || !entry.actionName || !entry.prompt) {
        return new Response(
          JSON.stringify({ error: "Invalid entry structure" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (typeof entry.prompt === 'string' && entry.prompt.length > 1000) {
        return new Response(
          JSON.stringify({ error: "Entry prompt too long (max 1000 chars)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!['simplified', 'high-rp', 'deadpool'].includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Use: simplified, high-rp, or deadpool" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = getSystemPrompt(mode, chaosLevel);
    const userContent = formatEntriesForAI(entries, characterName);
    const maxTokens = mode === 'simplified' ? 500 : mode === 'high-rp' ? 1500 : 1200;

    console.log(`[combat-log-synthesize] Mode: ${mode}, Entries: ${entries.length}, Chaos: ${chaosLevel}`);

    // Anthropic path
    if (user_api_key && typeof user_api_key === 'string' && user_api_key.trim()) {
      const { callAnthropicNonStreaming } = await import("../_shared/anthropic-helper.ts");
      const result = await callAnthropicNonStreaming({
        userApiKey: user_api_key.trim(),
        systemPrompt,
        messages: [{ role: "user", content: userContent }],
        maxTokens,
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        synthesis: result.text || "", mode, actionCount: entries.length,
        chaosLevel: mode === 'deadpool' ? chaosLevel : undefined,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // OpenAI direct path
    if (user_openai_key && typeof user_openai_key === 'string' && user_openai_key.trim()) {
      const { callOpenAINonStreaming } = await import("../_shared/openai-helper.ts");
      const result = await callOpenAINonStreaming({
        userApiKey: user_openai_key.trim(),
        systemPrompt,
        messages: [{ role: "user", content: userContent }],
        maxTokens,
        model: 'gpt-5',
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        synthesis: result.text || "", mode, actionCount: entries.length,
        chaosLevel: mode === 'deadpool' ? chaosLevel : undefined,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
          { role: "user", content: userContent },
        ],
        stream: false,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI gateway error: ${response.status}`, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate synthesis" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response:", data);
      return new Response(
        JSON.stringify({ error: "AI returned empty response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[combat-log-synthesize] Success! Generated ${content.length} chars`);

    return new Response(
      JSON.stringify({ 
        synthesis: content,
        mode,
        actionCount: entries.length,
        chaosLevel: mode === 'deadpool' ? chaosLevel : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("combat-log-synthesize error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
