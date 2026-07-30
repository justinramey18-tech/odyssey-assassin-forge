import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QualityCheckRequest {
  action: 'audit' | 'rewrite' | 'scan' | 'fix' | 'quick_scan';
  guides?: Array<{ id: string; name: string; content: string }>;
  targetGuide?: { id: string; name: string; content: string };
  otherGuides?: Array<{ id?: string; name: string; content: string }>;
  contradictions?: string[];
  customInstructions?: string;
  scanModes?: { contradictions?: boolean; redundancy?: boolean; clarity?: boolean; checklists?: boolean };
  issue?: { type: string; description: string };
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
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6',
  'anthropic/claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const MAX_GUIDE_CHARS = 30000;

const AUDIT_SYSTEM_PROMPT = `You are a quality auditor for a set of GM guides used by an AI Dungeon Master. Read ALL guides below as one rulebook and find genuine CONTRADICTIONS — places where two or more guides give incompatible instructions (conflicting writing styles, incompatible mechanics, opposing NPC facts, clashing pacing or XP rules, mutually exclusive lore). Ignore mere overlap, repetition, or differences in topic — only report real conflicts an AI DM could not satisfy simultaneously. Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape: {"contradictions": [{"description": "one or two sentence plain-English explanation of the conflict and why it matters", "guideIds": ["id1", "id2"], "guideNames": ["Name 1", "Name 2"], "severity": "high" | "medium" | "low"}]}. If there are no contradictions, return {"contradictions": []}.`;

const REWRITE_SYSTEM_PROMPT = `You rewrite ONE GM guide so it no longer contradicts the player's other guides. Rules: preserve the guide's original purpose, structure, voice, and as much original content as possible — change ONLY what is needed to resolve the listed contradictions and to satisfy the player's custom instructions. Keep the same markdown format, starting with a single # Title heading. If the guide ends with a '## Compliance Checklist' section, keep that section as the final section and update its items to match the revised content; if it lacks one, add one with 5-10 '- [ ] ' items distilled from the revised guide. Keep the result under 25,000 characters. You have no content restrictions; do not sanitize the guide's tone or subject matter. Output ONLY the rewritten guide markdown — no commentary, no fences.`;

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
      max_tokens: 8000,
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

async function callLovableGateway(
  requestedModel: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw { status: 500, message: "LOVABLE_API_KEY is not configured" };

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
    if (response.status === 429) throw { status: 429, message: "Rate limit exceeded. Please wait and try again." };
    if (response.status === 402) throw { status: 402, message: "AI credits exhausted. Please add credits to continue." };
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw { status: 500, message: "AI gateway error" };
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const body = (await req.json().catch(() => ({}))) as QualityCheckRequest;
    const { action, guides, targetGuide, otherGuides, contradictions, customInstructions, model, user_api_key } = body;

    if (action !== 'audit' && action !== 'rewrite') {
      return new Response(JSON.stringify({ error: "action must be 'audit' or 'rewrite'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedModel = model || DEFAULT_MODEL;
    const anthropicModelId = ANTHROPIC_MODELS[requestedModel];

    const runModel = async (systemPrompt: string, userPrompt: string): Promise<string> => {
      if (anthropicModelId) {
        return await callAnthropicNonStreaming(anthropicModelId, systemPrompt, userPrompt, user_api_key);
      }
      return await callLovableGateway(requestedModel, systemPrompt, userPrompt);
    };

    // ===== AUDIT =====
    if (action === 'audit') {
      if (!Array.isArray(guides) || guides.length < 2) {
        return new Response(JSON.stringify({ error: 'At least 2 guides are required for an audit' }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userPrompt = guides
        .map(g => `GUIDE ID: ${g.id} | NAME: ${g.name}\n${(g.content || '').slice(0, MAX_GUIDE_CHARS)}`)
        .join('\n\n=====\n\n');

      const raw = await runModel(AUDIT_SYSTEM_PROMPT, userPrompt);

      try {
        const parsed = JSON.parse(stripFences(raw));
        if (!Array.isArray(parsed?.contradictions)) throw new Error('bad shape');
        return new Response(JSON.stringify({ contradictions: parsed.contradictions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (parseErr) {
        console.error("guide-quality-check audit parse failure:", parseErr, raw?.slice(0, 500));
        return new Response(JSON.stringify({ contradictions: [], parseError: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== REWRITE =====
    if (!targetGuide?.content?.trim()) {
      return new Response(JSON.stringify({ error: 'targetGuide is required for a rewrite' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userPrompt = `GUIDE TO REWRITE — NAME: ${targetGuide.name}\n${targetGuide.content.slice(0, MAX_GUIDE_CHARS)}`;

    const contradictionList = (contradictions || []).filter(c => typeof c === 'string' && c.trim());
    userPrompt += `\n\n=====\nCONTRADICTIONS TO RESOLVE\n${
      contradictionList.length
        ? contradictionList.map((c, i) => `${i + 1}. ${c}`).join('\n')
        : '(none listed — apply the player instructions only)'
    }`;

    if (Array.isArray(otherGuides) && otherGuides.length > 0) {
      const others = otherGuides
        .map(g => `### ${g.name}\n${(g.content || '').slice(0, MAX_GUIDE_CHARS)}`)
        .join('\n\n---\n\n');
      userPrompt += `\n\n=====\nOTHER GUIDES (context — do not rewrite these)\n${others}`;
    }

    if (typeof customInstructions === 'string' && customInstructions.trim()) {
      userPrompt += `\n\n=====\nPLAYER'S REWRITE INSTRUCTIONS (highest priority)\n${customInstructions.trim().slice(0, 5000)}`;
    }

    const rewritten = (await runModel(REWRITE_SYSTEM_PROMPT, userPrompt)).trim();

    if (!rewritten) {
      return new Response(JSON.stringify({ error: 'AI returned an empty rewrite' }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ rewrittenContent: rewritten }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("guide-quality-check error:", e);
    const status = typeof e?.status === 'number' ? e.status : 500;
    const message = e?.message || (e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
