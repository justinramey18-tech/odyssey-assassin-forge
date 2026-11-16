// Solo Empyrean Live NPCs (D-38). Signed-in players only (it spends the server's AI key).
// Actions:
// - remember: what each roster NPC in a scene remembers of the rider, and how they feel now.
// - build: Quick Build, an original NPC from a short description.
// Stateless: the phone stores the results in its own solo_npcs rows. Party Live NPCs (npc-reply,
// npc-memory) are separate and untouched (INV-N2).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { askClaudeThenLovable } from "../_shared/claude.ts";
import {
  BUILD_TOOL, buildSystem, readBuildInput, readBuildResult, readRememberInput, readRememberResult, REMEMBER_TOOL, rememberSystem,
} from "./logic.ts";

const MEMORY_MODEL = "claude-haiku-5-5";
const BUILD_MODEL = "claude-sonnet-5-5";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Use POST." });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Please sign in first." });
    const { data: auth, error: authErr } = await db.auth.getUser(token);
    if (authErr || !auth?.user?.id) return json(401, { error: "Please sign in first." });

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return json(400, { error: "Invalid request." });
    const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (body.action === "remember") {
      const input = readRememberInput(body);
      if (!input) return json(400, { error: "Nothing to remember." });
      const asked = await askClaudeThenLovable({
        claudeKey, model: MEMORY_MODEL, system: rememberSystem(input),
        messages: [{ role: "user", content: `SCENE:\n${input.scene}` }],
        maxTokens: 900, tag: "[solo-npc remember]", tools: [REMEMBER_TOOL], toolName: REMEMBER_TOOL.name, timeoutMs: 40_000,
      });
      if (!asked.ok) return json(asked.status === 429 ? 429 : 502, { error: "The NPCs could not remember that. It will be tried again next time." });
      return json(200, { memories: readRememberResult(asked.toolInput, input) });
    }

    if (body.action === "build") {
      const input = readBuildInput(body);
      if (!input) return json(400, { error: "Describe the NPC in a few words." });
      const asked = await askClaudeThenLovable({
        claudeKey, model: BUILD_MODEL, system: buildSystem(input),
        messages: [{ role: "user", content: input.description }],
        maxTokens: 1200, tag: "[solo-npc build]", tools: [BUILD_TOOL], toolName: BUILD_TOOL.name, timeoutMs: 60_000,
      });
      const npc = asked.ok ? readBuildResult(asked.toolInput) : null;
      if (!npc) return json(502, { error: "Quick Build could not make that NPC. Try again." });
      return json(200, { npc });
    }

    return json(400, { error: "Unknown action." });
  } catch (e) {
    console.error("[solo-npc]", e instanceof Error ? e.message : e);
    return json(500, { error: "Something went wrong." });
  }
});
