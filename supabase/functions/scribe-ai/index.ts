import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, style, intensity, customPrompt } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured. Add it in backend secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const intensityLabel = ["subtle", "mild", "moderate", "strong", "dramatic"][
      Math.max(0, Math.min(4, (intensity || 3) - 1))
    ];

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

    const systemPrompt = `You are a masterful narrative writer specializing in TTRPG session logs.
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
- Output ONLY the narrative text, no commentary or meta-text`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Transform this TTRPG chat log into ${styleDesc} narrative:\n\n${text.slice(0, 60000)}`,
          },
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

    return new Response(JSON.stringify({ text: outputText }), {
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
