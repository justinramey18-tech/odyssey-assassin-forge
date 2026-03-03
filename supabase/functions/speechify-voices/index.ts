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
    const { user_api_key } = await req.json();

    if (!user_api_key || typeof user_api_key !== "string" || !user_api_key.trim()) {
      return new Response(
        JSON.stringify({ error: "Speechify API key is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = user_api_key.trim();

    const response = await fetch("https://api.sws.speechify.com/v1/voices", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Speechify voices error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Speechify API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Speechify raw response keys:", Object.keys(data));
    console.log("Speechify raw response (first 2000 chars):", JSON.stringify(data).slice(0, 2000));

    // Normalise – the API may return an array directly or wrapped in { voices: [] }
    const rawVoices: any[] = Array.isArray(data) ? data : data.voices ?? [];
    console.log("Total voices found:", rawVoices.length);
    
    // Log first voice to understand shape
    if (rawVoices.length > 0) {
      console.log("Sample voice keys:", Object.keys(rawVoices[0]));
      console.log("Sample voice:", JSON.stringify(rawVoices[0]).slice(0, 500));
    }
    
    // Log any that look cloned
    const clonedRaw = rawVoices.filter((v: any) => 
      v.type === 'personal' || v.type === 'cloned' || v.type === 'custom' ||
      v.category === 'personal' || v.category === 'cloned' || v.category === 'custom' ||
      v.is_custom || v.is_cloned || v.is_personal
    );
    console.log("Cloned/personal voices found:", clonedRaw.length, clonedRaw.map((v: any) => ({ id: v.id, name: v.display_name ?? v.name, type: v.type, category: v.category })));

    const voices = rawVoices.map((v: any) => ({
      id: v.id ?? v.voice_id ?? "",
      name: v.display_name ?? v.name ?? "Unnamed",
      type: v.type ?? v.category ?? "default",
    }));

    return new Response(JSON.stringify({ voices }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Speechify voices function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
