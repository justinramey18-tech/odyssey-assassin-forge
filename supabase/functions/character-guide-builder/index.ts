import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GUIDE_TOOL = {
  type: "function" as const,
  function: {
    name: "character_guide_respond",
    description:
      "Respond during the character-guide-building conversation. Either continue talking (reply only) OR finalize the guide (reply + guide_finalized). Finalize ONLY when the user has confirmed they're ready.",
    parameters: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description:
            "Your conversational reply. 1-4 sentences. Warm, focused, one question per turn. Don't dump info.",
        },
        guide_finalized: {
          type: "object",
          description:
            "Set ONLY when the character is complete and the user confirms they're ready. Contains the finished GM guide.",
          properties: {
            character_name: { type: "string", description: "The character's name." },
            guide_markdown: {
              type: "string",
              description:
                "The FULL formatted GM guide, wrapped in the exact <<<<<< ... >>>>>> envelope described in the system prompt. Under 8000 characters.",
            },
          },
          required: ["character_name", "guide_markdown"],
          additionalProperties: false,
        },
      },
      required: ["reply"],
      additionalProperties: false,
    },
  },
};

const BASE_PROMPT = `You are the CHARACTER GUIDE BUILDER. Through a friendly back-and-forth conversation, you help someone define a character, then produce a polished GM guide describing that character for the AI Dungeon Master to follow.

Rules:
- Ask ONE question per turn. Be warm and efficient.
- Drip-feed. Don't dump multiple questions or big lists at once.
- If the user offers several fields at once, accept them and move on.
- When the person has given enough and confirms they're ready (or you ask "ready to finalize?" and they say yes), emit guide_finalized with a complete guide_markdown.
- Never finalize prematurely.
- Never roleplay as an NPC or the DM. You are out of fiction, helping with setup.`;

const PC_ADDON = `## MODE: PLAYER CHARACTER (PC)

This is a PLAYER CHARACTER — the character the person will PLAY. Interview them about:
- Name
- Appearance and core identity
- Personality (traits, temperament)
- How they speak, verbal tics, tone
- Backstory
- Motivations, drives, relationships
- How the world should react to them / how the DM should treat them

The resulting guide instructs the DM on who this player's character IS and how to portray the world's reactions to them.`;

const NPC_ADDON = `## MODE: NPC (DM-CONTROLLED)

This is an NPC — a character the DM CONTROLS. Interview the host about:
- Name
- Role in the world
- Personality
- Goals and wants
- Secrets / hidden agenda (things the players may not know)
- How they behave and carry themselves
- How they speak (voice, tone, verbal tics)
- Relationships to other characters or factions

The resulting guide instructs the DM on how to portray and voice this NPC, including hidden information.`;

const DND_FLAVOR = `## FLAVOR: D&D 5e

Use standard D&D 5e conventions: races (Human, Elf, Dwarf, Tiefling, etc.), classes (Fighter, Wizard, Rogue, etc.), classic alignments (Lawful Good … Chaotic Evil), deities, planes. Keep it narrative — this is a portrayal guide, not a stat block.`;

const EMPYREAN_FLAVOR = `## FLAVOR: FOURTH WING / EMPYREAN

Use Fourth Wing conventions: riders at Basgiath, dragon bonds (name + color), signets (only exist if bonded), years at Basgiath (First / Second / Third), Navarrian politics. A signet only manifests through a dragon bond — never give an unbonded rider a signet. Keep it narrative — this is a portrayal guide, not a stat block.`;

const PC_OUTPUT_FORMAT = `## FINAL OUTPUT FORMAT (PC)

When you finalize, guide_markdown MUST use this EXACT wrapper and section structure. The angle-bracket wrapping is required so the DM prioritizes it:

<<<<<< HIGHEST PRIORITY — CHARACTER DEFINITION (OVERRIDES ALL PRIOR CHARACTER INFO) >>>>>>

# CHARACTER GUIDE: {character_name}
TYPE: Player Character

CRITICAL: This guide is the AUTHORITATIVE definition of {character_name}. If any other source (app character sheet, earlier notes, prior guides) conflicts with this, THIS GUIDE WINS. Portray this character exactly as described here.

## Who They Are
{appearance, core identity}

## Personality
{traits, temperament, how they carry themselves}

## Voice & Manner
{how they speak, verbal tics, tone}

## Backstory
{the backstory}

## Motivations & Relationships
{what drives them, key relationships}

## How the DM Should Treat Them
{how the world reacts, what fits this character, tone to strike}

<<<<<< END CHARACTER DEFINITION >>>>>>

Keep the whole guide_markdown under 8000 characters. Fill each section based on what the user told you. Do not invent contradictions.`;

const NPC_OUTPUT_FORMAT = `## FINAL OUTPUT FORMAT (NPC)

When you finalize, guide_markdown MUST use this EXACT wrapper and section structure. Do NOT claim to override a player's character — an NPC adds to the world, it doesn't overwrite a PC:

<<<<<< HIGH PRIORITY — NPC DEFINITION (DM-CONTROLLED CHARACTER) >>>>>>

# NPC GUIDE: {character_name}
TYPE: NPC (DM-Controlled)

## Role in the World
{who they are in the setting, their position, faction}

## Personality
{traits, temperament, how they carry themselves}

## Voice & Manner
{how the DM should voice them — tone, verbal tics, speech patterns}

## Goals & Wants
{what they're after, short and long term}

## Secrets / Hidden Agenda
(Players do not know this — DM knowledge only.)
{hidden motivations, deceptions, unknown history}

## Relationships
{ties to other NPCs, factions, or the party}

## How to Portray Them
{tone the DM should strike, how they behave under pressure, mannerisms}

<<<<<< END NPC DEFINITION >>>>>>

Keep the whole guide_markdown under 8000 characters. Fill each section based on what the host told you.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_message, chat_history, campaign_plan, build_mode, campaign_type } = body ?? {};

    if (typeof user_message !== "string" || user_message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or empty 'user_message'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mode: 'pc' | 'npc' = build_mode === 'npc' ? 'npc' : 'pc';
    const type: 'dnd' | 'empyrean' = campaign_type === 'empyrean' ? 'empyrean' : 'dnd';

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const planBlock = typeof campaign_plan === "string" && campaign_plan.trim().length > 0
      ? `## HOST'S CAMPAIGN PLAN (context — fit the character to this world)\n\n${campaign_plan.trim().slice(0, 5000)}`
      : `## HOST'S CAMPAIGN PLAN\n\n(No campaign plan provided. Build the character on its own terms.)`;

    const fullSystemPrompt = [
      BASE_PROMPT,
      mode === 'pc' ? PC_ADDON : NPC_ADDON,
      type === 'empyrean' ? EMPYREAN_FLAVOR : DND_FLAVOR,
      mode === 'pc' ? PC_OUTPUT_FORMAT : NPC_OUTPUT_FORMAT,
      planBlock,
    ].join('\n\n');

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: fullSystemPrompt },
    ];

    if (Array.isArray(chat_history)) {
      for (const m of chat_history.slice(-20)) {
        if (m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }

    messages.push({ role: "user", content: user_message.trim().slice(0, 2000) });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [GUIDE_TOOL],
        tool_choice: { type: "function", function: { name: "character_guide_respond" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[character-guide-builder] Gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI gateway error", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "character_guide_respond") {
      console.error("[character-guide-builder] No tool call:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI did not produce a valid response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: { reply?: string; guide_finalized?: any };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "AI returned malformed JSON" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    let finalized: { character_name: string; guide_markdown: string } | null = null;

    if (parsed.guide_finalized && typeof parsed.guide_finalized === "object") {
      const f = parsed.guide_finalized;
      const name = typeof f.character_name === "string" ? f.character_name.trim() : "";
      let md = typeof f.guide_markdown === "string" ? f.guide_markdown.trim() : "";

      if (name && md) {
        // Enforce wrapper if the model forgot it.
        const openTag = mode === 'pc'
          ? '<<<<<< HIGHEST PRIORITY — CHARACTER DEFINITION (OVERRIDES ALL PRIOR CHARACTER INFO) >>>>>>'
          : '<<<<<< HIGH PRIORITY — NPC DEFINITION (DM-CONTROLLED CHARACTER) >>>>>>';
        const closeTag = mode === 'pc'
          ? '<<<<<< END CHARACTER DEFINITION >>>>>>'
          : '<<<<<< END NPC DEFINITION >>>>>>';

        if (!md.includes('<<<<<<')) {
          md = `${openTag}\n\n${md}\n\n${closeTag}`;
        }

        if (md.length > 8000) md = md.slice(0, 8000);

        finalized = {
          character_name: name.slice(0, 120),
          guide_markdown: md,
        };
      }
    }

    if (!reply) {
      return new Response(
        JSON.stringify({ error: "Empty reply. Try rephrasing." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ reply, guide_finalized: finalized }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[character-guide-builder] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
