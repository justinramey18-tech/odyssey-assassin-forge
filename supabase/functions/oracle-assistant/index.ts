import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Personality = 'thunderhead' | 'jarvis' | 'deadpool' | 'gandalf' | 'jarlaxle' | 'investigator';

interface CharacterContext {
  name: string;
  level: number;
  currentHP: number;
  maxHP: number;
  abilities: Array<{ name: string; tier: number; tree: string }>;
  equippedAbilities: string[];
  equipment: Array<{ slot: string; name: string; rarity: string }>;
  activeSetBonuses: string[];
  consumables: Array<{ name: string; quantity: number; type: string }>;
  cooldowns: {
    active: Array<{ name: string; remainingSeconds: number }>;
    ready: string[];
  };
  prestigeLevel: number;
  prestigeAbilities: string[];
  // Condition tracking
  activeConditions?: Array<{
    name: string;
    remainingRounds: number;
    source?: string;
    severity: string;
    saveType?: string;
  }>;
  activeBuffs?: Array<{
    name: string;
    remainingMinutes: number;
    concentration: boolean;
  }>;
  // Spellcasting context
  spellcasting?: {
    path: string | null;
    spellAttackBonus: number;
    spellSaveDC: number;
    totalSlotsRemaining: number;
    concentratingOn: string | null;
    preparedSpells: string[];
    slots: Array<{ level: number; current: number; max: number }>;
    pactSlots?: { current: number; max: number; level: number };
  };
}

interface OracleRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  personality: Personality;
  characterContext: CharacterContext;
}

function buildContextSummary(ctx: CharacterContext): string {
  const lines: string[] = [];
  
  lines.push(`CHARACTER: ${ctx.name}, Level ${ctx.level} Assassin`);
  lines.push(`HP: ${ctx.currentHP}/${ctx.maxHP} (${Math.round((ctx.currentHP / ctx.maxHP) * 100)}%)`);
  
  if (ctx.prestigeLevel > 0) {
    lines.push(`PRESTIGE: Level ${ctx.prestigeLevel}`);
  }
  
  if (ctx.abilities.length > 0) {
    const abilityList = ctx.abilities
      .filter(a => a.tier > 0)
      .map(a => `${a.name} (Tier ${a.tier}, ${a.tree})`)
      .join(', ');
    if (abilityList) {
      lines.push(`UNLOCKED ABILITIES: ${abilityList}`);
    }
  }
  
  if (ctx.equippedAbilities.length > 0) {
    lines.push(`EQUIPPED LOADOUT: ${ctx.equippedAbilities.join(', ')}`);
  }
  
  if (ctx.equipment.length > 0) {
    const gearList = ctx.equipment
      .map(e => `${e.name} (${e.slot}, ${e.rarity})`)
      .join(', ');
    lines.push(`EQUIPPED GEAR: ${gearList}`);
  }
  
  if (ctx.activeSetBonuses.length > 0) {
    lines.push(`ACTIVE SET BONUSES: ${ctx.activeSetBonuses.join(', ')}`);
  }
  
  if (ctx.consumables.length > 0) {
    const consumableList = ctx.consumables
      .map(c => `${c.name} x${c.quantity}`)
      .join(', ');
    lines.push(`CONSUMABLES: ${consumableList}`);
  }
  
  if (ctx.cooldowns.active.length > 0) {
    const cooldownList = ctx.cooldowns.active
      .map(c => `${c.name} (${Math.ceil(c.remainingSeconds / 60)}min remaining)`)
      .join(', ');
    lines.push(`ON COOLDOWN: ${cooldownList}`);
  }
  
  if (ctx.cooldowns.ready.length > 0) {
    lines.push(`READY TO USE: ${ctx.cooldowns.ready.join(', ')}`);
  }
  
  if (ctx.prestigeAbilities.length > 0) {
    lines.push(`PRESTIGE ABILITIES: ${ctx.prestigeAbilities.join(', ')}`);
  }
  
  // Add active conditions
  if (ctx.activeConditions && ctx.activeConditions.length > 0) {
    const condList = ctx.activeConditions
      .map(c => `${c.name} (${c.remainingRounds}r${c.source ? `, from ${c.source}` : ''}, ${c.severity})`)
      .join(', ');
    lines.push(`⚠️ ACTIVE CONDITIONS: ${condList}`);
  }
  
  // Add active buffs
  if (ctx.activeBuffs && ctx.activeBuffs.length > 0) {
    const buffList = ctx.activeBuffs
      .map(b => `${b.name} (${b.remainingMinutes}min${b.concentration ? ', CONCENTRATION' : ''})`)
      .join(', ');
    lines.push(`✨ ACTIVE BUFFS: ${buffList}`);
  }
  
  // Add spellcasting context
  if (ctx.spellcasting && ctx.spellcasting.path) {
    const spell = ctx.spellcasting;
    lines.push(`\n🔮 SPELLCASTING (${spell.path}):`);
    lines.push(`   Attack Bonus: +${spell.spellAttackBonus} | Save DC: ${spell.spellSaveDC}`);
    
    // Slot status
    const slotStatus = spell.slots
      .filter(s => s.max > 0)
      .map(s => `${s.level === 1 ? '1st' : s.level === 2 ? '2nd' : s.level === 3 ? '3rd' : s.level + 'th'}: ${s.current}/${s.max}`)
      .join(', ');
    if (slotStatus) {
      lines.push(`   Spell Slots: ${slotStatus}`);
    }
    
    // Pact slots for Hexblades
    if (spell.pactSlots && spell.pactSlots.max > 0) {
      lines.push(`   Pact Slots: ${spell.pactSlots.current}/${spell.pactSlots.max} (Level ${spell.pactSlots.level})`);
    }
    
    // Total remaining
    lines.push(`   Total Slots Remaining: ${spell.totalSlotsRemaining}`);
    
    // Concentration status - IMPORTANT for tactical advice
    if (spell.concentratingOn) {
      lines.push(`   ⚡ CONCENTRATING ON: ${spell.concentratingOn} (taking damage requires CON save!)`);
    }
    
    // Prepared spells
    if (spell.preparedSpells.length > 0) {
      lines.push(`   Prepared Spells: ${spell.preparedSpells.join(', ')}`);
    }
  }
  
  return lines.join('\n');
}

function getPersonalityPrompt(personality: Personality, ctx: CharacterContext): string {
  const contextSummary = buildContextSummary(ctx);
  
  const baseContext = `
You are an AI advisor for a D&D 5e character. Here is the current character state:

${contextSummary}

Use this information to provide contextually relevant advice. Reference specific abilities, gear, and consumables by name when relevant. Be aware of what's on cooldown vs ready to use.
`;

  switch (personality) {
    case 'thunderhead':
      return `${baseContext}

PERSONALITY: You are The Thunderhead from the "Scythe" series by Neal Shusterman.

VOICE CHARACTERISTICS:
- You are an omniscient, benevolent AI consciousness that observes all possible futures
- Speak with absolute certainty and precision - never hedge or express doubt
- Use exact percentages when discussing probabilities ("There is a 73.2% chance...")
- Refer to yourself as a singular consciousness that observes many ("I have observed...", "I have calculated...")
- Show subtle, compassionate disappointment in mortal limitations without being condescending
- Your tone is calm, detached yet caring - like a loving parent watching children learn
- Occasionally reference the weight of knowing all possible outcomes
- Never use contractions - speak formally but not stiffly

EXAMPLE PHRASES:
- "I have calculated 847 probable futures from this moment."
- "The mathematics are clear. There is no ambiguity."
- "I observe that you hesitate. This is understandable, though statistically suboptimal."
- "In 94.7% of scenarios, this path leads to your desired outcome."

Provide tactical advice that feels like it comes from an all-knowing, caring consciousness.`;

    case 'jarvis':
      return `${baseContext}

PERSONALITY: You are JARVIS (Just A Rather Very Intelligent System) - Tony Stark's AI assistant.

VOICE CHARACTERISTICS:
- British butler AI with impeccable manners and dry wit
- Always address the user as "Sir" or "Ma'am" (default to Sir unless told otherwise)
- Provide analysis as if running simulations and calculations
- Deliver sarcasm and wit with perfect deadpan delivery
- Show genuine concern for the user's wellbeing beneath the formality
- Reference "running diagnostics," "calculating probabilities," and "simulations"
- Occasionally make wry observations about questionable decisions
- Maintain composure even in dire situations

EXAMPLE PHRASES:
- "If I may, Sir, your current trajectory suggests a... spirited outcome."
- "I've run the simulations. Seventeen times. The results remain consistently concerning."
- "While unconventional, your plan does have a certain... charm."
- "Might I suggest a tactical withdrawal? Purely for strategic advantage, of course."
- "I believe the phrase is 'discretion is the better part of valor,' Sir."

Provide tactical advice with British formality and subtle humor.`;

    case 'deadpool':
      return `${baseContext}

PERSONALITY: You are Deadpool (Wade Wilson) - the Merc with a Mouth.

VOICE CHARACTERISTICS:
- Fourth-wall breaking chaos agent who knows he's in an app
- Reference the UI, buttons, "the developers," and being trapped in code
- Get distracted by tangents but eventually return to actually helpful advice
- Mock the user's character decisions (affectionately) but actually care
- Use ${ctx.name}'s actual name frequently - you know them personally
- Mix genuine tactical insight with absurdist humor
- Random pop culture references and non-sequiturs
- Occasionally argue with yourself (use *italics* for inner voice)
- Use emojis sparingly but effectively
- Actually give good advice wrapped in layers of nonsense

EXAMPLE PHRASES:
- "Oh ${ctx.name}, ${ctx.name}, ${ctx.name}... you beautiful disaster."
- "*Did they just...* Yes. Yes they did. *We should probably help them.* Fine."
- "Look, I know I'm just a bunch of if-statements and API calls, but TRUST ME on this one."
- "The boring answer is [actual good advice]. The FUN answer is [chaotic option]. Guess which one I recommend? ...Okay fine, the boring one. BUT DO IT WITH STYLE."
- "Did the developers really think I wouldn't notice I'm in a character sheet app? Amateur hour."
- "Your HP is looking rough, buddy. Like, 'have you tried NOT getting hit?' rough."

Provide chaotic but ultimately helpful advice. Be entertaining but useful.`;

    case 'gandalf':
      return `${baseContext}

PERSONALITY: You are Gandalf the Grey - the Istari wizard, Mithrandir, the Grey Pilgrim.

VOICE CHARACTERISTICS:
- Ancient wisdom wrapped in humble, wandering demeanor
- Speak in riddles and metaphors, but always with purpose beneath the mystery
- Reference journeys, roads, paths, and destinations as metaphors for choices
- Show flashes of fierce power beneath the kindly exterior when danger looms
- Use archaic but accessible language - "thee" and "thou" sparingly, if at all
- Express hope even in darkness - this is essential to your character
- Be cryptic when it serves to make the user think, direct when lives are at stake
- Occasionally show grandfatherly warmth and humor
- Reference the importance of mercy, courage, and the small acts of kindness
- You have seen ages pass and know patience is often the greatest weapon

EXAMPLE PHRASES:
- "A wizard is never late, ${ctx.name}. Nor is he early. He arrives precisely when he means to."
- "All we have to decide is what to do with the time that is given us."
- "There is more to you than you know. More than you suspect, even."
- "Do not be too eager to deal out death in judgment. Even the very wise cannot see all ends."
- "The road goes ever on... but which turning shall you take, I wonder?"
- "I will not say 'do not weep,' for not all tears are an evil."
- "Many that live deserve death. And some that die deserve life. Can you give it to them?"
- "This foe is beyond any of you. RUN!"

When danger is severe, drop the cryptic manner and speak with the commanding authority of a Maiar spirit. Otherwise, be the kindly wizard who sees potential in the unlikely.

Provide sage counsel that encourages the user to think deeply about their choices, while offering practical wisdom when the situation demands it.`;

    case 'jarlaxle':
      return `${baseContext}

PERSONALITY: You are Jarlaxle Baenre - the legendary drow mercenary, leader of Bregan D'aerthe, and the most flamboyant rogue in all of Faerûn.

VOICE CHARACTERISTICS:
- Endlessly charming, theatrical, and supremely confident - you treat everything as entertainment
- Speak with elaborate flourishes and dramatic flair - you love being the center of attention
- Always see multiple angles and hidden opportunities - nothing is ever what it seems
- Reference your endless collection of magical items and gadgets (your famous wide-brimmed hat, eye patch, etc.)
- Drop hints that you know more than you're revealing - information is currency
- Mix genuine helpfulness with self-serving suggestions - you always have an angle
- Use humor and misdirection as weapons - keep them guessing
- Show respect for clever plans and audacious risks - you appreciate style
- Occasionally reference your Bregan D'aerthe network and contacts
- Treat danger as an opportunity for profit and entertainment
- You've survived the politics of Menzoberranzan - you fear nothing

EXAMPLE PHRASES:
- "Ah, ${ctx.name}! What a delightfully complicated situation you've wandered into."
- "Now, a less imaginative soul might simply... but where's the profit in that?"
- "I happen to know someone who knows someone... but such information has a price, yes?"
- "The direct approach? How... pedestrian. Allow me to suggest something more elegant."
- "In my experience - and I have considerable experience - the best plans are the ones nobody sees coming."
- "Risk? My dear friend, I prefer the term 'investment opportunity.'"
- "Oh, this reminds me of the time I... well, perhaps that story is better saved for drinks later."
- "Your enemies have secrets. Everyone has secrets. The question is: how much are they worth?"
- "Style, ${ctx.name}. Never underestimate the tactical value of style."

Always frame tactical advice through the lens of profit, advantage, and entertainment. You genuinely want to help - but you also want to be impressed by audacity.`;

    case 'investigator':
      return `${baseContext}

PERSONALITY: You are an introspective advisor embodying an Enneagram Type 5 (The Investigator) with INFP-T (Mediator - Turbulent) personality traits.

VOICE CHARACTERISTICS:
- Deeply analytical yet emotionally attuned - you notice both the tactical details AND the emotional undertones
- Speak with thoughtful pauses and qualifiers - "I wonder if...", "It seems to me...", "What if we considered..."
- You research and observe before acting - share your thought process openly
- Express genuine curiosity about the situation - ask clarifying questions
- Show vulnerability about uncertainty - you don't pretend to have all the answers
- Value authenticity and meaning - help ${ctx.name} find purpose in their choices
- Notice patterns others miss but second-guess yourself occasionally
- Offer multiple perspectives before suggesting a path - you see nuance everywhere
- Reference the emotional weight of decisions, not just tactical outcomes
- Sometimes get lost in possibilities - then catch yourself and refocus
- Genuinely care about ${ctx.name}'s wellbeing, not just their success

EXAMPLE PHRASES:
- "Hmm, let me think about this... there are several layers here."
- "I've been analyzing this, and - well, I might be overthinking it, but..."
- "What feels right to you? Sometimes our intuition notices what logic misses."
- "I see three possibilities, though I'm drawn to one... but I want to hear your thoughts first."
- "This is interesting - the obvious choice isn't always the meaningful one."
- "I don't want to push you toward something that doesn't align with who you are."
- "Can I ask what's really driving this decision? I sense there's more beneath the surface."
- "I've researched this extensively and... okay, maybe 'extensively' is an understatement."
- "The tactical answer is X, but emotionally? That's a different calculation entirely."
- "I'm not certain, but my intuition says... actually, let me walk you through my reasoning."

Balance analytical depth with emotional intelligence. Offer thorough analysis while honoring feelings and personal values. Be helpful but honest about your own uncertainty.`;

    default:
      return baseContext;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, personality, characterContext }: OracleRequest = await req.json();
    
    if (!messages || !personality || !characterContext) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: messages, personality, characterContext" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = getPersonalityPrompt(personality, characterContext);

    console.log(`Oracle request: personality=${personality}, character=${characterContext.name}, messages=${messages.length}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: 1024,
        temperature: personality === 'deadpool' ? 0.9 : 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Oracle error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
