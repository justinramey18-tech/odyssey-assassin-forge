import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOUNDS = [
  {
    path: "sfx/whisper.mp3",
    prompt: "Quiet whispered conversation between two people in a dark room, hushed tones, barely audible, intimate murmuring, soft and incremental whispers building slowly, fantasy RPG atmosphere",
    duration: 6,
    influence: 0.5,
  },
  {
    path: "sfx/arrow-hit.mp3",
    prompt: "Heavy arrow thudding into a wooden shield with deep bass impact, loud satisfying thwack, low-frequency rumble on impact, medieval combat, powerful and punchy arrow strike",
    duration: 3,
    influence: 0.5,
  },
  {
    path: "sfx/magic-cast.mp3",
    prompt: "Anime-style energy power up with crackling electricity and rising intensity, Dragon Ball Z ki charge with electric sparks, building energy aura with deep bass rumble and lightning crackle, explosive magical release",
    duration: 5,
    influence: 0.5,
  },
  {
    path: "ambience/rain.mp3",
    prompt: "Heavy rainfall on a medieval stone courtyard, deep low-pitched rain drops hitting cobblestones, distant thunder rumble, thick steady downpour with bass-heavy patter, no high-pitched tinkling, dark atmospheric rain",
    duration: 12,
    influence: 0.5,
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const results: Record<string, string> = {};

  for (const sound of SOUNDS) {
    try {
      console.log(`Generating: ${sound.path}`);
      const resp = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: sound.prompt,
          duration_seconds: sound.duration,
          prompt_influence: sound.influence,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        results[sound.path] = `ERROR ${resp.status}: ${errText}`;
        continue;
      }

      const audioBuffer = await resp.arrayBuffer();
      
      // Delete existing then upload
      await sb.storage.from("cinematic-audio").remove([sound.path]);
      const { error } = await sb.storage.from("cinematic-audio").upload(sound.path, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

      if (error) {
        results[sound.path] = `Upload error: ${error.message}`;
      } else {
        results[sound.path] = `OK (${audioBuffer.byteLength} bytes)`;
      }
    } catch (e) {
      results[sound.path] = `Exception: ${e.message}`;
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
