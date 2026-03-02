import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GuideRequest {
  prompt: string;
  campaignSummary?: string;
  existingGuides?: Array<{ name: string; content: string }>;
  chatHistory?: Array<{ role: string; content: string }>;
  model?: string;
  user_api_key?: string;
}

const LOVABLE_MODELS = new Set([
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

const ANTHROPIC_MODELS: Record<string, string> = {
  'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
  'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6-20260219',
};

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

function buildSystemPrompt(
  campaignSummary?: string,
  existingGuides?: Array<{ name: string; content: string }>,
  chatHistory?: Array<{ role: string; content: string }>,
): string {
  let prompt = `You are a GM Guide generator for D&D 5e campaigns. Your job is to create structured, detailed GM reference guides in markdown format.

## PRIME DIRECTIVE
Follow the user's prompt EXACTLY. Create only what they ask for.
Do NOT expand the scope beyond the prompt. If they ask for a narration style guide, write a narration style guide — not a setting or scene guide. If they ask for house rules, write house rules — not an adventure module.

## OUTPUT FORMAT
- Start with a single # Title heading on the first line (this becomes the guide name)
- Use ## and ### headings to organize sections
- Write content that a DM can reference during play — be specific and actionable
- Keep output under 25,000 characters
- Do NOT include meta-commentary about the guide itself — just write the guide content directly

## GUIDE TYPES
Guides can cover ANY topic the user requests, including but not limited to:
narration style, prose tone, writing voice, house rules, pacing guidelines,
NPC behavior templates, combat style, setting details, encounter design,
faction politics, random tables, session zero frameworks, safety tools, etc.
Match the guide type to what the user asks for.

## QUALITY STANDARDS (apply only to relevant guide types)
- NPCs: names, motivations, personality traits, and plot hooks
- Locations: sensory descriptions and points of interest
- Encounters: tactical setup, enemy tactics, and possible outcomes
- Factions: goals, resources, and relationships
- Style/tone guides: clear examples of the desired voice, do's and don'ts, sample passages
- Rules guides: clear formatting, edge case rulings, quick-reference tables`;

  if (campaignSummary?.trim()) {
    prompt += `\n\n## CAMPAIGN CONTEXT (reference ONLY if relevant to the user's request)\nDo NOT force this into the guide. Only use it if the user's prompt relates to campaign-specific content.\n\n${campaignSummary.slice(0, 15000)}`;
  }

  if (chatHistory && chatHistory.length > 0) {
    const recentChat = chatHistory.slice(-10).map(m => `${m.role}: ${m.content.slice(0, 500)}`).join('\n');
    prompt += `\n\n## RECENT SESSION CONTEXT (reference ONLY if relevant to the user's request)\nDo NOT base the guide on this unless the prompt specifically calls for it.\n\n${recentChat}`;
  }

  if (existingGuides && existingGuides.length > 0) {
    const guideList = existingGuides.map(g => `### ${g.name}\n${g.content}`).join('\n\n---\n\n');
    prompt += `\n\n## EXISTING GUIDES (full content — reference or build upon ONLY if the user's prompt asks you to)\nDo NOT duplicate content from these guides. If the user asks to expand, complement, or riff on existing guides, use them as context.\n\n${guideList}`;
  }

  return prompt;
}

async function callAnthropicNonStreaming(
  anthropicModelId: string,
  systemPrompt: string,
  userPrompt: string,
  userApiKey?: string,
): Promise<string> {
  const ANTHROPIC_API_KEY = (typeof userApiKey === 'string' && userApiKey.trim())
    ? userApiKey.trim()
    : Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw { status: 500, message: "No Anthropic API key available. Add your key in Settings → API Keys." };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: anthropicModelId,
      max_tokens: 5000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", response.status, errorText);
    if (response.status === 429) throw { status: 429, message: "Rate limit exceeded. Please wait and try again." };
    if (response.status === 401) throw { status: 401, message: "Invalid Anthropic API key." };
    throw { status: 500, message: "Anthropic API error" };
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate
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

    const { prompt, campaignSummary, existingGuides, chatHistory, model, user_api_key } = (await req.json()) as GuideRequest;

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(campaignSummary, existingGuides, chatHistory);
    const userPrompt = prompt.trim();
    const requestedModel = model || DEFAULT_MODEL;
    const anthropicModelId = ANTHROPIC_MODELS[requestedModel];

    let guideContent: string;

    if (anthropicModelId) {
      try {
        guideContent = await callAnthropicNonStreaming(anthropicModelId, systemPrompt, userPrompt, user_api_key);
      } catch (e: any) {
        const status = e?.status || 500;
        const message = e?.message || "Anthropic error";
        return new Response(JSON.stringify({ error: message }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Lovable AI gateway (non-streaming)
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

      const gatewayModel = LOVABLE_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: gatewayModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 8000,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      guideContent = data.choices?.[0]?.message?.content ?? '';
    }

    // Extract suggested name from first heading
    const headingMatch = guideContent.match(/^#\s+(.+)/m);
    const suggestedName = headingMatch?.[1]?.trim().slice(0, 100) || prompt.slice(0, 60).trim();

    return new Response(JSON.stringify({ guide: guideContent, suggestedName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("guide-creator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
