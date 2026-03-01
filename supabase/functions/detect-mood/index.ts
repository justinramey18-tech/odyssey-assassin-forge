import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, presets } = await req.json();
    if (!text || !presets?.length) {
      return new Response(JSON.stringify({ preset_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const presetList = presets.map((p: { id: string; label: string }) => `- ${p.id}: ${p.label}`).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a mood classifier for a D&D/TTRPG game. Given narrative text from a Dungeon Master, determine which music mood preset best fits the scene. Respond ONLY with the preset_id. If no preset clearly fits, respond with "none".

Available presets:
${presetList}`
          },
          { role: "user", content: text.slice(0, 2000) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_mood",
              description: "Classify the narrative mood into one of the available presets",
              parameters: {
                type: "object",
                properties: {
                  preset_id: {
                    type: "string",
                    description: "The ID of the best matching mood preset, or 'none' if no preset fits",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score from 0 to 1",
                  },
                },
                required: ["preset_id", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_mood" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ preset_id: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const presetId = args.preset_id;
        const confidence = args.confidence ?? 0;

        // Only return a match if confidence is reasonable and it's a valid preset
        if (presetId && presetId !== "none" && confidence >= 0.3) {
          const validIds = new Set(presets.map((p: { id: string }) => p.id));
          if (validIds.has(presetId)) {
            return new Response(JSON.stringify({ preset_id: presetId, confidence }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch {
        // parse error, fall through
      }
    }

    return new Response(JSON.stringify({ preset_id: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-mood error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
