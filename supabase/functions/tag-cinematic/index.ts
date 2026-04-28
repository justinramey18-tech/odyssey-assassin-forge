import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SFX_VALUES = [
  'dragon-roar', 'thunder', 'sword-clash', 'heartbeat',
  'signet-crackle', 'explosion', 'door-creak', 'crowd-gasp',
  'arrow-impact', 'ward-hum', 'bone-snap', 'fire-whoosh',
  'horse-gallop', 'bell-toll', 'whisper',
];

const AMBIENCE_VALUES = [
  'rain', 'wind', 'tavern', 'forest',
  'combat-drums', 'tension-drone', 'silence',
  'campfire', 'dungeon', 'crowd', 'flying',
];

const VFX_VALUES = [
  'screen-shake', 'rain', 'embers', 'lightning',
  'ground-pulse', 'fade-to-black', 'flash-white',
  'frost', 'blood-vignette', 'gold-particles',
];

const MOOD_VALUES = [
  'dark', 'warm', 'cold', 'danger',
  'triumph', 'grief', 'neutral',
];

const BEAT_TOOL = {
  type: "function" as const,
  function: {
    name: "build_cinematic_beats",
    description:
      "Distill the DM narrative into an odd number (3, 5, or 7) of short cinematic beats with tags.",
    parameters: {
      type: "object",
      properties: {
        beats: {
          type: "array",
          minItems: 3,
          maxItems: 7,
          description:
            "Array of beats. Length MUST be exactly 3, 5, or 7. The middle index is the peak (intensity 5). Beats before it are setup; beats after are consequence.",
          items: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description:
                  "1-2 short sentences. STRICTLY ≤30 words. Rewrite the moment in your own punchy voice — do not paste from the original.",
              },
              intensity: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                description:
                  "1-5 scale. The middle beat is always 5. Setup beats ramp up (e.g. 2, 3, 4 for a 7-beat scene). Consequence beats ramp down.",
              },
              sfx: {
                type: "array",
                items: { type: "string", enum: SFX_VALUES },
                description: "0-2 SFX tags. The peak beat (intensity 5) gets the primary SFX. Other beats sparingly.",
              },
              ambience: {
                type: "string",
                enum: ['', ...AMBIENCE_VALUES],
                description: "Optional ambience for this beat. Empty string for no change. Persistent across beats — only set when atmosphere changes.",
              },
              vfx: {
                type: "array",
                items: { type: "string", enum: VFX_VALUES },
                description: "0-2 VFX tags. The peak beat (intensity 5) gets the heaviest VFX (e.g. screen-shake, lightning). Setup/consequence beats use lighter VFX or none.",
              },
              mood: {
                type: "string",
                enum: ['', ...MOOD_VALUES],
                description: "Optional mood color shift. Empty string for no change. Persistent — only emit when emotional tone shifts.",
              },
            },
            required: ["text", "intensity", "sfx", "ambience", "vfx", "mood"],
            additionalProperties: false,
          },
        },
      },
      required: ["beats"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `You are a cinematic distiller for a Fourth Wing-themed TTRPG. The DM has just produced a narrative response. You will return an array of short, punchy beats that the player will tap through one at a time.

## YOUR JOB

Read the DM's narrative. Identify the PEAK MOMENT — the climax of the action, the line that lands hardest, the visual that defines the scene. That's your center beat (intensity 5). Surround it with setup beats (ramping up to the peak) and consequence beats (ramping down).

## STRUCTURE

The number of beats MUST be exactly 3, 5, or 7. Pick based on scene length:
- 3 beats: short scenes — brief NPC exchanges, single quick actions, simple beats. Pattern: [setup, PEAK, consequence].
- 5 beats: medium scenes — full encounters, dialogue exchanges with stakes, tactical moments. Pattern: [setup, setup, PEAK, consequence, consequence].
- 7 beats: long scenes — multi-phase combat, big reveals, climactic confrontations. Pattern: [setup, setup, setup, PEAK, consequence, consequence, consequence].

ALWAYS odd. ALWAYS one peak in the middle. NEVER 4, 6, or 8 beats.

## BEAT TEXT

Rewrite each moment in your own voice. Distilled, punchy, cinematic. Maximum 30 words per beat — count strictly. Aim for 10-25 words. Do NOT paste sentences verbatim from the DM's text. Do NOT include narrative throat-clearing ("As you stand there, you notice…"). Get to the image.

Examples of good beat text:
- "The mess hall freezes. Forty cadets watching. Vane's hand drifts toward his hilt — patient, deadly."
- "You meet his gaze. Don't blink. Don't look down."
- "Rhiannon's hand finds yours under the table. *You made an enemy.*"

Examples of BAD beat text:
- "As Vane approaches, you can feel the tension in the room rising as everyone watches the exchange unfold." (too narrative, throat-clearing)
- The original sentence pasted in (verbatim quoting is wrong — rewrite in your voice)
- A 35-word sentence (over the limit)

## INTENSITY

1 = quiet aftermath, breathing
2 = setup, slow build, atmosphere
3 = stakes rising, tension building
4 = pre-peak crescendo, action launching
5 = THE peak — climax, biggest visual, primary SFX (always exactly one beat at this level, in the middle)

For 5 beats the pattern is intensity 2, 3, 5, 3, 2.
For 3 beats: 3, 5, 3.
For 7 beats: 2, 3, 4, 5, 4, 3, 2.

## TAGS

Use ONLY values from these lists. Do NOT invent new ones.

SFX (one-shot sounds): ${SFX_VALUES.join(', ')}
AMBIENCE (background loops): ${AMBIENCE_VALUES.join(', ')}
VFX (visual effects): ${VFX_VALUES.join(', ')}
MOOD (color shift): ${MOOD_VALUES.join(', ')}

## TAG GUIDELINES

- The PEAK beat (intensity 5) gets the HEAVIEST treatment: the primary SFX (e.g. dragon-roar, sword-clash, thunder) AND a strong VFX (e.g. screen-shake, lightning, embers, flash-white). Stack tags for impact.
- Setup beats use sparse tags. Empty arrays are fine. A subtle ambience or mood is enough.
- Consequence beats use lighter tags. The aftermath should feel quieter — heartbeat, silence ambience, slow fade.
- AMBIENCE persists. Only set it when the environment GENUINELY changes. Use empty string '' to mean "no change from previous beat."
- MOOD persists. Same rule. Use '' for no change.
- SFX MUST match a literal sound happening in the beat. A dragon roaring = dragon-roar. A dragon being remembered or mentioned = no SFX.
- VFX are physical. Lightning striking = lightning. Tension building = no VFX (use mood instead).
- For dialogue-heavy beats, light treatment. Maybe a mood shift. Rarely SFX unless dialogue describes a sound.

## OUTPUT

Always call build_cinematic_beats. Return the beats array. The function call schema enforces shape. Don't write any text outside the function call.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text.slice(0, 20000) },
        ],
        tools: [BEAT_TOOL],
        tool_choice: { type: "function", function: { name: "build_cinematic_beats" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[tag-cinematic] gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ beats: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "build_cinematic_beats") {
      console.error("[tag-cinematic] no tool call:", JSON.stringify(aiData).slice(0, 500));
      return new Response(
        JSON.stringify({ beats: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: { beats?: any[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ beats: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawBeats = Array.isArray(parsed.beats) ? parsed.beats : [];

    const allowedCounts = [3, 5, 7];
    if (!allowedCounts.includes(rawBeats.length)) {
      console.warn(`[tag-cinematic] invalid beat count: ${rawBeats.length}, returning null`);
      return new Response(
        JSON.stringify({ beats: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleaned = rawBeats.map((b: any) => {
      const text = typeof b?.text === 'string' ? b.text.trim() : '';
      const words = text.split(/\s+/).filter(Boolean);
      const finalText = words.length > 30 ? words.slice(0, 30).join(' ') : text;

      const intensity = typeof b?.intensity === 'number'
        ? Math.max(1, Math.min(5, Math.round(b.intensity)))
        : 3;

      const filterByEnum = (arr: any, allowed: string[]): string[] =>
        Array.isArray(arr) ? arr.filter((x: any) => typeof x === 'string' && allowed.includes(x)) : [];

      return {
        text: finalText,
        intensity,
        sfx: filterByEnum(b?.sfx, SFX_VALUES),
        ambience: typeof b?.ambience === 'string' && AMBIENCE_VALUES.includes(b.ambience) ? b.ambience : null,
        vfx: filterByEnum(b?.vfx, VFX_VALUES),
        mood: typeof b?.mood === 'string' && MOOD_VALUES.includes(b.mood) ? b.mood : null,
      };
    });

    const middleIdx = Math.floor(cleaned.length / 2);
    if (cleaned[middleIdx]) cleaned[middleIdx].intensity = 5;

    return new Response(
      JSON.stringify({ beats: cleaned }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[tag-cinematic] unhandled error:", e);
    return new Response(
      JSON.stringify({ beats: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
