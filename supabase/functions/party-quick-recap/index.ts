import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You write a Quick Recap for a tabletop roleplaying game player who is returning to the story. Your only job is to re-orient them so they can make their next decision. Rules:

1. Only include what the player characters know. Never reveal GM secrets, hidden motives, or future plot.

2. Be concrete: use real names, places, numbers and deadlines from the context. No generic filler.

3. Be short. Every field has a limit. Plain sentences, no markdown, no emoji.

4. Use the campaign's own vocabulary and tone. If the setting calls powers tech or divine gifts instead of magic, follow that.

5. The most recent messages describe the present. The campaign summary describes the past. If they conflict, the recent messages win.

6. Ignore game mechanics text (HP footers, dice logs, tactics blocks) unless it changes the story.

7. Options are suggestions phrased as possibilities, never orders. Include at least one option that is not combat.

8. Write the rightNow field in second person, addressed to the party ("You are...").`;

const TOOL = {
  type: "function",
  function: {
    name: "return_recap",
    description: "Return the structured quick recap.",
    parameters: {
      type: "object",
      properties: {
        headline: { type: "string", description: "One sentence, max 20 words: what is happening right now." },
        rightNow: { type: "string", description: "2 to 3 sentences: the immediate scene and the pressure or question facing the party." },
        whereAndWhen: {
          type: "object",
          properties: {
            location: { type: "string" },
            time: { type: "string", description: "Optional in-world time or deadline" },
            sceneType: { type: "string", enum: ["combat", "social", "exploration", "stealth", "travel", "downtime", "crisis", "investigation"] },
          },
          required: ["location", "sceneType"],
        },
        storySoFar: { type: "array", items: { type: "string" }, description: "3 to 5 one-sentence beats, max 25 words each, oldest first." },
        objectives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "max 8 words" },
              status: { type: "string", enum: ["active", "urgent", "done"] },
              detail: { type: "string", description: "max 20 words" },
            },
            required: ["title", "status", "detail"],
          },
          description: "Up to 4 objectives.",
        },
        keyNpcs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string", description: "max 6 words" },
              attitude: { type: "string", enum: ["ally", "neutral", "hostile", "unknown"] },
              note: { type: "string", description: "max 18 words" },
            },
            required: ["name", "role", "attitude", "note"],
          },
          description: "Up to 5 NPCs.",
        },
        threats: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              detail: { type: "string", description: "max 18 words" },
              clock: { type: "string", description: "Optional, e.g. '9.5 hours left'" },
            },
            required: ["name", "detail"],
          },
          description: "Up to 3 threats.",
        },
        crew: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              status: { type: "string", description: "max 16 words about what they are doing or their condition" },
            },
            required: ["name", "status"],
          },
          description: "One object per party member.",
        },
        yourOptions: { type: "array", items: { type: "string" }, description: "3 to 4 open possibilities, max 16 words each." },
        looseThreads: { type: "array", items: { type: "string" }, description: "Up to 3 unanswered questions, max 14 words each." },
      },
      required: ["headline", "rightNow", "whereAndWhen", "storySoFar", "objectives", "keyNpcs", "threats", "crew", "yourOptions", "looseThreads"],
    },
  },
};

function stripMechanics(content: string): string {
  // Remove fenced code blocks
  let text = content.replace(/```[\s\S]*?```/g, " ");
  // Remove mechanics blocks: a line containing TACTICS, SYNC or DM DICE ROLLS in capitals, up to the next blank line
  text = text.replace(/^.*\b(TACTICS|SYNC|DM DICE ROLLS)\b.*$(?:\n(?!\s*\n).*)*/gm, " ");
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function asArray(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const characterName = typeof body?.characterName === "string" ? body.characterName.trim() : "";
    if (!characterName) {
      return json({ error: "characterName is required." }, 400);
    }

    const campaignSummary = typeof body.campaignSummary === "string" ? body.campaignSummary.slice(0, 6000) : "";
    const memoryAnchors = typeof body.memoryAnchors === "string" ? body.memoryAnchors.slice(0, 3000) : "";
    const quests = asArray(body.quests, 10);
    const worldState = asArray(body.worldState, 8);
    const party = asArray(body.party, 20);

    const rawMessages = asArray(body.recentMessages, 1000).slice(-30);
    const recentMessages = rawMessages
      .map((m) => {
        const msg = m as { role?: string; name?: string; content?: string };
        const content = typeof msg.content === "string" ? stripMechanics(msg.content.slice(0, 1500)) : "";
        return {
          role: msg.role === "assistant" ? "assistant" : "user",
          name: typeof msg.name === "string" ? msg.name : "Unknown",
          content,
        };
      })
      .filter((m) => m.content.length > 0);

    if (recentMessages.length === 0 && !campaignSummary) {
      return json({ recap: null, reason: "no_story" });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return json({ error: "Could not build the recap." }, 500);
    }

    // Build the plain-text context block, skipping empty sections
    const sections: string[] = [];
    sections.push(`PLAYER ASKING\n${characterName}`);
    if (campaignSummary) sections.push(`CAMPAIGN SUMMARY\n${campaignSummary}`);
    if (memoryAnchors) sections.push(`MEMORY ANCHORS\n${memoryAnchors}`);
    if (quests.length > 0) {
      sections.push(
        "QUESTS\n" +
          quests
            .map((q) => {
              const quest = q as { title?: string; status?: string; detail?: string };
              return `- ${quest.title ?? "Untitled"} (${quest.status ?? "unknown"}): ${quest.detail ?? ""}`;
            })
            .join("\n"),
      );
    }
    if (worldState.length > 0) {
      sections.push(
        "WORLD STATE\n" +
          worldState
            .map((w) => {
              const ws = w as { title?: string; consequence?: string; impact?: string };
              return `- ${ws.title ?? "Event"}: ${ws.consequence ?? ""}${ws.impact ? ` (impact: ${ws.impact})` : ""}`;
            })
            .join("\n"),
      );
    }
    if (party.length > 0) {
      sections.push(
        "PARTY\n" +
          party
            .map((p) => {
              const member = p as { name?: string; className?: string; level?: number; currentHP?: number; maxHP?: number; conditions?: string[] };
              const conditions = Array.isArray(member.conditions) && member.conditions.length > 0 ? `, conditions: ${member.conditions.join(", ")}` : "";
              return `- ${member.name ?? "Unknown"} — ${member.className ?? "Adventurer"} level ${member.level ?? "?"} (HP ${member.currentHP ?? "?"}/${member.maxHP ?? "?"}${conditions})`;
            })
            .join("\n"),
      );
    }
    if (recentMessages.length > 0) {
      sections.push(
        "RECENT STORY\n" + recentMessages.map((m) => `${m.name}: ${m.content}`).join("\n"),
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: sections.join("\n\n") },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_recap" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return json({ error: "Too many recap requests right now. Try again in a moment." }, 429);
      }
      if (response.status === 402) {
        return json({ error: "AI credits are used up for this workspace." }, 402);
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return json({ error: "Could not build the recap." }, 500);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    let recap: Record<string, unknown> | null = null;
    const toolCall = message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        recap = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Tool call arguments parse failure:", e);
      }
    }
    if (!recap && typeof message?.content === "string") {
      try {
        const stripped = message.content.replace(/```(?:json)?/g, "").trim();
        recap = JSON.parse(stripped);
      } catch (e) {
        console.error("Content fallback parse failure:", e);
      }
    }
    if (!recap || typeof recap !== "object") {
      console.error("No recap produced from model response");
      return json({ error: "Could not build the recap." }, 500);
    }

    // Light validation and clamping
    const validated = {
      headline: typeof recap.headline === "string" ? recap.headline : "",
      rightNow: typeof recap.rightNow === "string" ? recap.rightNow : "",
      whereAndWhen: recap.whereAndWhen && typeof recap.whereAndWhen === "object" ? recap.whereAndWhen : { location: "", sceneType: "exploration" },
      storySoFar: asArray(recap.storySoFar, 5),
      objectives: asArray(recap.objectives, 4),
      keyNpcs: asArray(recap.keyNpcs, 5),
      threats: asArray(recap.threats, 3),
      crew: asArray(recap.crew, 20),
      yourOptions: asArray(recap.yourOptions, 4),
      looseThreads: asArray(recap.looseThreads, 3),
    };

    return json({ recap: validated, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("party-quick-recap error:", error);
    return json({ error: "Could not build the recap." }, 500);
  }
});
