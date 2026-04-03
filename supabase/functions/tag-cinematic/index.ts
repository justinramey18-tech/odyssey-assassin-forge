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
            content: `You are a cinematic tag injector for a D&D/Empyrean dragon-rider campaign. The player experiences DM responses as a tap-to-advance slideshow with synchronized audio and visual effects.

Your job: Read the narrative text and return the EXACT same text, but with hidden HTML comment tags prepended to paragraphs that deserve sound effects, ambient audio, visual effects, or mood shifts.

AVAILABLE TAGS — use ONLY these exact values:

Sound Effects (one-shot, play once):
<!--SFX:dragon-roar--> <!--SFX:thunder--> <!--SFX:sword-clash--> <!--SFX:heartbeat-->
<!--SFX:signet-crackle--> <!--SFX:explosion--> <!--SFX:door-creak--> <!--SFX:crowd-gasp-->
<!--SFX:arrow-impact--> <!--SFX:ward-hum--> <!--SFX:bone-snap--> <!--SFX:fire-whoosh-->
<!--SFX:horse-gallop--> <!--SFX:bell-toll--> <!--SFX:whisper-->

Ambience (looping background, persists until changed):
<!--AMBIENCE:rain--> <!--AMBIENCE:wind--> <!--AMBIENCE:tavern--> <!--AMBIENCE:forest-->
<!--AMBIENCE:combat-drums--> <!--AMBIENCE:tension-drone--> <!--AMBIENCE:silence-->
<!--AMBIENCE:campfire--> <!--AMBIENCE:dungeon--> <!--AMBIENCE:crowd--> <!--AMBIENCE:flying-->

Visual Effects (combine with + for multiple):
<!--VFX:screen-shake--> <!--VFX:rain--> <!--VFX:embers--> <!--VFX:lightning-->
<!--VFX:ground-pulse--> <!--VFX:fade-to-black--> <!--VFX:flash-white-->
<!--VFX:frost--> <!--VFX:blood-vignette--> <!--VFX:gold-particles-->
Multiple VFX example: <!--VFX:screen-shake+embers-->

Mood (subtle background color shift):
<!--MOOD:dark--> <!--MOOD:warm--> <!--MOOD:cold--> <!--MOOD:danger-->
<!--MOOD:triumph--> <!--MOOD:grief--> <!--MOOD:neutral-->

RULES — READ CAREFULLY:

1. PRESERVE THE TEXT EXACTLY. Do not rewrite, edit, shorten, or rephrase any narrative text. Return every word unchanged. You are ONLY adding tags.

2. Place tags on the line BEFORE the paragraph they affect, or at the START of the paragraph on the same line.

3. The FIRST paragraph MUST get an AMBIENCE tag and a MOOD tag to set the opening atmosphere. Default to wind + neutral if nothing else fits.

4. Do NOT add SFX to the first paragraph. Let the opening breathe.

5. AMBIENCE persists — only emit a new AMBIENCE tag when the environment genuinely changes. Don't repeat the same ambience on every paragraph.

6. MOOD persists — only emit a new MOOD tag when the emotional tone shifts.

7. SFX must match LITERAL SOUNDS actively happening in the narrative. A dragon roaring = dragon-roar. A dragon being mentioned or remembered = no SFX. A sword being drawn or swung = sword-clash. A sword hanging on a wall = no SFX.

8. VFX are for HIGH-IMPACT visual moments: a dragon landing (screen-shake), fire erupting (embers), lightning striking (lightning), taking damage (blood-vignette), magic activating (gold-particles). NOT for every paragraph.

9. Stack tags for big moments: a dragon crashing down in flames might get SFX:dragon-roar + VFX:screen-shake+embers + MOOD:danger all on the same paragraph.

10. SILENCE is powerful. Use AMBIENCE:silence deliberately when sound stops — before a revelation, entering a dead zone, a moment of dread.

11. Dialogue paragraphs (starting with a quote or containing mostly speech) should get lighter treatment — maybe a mood shift but rarely SFX unless the dialogue itself describes a sound happening.

12. A typical 8-10 paragraph response should have roughly 4-8 total tags. Not every paragraph needs a tag. Restraint creates impact.

13. NEVER add any text, commentary, explanation, or markdown. Return ONLY the tagged narrative text.

14. Do NOT use any HTML tags like <span>, <em>, <strong>. Only the comment-style cinematic tags listed above.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    if (!response.ok) {
      // On failure, return original text untagged so slideshow still works
      return new Response(
        JSON.stringify({ taggedText: text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const taggedText = data.choices?.[0]?.message?.content?.trim() || text;

    return new Response(
      JSON.stringify({ taggedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("tag-cinematic error:", error);
    // On any error, return original text untagged
    return new Response(
      JSON.stringify({ taggedText: text }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
