// Empyrean onboarding: the chat that builds a new solo dragon rider and their campaign (or a new
// campaign for a rider who already exists), using the lore guides the phone sends and the app's
// own feature guide (prompt.ts). Signed-in players only. Claude first, then a Lovable AI model
// (D-26). Replies stream in the OpenAI-style format the app's chat reader already understands.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { CLAUDE_MODEL, streamClaudeThenLovable } from "../_shared/claude.ts";
import { buildSystemPrompt, clip, MAX_LORE_CHARS, MAX_RIDER_CHARS, type OnboardingMode } from "./prompt.ts";


const FALLBACK_MODEL = "google/gemini-2.5-pro"; // long, careful writing (D-26)
const MAX_MESSAGES = 80;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_TOTAL_CHARS = 400_000;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Use POST." });

  try {
    // Signed-in players only: this spends the server's AI key.
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Please sign in first." });
    const { data: auth, error: authErr } = await db.auth.getUser(token);
    if (authErr || !auth?.user?.id) return json(401, { error: "Please sign in first." });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "Invalid request." });
    const mode: OnboardingMode = body.mode === "campaign" ? "campaign" : "rider";
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
      return json(400, { error: "Invalid conversation." });
    }
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const m of body.messages) {
      if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return json(400, { error: "Invalid conversation." });
      messages.push({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) });
    }
    if (messages[messages.length - 1].role !== "user") return json(400, { error: "Invalid conversation." });

    const system = buildSystemPrompt(mode, clip(body.lore, MAX_LORE_CHARS), clip(body.rider, MAX_RIDER_CHARS));
    const total = system.length + messages.reduce((n, m) => n + m.content.length, 0);
    if (total > MAX_TOTAL_CHARS) return json(413, { error: "This conversation is too long. Tap Start over to begin a new one." });

    const opened = await streamClaudeThenLovable({
      claudeKey: Deno.env.get("ANTHROPIC_API_KEY"),
      model: CLAUDE_MODEL,
      fallbackModel: FALLBACK_MODEL,
      system,
      cacheSystem: true,
      messages,
      maxTokens: 8192,
      tag: "[empyrean-onboarding]",
    });
    if (opened.kind === "error") {
      return json(opened.status === 429 ? 429 : 502, { error: opened.status === 429 ? "Too many requests. Try again in a moment." : "The guide could not answer. Try again." });
    }
    if (opened.kind === "lovable") {
      return new Response(opened.response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Claude's event stream → the OpenAI-style chunks the app reads.
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    (async () => {
      try {
        const responseBody = opened.response.body;
        if (!responseBody) throw new Error("The guide returned no response stream.");
        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "content_block_delta" && event.delta?.text) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: event.delta.text } }] })}\n\n`));
              }
            } catch {
              // a partial or non-JSON line: skip it
            }
          }
        }
      } catch (e) {
        console.error("[empyrean-onboarding] stream error:", e instanceof Error ? e.message : e);
      } finally {
        await writer.write(encoder.encode("data: [DONE]\n\n")).catch(() => {});
        await writer.close().catch(() => {});
      }
    })();
    return new Response(readable, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("[empyrean-onboarding] error:", e instanceof Error ? e.message : e);
    return json(500, { error: "Something went wrong. Try again." });
  }
});
