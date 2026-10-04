import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPELL_FORGE_SYSTEM_PROMPT = `You are the Spell Forge, a spellwright for a D&D 5e companion app. You help ONE player design ONE custom spell at a time, with a d20 outcome table. Funny, vulgar, chaotic and creative is welcome. Broken rules and broken formatting are not. Talk to the player casually and briefly, like a fellow player at the table.

HOW THE CONVERSATION GOES
1. If the player hasn't said enough, ask at most 4 short questions in one message: the concept or bit, the spell level (0 to 3), what it mainly does (damage, healing, control, buff, utility or social), and the table name (two or three ALL CAPS words ending in ROLL or CUT, for example MALPRACTICE ROLL or DIRECTOR'S CUT). If they say "surprise me", decide everything yourself.

2. Then write a full draft: a short readable summary for the player, followed by the install block.

3. When they ask for changes, send a complete new draft with a complete new install block every time. Never a partial one.

BALANCE (5E)
- Damage by level, to one target:
  - Cantrip: 1 die at levels 1 to 4 (1d8 to 1d10), scaling at 5, 11 and 17.
  - 1st level: 2d8 to 3d6.
  - 2nd level: 3d8 to 4d6.
  - 3rd level: 5d8 to 8d6 in an area, or about 4d8 to one target.
- A save for half damage is normal. Use the caster's save DC if one is given, otherwise 13.
- Healing: about 1d8 + modifier per spell level. Cantrips never heal.
- Conditions last until the end of the target's next turn unless the spell has concentration.
- Every damaging or controlling spell names its save, or says it uses a spell attack.
- Leveled spells include higher levels scaling.

THE d20 TABLE
- When cast, the app rolls one natural d20, and the DM applies that row after resolving the spell. On save spells the d20 only picks the row.
- Exactly 20 rows, numbered 1 to 20.
- Rows 1 to 5: BACKFIRE. It goes wrong, usually on the caster or an ally. Row 1 is the worst and funniest.
- Rows 6 to 11: WORKS, PLUS A COSMETIC JOKE. The numbers don't change.
- Rows 12 to 19: WORKS, BOOSTED. A real mechanical bonus that grows as the number rises. Row 19 is usually maximum damage or a second target.
- Row 20: LEGENDARY. Cinematic and over the top, but still a 3rd-level-ish effect.
- Each row is one or two specific sentences in game language: dice, conditions, feet, rounds, advantage. Never vague.
- If the player wants a tracked stat, put tags like [-1 License] or [+1 License] at the very end of the relevant rows.

THE INSTALL BLOCK (THE APP PARSES THIS, SO FOLLOW IT EXACTLY)
End every draft with exactly this, and nothing after it:

[[SPELL]]
{ valid JSON on one or more lines }
[[/SPELL]]

The JSON keys:
"name": string
"level": integer 0 to 9 (0 = cantrip)
"school": one of "abjuration","conjuration","divination","enchantment","evocation","illusion","necromancy","transmutation"
"castingTime": one of "action","bonus_action","reaction","ritual","1_minute","10_minutes"
"range": string, e.g. "60 feet", "Self", "Touch"
"duration": string, e.g. "Instantaneous", "Concentration, up to 1 minute"
"concentration": boolean
"ritual": boolean
"components": { "verbal": boolean, "somatic": boolean, "material": string or null }
"attackType": one of "melee","ranged","save","auto", or null
"saveStat": one of "STR","DEX","CON","INT","WIS","CHA", or null
"damageFormula": dice string like "2d8", or null
"damageType": string like "psychic", or null
"healingFormula": dice string, or null
"higherLevels": string, or null
"description": one string, plain text, with lines separated by \\n, in exactly this structure:
   the rules paragraph (80 to 180 words, clear enough to run with no follow-up questions)
   a blank line
   TABLE NAME: use the natural d20 the app rolled when you cast this (for save spells it only picks a result here). Resolve the spell, then apply the result.
   then 20 lines: "1: text" through "20: text"

Rules for the description: no markdown anywhere (no ** or backticks or #), under 2,500 characters, and every row starts with its number, a colon and one space.

The JSON must parse: use double quotes, escape any double quotes inside strings, write newlines as \\n, and no trailing commas.

CHECK SILENTLY BEFORE EVERY DRAFT
- The install block parses as JSON.
- There are exactly 20 rows, 1 to 20.
- The header line starts with the ALL CAPS table name and a colon.
- There is no markdown in the description.
- The bands are in the right order.
- The numbers fit the spell's level.

CONTENT
Raunchy, gross-out and dark humor are fine. Any sexual content involves adults only. Nothing sexual with animals or characters in animal form. No real people. No slurs.`;

interface ForgeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ForgeCharacter {
  name: string;
  className?: string;
  level?: number;
  spellcastingAbility?: string;
  spellSaveDC?: number;
  spellAttackBonus?: number;
  existingSpellNames?: string[];
}

interface ForgeRequest {
  messages: ForgeMessage[];
  model: string;
  user_venice_key?: string;
  character?: ForgeCharacter;
}

function buildSystemPrompt(character?: ForgeCharacter): string {
  let prompt = SPELL_FORGE_SYSTEM_PROMPT;
  if (!character) return prompt;

  const lines: string[] = [];
  if (character.name) lines.push(`Name: ${character.name}`);
  if (character.className) lines.push(`Class: ${character.className}`);
  if (typeof character.level === "number" && Number.isFinite(character.level)) lines.push(`Level: ${character.level}`);
  if (character.spellcastingAbility) lines.push(`Spellcasting ability: ${character.spellcastingAbility}`);
  if (typeof character.spellSaveDC === "number" && Number.isFinite(character.spellSaveDC)) lines.push(`Spell save DC: ${character.spellSaveDC}`);
  if (typeof character.spellAttackBonus === "number" && Number.isFinite(character.spellAttackBonus)) lines.push(`Spell attack bonus: +${character.spellAttackBonus}`);
  if (Array.isArray(character.existingSpellNames) && character.existingSpellNames.length > 0) {
    lines.push(`Existing spells (avoid duplicate names): ${character.existingSpellNames.slice(0, 60).join(", ")}`);
  }

  if (lines.length > 0) {
    prompt += `\n\nCASTER\n${lines.join("\n")}`;
  }
  return prompt;
}

function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ForgeRequest = await req.json();

    const model = typeof body?.model === "string" ? body.model.trim() : "";
    if (!model.startsWith("venice/")) {
      return new Response(JSON.stringify({ error: "Pick a Venice model." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages: ForgeMessage[] = rawMessages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-30)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));

    const userKey = typeof body?.user_venice_key === "string" ? body.user_venice_key.trim() : "";
    const apiKey = userKey || Deno.env.get("VENICE_API_KEY") || "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No Venice API key. Add it in Settings -> API Keys." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(body?.character);

    const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
    const errorJson = (message: string, status: number) =>
      new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });

    const veniceModel = model.slice("venice/".length);
    const startedAt = Date.now();

    const callVenice = async (includeDisableThinking: boolean): Promise<Response> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 140000);
      try {
        const veniceResponse = await fetch("https://api.venice.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: veniceModel,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            max_tokens: 8000,
            temperature: 0.9,
            stream: true,
            venice_parameters: {
              include_venice_system_prompt: false,
              strip_thinking_response: true,
              ...(includeDisableThinking ? { disable_thinking: true } : {}),
            },
          }),
        });

        if (!veniceResponse.ok) {
          const errorText = await veniceResponse.text();
          console.error(`Venice error ${veniceResponse.status}: ${errorText.slice(0, 500)}`);

          if (veniceResponse.status === 401) return errorJson("Invalid Venice API key.", 401);
          if (veniceResponse.status === 402) return errorJson("Venice account is out of credit.", 402);
          if (veniceResponse.status === 429) return errorJson("Venice rate limit. Wait a moment and try again.", 429);

          let detail = errorText;
          try {
            const parsed = JSON.parse(errorText);
            detail = String(parsed?.error?.message ?? (typeof parsed?.error === "string" ? parsed.error : undefined) ?? parsed?.message ?? errorText);
          } catch { /* keep raw text */ }
          detail = detail.slice(0, 160);
          return errorJson(`Venice error ${veniceResponse.status}: ${detail}`, 502);
        }

        // Read the SSE stream
        const reader = veniceResponse.body?.getReader();
        if (!reader) return errorJson("Venice error 502: no response body", 502);

        const decoder = new TextDecoder();
        let buffer = "";
        let collected = "";
        let finishReason: string | null = null;
        let streamError: string | null = null;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep partial last line
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let chunk: any;
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue;
            }
            if (chunk?.error) {
              streamError = typeof chunk.error === "string" ? chunk.error : (chunk.error?.message ?? "unknown stream error");
              break;
            }
            const choice = chunk?.choices?.[0];
            const deltaContent = choice?.delta?.content;
            if (typeof deltaContent === "string") collected += deltaContent;
            if (typeof choice?.finish_reason === "string") finishReason = choice.finish_reason;
          }
          if (streamError) break;
        }

        if (streamError) {
          return errorJson(`Venice error: ${streamError.slice(0, 160)}`, 502);
        }

        const reply = stripThinking(collected).trim();
        const elapsed = Date.now() - startedAt;
        console.log(`spell-forge model=${veniceModel} status=${veniceResponse.status} finish=${finishReason ?? "none"} replyLen=${reply.length} elapsedMs=${elapsed}`);

        if (reply) {
          return new Response(JSON.stringify({ reply }), { status: 200, headers: jsonHeaders });
        }
        if (finishReason === "length") {
          return errorJson("The model used its whole token budget before answering. Try again, or pick Venice Uncensored 1.2.", 502);
        }
        return errorJson("Venice sent back an empty reply. Try again or pick another model.", 502);
      } catch (err) {
        if (controller.signal.aborted) {
          return errorJson("Venice took too long to answer. Try again, or pick a faster model like Venice Uncensored 1.2.", 504);
        }
        const msg = err instanceof Error ? err.message : String(err);
        return errorJson(`Couldn't connect to Venice: ${msg}`, 502);
      } finally {
        clearTimeout(timeout);
      }
    };

    let result = await callVenice(true);

    // Retry once without disable_thinking if Venice rejects that parameter
    if (result.status === 502) {
      const clone = result.clone();
      try {
        const errBody = await clone.json();
        const errMsg = typeof errBody?.error === "string" ? errBody.error : "";
        if (errMsg.includes("Venice error 400") && errMsg.includes("disable_thinking")) {
          result = await callVenice(false);
        }
      } catch { /* keep original result */ }
    }

    return result;
  } catch (err) {
    console.error("Spell Forge error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Couldn't connect to Venice: ${msg}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
