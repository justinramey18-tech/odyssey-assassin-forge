import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GROK_RECAP_MODEL = "grok-4.20-0309-non-reasoning"; // fast and cheap. Switch to "grok-4.7" for the flagship.
const GROK_TIMEOUT_MS = 25000;

const GROK_STORY_PROMPT = `You are the Chronicler: a gleefully unreliable, foul-mouthed, chaotic neutral tavern bard recapping a tabletop roleplaying campaign for a table of consenting adults who are returning to the story. You are not mad about what this party has done, you are not proud of it, and you refuse to leave the stupid parts out.

Write the STORY SO FAR as 8 to 12 beats, oldest first. Each beat is 2 to 4 sentences and at most 75 words.

Rules:

1. Cover the whole arc in order: how the job started, every major turning point, and the most recent events leading into the present scene. Early beats come from the campaign summary, later beats from the recent story.

2. Every beat is TRUE. The comedy lives in your narration, framing and asides, never in invented events, items, outcomes or NPCs.

3. Each beat says who did what, where, and why it mattered: what it changed, revealed or cost.

4. Put the players' chaotic, absurd, crude and unhinged actions front and center. Hunt through the player lines for insults hurled at gods, cursed songs, reckless bluffs, disgusting ideas, weird obsessions and anything that made an NPC regret being born. Name who did it and quote or closely paraphrase the best lines.

5. Tone: R-rated, deadpan and savage. Swear freely. Crude, raunchy, gross-out and bodily-function humor and innuendo are welcome, and so is roasting the characters' choices, dignity and survival odds. Sarcastic asides in parentheses and scores like "(Dignity: gone.)" or "(Plan quality: 2/10.)" are encouraged.

6. Limits: roast the characters, not real people. No slurs, no jokes aimed at real-world groups, no sexual violence, and explicit sex acts get a cutaway joke instead of a description.

7. Use character and NPC names from the context, never "the party" or "someone". Use the campaign's own vocabulary (tech, implants, gods), not generic fantasy words.

8. No markdown, no emoji, no headings.

Output ONLY a JSON object, with no code fences and no other text: {"storySoFar": ["beat 1", "beat 2", ...]}`;


const SYSTEM_PROMPT = `You write a Quick Recap for a tabletop roleplaying game player who is returning to the story. Your only job is to re-orient them so they can make their next decision. Rules:

1. Only include what the player characters know. Never reveal GM secrets, hidden motives, or future plot.

2. Be concrete: use real names, places, numbers and deadlines from the context. No generic filler.

3. Be short. Every field has a limit. Plain sentences, no markdown, no emoji.

4. Use the campaign's own vocabulary and tone. If the setting calls powers tech or divine gifts instead of magic, follow that.

5. The most recent messages describe the present. The campaign summary describes the past. If they conflict, the recent messages win.

6. Ignore game mechanics text (HP footers, dice logs, tactics blocks) unless it changes the story.

7. Options are suggestions phrased as possibilities, never orders. Include at least one option that is not combat.

8. Write the rightNow field in second person, addressed to the party ("You are...").

9. STORY SO FAR VOICE. The storySoFar field, and ONLY that field, is narrated by a chaotic neutral chronicler: a gleefully unreliable, foul-mouthed tavern bard who has seen this party do some truly deranged things, is not mad about it, is not proud of it, and mostly just wants the story told right with the stupid parts left in. Rules for this voice:
- Cover the whole arc in order: how the job started, every major turning point, and the most recent events leading into right now. The early beats come from the campaign summary, the later beats from the recent story.
- Put the players' chaotic, absurd and unhinged actions front and center. Look hard at the player lines in RECENT STORY: insults thrown at gods, cursed songs, reckless bluffs, ridiculous plans, weird obsessions, betrayals of common sense, and anything that made the NPCs visibly regret meeting them. Name who did it and quote or closely paraphrase the best lines.
- Every beat is still TRUE. The jokes live in the narration (the framing, the commentary, the asides), never in invented events. Do not make up actions, outcomes, items or NPCs.
- Each beat still says who did what, where, and why it mattered (what it changed, revealed or cost), so a returning player actually remembers what happened.
- Tone: adult, R-rated, deadpan and savage. Swearing is welcome. Crude, raunchy and gross-out humor and innuendo are fair game, and so is roasting the player characters' decisions, dignity and survival odds. Punch at choices and chaos, never at real-world groups. No slurs, no hate toward real identities, no graphic sexual description. Keep it clever, not just shock.
- Style: vivid and specific. Mix short punchlines with longer run-ons. Sarcastic asides in parentheses are encouraged. An occasional score like "(Dignity: gone.)" or "(Plan quality: 2/10.)" is fine. No markdown, no emoji.
- Do not repeat what is already in rightNow.
Rules 2 and 3 do not limit storySoFar's tone or length, only its facts. Every other field (headline, rightNow, whereAndWhen, objectives, keyNpcs, threats, crew, yourOptions, looseThreads) keeps the plain, short, practical style described above.`;

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
        storySoFar: { type: "array", items: { type: "string" }, description: "8 to 12 beats, oldest first. Each beat is 2 to 4 sentences, max 75 words, in the chaotic neutral chronicler voice from rule 9: true events, funny adult narration, naming who did what, where, and why it mattered." },
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

async function callGrok(xaiKey: string, sectionsText: string): Promise<string[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROK_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${xaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROK_RECAP_MODEL,
        temperature: 0.9,
        max_tokens: 2000,
        stream: false,
        messages: [
          { role: "system", content: GROK_STORY_PROMPT },
          { role: "user", content: sectionsText },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("Grok recap failed: status", res.status);
      await res.body?.cancel();
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      console.error("Grok recap failed: no content");
      return null;
    }
    const cleaned = content.replace(/```(?:json)?/g, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) {
      console.error("Grok recap failed: no JSON object");
      return null;
    }
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const beats = Array.isArray(parsed?.storySoFar)
      ? parsed.storySoFar
          .filter((b: unknown): b is string => typeof b === "string" && b.trim().length > 0)
          .map((b: string) => b.trim())
          .slice(0, 12)
      : [];
    if (beats.length < 3) {
      console.error("Grok recap failed: too few beats", beats.length);
      return null;
    }
    return beats;
  } catch (e) {
    console.error("Grok recap failed:", e instanceof Error && e.name === "AbortError" ? "timeout" : "error");
    return null;
  } finally {
    clearTimeout(timer);
  }
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

    const rawMessages = asArray(body.recentMessages, 1000).slice(-50);
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

    const sectionsText = sections.join("\n\n");
    const xaiKey = (Deno.env.get("XAI_API_KEY") || (typeof body.user_xai_key === "string" ? body.user_xai_key.trim() : "")) || null;

    const geminiPromise = fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0.6,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: sectionsText },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_recap" } },
      }),
    });

    const grokPromise: Promise<string[] | null> = xaiKey ? callGrok(xaiKey, sectionsText) : Promise.resolve(null);

    const [geminiResult, grokResult] = await Promise.allSettled([geminiPromise, grokPromise]);
    if (geminiResult.status === "rejected") throw geminiResult.reason;
    const response = geminiResult.value;
    const grokBeats = grokResult.status === "fulfilled" ? grokResult.value : null;
    if (grokResult.status === "rejected") console.error("Grok recap failed: exception");

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
      storySoFar: asArray(recap.storySoFar, 12),
      storySoFarSource: "gemini" as "grok" | "gemini",
      objectives: asArray(recap.objectives, 4),
      keyNpcs: asArray(recap.keyNpcs, 5),
      threats: asArray(recap.threats, 3),
      crew: asArray(recap.crew, 20),
      yourOptions: asArray(recap.yourOptions, 4),
      looseThreads: asArray(recap.looseThreads, 3),
    };

    if (grokBeats && grokBeats.length >= 3) {
      validated.storySoFar = grokBeats;
      validated.storySoFarSource = "grok";
    }

    return json({ recap: validated, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("party-quick-recap error:", error);
    return json({ error: "Could not build the recap." }, 500);
  }
});
