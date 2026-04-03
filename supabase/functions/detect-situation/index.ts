import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_SITUATIONS = [
  'combat', 'social', 'exploration', 'training', 'downtime', 'crisis',
  'flight', 'stealth', 'political', 'wardline', 'investigation', 'ritual',
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Missing required field: text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const truncatedText = text.slice(0, 2000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a D&D/Empyrean campaign situation classifier. Read the narrative text and classify the CURRENT situation into exactly ONE of these categories. Output ONLY the single lowercase word, nothing else.

Valid situations:
- combat: Active fighting, initiative, attacks landing, spells being cast, enemies engaging
- flight: On dragonback, aerial movement, flying, formation flying, aerial patrol, landing/takeoff in progress
- stealth: Sneaking, hiding, infiltration, covert movement, after curfew, eavesdropping, ambush setup
- political: Tribunal, council meeting, formal debate, chain of command confrontation, quadrant politics, leadership challenge
- wardline: Ward line patrol, ward defense, breach response, ward inspection, crossing beyond the ward line, ward repair
- investigation: Searching for clues, reading archives, tracking patterns, forensic analysis, interrogation, studying evidence
- ritual: Threshing ceremony, Conscription Day, funeral, bonding ceremony, promotion, formal oath, graduation
- social: Casual conversation, tavern talk, friendly interaction, relationship building, gossip
- training: Sparring, drill, practice, study session, classroom, instructor feedback
- exploration: Traveling, scouting new terrain, entering unknown area, mapping, discovering locations
- downtime: Resting, recovering, personal time, writing letters, reflection, sleeping
- crisis: Emergency, alarm, unexpected threat, urgent response needed, ward breach panic

Classify based on what is ACTIVELY HAPPENING at the END of the narrative, not what happened earlier. If a scene transitions from social to combat, output "combat". If riders are in the air, output "flight" even if they're heading to combat.

Output ONLY the single word. No punctuation, no explanation.`,
          },
          {
            role: "user",
            content: truncatedText,
          },
        ],
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content || "").trim().toLowerCase().replace(/[^a-z]/g, '');

    // Validate against allowed list, default to exploration
    const situation = VALID_SITUATIONS.includes(raw) ? raw : 'exploration';

    return new Response(
      JSON.stringify({ situation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("detect-situation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
