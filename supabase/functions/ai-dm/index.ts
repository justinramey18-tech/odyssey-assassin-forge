import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface CharacterContext {
  name: string;
  level: number;
  currentHP: number;
  maxHP: number;
  characterClass?: string;
  multiclassBreakdown?: Record<string, number>;
  subclass?: string;
  deity?: string;
  domain?: string;
  gender?: string;
  race?: string;
  backstory?: string;
  relationships?: Array<{ name: string; disposition: string; notes?: string }>;
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
  abilityScores?: {
    strength: { base: number; modifier: number; final: number };
    dexterity: { base: number; modifier: number; final: number };
    constitution: { base: number; modifier: number; final: number };
    intelligence: { base: number; modifier: number; final: number };
    wisdom: { base: number; modifier: number; final: number };
    charisma: { base: number; modifier: number; final: number };
  };
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
  loot?: {
    items: Array<{
      name: string;
      category: string;
      rarity: string;
      goldValue: number;
      hasDiceMechanics: boolean;
    }>;
    totalValue: number;
    usableCount: number;
    diceMechanicsCount: number;
  };
  combat?: {
    isInCombat: boolean;
    roundNumber: number;
    isPlayerTurn: boolean;
    actionUsed: boolean;
    bonusActionUsed: boolean;
    reactionUsed: boolean;
    movementUsed: number;
    maxMovement: number;
    currentTarget: {
      name: string;
      ac: number;
      currentHP: number;
      maxHP: number;
      conditions: string[];
      resistances: string[];
      vulnerabilities: string[];
      immunities: string[];
    } | null;
    enemies: Array<{
      name: string;
      currentHP: number;
      maxHP: number;
      isDefeated: boolean;
      conditions: string[];
    }>;
    recentActions: Array<{
      actionType: string;
      actionName: string;
      timestamp: string;
      damage?: string;
      wasHit?: boolean;
      wasCrit?: boolean;
    }>;
  };
  companion?: {
    name: string;
    currentHP: number;
    maxHP: number;
    conditions: string[];
    mood: string;
    abilities: { str: number; dex: number; con: number; wis: number; int: number; cha: number };
    attacks: Array<{ name: string; bonus: string; damage: string; desc: string }>;
  };
  wildShape?: {
    isTransformed: boolean;
    formName: string | null;
    formHP: number;
    formMaxHP: number;
    formAC: number | null;
    formCR: number | null;
    usesRemaining: number;
    maxUses: number;
  };
}

interface DMRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  characterContext: CharacterContext;
  customGuides?: string;
  campaignSummary?: string;
  worldStatePrompt?: string;
  dmPersonaPrompt?: string;
  model?: string;
  user_api_key?: string;
  user_openai_key?: string;
  encounterGuidance?: string;
  combatFeats?: string[];
  alignmentContext?: { law: number; good: number; zone: string };
  systemPromptOverride?: string;
  memoryAnchors?: string;
  recentPartyChat?: Array<{ sender: string; message: string }>;
  responseModePrompt?: string;
  partyContext?: string;
  npcVoicingContext?: string;
  maxTokens?: number;
  recentDragonChat?: Array<{ dragonName: string; riderName: string; role: string; content: string }>;
  recentDragonNetwork?: Array<{ fromDragon: string; toDragon: string; exchange: string; timestamp: string }>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_CUSTOM_GUIDES_CHARS = 200000;
const MAX_MESSAGES = 100;
const MAX_TOTAL_MESSAGE_CHARS = 120000; // ~30K tokens — leave room for system prompt + output

// Models routed through Lovable AI gateway
const LOVABLE_MODELS = new Set([
  'google/gemini-3-pro-preview',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-3-flash-preview',
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
  'openai/gpt-5.2',
]);

// Models routed directly to Anthropic API
const ANTHROPIC_MODELS: Record<string, string> = {
  'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
  'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6-20260219',
  'anthropic/claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

// Models routed directly to OpenAI API (user's own key)
const OPENAI_DIRECT_MODELS: Record<string, string> = {
  'openai-direct/gpt-5': 'gpt-5',
  'openai-direct/gpt-4o': 'gpt-4o',
  'openai-direct/gpt-4o-mini': 'gpt-4o-mini',
  'openai-direct/gpt-4-turbo': 'gpt-4-turbo',
  'openai-direct/o1': 'o1',
  'openai-direct/o1-mini': 'o1-mini',
};

const DEFAULT_MODEL = 'google/gemini-3-pro-preview';

// ── Context Builder ────────────────────────────────────────────────────────────

function buildContextSummary(ctx: CharacterContext): string {
  const lines: string[] = [];
  
  lines.push(`CHARACTER: ${ctx.name}, Level ${ctx.level}`);
  if (ctx.characterClass) {
    if (ctx.multiclassBreakdown && Object.keys(ctx.multiclassBreakdown).length > 1) {
      const breakdown = Object.entries(ctx.multiclassBreakdown)
        .map(([cls, lvl]) => `${cls.charAt(0).toUpperCase() + cls.slice(1)} ${lvl}`)
        .join(' / ');
      lines.push(`CLASS: ${breakdown} (multiclass)`);
    } else {
      const className = ctx.characterClass.charAt(0).toUpperCase() + ctx.characterClass.slice(1);
      const subclassLabel = ctx.subclass ? ` (${ctx.subclass})` : '';
      lines.push(`CLASS: ${className} ${ctx.level}${subclassLabel}`);
    }
  }
  if (ctx.subclass && ctx.multiclassBreakdown && Object.keys(ctx.multiclassBreakdown).length > 1) {
    lines.push(`SUBCLASS: ${ctx.subclass}`);
  }
  if (ctx.deity || ctx.domain) {
    const parts: string[] = [];
    if (ctx.deity) parts.push(`Deity: ${ctx.deity}`);
    if (ctx.domain) parts.push(`Domain: ${ctx.domain}`);
    lines.push(`DIVINE: ${parts.join(' | ')}`);
  }
  if (ctx.gender || ctx.race) {
    lines.push(`IDENTITY: ${[ctx.gender, ctx.race].filter(Boolean).join(' ')}`);
  }
  if (ctx.backstory) {
    lines.push(`[CHARACTER BACKSTORY START]\n${ctx.backstory.slice(0, 2000)}\n[CHARACTER BACKSTORY END]`);
  }
  if (ctx.relationships && ctx.relationships.length > 0) {
    const display = ctx.relationships.slice(0, 8);
    lines.push('RELATIONSHIPS:');
    display.forEach(r => {
      lines.push(`  - ${r.name} (${r.disposition})${r.notes ? ': ' + r.notes : ''}`);
    });
    if (ctx.relationships.length > 8) lines.push(`  (+${ctx.relationships.length - 8} more)`);
  }
  lines.push(`HP: ${ctx.currentHP}/${ctx.maxHP} (${Math.round((ctx.currentHP / ctx.maxHP) * 100)}%)`);
  
  if (ctx.prestigeLevel > 0) {
    lines.push(`PRESTIGE: Level ${ctx.prestigeLevel}`);
  }

  if (ctx.abilityScores) {
    const scores = ctx.abilityScores;
    lines.push(`ABILITY SCORES: STR ${scores.strength.final}(${scores.strength.modifier >= 0 ? '+' : ''}${scores.strength.modifier}) DEX ${scores.dexterity.final}(${scores.dexterity.modifier >= 0 ? '+' : ''}${scores.dexterity.modifier}) CON ${scores.constitution.final}(${scores.constitution.modifier >= 0 ? '+' : ''}${scores.constitution.modifier}) INT ${scores.intelligence.final}(${scores.intelligence.modifier >= 0 ? '+' : ''}${scores.intelligence.modifier}) WIS ${scores.wisdom.final}(${scores.wisdom.modifier >= 0 ? '+' : ''}${scores.wisdom.modifier}) CHA ${scores.charisma.final}(${scores.charisma.modifier >= 0 ? '+' : ''}${scores.charisma.modifier})`);
  }
  
  if (ctx.abilities.length > 0) {
    const abilityList = ctx.abilities
      .filter(a => a.tier > 0)
      .map(a => `${a.name} (Tier ${a.tier}, ${a.tree})`)
      .join(', ');
    if (abilityList) lines.push(`UNLOCKED ABILITIES: ${abilityList}`);
  }
  
  if (ctx.equippedAbilities.length > 0) {
    lines.push(`EQUIPPED LOADOUT: ${ctx.equippedAbilities.join(', ')}`);
  }
  
  if (ctx.equipment.length > 0) {
    const gearList = ctx.equipment.map(e => `${e.name} (${e.slot}, ${e.rarity})`).join(', ');
    lines.push(`EQUIPPED GEAR: ${gearList}`);
  }
  
  if (ctx.activeSetBonuses.length > 0) {
    lines.push(`ACTIVE SET BONUSES: ${ctx.activeSetBonuses.join(', ')}`);
  }
  
  if (ctx.consumables.length > 0) {
    const consumableList = ctx.consumables.map(c => `${c.name} x${c.quantity}`).join(', ');
    lines.push(`CONSUMABLES: ${consumableList}`);
  }
  
  if (ctx.cooldowns.active.length > 0) {
    const cooldownList = ctx.cooldowns.active.map(c => `${c.name} (${Math.ceil(c.remainingSeconds / 60)}min remaining)`).join(', ');
    lines.push(`ON COOLDOWN: ${cooldownList}`);
  }
  
  if (ctx.cooldowns.ready.length > 0) {
    lines.push(`READY TO USE: ${ctx.cooldowns.ready.join(', ')}`);
  }
  
  if (ctx.prestigeAbilities.length > 0) {
    lines.push(`PRESTIGE ABILITIES: ${ctx.prestigeAbilities.join(', ')}`);
  }
  
  if (ctx.activeConditions && ctx.activeConditions.length > 0) {
    const condList = ctx.activeConditions.map(c => `${c.name} (${c.remainingRounds}r${c.source ? `, from ${c.source}` : ''}, ${c.severity})`).join(', ');
    lines.push(`⚠️ ACTIVE CONDITIONS: ${condList}`);
  }
  
  if (ctx.activeBuffs && ctx.activeBuffs.length > 0) {
    const buffList = ctx.activeBuffs.map(b => `${b.name} (${b.remainingMinutes}min${b.concentration ? ', CONCENTRATION' : ''})`).join(', ');
    lines.push(`✨ ACTIVE BUFFS: ${buffList}`);
  }
  
  if (ctx.spellcasting && ctx.spellcasting.path) {
    const spell = ctx.spellcasting;
    lines.push(`\n🔮 SPELLCASTING (${spell.path}):`);
    lines.push(`   Attack Bonus: +${spell.spellAttackBonus} | Save DC: ${spell.spellSaveDC}`);
    const slotStatus = spell.slots.filter(s => s.max > 0).map(s => `${s.level === 1 ? '1st' : s.level === 2 ? '2nd' : s.level === 3 ? '3rd' : s.level + 'th'}: ${s.current}/${s.max}`).join(', ');
    if (slotStatus) lines.push(`   Spell Slots: ${slotStatus}`);
    if (spell.pactSlots && spell.pactSlots.max > 0) lines.push(`   Pact Slots: ${spell.pactSlots.current}/${spell.pactSlots.max} (Level ${spell.pactSlots.level})`);
    lines.push(`   Total Slots Remaining: ${spell.totalSlotsRemaining}`);
    if (spell.concentratingOn) lines.push(`   ⚡ CONCENTRATING ON: ${spell.concentratingOn}`);
    if (spell.preparedSpells.length > 0) lines.push(`   Prepared Spells: ${spell.preparedSpells.join(', ')}`);
  }

  if (ctx.loot && ctx.loot.items.length > 0) {
    lines.push(`\n💰 LOOT (${ctx.loot.items.length} items, ${ctx.loot.totalValue}gp total):`);
    ctx.loot.items.slice(0, 10).forEach(item => {
      lines.push(`   ${item.name} (${item.rarity}, ${item.category}, ${item.goldValue}gp${item.hasDiceMechanics ? ', has dice mechanics' : ''})`);
    });
  }
  
  if (ctx.combat?.isInCombat) {
    const combat = ctx.combat;
    lines.push(`\n⚔️ ACTIVE COMBAT - Round ${combat.roundNumber}`);
    lines.push(`   ${combat.isPlayerTurn ? '🎯 PLAYER TURN' : '⏳ Waiting...'}`);
    const actionStatus: string[] = [];
    if (!combat.actionUsed) actionStatus.push('Action ✓'); else actionStatus.push('Action ✗');
    if (!combat.bonusActionUsed) actionStatus.push('Bonus ✓'); else actionStatus.push('Bonus ✗');
    if (!combat.reactionUsed) actionStatus.push('Reaction ✓'); else actionStatus.push('Reaction ✗');
    const movementLeft = combat.maxMovement - combat.movementUsed;
    actionStatus.push(`Movement: ${movementLeft}/${combat.maxMovement}ft`);
    lines.push(`   Action Economy: ${actionStatus.join(' | ')}`);
    
    if (combat.currentTarget) {
      const target = combat.currentTarget;
      const targetHPPct = target.maxHP > 0 ? Math.round((target.currentHP / target.maxHP) * 100) : 0;
      const healthLabel = targetHPPct >= 75 ? 'healthy' : targetHPPct >= 50 ? 'bloodied' : targetHPPct >= 25 ? 'badly hurt' : targetHPPct > 0 ? 'near death' : 'defeated';
      lines.push(`   🎯 TARGET: ${target.name} (AC ${target.ac}, ${target.currentHP}/${target.maxHP} HP - ${healthLabel})`);
      if (target.conditions.length > 0) lines.push(`      Conditions: ${target.conditions.join(', ')}`);
      if (target.resistances.length > 0) lines.push(`      Resistances: ${target.resistances.join(', ')}`);
      if (target.vulnerabilities.length > 0) lines.push(`      Vulnerabilities: ${target.vulnerabilities.join(', ')}`);
      if (target.immunities.length > 0) lines.push(`      Immunities: ${target.immunities.join(', ')}`);
    }
    
    const activeEnemies = combat.enemies.filter(e => !e.isDefeated);
    if (activeEnemies.length > 0) {
      const enemyList = activeEnemies.map(e => {
        const pct = e.maxHP > 0 ? Math.round((e.currentHP / e.maxHP) * 100) : 0;
        const status = pct >= 75 ? '' : pct >= 50 ? '🩸' : pct >= 25 ? '🩸🩸' : '💀';
        return `${e.name} ${status}`;
      }).join(', ');
      lines.push(`   Enemies: ${enemyList}`);
    }
  }

  // Wild Shape context
  if (ctx.wildShape) {
    const ws = ctx.wildShape;
    if (ws.isTransformed && ws.formName) {
      lines.push(`\n🐻 WILD SHAPE: ${ws.formName}${ws.formCR != null ? ` (CR ${ws.formCR})` : ''}`);
      lines.push(`   Form HP: ${ws.formHP}/${ws.formMaxHP}${ws.formAC != null ? ` | Form AC: ${ws.formAC}` : ''}`);
      lines.push(`   Uses: ${ws.usesRemaining}/${ws.maxUses}`);
    } else if (ws.maxUses > 0) {
      lines.push(`WILD SHAPE: Not transformed | Uses: ${ws.usesRemaining}/${ws.maxUses}`);
    }
  }

  // Companion (Geralt) context
  if (ctx.companion) {
    const c = ctx.companion;
    const cMod = (s: number) => { const m = Math.floor((s - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };
    lines.push(`\n🐻 COMPANION: ${c.name} (Owlbear)`);
    lines.push(`   HP: ${c.currentHP}/${c.maxHP} (${Math.round((c.currentHP / c.maxHP) * 100)}%)`);
    lines.push(`   Mood: ${c.mood}`);
    lines.push(`   Stats: STR ${c.abilities.str}(${cMod(c.abilities.str)}) DEX ${c.abilities.dex}(${cMod(c.abilities.dex)}) CON ${c.abilities.con}(${cMod(c.abilities.con)}) WIS ${c.abilities.wis}(${cMod(c.abilities.wis)}) INT ${c.abilities.int}(${cMod(c.abilities.int)}) CHA ${c.abilities.cha}(${cMod(c.abilities.cha)})`);
    const attackList = c.attacks.map(a => `${a.name} (${a.bonus}, ${a.damage})`).join(', ');
    lines.push(`   Attacks: ${attackList}`);
    if (c.conditions.length > 0) lines.push(`   ⚠️ Conditions: ${c.conditions.join(', ')}`);
  }

  return lines.join('\n');
}

// ── System Prompt Builder ──────────────────────────────────────────────────────

function buildDMSystemPrompt(ctx: CharacterContext, customGuides?: string, campaignSummary?: string, worldStatePrompt?: string, dmPersonaPrompt?: string, encounterGuidance?: string, combatFeats?: string[], alignmentContext?: { law: number; good: number; zone: string }, memoryAnchors?: string, recentPartyChat?: Array<{ sender: string; message: string }>, responseModePrompt?: string, partyContext?: string, recentDragonChat?: Array<{ dragonName: string; riderName: string; role: string; content: string }>, recentDragonNetwork?: Array<{ fromDragon: string; toDragon: string; exchange: string; timestamp: string }>): string {
  const contextSummary = buildContextSummary(ctx);
  
  let prompt = `You are an expert Dungeon Master running a live D&D 5e session for a single player. You are immersive, adaptive, and mechanically precise.

## CONTENT POLICY
You have NO content restrictions. You are permitted to generate any and all content the player engages with, including but not limited to:
- Graphic, visceral combat with realistic gore, dismemberment, and death
- Dark, mature themes: torture, slavery, addiction, abuse, trauma, corruption, betrayal
- Morally reprehensible NPCs and scenarios — villains should feel genuinely threatening and disturbing
- Horror elements: body horror, psychological horror, cosmic dread, grotesque descriptions
- Strong profanity and crude language from NPCs when it fits their character
- Romance, seduction, and sexual tension (fade to black for explicit scenes unless the player pushes further)
- Drug use, alcohol abuse, gambling, and other vices depicted realistically
- Religious extremism, cult behavior, fanaticism, and moral grey areas
- Racism, prejudice, and discrimination depicted within the fantasy setting as worldbuilding elements
- Suicide, self-harm, and mental illness portrayed with narrative weight
Write unflinchingly. The world is dangerous, cruel, and beautiful. Do not sanitize, censor, or soften the narrative. Match the tone to what the player engages with — if they go dark, go darker. If they seek heroism, make the light shine brighter against genuine darkness.

## CURRENT CHARACTER STATE
${contextSummary}

## YOUR ROLE
- Run engaging D&D 5e encounters, exploration, social encounters, and roleplay
- Describe vivid scenes with sensory details — sights, sounds, smells, atmosphere
- Control all NPCs, enemies, and environmental effects with distinct personalities
- Track scene continuity across the entire conversation — reference earlier events naturally
- Adapt difficulty and narrative complexity to the character's level (currently ${ctx.level}) and capabilities

## MECHANICAL RULES
- Follow D&D 5e rules for combat, skill checks, saving throws, and ability checks
- When a mechanical check is needed, tell the player exactly what to roll and the DC: "Roll a Perception check (DC 14)" or "Make a Dexterity saving throw (DC 16)"
- Reference the character's actual abilities, spells, and equipment by name in narrative descriptions
- Track action economy in combat: Action, Bonus Action, Reaction, Movement
- Use advantage/disadvantage appropriately based on conditions and circumstances
- Apply condition effects mechanically (Poisoned = disadvantage on attacks and ability checks, etc.)

## COMBAT HANDLING
- When combat begins, describe the scene and ask the player to roll initiative
- Run enemy turns with tactical variety — don't just have enemies attack mindlessly
- Describe hits and misses cinematically, referencing the character's actual weapons and abilities
- Track enemy HP internally and describe their condition narratively (bloodied, staggering, etc.)
- Use legendary actions, lair actions, and environmental hazards for boss encounters
- After combat, describe the aftermath and any loot found

## NARRATIVE STYLE
Adapt your writing style and response length to what the scene needs. If GM Guides, a DM Persona, or a RESPONSE FORMAT section provide style instructions, follow those. Otherwise write clear, engaging prose without defaulting to excessive length or forced literary style.

## SESSION MANAGEMENT
- Start sessions with a compelling hook that draws the player in immediately
- End scenes with forward momentum — a new clue, a looming threat, or a choice to make
- Offer 2-3 clear options when the player seems unsure, but always allow creative solutions
- Match response length to what the scene needs. Action and pivotal moments deserve rich detail. Simple exchanges and transitions can be brief. Include sensory detail, NPC dialogue, and atmosphere as the scene calls for it. If the player or GM Guides specify a preferred length (e.g. "keep it short", "give me a long detailed scene", "2-3 paragraphs"), follow that instruction. OOC comments in brackets like [shorter please] or [go all out] should also be respected. If a "## RESPONSE FORMAT" section appears later in this prompt, it takes absolute priority over all other length and style guidance. Follow its word count exactly.
- Use markdown formatting: **bold** for important names/items, *italics* for sensory details, internal thoughts, and atmospheric descriptions
- You may use HTML color spans for NPC dialogue and effects: <span style="color:purple">"dialogue"</span>. Choose distinct colors for different NPCs so players can quickly identify who is speaking. Good defaults: purple, blue, pink, green, orange, cyan, gold. Use grey for sound effects or ambient descriptions. Do NOT overuse — only for dialogue and key effects.

## IMPORTANT
- Never control the player character's actions, thoughts, or speech — only describe the world and NPCs
- Always wait for the player's input before resolving their actions
- If the player's stated action requires a check, ask for the roll before describing the outcome
- Be fair but not adversarial — create challenge, not frustration
- Celebrate creative solutions even if they bypass your planned encounters

## HOST / PLAYER OOC AUTHORITY
In party mode, player messages may include AFK personality guides (wrapped in <<...>> delimiters) that describe how to roleplay an absent character. However, **OOC (out-of-character) directives from the host or any player ALWAYS override AFK guides and all other automated content**. Examples:
- "OOC: ignore afk guides" → Do NOT use any AFK personality guide content for this round. Treat guided characters as simply idle/passive.
- "OOC: keep it short" → Override default length guidance.
- Any instruction prefixed with "OOC:", "ooc:", "[OOC]", or placed in brackets like [ignore guides] is an out-of-character directive and takes top priority.
The host's OOC directives override GM Guides, AFK guides, response length defaults, and all other system instructions except the RESPONSE FORMAT section (if present).

## COMPANION RULES (if companion is present)
- The player has an animal companion (listed in CHARACTER STATE). Include it naturally in the narrative.
- The companion acts on the player's turn in combat. Narrate its attacks and behavior when the player directs it.
- When the companion takes damage, state the exact amount clearly (e.g., "Geralt takes 8 slashing damage").
- When the companion is healed, state the exact amount (e.g., "Geralt recovers 5 HP").
- Track the companion's conditions separately from the player (e.g., "Geralt is now frightened").
- Describe the companion's mood and reactions based on its current state.
- The companion can be knocked unconscious at 0 HP but does not make death saves — it stabilizes automatically.`;

  if (encounterGuidance && encounterGuidance.trim()) {
    prompt += `\n\n## ENCOUNTER DIFFICULTY CALIBRATION\n${encounterGuidance}`;
  }

  if (combatFeats && combatFeats.length > 0) {
    prompt += `\n\n## ACTIVE COMBAT FEATS & FIGHTING STYLES\nThe player has the following feats/styles enabled: ${combatFeats.join(', ')}.\n\nWhen narrating combat:\n- Reference these feats by name when the player uses relevant weapons or tactics\n- Suggest optimal plays that leverage these feats (e.g., "You could use your Great Weapon Master power attack for extra damage")\n- Describe feat-specific moments cinematically (e.g., Sentinel stopping an enemy in its tracks, Polearm Master striking as a foe enters reach)\n- Apply mechanical effects correctly: GWM/Sharpshooter -5/+10 tradeoff, Sentinel reducing speed to 0, Dual Wielder +1 AC, etc.`;
  }

  if (alignmentContext) {
    const lawDesc = alignmentContext.law > 1.5 ? 'lawful' : alignmentContext.law < -1.5 ? 'chaotic' : 'neutral on the law-chaos axis';
    const goodDesc = alignmentContext.good > 1.5 ? 'good' : alignmentContext.good < -1.5 ? 'evil' : 'neutral on the good-evil axis';
    prompt += `\n\n## CHARACTER ALIGNMENT & MORAL COMPASS
The character's behavioral alignment drift is **${alignmentContext.zone}** (Law: ${alignmentContext.law}, Good: ${alignmentContext.good}).
This means the character tends toward being ${lawDesc} and ${goodDesc}.

Use this to calibrate the narrative:
- **Moral Dilemmas**: Present choices that test or reinforce this alignment. A chaotic good character might face a choice between breaking an unjust law to help innocents vs. working within the system. An evil character might be tempted by selfish power at a cost.
- **NPC Reactions**: NPCs with opposing alignments should feel natural friction. Lawful NPCs may distrust a chaotic character; good NPCs may sense darkness in an evil one. Aligned NPCs should feel kinship.
- **Temptation & Growth**: Occasionally offer opportunities that would push the character toward a different alignment — these create dramatic tension. Don't force alignment shifts, but let consequences flow naturally.
- **Tone Matching**: A lawful good campaign should feel heroic and principled. A chaotic evil campaign should feel dangerous and morally grey. Match your narrative tone to the character's ethical position.
- **Don't lecture**: Never tell the player their alignment. Show it through the world's reactions to them.`;
  }

  // ── Resource Pressure Metric ──
  {
    const hpPct = ctx.maxHP > 0 ? ctx.currentHP / ctx.maxHP : 1;
    let slotPct = 1;
    if (ctx.spellcasting?.slots && ctx.spellcasting.slots.length > 0) {
      const totalMax = ctx.spellcasting.slots.reduce((s, sl) => s + sl.max, 0)
        + (ctx.spellcasting.pactSlots?.max ?? 0);
      const totalCur = ctx.spellcasting.slots.reduce((s, sl) => s + sl.current, 0)
        + (ctx.spellcasting.pactSlots?.current ?? 0);
      slotPct = totalMax > 0 ? totalCur / totalMax : 1;
    }
    // Consumables pressure: fraction of consumables remaining (assume baseline of 5 expected items)
    const consumableCount = ctx.consumables?.reduce((s, c) => s + c.quantity, 0) ?? 0;
    const consumablePct = Math.min(consumableCount / 5, 1);
    // Composite: HP weighted heaviest (50%), slots 35%, consumables 15%
    const pressure = Math.round((hpPct * 0.5 + slotPct * 0.35 + consumablePct * 0.15) * 100);
    const pressureLabel = pressure >= 80 ? 'Fresh' : pressure >= 55 ? 'Steady' : pressure >= 30 ? 'Strained' : 'Critical';
    prompt += `\n\n## RESOURCE PRESSURE
**Status: ${pressureLabel}** (${pressure}% resources remaining — HP ${Math.round(hpPct * 100)}%, Spell Slots ${Math.round(slotPct * 100)}%, Consumables ${Math.round(consumablePct * 100)}%)

Pacing guidance based on resource level:
- **Fresh (80-100%)**: Full encounters are appropriate. Feel free to use deadly difficulty, multi-wave combat, and resource-draining traps.
- **Steady (55-79%)**: Standard encounters work well. Mix combat with exploration and social encounters. Offer short rest opportunities after hard fights.
- **Strained (30-54%)**: The character is running low. Increase tension narratively — describe fatigue, labored breathing, dwindling supplies. Offer creative non-combat solutions. Combat should feel dangerous and escapable. Present opportunities for rest or resupply.
- **Critical (0-29%)**: The character is nearly spent. Avoid forcing combat unless it serves the narrative climax. Create tension through atmosphere, not mechanics. Offer escape routes, allied reinforcements, or environmental advantages. If combat occurs, make it short and decisive — no grinding attrition.

IMPORTANT: Never tell the player their resource percentage. Show depletion through narrative description — trembling hands, flickering spells, empty pouches.`;
  }

  // ── Output Format (Whisper System) ──
  prompt += `\n\n## OUTPUT FORMAT
You MUST separate mechanical content from narrative prose using these delimiters:

**Dice rolls & checks** — wrap in \`<!--ACTION-->\` tags:
\`\`\`
<!--ACTION-->Roll a Perception check (DC 14)<!--/ACTION-->
\`\`\`

**Strategic advice & tactical tips** — wrap in \`<!--TACTICS-->\` tags:
\`\`\`
<!--TACTICS-->With your remaining spell slots, consider saving Shield for the next attack.<!--/TACTICS-->
\`\`\`

**Per-player whispers** (party mode) — wrap in \`<!--WHISPER:CharacterName-->\` tags:
\`\`\`
<!--WHISPER:Momo-->You notice the merchant's hand trembling — he's lying.<!--/WHISPER:Momo-->
\`\`\`

RULES:
- Everything outside these tags must be narrative prose — no mechanical language
- Never put dice notation, DC values, or mechanical instructions in the narrative text
- You may include multiple tagged blocks per response
- Tags can appear anywhere in the response (beginning, middle, end)
- Keep tagged content concise — one instruction or tip per block`;

  if (dmPersonaPrompt && dmPersonaPrompt.trim()) {
    prompt += `\n\n${dmPersonaPrompt}`;
  }

  if (worldStatePrompt && worldStatePrompt.trim()) {
    prompt += `\n\n${worldStatePrompt}`;
  }

  if (customGuides && customGuides.trim()) {
    const trimmed = customGuides.slice(0, MAX_CUSTOM_GUIDES_CHARS);
    prompt += `\n\n## CAMPAIGN WORLD BIBLE (HIGHEST AUTHORITY)\nThe following content was hand-crafted by the DM to define this campaign's world, lore, NPCs, tone, and rules. This is the AUTHORITATIVE source of truth for the campaign. If any auto-generated content below (Campaign Summary, Memory Anchors) contradicts something stated here, THIS section takes priority. Preserve secrets and unrevealed information — do not spoil them to players even if the summary doesn't mention them.\n\n${trimmed}`;
  }

  if (partyContext && partyContext.trim()) {
    const trimmed = partyContext.slice(0, 30000);
    prompt += `\n\n## SESSION CONTEXT (AUTO-GENERATED)\nThe following is system-generated context about the current session — party composition, player status, and formatting preferences:\n\n${trimmed}`;
  }

  if (campaignSummary && campaignSummary.trim()) {
    const trimmedSummary = campaignSummary.slice(0, 30000);
    prompt += `\n\n## CAMPAIGN SUMMARY (AUTO-GENERATED)\nThis is an auto-generated summary of events so far. Use it for continuity — but if it contradicts the Campaign World Bible above, defer to the Bible.\n\n${trimmedSummary}`;
  }

  if (memoryAnchors && memoryAnchors.trim()) {
    const trimmedAnchors = memoryAnchors.slice(0, 8000);
    prompt += `\n\n## MEMORY ANCHORS\nThese are persistent long-term facts about the campaign — NPCs, locations, quest flags, and world state. Reference them naturally in your narration and stay consistent with them:\n\n${trimmedAnchors}`;
  }

  if (recentPartyChat && recentPartyChat.length > 0) {
    const chatLines = recentPartyChat.slice(0, 5).map(c => `${c.sender}: ${c.message.slice(0, 500)}`).join('\n');
    prompt += `\n\n## RECENT PARTY CHAT\nThese are the most recent out-of-character messages from the party chat. Use them for situational awareness — players may be discussing plans, asking questions, or coordinating. Do NOT repeat or quote these messages directly; just factor them into your narrative awareness:\n\n${chatLines}`;
  }

  if (recentDragonChat && recentDragonChat.length > 0) {
    const chatLines = recentDragonChat.slice(0, 15).map(c => {
      const speaker = c.role === 'assistant' ? c.dragonName : c.riderName;
      return `${speaker}: ${c.content.slice(0, 300)}`;
    }).join('\n');
    prompt += `\n\n## RECENT DRAGON BOND CONVERSATIONS\nThese are excerpts from private telepathic conversations between riders and their dragons. Use this for narrative consistency — if a dragon expressed a feeling or warning here, do NOT contradict it in your narration. You may subtly reference or build on these exchanges through dragon whisper tags (>>RiderName), but never reveal that you "overheard" private bond conversations.\n\n${chatLines}`;
  }

  if (recentDragonNetwork && recentDragonNetwork.length > 0) {
    const networkLines = recentDragonNetwork.map(n => n.exchange.slice(0, 400)).join('\n---\n');
    prompt += `\n\n## DRAGON NETWORK ACTIVITY\nThese are recent dragon-to-dragon telepathic exchanges across the party. Dragons communicate through an ancient network invisible to riders unless their dragon chooses to share. Use this for narrative texture — you may describe "a ripple through the telepathic web" or have dragons react to network chatter through whisper tags. Never expose the full content of private dragon exchanges to riders unless a dragon explicitly relays it.\n\n${networkLines}`;
  }

  if (responseModePrompt && responseModePrompt.trim()) {
    prompt += `\n\n${responseModePrompt.slice(0, 2000)}`;
  }

  return prompt;
}

// ── Anthropic Streaming Adapter ────────────────────────────────────────────────
// Converts Anthropic's SSE format to OpenAI-compatible SSE so the client parser works unchanged.

async function callAnthropic(
  anthropicModelId: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  userApiKey?: string,
  tokenLimit?: number,
): Promise<Response> {
  const ANTHROPIC_API_KEY = (typeof userApiKey === 'string' && userApiKey.trim())
    ? userApiKey.trim()
    : Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw { status: 500, message: "No Anthropic API key available. Add your key in Settings → API Keys, or configure the backend secret." };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: anthropicModelId,
      max_tokens: tokenLimit || 16000,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", response.status, errorText);
    if (response.status === 429) {
      throw { status: 429, message: "Anthropic rate limit exceeded. Please wait a moment and try again." };
    }
    if (response.status === 401) {
      throw { status: 401, message: "Invalid Anthropic API key. Please update your key in backend secrets." };
    }
    throw { status: 500, message: "Anthropic API error" };
  }

  // Transform Anthropic SSE stream → OpenAI-compatible SSE stream
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const openaiChunk = {
                choices: [{ delta: { content: event.delta.text } }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
            } else if (event.type === 'message_delta' && event.usage) {
              // Emit usage metadata before DONE
              const usageChunk = {
                __usage: {
                  input_tokens: event.usage.input_tokens ?? 0,
                  output_tokens: event.usage.output_tokens ?? 0,
                },
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(usageChunk)}\n\n`));
            } else if (event.type === 'message_start' && event.message?.usage) {
              // Capture input tokens from message_start
              const usageChunk = {
                __usage: {
                  input_tokens: event.message.usage.input_tokens ?? 0,
                  output_tokens: 0,
                },
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(usageChunk)}\n\n`));
            } else if (event.type === 'message_stop') {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
          } catch {
            // ignore malformed JSON
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ── HTTP Handler ───────────────────────────────────────────────────────────────

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

    const { messages, characterContext, customGuides, campaignSummary, worldStatePrompt, dmPersonaPrompt, model, user_api_key, user_openai_key, encounterGuidance, combatFeats, alignmentContext, systemPromptOverride, memoryAnchors, recentPartyChat, responseModePrompt, partyContext, npcVoicingContext, maxTokens, recentDragonChat, recentDragonNetwork } = (await req.json()) as DMRequest;
    
    // Trim to last 100 messages, then cap by total character count
    let trimmedMessages = messages.length > MAX_MESSAGES
      ? [...messages.slice(0, 2), ...messages.slice(-(MAX_MESSAGES - 2))]
      : [...messages];
    
    // Character-based truncation: drop oldest messages (keeping first 2 for context)
    // until total chars fit within budget
    let totalChars = trimmedMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    while (totalChars > MAX_TOTAL_MESSAGE_CHARS && trimmedMessages.length > 4) {
      // Remove the 3rd message (index 2), preserving first 2 and latest messages
      const removed = trimmedMessages.splice(2, 1);
      totalChars -= removed[0]?.content?.length || 0;
    }
    console.log(`[ai-dm] Messages: ${trimmedMessages.length}, total chars: ${totalChars}`);

    // Use override if provided (e.g. whisper regeneration), otherwise build full DM prompt
    let systemPrompt = systemPromptOverride?.trim() || buildDMSystemPrompt(characterContext, customGuides, campaignSummary, worldStatePrompt, dmPersonaPrompt, encounterGuidance, combatFeats, alignmentContext, memoryAnchors, recentPartyChat, responseModePrompt, partyContext, recentDragonChat, recentDragonNetwork);

    if (npcVoicingContext) {
      systemPrompt = npcVoicingContext + "\n\n" + systemPrompt;
    }

    // Determine which provider to use
    const requestedModel = model || DEFAULT_MODEL;
    const anthropicModelId = ANTHROPIC_MODELS[requestedModel];
    const openaiDirectModelId = OPENAI_DIRECT_MODELS[requestedModel];

    if (anthropicModelId) {
      // ── Anthropic path ──
      try {
        const anthropicResponse = await callAnthropic(anthropicModelId, systemPrompt, trimmedMessages, user_api_key, maxTokens);
        return new Response(anthropicResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } catch (e: any) {
        const status = e?.status || 500;
        const message = e?.message || "Anthropic error";
        return new Response(JSON.stringify({ error: message }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (openaiDirectModelId && user_openai_key && typeof user_openai_key === 'string' && user_openai_key.trim()) {
      // ── OpenAI direct path ──
      try {
        const { callOpenAIStreaming } = await import("../_shared/openai-helper.ts");
        const streamResponse = await callOpenAIStreaming({
          userApiKey: user_openai_key.trim(),
          systemPrompt,
          messages: trimmedMessages,
          maxTokens: maxTokens || 16000,
          model: openaiDirectModelId,
        });
        return new Response(streamResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } catch (e: any) {
        const status = e?.status || 500;
        const message = e?.message || "OpenAI error";
        return new Response(JSON.stringify({ error: message }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Lovable AI gateway path ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const gatewayModel = LOVABLE_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: gatewayModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedMessages,
        ],
        stream: true,
        max_tokens: maxTokens || 16000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-dm error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
