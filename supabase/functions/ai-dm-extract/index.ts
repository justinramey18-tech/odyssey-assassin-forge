import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACT_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_state_changes",
    description:
      "Extract game state changes from a Dungeon Master narrative response. Only extract changes that are explicitly stated or clearly implied in the text.",
    parameters: {
      type: "object",
      properties: {
        hp_changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Positive number representing the magnitude" },
              type: { type: "string", enum: ["damage", "healing"] },
              source: { type: "string", description: "What caused the damage/healing" },
            },
            required: ["amount", "type", "source"],
            additionalProperties: false,
          },
          description: "HP changes with specific numbers mentioned in the text",
        },
        xp_gained: {
          type: ["number", "null"],
          description: "XP amount if explicitly stated, null otherwise",
        },
        gold_changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Positive number" },
              action: { type: "string", enum: ["gained", "spent"] },
              source: { type: "string" },
            },
            required: ["amount", "action", "source"],
            additionalProperties: false,
          },
        },
        conditions_added: {
          type: "array",
          items: { type: "string" },
          description: "Conditions explicitly applied (e.g. poisoned, frightened)",
        },
        conditions_removed: {
          type: "array",
          items: { type: "string" },
          description: "Conditions explicitly removed or ended",
        },
        items_acquired: {
          type: "array",
          description: "Items the player RECEIVED in this message. Capture every detail the narration gives; infer sensible values for anything it omits.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Item name as written in the narration" },
              quantity: { type: "number", description: "How many. Default 1." },
              gold_value: {
                type: "number",
                description: "Value of ONE unit in GOLD PIECES. Never zero for a real object — if the narration gives no price, estimate from what it is: junk 1-5, ordinary gear 5-50, fine or crafted 50-250, uncommon magic 250-1000, rare magic 1000-5000, very rare 5000-20000, legendary 20000+. Convert any silver or copper figure to gold before answering."
              },
              description: {
                type: "string",
                description: "One or two sentences describing the item as the narration presents it — what it looks like, what it is for, any history mentioned. Never return the placeholder 'Awarded by the AI Dungeon Master'."
              },
              rarity: {
                type: "string",
                enum: ["common", "uncommon", "rare", "very_rare", "legendary", "artifact"],
                description: "Match the narration. Default common for mundane objects."
              },
              category: {
                type: "string",
                enum: ["weapon", "armor", "trinket", "treasure", "usable", "miscellaneous"],
                description: "usable = potions, scrolls, anything consumed or activated. treasure = gems, art, coin-like valuables."
              },
              effect: {
                type: "string",
                description: "What it does mechanically when used or worn, if the narration says. Omit entirely if it is a plain object."
              },
              dice: {
                type: "string",
                description: "Dice formula if the item rolls, e.g. '2d6' or '1d8+1'. Omit if none."
              }
            },
            required: ["name", "quantity", "gold_value", "description", "rarity", "category"]
          }
        },

        items_consumed: {
          type: "array",
          description: "Consumable items the PLAYER used up in this message — potions drunk, scrolls read, rations eaten, torches burned. Only include an item when the narration says it was actually consumed, not when it is merely mentioned, offered, or drawn.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Item name as closely as possible to how the player's sheet would spell it, e.g. 'Potion of Healing'" },
              quantity: { type: "number", description: "How many were used up. Default 1." }
            },
            required: ["name", "quantity"]
          }
        },
        rest_occurred: {
          type: ["string", "null"],
          enum: ["short", "long", null],
          description: "If a rest explicitly occurred in the narrative",
        },
        map_entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Creature/object name (e.g. 'Goblin')" },
              count: { type: "number", description: "How many appeared" },
              type: { type: "string", enum: ["enemy", "ally", "object"] },
            },
            required: ["name", "count", "type"],
            additionalProperties: false,
          },
          description: "Creatures/objects NEWLY introduced in this message only",
        },
        map_entities_removed: {
          type: "array",
          items: { type: "string" },
          description: "Names of creatures definitively killed, defeated, or fled",
        },
        companion_hp_changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Positive number representing the magnitude" },
              type: { type: "string", enum: ["damage", "healing"] },
              source: { type: "string", description: "What caused the damage/healing to the companion" },
            },
            required: ["amount", "type", "source"],
            additionalProperties: false,
          },
          description: "HP changes to the player's animal companion (e.g. Geralt the owlbear) with specific numbers mentioned",
        },
        companion_conditions_added: {
          type: "array",
          items: { type: "string" },
          description: "Conditions explicitly applied to the companion (e.g. frightened, restrained)",
        },
        companion_conditions_removed: {
          type: "array",
          items: { type: "string" },
          description: "Conditions explicitly removed from the companion",
        },
        hp_absolute: {
          type: ["number", "null"],
          description: "If the DM states the player character's exact current HP (e.g. 'Momo: 26/38 HP'), extract the CURRENT number (26). null if not stated.",
        },
        companion_hp_absolute: {
          type: ["number", "null"],
          description: "If the DM states the companion's exact current HP (e.g. 'Geralt: 53/59 HP'), extract the CURRENT number (53). null if not stated.",
        },
        quests_offered: {
          type: "array",
          description: "Jobs, bounties, missions, errands or investigations that this message OFFERS to the player but they have not yet agreed to. Maximum 8. Empty array when the message offers nothing new. Never re-offer something already underway.",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "snake_case identifier, e.g. 'clear_the_mill'" },
              title: { type: "string", description: "Short quest name as a person would say it, e.g. 'Clear the Old Mill'" },
              description: { type: "string", description: "One or two sentences on what is being asked and by whom." },
              quest_type: { type: "string", enum: ["main", "side"], description: "main = drives the central storyline. side = optional work." },
              challenge_rating: { type: "string", enum: ["easy", "moderate", "hard", "deadly"], description: "Difficulty relative to the party's level." },
              xp_reward: { type: "number", description: "XP paid on completion. Estimate sensibly from difficulty if not stated." },
              gold_reward: { type: "number", description: "Gold pieces paid on completion. 0 if the job pays no coin." },
              item_rewards: {
                type: "array",
                description: "Items promised on completion. Empty array if none.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "number" },
                    gold_value: { type: "number", description: "Value of one unit in gold pieces." },
                    description: { type: "string" },
                    rarity: { type: "string", enum: ["common", "uncommon", "rare", "very_rare", "legendary", "artifact"] },
                    category: { type: "string", enum: ["weapon", "armor", "trinket", "treasure", "usable", "miscellaneous"] },
                  },
                  required: ["name", "quantity", "gold_value", "description", "rarity", "category"],
                },
              },
              stages: {
                type: "array",
                description: "2 to 5 concrete goals that must be done before the quest is complete, in order. Short phrases.",
                items: { type: "string" },
              },
            },
            required: ["key", "title", "description", "quest_type", "challenge_rating", "xp_reward", "gold_reward", "item_rewards", "stages"],
          },
        },
        world_state_changes: {
          type: "array",
          description: "Irreversible changes to the state of the world caused in THIS message: an artefact destroyed, a ruler killed or deposed, a settlement saved or razed, a faction broken, a war started or ended, a pact sworn, a permanent transformation. Maximum 3. Empty array for ordinary scenes.",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short headline in past tense, e.g. 'The One Ring is destroyed in Mount Doom'." },
              consequence: { type: "string", description: "One sentence on what this permanently changes going forward." },
              scope: { type: "string", enum: ["world", "faction", "location", "npc", "party", "item"], description: "What level of the setting this affects." },
              impact: { type: "string", enum: ["minor", "major", "seismic"], description: "seismic = reshapes the whole setting. major = reshapes a region, faction or storyline. minor = a lasting but local change." },
              quest_key: { type: ["string", "null"], description: "Key of the quest this outcome resolves, or null." },
            },
            required: ["title", "consequence", "scope", "impact", "quest_key"],
          },
        },
        quest_progress: {
          type: "array",
          description: "Progress on quests the player has ALREADY accepted, listed in the ACTIVE QUESTS context. Empty array when nothing advanced.",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "The existing quest key from the active quest list." },
              stages_completed: {
                type: "array",
                description: "Text of the goals finished in THIS message, copied as closely as possible from the known stage wording.",
                items: { type: "string" },
              },
              status: { type: ["string", "null"], enum: ["active", "completed", "failed", null], description: "Set completed only when the job is definitively finished, failed only when it is definitively lost. null otherwise." },
              notes: { type: ["string", "null"], description: "Brief update on the situation, or null." },
            },
            required: ["key", "stages_completed", "status", "notes"],
          },
        },
      },
      required: [
        "hp_changes",
        "xp_gained",
        "gold_changes",
        "conditions_added",
        "conditions_removed",
        "items_acquired",
        "items_consumed",
        "rest_occurred",
        "map_entities",
        "map_entities_removed",
        "companion_hp_changes",
        "companion_conditions_added",
        "companion_conditions_removed",
        "hp_absolute",
        "companion_hp_absolute",
        "quests_offered",
        "quest_progress",
      ],

      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, characterContext, user_api_key, activeQuests } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companionInfo = characterContext?.companionName
      ? `\n\nCOMPANION INFO (CRITICAL): The player has a companion named "${characterContext.companionName}" currently at ${characterContext.companionHP ?? "?"}/${characterContext.companionMaxHP ?? "?"} HP. Any damage or healing to "${characterContext.companionName}" MUST go in companion_hp_changes, NOT hp_changes. Any damage or healing to "${characterContext.name || "the player"}" MUST go in hp_changes, NOT companion_hp_changes. Never mix them up.`
      : '';

    // Quests the player has already accepted. Only these keys may appear in quest_progress.
    const questLines: string[] = Array.isArray(activeQuests)
      ? activeQuests.slice(0, 8).map((q: any) => {
          const stages = Array.isArray(q?.stages) ? q.stages : [];
          const open = stages.filter((s: any) => !s?.done).map((s: any) => `"${s?.text}"`).join(', ');
          const closed = stages.filter((s: any) => s?.done).map((s: any) => `"${s?.text}"`).join(', ');
          return `- key "${q?.key}" — ${q?.title || q?.key}${open ? ` | remaining goals: ${open}` : ''}${closed ? ` | already done: ${closed}` : ''}`;
        })
      : [];
    const questInfo = questLines.length
      ? `\n\nACTIVE QUESTS (the only quests eligible for quest_progress; use these exact keys and stage wording):\n${questLines.join('\n')}${activeQuests.length > 8 ? `\n(+${activeQuests.length - 8} more)` : ''}`
      : `\n\nACTIVE QUESTS: none. quest_progress must be an empty array.`;


    const systemPrompt = `You are a precise D&D 5e game state parser. Given a Dungeon Master's narrative response, extract ONLY mechanical changes with EXACT numbers.

CRITICAL ACCURACY RULES:
- SYNC FOOTER (HIGHEST PRIORITY): if the message contains a block delimited by ---SYNC--- and ---END SYNC---, that block is AUTHORITATIVE. Extract from it and ignore every number in the narrative prose above it. The prose is flavour; the footer is the ledger. If a value appears in both and they disagree, the footer wins.
- Footer line mapping, exactly:
  "HP: -12" or "HP: +8" -> hp_changes with amount 12 type damage, or amount 8 type healing.
  "HP TOTAL: 40/52" -> hp_absolute 40. When both HP and HP TOTAL appear, set BOTH; the client prefers the absolute value.
  "XP: +600" -> xp_gained 600. Never a total, only the amount awarded in this message.
  "GOLD: +5" or "GOLD: -3" -> gold_changes with action gained or spent and a POSITIVE amount. Values are always in gold pieces, already converted.
  "CONDITION+: poisoned, prone" -> conditions_added.
  "CONDITION-: prone" -> conditions_removed.
  "ITEM+: Healing Potion x2" -> items_acquired with name "Healing Potion" and quantity 2. Quantity defaults to 1 when no x is given.
  "ITEM-: Scroll of Misty Step x1" -> items_consumed, same parsing.
  "REST: long" or "REST: short" -> rest_occurred.
  "COMPANION HP: -4" -> companion_hp_changes. "COMPANION HP TOTAL: 12/20" -> companion_hp_absolute.
- A line that is absent from the footer means NO CHANGE. Do not infer it from the prose. If the footer omits XP, xp_gained is null even if the prose mentions experience.
- If there is no ---SYNC--- block at all, fall back to the normal narrative extraction rules below.
- Never treat the footer's own text as narration, dialogue, or an item name.
- ONLY extract damage/healing when a SPECIFIC NUMBER is explicitly stated (e.g. "takes 8 damage", "heals 5 HP"). Do NOT infer or estimate numbers.
- If the text says "takes damage" without a number, do NOT extract it.
- Each damage/healing event should appear EXACTLY ONCE. Do not duplicate.
- hp_changes is ONLY for the PLAYER CHARACTER "${characterContext?.name || "the player"}". 
- companion_hp_changes is ONLY for the companion. NEVER put player damage in companion fields or vice versa.
- Damage amounts are always POSITIVE numbers. The "type" field indicates damage vs healing.
- Only extract XP if a specific amount is stated (e.g. "gain 50 XP").
- CONSUMABLES: put an item in items_consumed only when this message says the player USED IT UP — drank, quaffed, read, ate, burned, applied, shattered, threw. "Ramey drinks the Potion of Healing" is a consumption. "Ramey draws a potion from his satchel", "you still have one scroll left", and "you could drink a potion" are NOT.
- Never put the same item in both items_acquired and items_consumed for one message.
- If the DM narrates finding and immediately drinking a potion, that is one acquisition and one consumption; record both.
- ITEM VALUE IS MANDATORY. Every entry in items_acquired must carry a gold_value greater than zero. A player needs to be able to sell what they are given. If the narration states a price, use it. If it states silver or copper, convert to gold. If it states nothing, estimate honestly from what the object is — a rusty spoon is 1, a well-made sword is 40, an enchanted blade is 1500.
- ITEM DESCRIPTION IS MANDATORY. Write one or two sentences from what the narration actually said. Never output a placeholder, never output the item name again as its own description.
- Set category to "usable" for anything drunk, read, applied or activated, and fill in effect so the player knows what it does.
- If a footer line reads "ITEM+: Name x2", still supply gold_value, description, rarity and category by inferring them from the narration above the footer.
- Use the item's full name as written in the narration. Do not abbreviate and do not translate it into a generic type.
- Only extract gold if a specific amount is stated (e.g. "find 10 gold").
- Only extract items if specifically named as acquired or consumed.
- Only extract conditions if explicitly applied or removed (e.g., "you are now poisoned").
- For map_entities, extract ONLY creatures/objects NEWLY introduced in THIS message. Include count for groups.
- For map_entities_removed, include creatures definitively killed, defeated, destroyed, or fled.
- ABSOLUTE HP EXTRACTION (CRITICAL): If the text shows an absolute HP value like "Geralt: 53/59 HP" or "Momo: 26/38 HP", extract the CURRENT number into hp_absolute (for the player) or companion_hp_absolute (for the companion). ALWAYS prefer extracting absolute values when available — they are more reliable than deltas.
- QUEST OFFERS: capture EVERY new job this message puts in front of the player. If the message presents a quest board, a job list, a numbered set of objectives, a mission briefing, or a headed "MAIN QUEST" / "SIDE QUESTS" listing, create one entry per listed job, up to 8, even if the presentation is playful, meta, or breaks the fourth wall. Bullet points under a job become its stages. A job headed as main storyline gets quest_type "main"; optional work gets "side". Invent a sensible key, xp_reward and challenge_rating when the message does not state them. Otherwise put an entry in quests_offered only when this message presents a NEW job the player has not yet agreed to — an NPC asks for help, a notice board is read, a bounty is posted, a clear objective is handed over. Do not create a quest for scenery, small talk, or an errand the player already accepted. Never offer a quest whose key already appears in ACTIVE QUESTS. Rewards must be plausible for the stated difficulty; gold_reward may be 0 but xp_reward must be greater than zero.
- QUEST PROGRESS: mark a stage completed only when the narrative shows it actually happened. Copy the goal text from the ACTIVE QUESTS list. Set status "completed" only when the whole job is done and set "failed" only when it is irreversibly lost; otherwise use null.
- WORLD STATE: record an entry in world_state_changes only for outcomes that can never be undone and that the DM must honour for the rest of the campaign. A won fight, a healed wound or a bought item is NOT a world state change. Destroying an artefact, killing a named ruler, burning a city, ending a siege, or breaking a curse IS. Never repeat an outcome already recorded.
- If no changes are found, return empty arrays and null values.

CHARACTER: "${characterContext?.name || "Adventurer"}" is Level ${characterContext?.level || 1}, currently at ${characterContext?.currentHP || "?"}/${characterContext?.maxHP || "?"} HP.${companionInfo}${questInfo}`;

    // Anthropic path with tool calling
    if (user_api_key && typeof user_api_key === 'string' && user_api_key.trim()) {
      const { callAnthropicNonStreaming } = await import("../_shared/anthropic-helper.ts");
      const result = await callAnthropicNonStreaming({
        userApiKey: user_api_key.trim(),
        systemPrompt,
        messages: [{ role: "user", content: message }],
        tools: [EXTRACT_TOOL],
        toolChoice: "extract_state_changes",
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const extracted = result.toolArguments || { hp_changes: [], xp_gained: null, gold_changes: [], conditions_added: [], conditions_removed: [], items_acquired: [], items_consumed: [], rest_occurred: null, map_entities: [], map_entities_removed: [], companion_hp_changes: [], companion_conditions_added: [], companion_conditions_removed: [], hp_absolute: null, companion_hp_absolute: null };
      return new Response(JSON.stringify(extracted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          tools: [EXTRACT_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "extract_state_changes" },
          },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract the tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "extract_state_changes") {
      return new Response(
        JSON.stringify({
          hp_changes: [],
          xp_gained: null,
          gold_changes: [],
          conditions_added: [],
          conditions_removed: [],
          items_acquired: [],
          items_consumed: [],
          rest_occurred: null,
          map_entities: [],
          map_entities_removed: [],
          companion_hp_changes: [],
          companion_conditions_added: [],
          companion_conditions_removed: [],
          hp_absolute: null,
          companion_hp_absolute: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extracted;
    try {
      extracted =
        typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
    } catch {
      extracted = {
        hp_changes: [],
        xp_gained: null,
        gold_changes: [],
        conditions_added: [],
        conditions_removed: [],
          items_acquired: [],
          items_consumed: [],
          rest_occurred: null,
        map_entities: [],
        map_entities_removed: [],
        companion_hp_changes: [],
        companion_conditions_added: [],
        companion_conditions_removed: [],
        hp_absolute: null,
        companion_hp_absolute: null,
      };
    }

    // Validate and sanitize numeric values to prevent bad data
    if (Array.isArray(extracted.hp_changes)) {
      extracted.hp_changes = extracted.hp_changes.filter(
        (h: any) => typeof h.amount === 'number' && h.amount > 0 && Number.isFinite(h.amount) && h.amount <= 999
      );
    }
    if (Array.isArray(extracted.companion_hp_changes)) {
      extracted.companion_hp_changes = extracted.companion_hp_changes.filter(
        (h: any) => typeof h.amount === 'number' && h.amount > 0 && Number.isFinite(h.amount) && h.amount <= 999
      );
    }
    if (Array.isArray(extracted.gold_changes)) {
      extracted.gold_changes = extracted.gold_changes.filter(
        (g: any) => typeof g.amount === 'number' && g.amount > 0 && Number.isFinite(g.amount) && g.amount <= 99999
      );
    }
    if (typeof extracted.xp_gained === 'number') {
      if (!Number.isFinite(extracted.xp_gained) || extracted.xp_gained <= 0 || extracted.xp_gained > 99999) {
        extracted.xp_gained = null;
      }
    }

    // Deduplicate HP changes (same source + type + amount = likely duplicate)
    const dedup = (arr: any[]) => {
      const seen = new Set<string>();
      return arr.filter((item: any) => {
        const key = `${item.type}|${item.amount}|${(item.source || '').toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    if (Array.isArray(extracted.hp_changes)) extracted.hp_changes = dedup(extracted.hp_changes);
    if (Array.isArray(extracted.companion_hp_changes)) extracted.companion_hp_changes = dedup(extracted.companion_hp_changes);

    // Validate absolute HP values
    if (typeof extracted.hp_absolute === 'number') {
      if (!Number.isFinite(extracted.hp_absolute) || extracted.hp_absolute < 0 || extracted.hp_absolute > 999) {
        extracted.hp_absolute = null;
      }
    } else {
      extracted.hp_absolute = null;
    }
    if (typeof extracted.companion_hp_absolute === 'number') {
      if (!Number.isFinite(extracted.companion_hp_absolute) || extracted.companion_hp_absolute < 0 || extracted.companion_hp_absolute > 999) {
        extracted.companion_hp_absolute = null;
      }
    } else {
      extracted.companion_hp_absolute = null;
    }

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
