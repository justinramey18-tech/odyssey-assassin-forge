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
    const { text, voice_id, user_api_key, audio_format } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Missing required field: text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = (typeof user_api_key === "string" && user_api_key.trim())
      ? user_api_key.trim()
      : null;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No Speechify API key provided. Add your key in Settings → API Keys." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use streaming endpoint for lower latency
    const response = await fetch(
      "https://api.sws.speechify.com/v1/audio/stream",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          voice_id: voice_id || "george",
          audio_format: audio_format || "mp3",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Speechify TTS error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Speechify API error: ${response.status}` }),
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
    console.error("Speechify TTS function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
