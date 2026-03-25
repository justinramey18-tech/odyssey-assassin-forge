import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface WorldBuilderRequest {
  genre: string;
  tone: string;
  setting: string;
  settingNotes: string;
  factions: string[];
  conflict: string;
  characterHook: string;
  characterName: string;
  characterLevel: number;
  user_api_key?: string;
}

const TOOL_DEF = {
  type: 'function' as const,
  function: {
    name: 'create_campaign_world',
    description: 'Create a structured campaign world bible for the DM',
    parameters: {
      type: 'object',
      properties: {
        world_name: { type: 'string', description: 'A unique, evocative name for this world or region' },
        overview: { type: 'string', description: '2-3 sentence atmospheric description of the world' },
        locations: {
          type: 'array', description: '3 named starting locations',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string', description: '1-2 sentence evocative description' },
              atmosphere: { type: 'string', description: 'One word or short phrase' },
            },
            required: ['name', 'description', 'atmosphere'],
          },
        },
        factions: {
          type: 'array', description: '2-3 active factions',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              motivation: { type: 'string', description: 'What they want — 1 sentence' },
              attitude_toward_player: { type: 'string', description: 'Default stance toward the character' },
            },
            required: ['name', 'motivation', 'attitude_toward_player'],
          },
        },
        situation: { type: 'string', description: '2-3 sentences: what is happening RIGHT NOW' },
        character_hook: { type: 'string', description: '2-3 sentences: how THIS character connects to the world' },
        dm_instructions: { type: 'string', description: '3-5 bullet points of DM guidance' },
        opening_scene_seed: { type: 'string', description: 'A vivid 2-3 sentence opening scene' },
      },
      required: ['world_name', 'overview', 'locations', 'factions', 'situation', 'character_hook', 'dm_instructions', 'opening_scene_seed'],
    },
  },
};

function formatWorldBible(world: any, characterName: string): string {
  const locationsMd = world.locations.map((l: any) =>
    `**${l.name}** *(${l.atmosphere})*\n${l.description}`
  ).join('\n\n');

  const factionsMd = world.factions.map((f: any) =>
    `**${f.name}**\nMotivation: ${f.motivation}\nAttitude: ${f.attitude_toward_player}`
  ).join('\n\n');

  return `# ${world.world_name}

## World Overview
${world.overview}

## Key Locations
${locationsMd}

## Active Factions
${factionsMd}

## Current Situation
${world.situation}

## Character Hook — ${characterName}
${world.character_hook}

## DM Instructions
${world.dm_instructions}

## Opening Scene
${world.opening_scene_seed}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: WorldBuilderRequest = await req.json();
    const { genre, tone, setting, settingNotes, factions, conflict, characterHook, characterName, characterLevel, user_api_key } = body;

    const systemPrompt = `You are a master world-builder and dungeon master. Create a detailed campaign world based on the player's choices. Generate content with unique names, compelling conflicts, and a strong sense of place. The world should feel lived-in and dangerous, with clear stakes for the character.`;

    const userPrompt = `Create a complete campaign world for a ${genre} ${tone} campaign with these details:

Setting: ${setting}${settingNotes ? `\nSetting notes: ${settingNotes}` : ''}
Factions: ${factions.length > 0 ? factions.join(', ') : 'to be determined by the setting'}
Core conflict: ${conflict || 'to be determined by the genre and setting'}
Character: ${characterName}, Level ${characterLevel}
Character hook: ${characterHook || 'a wanderer drawn into events by fate'}

Generate a complete campaign bible with unique world names, locations, factions, and an opening scene. Make it specific and evocative — not generic. Give the world a distinctive name.`;

    let world: any;

    // Anthropic path
    if (user_api_key && typeof user_api_key === 'string' && user_api_key.trim()) {
      const { callAnthropicNonStreaming } = await import("../_shared/anthropic-helper.ts");
      const result = await callAnthropicNonStreaming({
        userApiKey: user_api_key.trim(),
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 4096,
        tools: [TOOL_DEF],
        toolChoice: 'create_campaign_world',
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      world = result.toolArguments;
      if (!world) {
        return new Response(JSON.stringify({ error: 'No world data generated' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Default: Lovable gateway
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          tools: [TOOL_DEF],
          tool_choice: { type: 'function', function: { name: 'create_campaign_world' } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'AI credits required.' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const errText = await response.text();
        console.error('AI gateway error:', response.status, errText);
        return new Response(JSON.stringify({ error: 'AI generation failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function?.name !== 'create_campaign_world') {
        return new Response(JSON.stringify({ error: 'No world data generated' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      world = JSON.parse(toolCall.function.arguments);
    }

    const bible = formatWorldBible(world, characterName);

    return new Response(JSON.stringify({
      bible,
      world_name: world.world_name,
      opening_scene_seed: world.opening_scene_seed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('World builder error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
