import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, user_api_key, voice_settings, previous_text, next_text } = await req.json();

    if (!text || !voiceId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: text, voiceId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tiered API key resolution: user key first, then backend secret
    const apiKey = (typeof user_api_key === "string" && user_api_key.trim())
      ? user_api_key.trim()
      : Deno.env.get("ELEVENLABS_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No ElevenLabs API key available. Add your key in Settings → API Keys." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use streaming endpoint for lower latency
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: voice_settings?.stability ?? 0.6,
            similarity_boost: voice_settings?.similarity_boost ?? 0.75,
            style: voice_settings?.style ?? 0.3,
            use_speaker_boost: voice_settings?.use_speaker_boost ?? true,
          },
          // Request stitching context for multi-chunk narration
          ...(previous_text ? { previous_text } : {}),
          ...(next_text ? { next_text } : {}),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs TTS error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `ElevenLabs API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream audio binary directly back to client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("ElevenLabs TTS function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
