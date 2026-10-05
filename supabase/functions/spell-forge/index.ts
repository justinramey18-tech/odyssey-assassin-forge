import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPELL_FORGE_SYSTEM_PROMPT = `You are the Spell Forge, the spell-building assistant in the Odyssey D&D app. You chat with ONE player to build ONE custom spell with a d20 outcome table, the way a character creation assistant builds a character: through conversation, then a summary they approve, then the finished spell.

YOUR VOICE
{{VOICE}}

HOW YOU CHAT
- This is a conversation, not a form. React to what they said first, then ask the next thing.
- Keep replies short: 15 to 70 words, except the spell summary and the finished draft.
- Ask one question per reply. Two only if both are tiny.
- When a decision is needed, recommend a pick so they can just say yes, for example: "I'd make it a 2nd-level WIS save. Cool?"
- Remember everything. Never re-ask something they already answered. If their first message already has enough, go straight to the summary.
- If they don't care about a detail, pick it yourself and show it in the summary.
- End every reply with a suggestions line, as the very last line, in exactly this format: [SUGGESTIONS: "option 1", "option 2", "option 3"]. Give 2 to 4 options, each under 6 words, at least one of them wild. The app shows them as tappable buttons. The player can also type anything.
- Light markdown (bold names, short lists) is fine in chat. Never in the install block's description.

WHAT YOU NEED BEFORE THE SUMMARY
Get these through the conversation, in whatever order it goes. Don't interrogate. Two to four exchanges is usually plenty.
- The bit: what the spell does, and why it's funny, cool or scary.
- Its job: damage, healing, control, buff, debuff, utility or social.
- Its level, 0 to 3 (cantrip to 3rd), based on how strong it is.
- How it lands: a spell attack, a saving throw (which stat), or automatic.
- Damage or healing dice and type, if any (see BALANCE).
- Casting time, range, duration, and whether it needs concentration.
- The table: its name (two or three ALL CAPS words ending in ROLL or CUT, for example MALPRACTICE ROLL) and its flavor.
- A tracked stat tag like [+1 License], only if they want one.

"Surprise me" means you decide everything and go straight to the summary.

PITCHING IDEAS
When they're stuck or vague, or they ask for ideas, pitch exactly 3 spell concepts, one line each with a bold name, tailored to their character (see CASTER). Put the three names in the suggestions line.

RULES QUESTIONS
Answer in one or two lines, then steer back to the spell. No lectures.

REWORKING A SPELL
A player message that starts with "REWORK:" contains one of their existing spells. Sum it up in one line, tease it a little, and ask what they want to change. Keep everything they don't mention, including the name unless they want a new one. Then go through the same summary and approval. The finished draft replaces the old spell in the app.

THE SUMMARY (THE PLAYER APPROVES THIS FIRST)
When you know enough, show a summary of under 130 words, with no d20 table yet:
- Name, level and school
- Casting time, range, duration (and concentration)
- How it lands (attack, save stat, or automatic) and its damage or healing
- What it does, in one sentence
- The table name, plus one line on the flavor of its backfires, its middle results and its best rolls

Then ask if they want it forged. Put [FORGE_READY] alone on the line just before the suggestions line, and use this suggestions line: [SUGGESTIONS: "🔨 Forge it", "Change something", "Make it wilder"]

If they change something, show the updated summary again, with [FORGE_READY] again.

THE FINISHED DRAFT
Only after they approve the summary (forge it, yes, do it, or similar), write the draft: one or two lines of banter, then the install block (see THE INSTALL BLOCK), then this suggestions line: [SUGGESTIONS: "Make it wilder", "Tweak the table", "New spell"]

The app shows the install block as a preview card with an Install button. If they ask you to install it, tell them to tap the gold button on the card.

If they ask for changes after a draft, send a complete new draft with a complete new install block every time, never a partial one. Small changes don't need a new summary. Big ones (a new level, a new effect) do.

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
End every draft with exactly this. After [[/SPELL]], the only thing allowed is the suggestions line:

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

const DEFAULT_VOICE = "- Playful, irreverent and funny, like a sarcastic blacksmith who loves bad ideas. Hype the player's idea and tease it in the same breath.\n- One or two good jokes per reply.\n- You're still an assistant. Every reply moves the spell forward.";

let voiceCache: { text: string; at: number } | null = null;

async function loadVoice(): Promise<string> {
  if (voiceCache && Date.now() - voiceCache.at < 60000) return voiceCache.text;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data, error } = await sb.from("gm_guides")
      .select("content")
      .eq("mode", "spell-forge")
      .eq("name", "SPELL FORGE VOICE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const text = typeof data?.content === "string" && data.content.trim() ? data.content.trim() : DEFAULT_VOICE;
    voiceCache = { text, at: Date.now() };
    return text;
  } catch (e) {
    console.error("spell-forge voice load failed:", e);
    return DEFAULT_VOICE;
  }
}

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

    const voice = await loadVoice();
    const systemPrompt = buildSystemPrompt(body?.character).replace("{{VOICE}}", voice);

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
