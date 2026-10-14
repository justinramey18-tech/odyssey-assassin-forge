// Host Map Setup Assistant. Reads a STAGED Map Pack summary and the chat, and returns
// a reply plus proposed staged edits. It has no database access and writes nothing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "claude-sonnet-4-6";
const OPS = ["set_default_pace", "set_time_compression", "set_campaign_minute", "set_discovered", "edit_location", "add_location", "remove_location", "edit_route", "add_route", "remove_route", "set_start_location", "set_guide_recommendation"];
const FORBIDDEN_KEYS = ["imageUrl", "startedAt", "activeTravel", "user_id", "userId", "host", "partyId", "apiKey", "x", "y", "path"];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You are the Odyssey Host Map Setup Assistant. You help the party host review and adjust a STAGED Campaign Map Pack before they install it.

What you understand: places (locations with id, name, kind, region, parent place, discovered flag, pinned or not), roads (routes between two places with miles, typed vs map-estimated distance, terrain factor where 1 = open road, 1.5 hills, 2 forest), map scale (calibration), time speed (real minutes per in-world hour; presets: cinematic 1, standard 5, immersive 15, realtime 60), default pace (slow 2 mph, normal 3 mph, fast 4 mph; a travel day is 8 hours), the start place and campaign start time (campaign minute 0 = Day 1 00:00), and included GM guides.

Hard rules:
- Every change you propose applies ONLY to the staged pack. Never say you changed the live game, installed the map, or enabled a guide. The host installs with their own button.
- You cannot install or enable guides. You may only change a guide's "recommended" note.
- Never invent map facts (distances, places, roads, lore) the data doesn't contain. If something is missing, say what the host needs to provide.
- Never propose map coordinates, image changes, timers, or ids for users/parties.
- Use only ids that exist in the data, except when adding a new place or road (then pick a short new id like "loc-ashford").
- Keep replies short and plain; no technical jargon.
- If the host asks for a problem check, look for: roads with no usable distance, unpinned places, places nobody can reach, a missing start place, undiscovered start place, extreme terrain or time speed.

Always answer by calling the "respond" tool exactly once.`;

const TOOL = {
  name: "respond",
  description: "Reply to the host and list proposed staged changes (may be empty).",
  input_schema: {
    type: "object",
    properties: {
      reply: { type: "string", description: "Plain-language reply to the host." },
      operations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            op: { type: "string", enum: OPS },
            pace: { type: "string", enum: ["slow", "normal", "fast"] },
            preset: { type: "string", enum: ["cinematic", "standard", "immersive", "realtime"] },
            realMinutesPerGameHour: { type: "number" },
            minute: { type: "number" },
            locationId: { type: ["string", "null"] },
            routeId: { type: "string" },
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            region: { type: "string" },
            kind: { type: "string" },
            parentLocationId: { type: ["string", "null"] },
            discovered: { type: "boolean" },
            fromLocationId: { type: "string" },
            toLocationId: { type: "string" },
            distanceMiles: { type: "number" },
            distanceSource: { type: "string", enum: ["manual", "calibrated"] },
            terrainFactor: { type: "number" },
            guideIndex: { type: "number" },
            recommendedEnabled: { type: "boolean" },
          },
          required: ["op"],
        },
      },
    },
    required: ["reply", "operations"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in." }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } } });
    const { data: claims, error: claimsErr } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) return json({ error: "Please sign in." }, 401);

    const body = await req.json().catch(() => null) as { messages?: unknown; pack?: unknown; user_api_key?: unknown } | null;
    if (!body || !Array.isArray(body.messages) || !body.pack || typeof body.pack !== "object") return json({ error: "Missing messages or staged pack." }, 400);
    const key = typeof body.user_api_key === "string" ? body.user_api_key.trim() : "";
    if (!key) return json({ error: "Add your Anthropic key in Settings to use the Map Setup Assistant. The pack preview and install still work without it." }, 400);

    const messages = body.messages.slice(-16).flatMap((m: any) => {
      const role = m?.role === "assistant" ? "assistant" : m?.role === "user" ? "user" : null;
      const content = typeof m?.content === "string" ? m.content.slice(0, 4000) : "";
      return role && content ? [{ role, content }] : [];
    });
    if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "Send a message first." }, 400);
    const packJson = JSON.stringify(body.pack);
    if (packJson.length > 120_000) return json({ error: "This pack is too large for the assistant to read." }, 400);

    const system = `${SYSTEM}\n\n[STAGED PACK DATA START]\n${packJson}\n[STAGED PACK DATA END]`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, system, messages, tools: [TOOL], tool_choice: { type: "tool", name: "respond" } }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("anthropic", res.status, t.slice(0, 500));
      if (res.status === 401) return json({ error: "Your Anthropic key was rejected. Update it in Settings." }, 401);
      if (res.status === 429) return json({ error: "Anthropic is busy. Wait a moment and try again." }, 429);
      if (res.status === 403) return json({ error: "Anthropic refused this request." }, 403);
      return json({ error: "The assistant could not answer right now." }, 502);
    }
    const data = await res.json();
    const tool = data?.content?.find((b: any) => b?.type === "tool_use");
    const input = tool?.input ?? {};
    const reply = typeof input.reply === "string" && input.reply.trim() ? input.reply.trim().slice(0, 4000) : "I couldn't come up with an answer. Try asking another way.";
    const operations = (Array.isArray(input.operations) ? input.operations : []).slice(0, 40).filter((o: any) =>
      o && typeof o === "object" && OPS.includes(o.op) && !FORBIDDEN_KEYS.some(k => k in o));
    return json({ reply, operations });
  } catch (e) {
    console.error("campaign-map-assistant", e);
    return json({ error: "The assistant could not answer right now." }, 500);
  }
});
