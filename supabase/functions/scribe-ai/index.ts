import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Abort timeout - must be well below the 150s platform limit
const ANTHROPIC_TIMEOUT_MS = 120_000;
const MAX_INPUT_CHARS = 200_000;

interface CharacterCardInput {
  name: string;
  raceClass?: string;
  personality: string;
  speechStyle: string;
}

interface ProtagonistCardInput {
  name: string;
  raceClass?: string;
  personality: string;
  speechStyle: string;
  povStyle: 'first' | 'third' | 'rotating';
  backstory?: string;
  goalsConflicts?: string;
  relationships?: string;
  appearanceMannerisms?: string;
  flawsWeaknesses?: string;
  skillsAbilities?: string;
  characterArc?: string;
}

function buildContextBlocks(
  campaignSummary?: string,
  storyContext?: string,
  characterCards?: CharacterCardInput[],
  protagonistCards?: ProtagonistCardInput[],
): string {
  let blocks = '';

  if (campaignSummary && campaignSummary.length > 0) {
    blocks += `\nCAMPAIGN REFERENCE (ENFORCE CONSISTENCY):
${campaignSummary}
You MUST maintain strict consistency with the above. Character names, relationships, locations, world rules must match. Do not contradict established facts.\n`;
  }

  if (storyContext && storyContext.length > 0) {
    blocks += `\nPRECEDING NARRATIVE (match voice, tone, plot continuity, character speech patterns):
${storyContext}\n`;
  }

  // Protagonist profiles (high priority)
  if (protagonistCards && protagonistCards.length > 0) {
    const protagLines = protagonistCards.map(p => {
      const rc = p.raceClass ? ` (${p.raceClass})` : '';
      const povLabel = p.povStyle === 'first' ? 'First Person' : p.povStyle === 'rotating' ? 'Rotating' : 'Third Person Close';
      let entry = `[${p.name}${rc}] -- POV: ${povLabel}\nPersonality: ${p.personality}\nSpeech Style: ${p.speechStyle}`;
      if (p.backstory) entry += `\nBackstory: ${p.backstory}`;
      if (p.goalsConflicts) entry += `\nGoals & Conflicts: ${p.goalsConflicts}`;
      if (p.relationships) entry += `\nRelationships: ${p.relationships}`;
      if (p.appearanceMannerisms) entry += `\nAppearance & Mannerisms: ${p.appearanceMannerisms}`;
      if (p.flawsWeaknesses) entry += `\nFlaws & Weaknesses: ${p.flawsWeaknesses}`;
      if (p.skillsAbilities) entry += `\nSkills & Abilities: ${p.skillsAbilities}`;
      if (p.characterArc) entry += `\nCharacter Arc: ${p.characterArc}`;
      return entry;
    }).join('\n\n');

    const povDirectives: string[] = [];
    const povStyles = new Set(protagonistCards.map(p => p.povStyle));
    if (povStyles.has('first')) povDirectives.push('- Write from the first-person POV of the protagonist');
    if (povStyles.has('third')) povDirectives.push('- Write in tight third-person POV, revealing the protagonist\'s inner thoughts');
    if (povStyles.has('rotating')) povDirectives.push('- When using Rotating POV, shift perspective between scenes');
    povDirectives.push('- Include inner monologue revealing thoughts and emotional reactions');
    povDirectives.push('- Protagonist details take priority over supporting cast');

    blocks += `\nPROTAGONIST PROFILES (PRIMARY CHARACTERS -- prioritize in narration):

${protagLines}

NARRATION DIRECTIVES:
${povDirectives.join('\n')}\n`;
  }

  if (characterCards && characterCards.length > 0) {
    const lines = characterCards.map(c => {
      const rc = c.raceClass ? ` (${c.raceClass})` : '';
      return `- ${c.name}${rc}: ${c.personality}. Speech style: ${c.speechStyle}`;
    });
    blocks += `\nCHARACTER PROFILES (use for dialogue voice and consistency):
${lines.join('\n')}\n`;
  }

  return blocks;
}

// Validated model map — only real Anthropic model IDs
const VALID_MODELS: Record<string, string> = {
  'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
  'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6-20260210',
};
const FALLBACK_MODEL_ID = 'claude-sonnet-4-5-20250929';

/** Dynamic max_tokens: capped at 4096 for reliable sub-120s completion.
 *  Claude Sonnet generates ~50-80 tok/s; 4096 tokens ≈ 50-80s. */
function getMaxTokens(_inputCharCount: number): number {
  return 5000;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      text, style, intensity, customPrompt, model, user_api_key, user_openai_key,
      processingMode, campaignSummary, storyContext, characterCards, protagonistCards,
    } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "No text provided", code: "no_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate total context size
    const contextSizes = {
      text: text.length,
      campaignSummary: (campaignSummary || '').length,
      storyContext: (storyContext || '').length,
      characterCards: JSON.stringify(characterCards || []).length,
      protagonistCards: JSON.stringify(protagonistCards || []).length,
    };
    const totalInputChars = Object.values(contextSizes).reduce((a, b) => a + b, 0);

    console.log(`[scribe-ai] Request: text=${contextSizes.text}, summary=${contextSizes.campaignSummary}, story=${contextSizes.storyContext}, cards=${contextSizes.characterCards + contextSizes.protagonistCards}, total=${totalInputChars}, model=${model || 'default'}, hasUserKey=${!!(user_api_key && user_api_key.trim())}`);

    if (totalInputChars > MAX_INPUT_CHARS) {
      return new Response(JSON.stringify({
        error: `Total context (${totalInputChars.toLocaleString()} chars) exceeds the ${MAX_INPUT_CHARS.toLocaleString()} character limit. Reduce your input or context.`,
        code: "context_too_large",
        counts: contextSizes,
        total: totalInputChars,
        limit: MAX_INPUT_CHARS,
      }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasUserKey = typeof user_api_key === 'string' && user_api_key.trim().length > 0;
    const hasOpenAIKey = typeof user_openai_key === 'string' && user_openai_key.trim().length > 0;
    const useOpenAI = hasOpenAIKey && !hasUserKey; // OpenAI only if no Anthropic key provided

    if (!hasUserKey && !hasOpenAIKey) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized – sign in or add your own API key in Settings.", code: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { error: claimsError } = await supabaseClient.auth.getClaims(token);
      if (claimsError) {
        return new Response(JSON.stringify({ error: "Unauthorized – sign in or add your own API key in Settings.", code: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const ANTHROPIC_API_KEY = hasUserKey
      ? user_api_key.trim()
      : Deno.env.get("ANTHROPIC_API_KEY");

    if (!useOpenAI && !ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "No API key available. Add your key in Settings → API Keys, or configure the backend secret.", code: "no_api_key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const intensityLabel = ["subtle", "mild", "moderate", "strong", "dramatic"][
      Math.max(0, Math.min(4, (intensity || 3) - 1))
    ];

    const isEnhance = processingMode === 'enhance';

    const styleDescriptions: Record<string, string> = {
      fantasy: "epic high-fantasy prose with vivid imagery",
      noir: "dark, gritty detective noir style",
      literary: "elegant, refined literary prose",
      action: "fast-paced, punchy action writing",
      salvatore: "R.A. Salvatore-inspired warrior poetry with detailed blade techniques",
      deadpool: "fourth-wall-breaking irreverent humor à la Deadpool",
      dark_comedy: "gallows humor with sardonic wit",
      subtle_absurdity: "Kafkaesque deadpan absurdity",
      lovecraftian: "cosmic dread and sanity-eroding horror in the style of Lovecraft",
      gonzo: "gonzo journalism in the style of Hunter S. Thompson",
      hemingway: "brutal minimalism in the style of Hemingway",
      custom: customPrompt || "transform into polished narrative prose",
    };

    const styleDesc = styleDescriptions[style] || styleDescriptions.fantasy;
    const contextBlocks = buildContextBlocks(campaignSummary, storyContext, characterCards, protagonistCards);

    let systemPrompt: string;

    if (isEnhance) {
      systemPrompt = `You are a masterful narrative embellisher.
ENHANCE existing prose by adding descriptive detail, atmosphere, and sensory language AROUND the original text.

STYLE: ${styleDesc}

CRITICAL RULES:
- PRESERVE every original sentence, paragraph, and piece of dialogue VERBATIM
- Do NOT rewrite, rephrase, or reorganize existing text
- Do NOT continue the story beyond what is written
- Do NOT remove any content from the original
- ALL original dialogue must remain word-for-word unchanged
- You MAY add new dialogue that is logical within the scene context, consistent with established character voices
- ADD descriptive prose BETWEEN existing paragraphs: sensory details, atmosphere, emotional beats, environmental descriptions
- PRESERVE all **bold** and *italic* markdown formatting in the original
- Maintain the author's voice and tone
- Output ONLY the enhanced text, no commentary or meta-text
${contextBlocks}`;
    } else {
      systemPrompt = `You are a masterful narrative writer specializing in TTRPG session logs.
Your task: Transform raw TTRPG chat logs into polished narrative prose.

STYLE: ${styleDesc}
INTENSITY: ${intensityLabel} — ${
        intensityLabel === "subtle"
          ? "light touches, preserve original feel"
          : intensityLabel === "mild"
          ? "gentle enhancements"
          : intensityLabel === "moderate"
          ? "balanced transformation"
          : intensityLabel === "strong"
          ? "bold stylization"
           : "maximum style intensity, fully commit to the genre"
       }

RULES:
- Remove dice rolls, stat blocks, and game mechanics
- Convert game actions into narrative prose
- Preserve character names, locations, and key plot points
- Maintain chronological order of events
- Do NOT add events that didn't happen in the original
- PRESERVE all **bold** and *italic* markdown formatting
- Output ONLY the narrative text, no commentary or meta-text
${contextBlocks}`;
    }

    // Validate model ID — fallback to known-good if stale/invalid
    const resolvedModel = (model && VALID_MODELS[model]) || FALLBACK_MODEL_ID;
    const modelFallback = model && !VALID_MODELS[model] ? true : false;
    if (modelFallback) {
      console.log(`[scribe-ai] Model fallback: requested="${model}", using="${resolvedModel}"`);
    }

    // Budget-aware text slicing: subtract context from limit
    const contextChars = contextBlocks.length + systemPrompt.length;
    const textBudget = Math.max(10_000, MAX_INPUT_CHARS - contextChars);
    const slicedText = text.slice(0, textBudget);

    const userMessage = isEnhance
      ? `Enhance this prose with rich descriptive detail while preserving every original word. You must complete the entire enhancement in this single response without truncation. Be efficient with your additions—prioritize covering the full text from start to finish over elaborate embellishments in any one section. If the text is substantial, use concise sensory details and compact atmospheric additions to ensure you reach the end.\n\n${slicedText}`
      : `Transform this TTRPG snippet into ${styleDesc} prose narrative. You must complete the entire transformation in this single response without truncation. Be concise and efficient—use tight, vivid prose that captures the essence of each moment without elaborate flourishes. Prioritize covering all events, dialogue, and actions from start to finish over detailed descriptions. If the snippet is substantial, use shorter sentences and compact phrasing to ensure you reach the end.\n\n${slicedText}`;

    const maxTokens = getMaxTokens(slicedText.length);

    // ── OpenAI direct path ──
    if (useOpenAI) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${user_openai_key!.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-5",
            max_tokens: maxTokens,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          }),
          signal: controller.signal,
        });
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
          return new Response(JSON.stringify({ error: `Request timed out after ${Math.round(elapsed / 1000)}s.`, code: "request_timeout", elapsed_ms: elapsed }), {
            status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }

      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[scribe-ai] OpenAI error: ${response.status} (${elapsed}ms)`, errText);
        if (response.status === 401) {
          return new Response(JSON.stringify({ error: "Invalid OpenAI API key.", code: "invalid_api_key" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "OpenAI rate limit hit.", code: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: `AI processing failed (status ${response.status})`, code: "upstream_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await response.json();
      const outputText = result.choices?.[0]?.message?.content || "";
      const usage = result.usage ?? {};

      console.log(`[scribe-ai] OpenAI success: ${elapsed}ms, in=${usage.prompt_tokens || '?'}, out=${usage.completion_tokens || '?'}`);

      return new Response(JSON.stringify({
        text: outputText,
        usage: { input_tokens: usage.prompt_tokens ?? 0, output_tokens: usage.completion_tokens ?? 0 },
        meta: { elapsed_ms: elapsed, model_used: 'gpt-5', model_fallback: false, max_tokens: maxTokens, text_chars_sent: slicedText.length },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Anthropic path ──
    // Abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: resolvedModel,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [
            { role: "user", content: userMessage },
          ],
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      // Check if it was our abort
      if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
        console.error(`[scribe-ai] Timeout after ${elapsed}ms`);
        return new Response(JSON.stringify({
          error: `Request timed out after ${Math.round(elapsed / 1000)}s. Try reducing your input size or context.`,
          code: "request_timeout",
          elapsed_ms: elapsed,
        }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[scribe-ai] Anthropic error: ${response.status} (${elapsed}ms)`, errText);

      if (response.status === 401) {
        return new Response(
          JSON.stringify({
            error: "Invalid Anthropic API key. Please re-save your key in Settings → API Keys.",
            code: "invalid_api_key",
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Anthropic rate limit hit. Wait a moment and try again.",
            code: "rate_limited",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 529) {
        return new Response(
          JSON.stringify({
            error: "Anthropic API is temporarily overloaded. Please try again in a few minutes.",
            code: "api_overloaded",
          }),
          { status: 529, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          error: `AI processing failed (status ${response.status})`,
          code: "upstream_error",
          upstream_status: response.status,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const outputText = result.content?.[0]?.text || "";
    const usage = result.usage ?? {};

    console.log(`[scribe-ai] Success: ${elapsed}ms, in=${usage.input_tokens || '?'}, out=${usage.output_tokens || '?'}`);

    return new Response(JSON.stringify({
      text: outputText,
      usage: {
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
      },
      meta: {
        elapsed_ms: elapsed,
        model_used: resolvedModel,
        model_fallback: modelFallback,
        max_tokens: maxTokens,
        text_chars_sent: slicedText.length,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const elapsed = Date.now() - startTime;
    console.error(`[scribe-ai] Unhandled error (${elapsed}ms):`, e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
        code: "internal_error",
        elapsed_ms: elapsed,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
