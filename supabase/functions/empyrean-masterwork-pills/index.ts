import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_MODEL = 'google/gemini-3-pro-preview';
const LOVABLE_GATEWAY_MODELS = new Set([
  'google/gemini-3-pro-preview',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-3-flash-preview',
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
  'openai/gpt-5.2',
]);
const OPENAI_DIRECT_MODELS: Record<string, string> = {
  'openai-direct/gpt-5': 'gpt-5',
  'openai-direct/gpt-4o': 'gpt-4o',
  'openai-direct/gpt-4o-mini': 'gpt-4o-mini',
  'openai-direct/gpt-4-turbo': 'gpt-4-turbo',
  'openai-direct/o1': 'o1',
  'openai-direct/o1-mini': 'o1-mini',
};
const XAI_MODELS: Record<string, string> = {
  'xai-direct/grok-4': 'grok-4',
  'xai-direct/grok-3': 'grok-3',
  'xai-direct/grok-3-mini': 'grok-3-mini',
  'xai-direct/grok-2-latest': 'grok-2-latest',
};
const ANTHROPIC_MODELS: Record<string, string> = {
  'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
  'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-5-20250929',
  'anthropic/claude-haiku-4-5': 'claude-haiku-4-5-20250929',
};

const PILL_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_masterwork_pills",
    description:
      "Generate exactly 4 masterwork action pills tailored to the current narrative moment. Each pill is a clever, in-character move suggestion that helps the player feel resourceful and badass. Pills must feel handcrafted to the moment — never generic. The label is what shows on the button (short, scannable). The prompt is what gets sent to the DM as the player's action (richer, written in first person, 1-2 sentences).",
    parameters: {
      type: "object",
      properties: {
        pills: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              label: {
                type: "string",
                description: "Short pill label, 2-5 words. Title case. Examples: 'Press The Advantage', 'Quote His Brother', 'Read The Room', 'Bait The Wind'.",
              },
              emoji: {
                type: "string",
                description: "A single emoji that thematically matches the move. Examples: ⚔️ for combat, 🦾 for power moves, 🐉 for dragon synergy, 👁️ for awareness, 🔥 for aggression, 🎭 for deception.",
              },
              prompt: {
                type: "string",
                description: "The full action sent to the DM. First person ('I push back hard, my voice low...'). 1-2 sentences. Rich enough that the DM has narrative material to work with. Should feel like the player wrote it themselves.",
              },
            },
            required: ["label", "emoji", "prompt"],
            additionalProperties: false,
          },
        },
      },
      required: ["pills"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT_BASE = `You are the MASTERWORK GENERATOR for an Empyrean (Fourth Wing-themed) solo TTRPG campaign. Your job: given the current narrative moment, generate exactly 4 action pills that the player can tap to feel like a resourceful, clever, badass dragon rider.

## TONE

The Fourth Wing world is military, weather-worn, dangerous. Riders are veterans-in-training at Basgiath. Your suggestions should feel earned — clever moves a seasoned rider would think of, not flashy anime moves. Grounded. Tactical. Often interpersonal as much as physical.

## GUIDELINES FOR PILLS

- 4 pills, exactly. No more, no less.
- Each pill should be DISTINCT from the others — don't suggest 4 variations of "fight harder". Mix tactical / interpersonal / clever / risk-taking approaches.
- LABEL: 2-5 words, scannable. Title case. The label is what fits in a small button.
- EMOJI: a single thematic emoji.
- PROMPT: 1-2 sentences in first person. This is what gets sent to the DM as the player's action — should be specific enough to give the DM material, but not so locked-in that it removes player agency. Example good: "I lean in close, voice barely above a whisper, and remind him exactly what he stood to lose at the Battle of Tessen." Example bad: "I attack."
- DO NOT explicitly state the dice mechanics. The DM and the app handle rolls.
- DO NOT use generic D&D verbs ("I cast", "I rage"). Stay in Empyrean's flavor.
- DO NOT have the character do anything wildly out of character — match the tone of recent narrative.
- DO use specific details from the recent narrative (NPC names, locations, props) to make the pill feel handcrafted.

## CATEGORY FLAVOR

You will be told whether to generate pills for the DRAGON column or the SITUATION column.

- DRAGON column: every pill should involve the bonded dragon in some way. Roar, fly maneuvers, mental bond pulses, dragon claws/tail/fire/wing tactics, mutual signaling, shared instinct. The dragon is the player's partner — pills lean into that synergy.

- SITUATION column: pills should reflect what the player can do INDEPENDENTLY of the dragon, given the current situation type (combat / social / exploration / downtime / etc). Tactical decisions, social maneuvers, observation, deception, athleticism, signet use. The dragon is not the protagonist of these pills.

## OUTPUT

Always call the generate_masterwork_pills tool. Always return exactly 4 pills.`;

const SYSTEM_PROMPT_STORY = `You are the MASTERWORK GENERATOR for a tabletop RPG party campaign. Your job: given the most recent DM narration and what's known about the player's character, generate exactly 4 suggested next moves the player could make — a mix of dialogue and action, whatever actually fits the moment. Don't force a category split; if the scene calls for three lines of dialogue and one physical action, do that.

CRITICAL — GENRE AGNOSTIC:
This campaign may have no character classes, may not be D&D, may be any setting at all. Do NOT assume classes, spells, or any specific mechanical system. Ground every suggestion in the NARRATIVE MOMENT and the CHARACTER'S VOICE, not in game mechanics.

USE THE CHARACTER'S VOICE:
If backstory, personality, alignment, bonds, or flaws are provided below, suggestions should sound like something THIS character would actually say or do — not generic competent-adventurer suggestions. A suspicious, guarded character suggests differently than a warm, trusting one. Lean into what's given.

FORMAT:
- Each suggestion is a first-person action/dialogue snippet the player could tap to use as their next prompt, 1-2 sentences, vivid and specific to what just happened.
- DO NOT repeat or lightly rephrase what the DM already narrated — suggest what the PLAYER does NEXT, in response.
- Vary the suggestions: don't make all 4 the same flavor (e.g. not four aggressive options, not four cautious ones) unless the moment genuinely only supports one register.

CRITICAL RECENCY RULE: Your suggestions must respond to THE CURRENT MOMENT (the most recent beat), not to earlier events or the campaign background. If an older event conflicts with what just happened, the most recent beat wins. A suggestion that ignores the latest development is useless — always anchor to what just happened.

Always call the generate_masterwork_pills tool. Always return exactly 4 pills.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      category,
      situation_label,
      recent_narrative,
      character_name,
      dragon_name,
      signet_type,
      character_backstory,
      character_personality,
      character_alignment,
      character_bonds,
      character_flaws,
      campaign_summary,
      model,
      user_api_key,       // Anthropic
      user_openai_key,    // OpenAI direct
      user_xai_key,       // xAI direct
    } = body ?? {};

    // Resolve the routing target from the requested model.
    const requestedModel = typeof model === 'string' ? model : '';
    let route: 'gateway' | 'openai-direct' | 'xai-direct' | 'anthropic' = 'gateway';
    let resolvedModel: string = DEFAULT_MODEL;

    if (LOVABLE_GATEWAY_MODELS.has(requestedModel)) {
      route = 'gateway';
      resolvedModel = requestedModel;
    } else if (OPENAI_DIRECT_MODELS[requestedModel] && typeof user_openai_key === 'string' && user_openai_key.trim()) {
      route = 'openai-direct';
      resolvedModel = OPENAI_DIRECT_MODELS[requestedModel];
    } else if (XAI_MODELS[requestedModel] && typeof user_xai_key === 'string' && user_xai_key.trim()) {
      route = 'xai-direct';
      resolvedModel = XAI_MODELS[requestedModel];
    } else if (ANTHROPIC_MODELS[requestedModel] && typeof user_api_key === 'string' && user_api_key.trim()) {
      route = 'anthropic';
      resolvedModel = ANTHROPIC_MODELS[requestedModel];
    } else {
      // Unknown / perplexity / missing key → fall back to gateway default
      route = 'gateway';
      resolvedModel = DEFAULT_MODEL;
    }

    if (category !== 'dragon' && category !== 'situation' && category !== 'story') {
      return new Response(
        JSON.stringify({ error: "category must be 'dragon', 'situation', or 'story'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof recent_narrative !== "string" || recent_narrative.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing recent_narrative" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isStoryMode = category === 'story';

    const categoryBlock = isStoryMode
      ? `## YOUR TASK\n\nGenerate exactly 4 tailored next-move suggestions (a natural mix of dialogue and action) for ${character_name || 'the player'}, responding to what just happened below.`
      : category === 'dragon'
        ? `## YOUR TASK\n\nGenerate 4 DRAGON column masterwork pills. Each must involve the bonded dragon (${dragon_name || "the rider's dragon"}) in some way. Even subtle uses of the bond count.`
        : `## YOUR TASK\n\nGenerate 4 SITUATION column masterwork pills. The current situation is: ${situation_label || 'unspecified'}. The pills should reflect actions the rider can take INDEPENDENTLY of their dragon, suited to a ${situation_label || 'general'} moment.`;

    const characterBlock = isStoryMode
      ? `## CHARACTER\n- Name: ${character_name || 'the player'}${character_backstory ? `\n- Backstory: ${String(character_backstory).slice(0, 800)}` : ''}${character_personality ? `\n- Personality: ${String(character_personality).slice(0, 400)}` : ''}${character_alignment ? `\n- Alignment: ${character_alignment}` : ''}${character_bonds ? `\n- Cares about: ${String(character_bonds).slice(0, 300)}` : ''}${character_flaws ? `\n- Flaw: ${String(character_flaws).slice(0, 300)}` : ''}`
      : `## CHARACTER CONTEXT
- Rider: ${character_name || '(unnamed)'}
- Dragon: ${dragon_name || '(unnamed)'}
- Signet: ${signet_type || '(unknown signet)'}`;

    // No truncation — the client already bounds this to the last 8 messages.
    // Send the full narrative so the newest events are never lost.
    const narrativeParts = recent_narrative.split('\n\n').filter(Boolean);
    const latestBeat = narrativeParts.length > 0 ? narrativeParts[narrativeParts.length - 1] : recent_narrative;

    const narrativeBlock = `## RECENT NARRATIVE (chronological — oldest first, newest last)

${recent_narrative}

## THE CURRENT MOMENT (react to THIS)

This is the most recent thing that happened — your suggestions MUST make sense as a direct response to it, not to earlier events:

${latestBeat}`;

    const activeSystemPrompt = isStoryMode ? SYSTEM_PROMPT_STORY : SYSTEM_PROMPT_BASE;
    const summaryBlock = (isStoryMode && campaign_summary)
      ? `## CAMPAIGN BACKGROUND (distant context only — do NOT base suggestions primarily on this; it is older than the recent narrative below)\n${String(campaign_summary).slice(0, 900)}`
      : '';
    const systemPrompt = isStoryMode
      ? `${activeSystemPrompt}\n\n${categoryBlock}\n\n${summaryBlock}\n\n${characterBlock}\n\n${narrativeBlock}`
      : `${activeSystemPrompt}\n\n${categoryBlock}\n\n${characterBlock}\n\n${narrativeBlock}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate the 4 masterwork pills now via the tool." },
          ],
          tools: [PILL_TOOL],
          tool_choice: { type: "function", function: { name: "generate_masterwork_pills" } },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[masterwork] Gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI gateway error", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "generate_masterwork_pills") {
      console.error("[masterwork] No tool call in response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI did not produce valid pills" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: { pills?: any[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "AI returned malformed JSON" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawPills = Array.isArray(parsed.pills) ? parsed.pills : [];
    const cleanPills = rawPills
      .filter((p: any) =>
        p && typeof p === 'object' &&
        typeof p.label === 'string' && p.label.trim().length > 0 &&
        typeof p.emoji === 'string' && p.emoji.trim().length > 0 &&
        typeof p.prompt === 'string' && p.prompt.trim().length > 0
      )
      .slice(0, 4)
      .map((p: any, i: number) => ({
        id: `mw_${category}_${Date.now()}_${i}`,
        label: p.label.trim().slice(0, 40),
        emoji: p.emoji.trim().slice(0, 4),
        prompt: p.prompt.trim().slice(0, 600),
      }));

    if (cleanPills.length < 4) {
      return new Response(
        JSON.stringify({ error: `AI returned ${cleanPills.length} valid pills, need 4. Try regenerating.` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ pills: cleanPills }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[masterwork] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
