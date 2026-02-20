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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const body: WorldBuilderRequest = await req.json();
    const { genre, tone, setting, settingNotes, factions, conflict, characterHook, characterName, characterLevel } = body;

    const systemPrompt = `You are a master world-builder and dungeon master. Create a rich, immersive campaign world based on the player's choices. Generate vivid, evocative content with unique names, compelling conflicts, and a strong sense of place. The world should feel lived-in and dangerous, with clear stakes for the character.`;

    const userPrompt = `Create a complete campaign world for a ${genre} ${tone} campaign with these details:

Setting: ${setting}${settingNotes ? `\nSetting notes: ${settingNotes}` : ''}
Factions: ${factions.length > 0 ? factions.join(', ') : 'to be determined by the setting'}
Core conflict: ${conflict || 'to be determined by the genre and setting'}
Character: ${characterName}, Level ${characterLevel}
Character hook: ${characterHook || 'a wanderer drawn into events by fate'}

Generate a complete campaign bible with unique world names, locations, factions, and an opening scene. Make it specific and evocative — not generic. Give the world a distinctive name.`;

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
        tools: [{
          type: 'function',
          function: {
            name: 'create_campaign_world',
            description: 'Create a structured campaign world bible for the DM',
            parameters: {
              type: 'object',
              properties: {
                world_name: {
                  type: 'string',
                  description: 'A unique, evocative name for this world or region (e.g. "The Shattered Reach", "Ashenveil")',
                },
                overview: {
                  type: 'string',
                  description: '2-3 sentence atmospheric description of the world — its feel, its dangers, its unique character. No bullet points.',
                },
                locations: {
                  type: 'array',
                  description: '3 named starting locations relevant to the setting',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string', description: '1-2 sentence evocative description' },
                      atmosphere: { type: 'string', description: 'One word or short phrase: e.g. "dangerous", "tense", "mysterious"' },
                    },
                    required: ['name', 'description', 'atmosphere'],
                  },
                },
                factions: {
                  type: 'array',
                  description: '2-3 active factions in this world',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      motivation: { type: 'string', description: 'What they want and why — 1 sentence' },
                      attitude_toward_player: { type: 'string', description: 'Their default stance toward a newcomer like the character — e.g. "Wary but willing to deal", "Openly hostile", "Potential recruiter"' },
                    },
                    required: ['name', 'motivation', 'attitude_toward_player'],
                  },
                },
                situation: {
                  type: 'string',
                  description: '2-3 sentences: what is happening RIGHT NOW in this world. The immediate crisis or tension the character walks into.',
                },
                character_hook: {
                  type: 'string',
                  description: '2-3 sentences explaining specifically how THIS character (with their stated hook) is connected to the world and its events. Make it personal.',
                },
                dm_instructions: {
                  type: 'string',
                  description: '3-5 bullet points of DM guidance: tone to maintain, themes to emphasize, what to avoid, pacing notes. Format as a simple list starting each item with a dash.',
                },
                opening_scene_seed: {
                  type: 'string',
                  description: 'A vivid 2-3 sentence opening scene that the DM should use to begin the first session. Set the stage, establish the atmosphere, and give the character something immediate to react to.',
                },
              },
              required: ['world_name', 'overview', 'locations', 'factions', 'situation', 'character_hook', 'dm_instructions', 'opening_scene_seed'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'create_campaign_world' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits required.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function?.name !== 'create_campaign_world') {
      return new Response(JSON.stringify({ error: 'No world data generated' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const world = JSON.parse(toolCall.function.arguments);

    // Format into a clean markdown document for the GM Guide
    const locationsMd = world.locations.map((l: any) =>
      `**${l.name}** *(${l.atmosphere})*\n${l.description}`
    ).join('\n\n');

    const factionsMd = world.factions.map((f: any) =>
      `**${f.name}**\nMotivation: ${f.motivation}\nAttitude: ${f.attitude_toward_player}`
    ).join('\n\n');

    const bible = `# ${world.world_name}

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
