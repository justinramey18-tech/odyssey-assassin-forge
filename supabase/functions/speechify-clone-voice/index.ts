import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();

    const apiKey = (formData.get("user_api_key") as string)?.trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No Speechify API key provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const name = (formData.get("name") as string)?.trim();
    if (!name) {
      return new Response(
        JSON.stringify({ error: "Voice name is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sample = formData.get("sample") as File | null;
    if (!sample) {
      return new Response(
        JSON.stringify({ error: "Audio sample is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const consent = formData.get("consent") as string;
    if (!consent) {
      return new Response(
        JSON.stringify({ error: "Consent confirmation is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build multipart form for Speechify API
    const speechifyForm = new FormData();
    speechifyForm.append("name", name);
    speechifyForm.append("consent", consent);
    speechifyForm.append("sample", sample, sample.name || "recording.wav");

    const gender = formData.get("gender") as string;
    if (gender) speechifyForm.append("gender", gender);

    const locale = formData.get("locale") as string;
    if (locale) speechifyForm.append("locale", locale);

    console.log(`Cloning voice: name="${name}", sample size=${sample.size}`);

    const response = await fetch("https://api.sws.speechify.com/v1/voices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: speechifyForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Speechify clone error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Speechify API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("Voice cloned successfully:", result.id ?? result.voice_id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Clone voice error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
