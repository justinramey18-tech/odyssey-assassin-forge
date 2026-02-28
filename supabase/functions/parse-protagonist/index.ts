import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text, user_api_key } = await req.json();
    if (!text || typeof text !== 'string' || text.length < 10) {
      return new Response(JSON.stringify({ error: 'Provide at least 10 characters of character description' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a character profile extractor for fantasy/TTRPG characters.
Extract structured protagonist information from the user's text. Fill in as many fields as possible from the description. Leave fields empty string if the text doesn't mention them.`;

    const openaiTools = [{
      type: 'function' as const,
      function: {
        name: 'create_protagonist',
        description: 'Create a structured protagonist profile from text description.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Character name' },
            raceClass: { type: 'string', description: 'Race and class, e.g. "Half-Elf Warlock"' },
            personality: { type: 'string', description: 'Core personality traits, 1-2 sentences' },
            speechStyle: { type: 'string', description: 'How they speak — accent, vocabulary, cadence' },
            povStyle: { type: 'string', enum: ['first', 'third', 'rotating'], description: 'Recommended narrative POV' },
            backstory: { type: 'string', description: 'Character history and origin' },
            goalsConflicts: { type: 'string', description: 'Current goals and internal/external conflicts' },
            relationships: { type: 'string', description: 'Key relationships with other characters' },
            appearanceMannerisms: { type: 'string', description: 'Physical appearance and habitual mannerisms' },
            flawsWeaknesses: { type: 'string', description: 'Character flaws and vulnerabilities' },
            skillsAbilities: { type: 'string', description: 'Notable skills, abilities, or powers' },
            characterArc: { type: 'string', description: 'Expected character development or arc' },
          },
          required: ['name', 'personality', 'speechStyle', 'povStyle'],
          additionalProperties: false,
        },
      },
    }];

    // Anthropic path
    if (user_api_key && typeof user_api_key === 'string' && user_api_key.trim()) {
      const { callAnthropicNonStreaming } = await import("../_shared/anthropic-helper.ts");
      const result = await callAnthropicNonStreaming({
        userApiKey: user_api_key.trim(),
        systemPrompt,
        messages: [{ role: "user", content: `Extract protagonist details from this description:\n\n${text.slice(0, 10000)}` }],
        tools: openaiTools,
        toolChoice: 'create_protagonist',
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!result.toolArguments) {
        return new Response(JSON.stringify({ error: 'AI did not return structured data' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ protagonist: result.toolArguments }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract protagonist details from this description:\n\n${text.slice(0, 10000)}` },
        ],
        tools: openaiTools,
        tool_choice: { type: 'function', function: { name: 'create_protagonist' } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI Gateway error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits in Settings.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI parsing failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: 'AI did not return structured data' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ protagonist: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('parse-protagonist error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
