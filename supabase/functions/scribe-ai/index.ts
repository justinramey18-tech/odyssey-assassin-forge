import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body FIRST so we can check for user_api_key before enforcing auth
    const {
      text, style, intensity, customPrompt, model, user_api_key,
      processingMode, targetMultiplier, campaignSummary, storyContext, characterCards, protagonistCards,
    } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasUserKey = typeof user_api_key === 'string' && user_api_key.trim().length > 0;

    // Only enforce JWT auth when the user is NOT providing their own key
    // (i.e. they want to use our backend secret)
    if (!hasUserKey) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized – sign in or add your own Anthropic API key in Settings." }), {
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
        return new Response(JSON.stringify({ error: "Unauthorized – sign in or add your own Anthropic API key in Settings." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Resolve API key: user-provided takes priority, then backend secret
    const ANTHROPIC_API_KEY = hasUserKey
      ? user_api_key.trim()
      : Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "No Anthropic API key available. Add your key in Settings → API Keys, or configure the backend secret." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const intensityLabel = ["subtle", "mild", "moderate", "strong", "dramatic"][
      Math.max(0, Math.min(4, (intensity || 3) - 1))
    ];

    const multiplier = typeof targetMultiplier === 'number' ? targetMultiplier : 1.5;
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
TARGET LENGTH: Aim for approximately ${multiplier}x the original word count.

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
TARGET LENGTH: Aim for approximately ${multiplier}x the original word count.

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

    const modelMap: Record<string, string> = {
      'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
      'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
      'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6-20260210',
    };
    const anthropicModel = (model && modelMap[model]) || 'claude-sonnet-4-5-20250929';

    const userMessage = isEnhance
      ? `Enhance this prose with rich descriptive detail while preserving every original word:\n\n${text.slice(0, 200000)}`
      : `Transform this TTRPG chat log into ${styleDesc} narrative:\n\n${text.slice(0, 200000)}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid Anthropic API key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const outputText = result.content?.[0]?.text || "";
    const usage = result.usage ?? {};

    return new Response(JSON.stringify({
      text: outputText,
      usage: {
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scribe-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
