import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Every @Name token in the draft must survive the rewrite — they are functional NPC tags. */
function mentions(text: string): string[] {
  return (text.match(/@[A-Za-z0-9_'-]+/g) || []).map(m => m.toLowerCase());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const draft = typeof body?.draft === "string" ? body.draft.trim() : "";
    if (!draft) return json({ enhanced: null, reason: "empty" });

    const clipped = draft.slice(0, 4000);
    const characterName = typeof body?.characterName === "string" ? body.characterName.slice(0, 60) : "";
    const asList = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 25) : [];
    const abilities = asList(body?.abilities);
    const spells = asList(body?.spells);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You rewrite a player's rough notes into ONE cohesive first-person action statement for a single turn of a tabletop RPG.

The player has tapped several action buttons and typed fragments, so the draft arrives as a stack of disconnected lines. Weave them into a single sequential declaration of what the character ATTEMPTS this turn.

HARD RULES. Breaking any of these ruins the game:

1. INTENT ONLY. Never state an outcome. Never say the attack lands, the lock opens, the guard is fooled, the leap succeeds, or that anyone is hurt, moved, or persuaded. The Dungeon Master decides all of that. Write "I swing for his knee", never "I hit his knee".

2. Never roll dice. Never invent numbers, damage, DCs, saves, distances the player did not give, or hit points.

3. Never write dialogue or reactions for NPCs. Never narrate anything the character could not perceive.

4. Keep every action the player listed. Do not add actions they did not mention. Do not drop any.

5. Keep the player's order unless physics forces a change, and if you must reorder, make the sequence explicit.

6. Preserve every @Name token EXACTLY as written, including the @ and the spelling. They are functional tags, not decoration.

7. Preserve exact ability, spell and item names verbatim. Do not rename, translate, pluralise or "correct" them.

8. First person, present tense, the player speaking for their character.

9. No questions, no commentary, no headings, no bullet points, no markdown. Prose only.

10. Two to five sentences. Never longer than a player could say out loud in one turn.

If the draft is already one clean action, return it with only light polish. If part of the draft is ambiguous, keep the player's original wording for that part verbatim rather than guessing at it.`;

    const contextBits: string[] = [];
    if (characterName) contextBits.push(`Character: ${characterName}`);
    if (abilities.length) contextBits.push(`Equipped abilities (use these names exactly if referenced): ${abilities.join(", ")}`);
    if (spells.length) contextBits.push(`Prepared spells (use these names exactly if referenced): ${spells.join(", ")}`);
    const contextBlock = contextBits.length ? `${contextBits.join("\n")}\n\n` : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${contextBlock}PLAYER DRAFT:\n${clipped}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rewrite_action",
              description: "Return the rewritten first-person action statement",
              parameters: {
                type: "object",
                properties: {
                  enhanced_action: {
                    type: "string",
                    description: "The single cohesive action statement, prose only, intent not outcome",
                  },
                },
                required: ["enhanced_action"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "rewrite_action" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ enhanced: null, reason: "rate_limited" }, 429);
      if (response.status === 402) return json({ enhanced: null, reason: "payment_required" }, 402);
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return json({ enhanced: null, reason: "gateway_error" });
    }

    const data = await response.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ enhanced: null, reason: "no_output" });

    let enhanced = "";
    try {
      enhanced = String(JSON.parse(args)?.enhanced_action ?? "").trim();
    } catch {
      return json({ enhanced: null, reason: "parse_error" });
    }

    if (!enhanced) return json({ enhanced: null, reason: "no_output" });

    // Guard the NPC tags. If any @Name was dropped or altered, voicing would silently
    // break on send, so refuse the rewrite rather than hand back something broken.
    const before = mentions(clipped);
    const after = mentions(enhanced);
    const lost = before.filter(m => !after.includes(m));
    if (lost.length > 0) return json({ enhanced: null, reason: "mentions_lost" });

    // Hard cap so a runaway rewrite cannot bury the turn.
    if (enhanced.length > 1200) enhanced = enhanced.slice(0, 1200).trim();

    return json({ enhanced });
  } catch (e) {
    console.error("enhance-player-action error:", e);
    return json({ enhanced: null, reason: "error" }, 500);
  }
});
