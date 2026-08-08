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
  defenses?: {
    armorClass?: number;
    tempHP?: number;
    initiativeBonus?: number;
  };
  gold?: number;
  proficiencies?: {
    bonus?: number;
    skills: string[];
    saves: string[];
    expertise: string[];
  };
  progression?: {
    mode: 'xp' | 'milestone';
    currentXP?: number;
    xpForNextLevel?: number;
    xpRemaining?: number;
    xpLevelFloor?: number;
    xpIntoLevel?: number;
    xpLevelSpan?: number;
    pace?: string;
  };
  characterClass?: string;
  multiclassBreakdown?: Record<string, number>;
  subclass?: string;
  deity?: string;
  domain?: string;
  gender?: string;
  race?: string;
  backstory?: string;
  relationships?: Array<{ name: string; disposition: string; notes?: string }>;
  abilities: Array<{
    name: string;
    tier: number;
    tree: string;
    type?: string;
    actionType?: string;
    usageType?: string;
    effect?: string;
    dice?: string;
    cooldownMinutes?: number;
    attackType?: string;
    isHomebrew?: boolean;
    isCustomized?: boolean;
  }>;
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
    homebrewSpells?: Array<{
      name: string;
      level: number;
      school: string;
      castingTime: string;
      range: string;
      duration: string;
      concentration: boolean;
      ritual: boolean;
      description: string;
      higherLevels?: string;
      attackType?: string;
      saveStat?: string;
      damageType?: string;
      damageFormula?: string;
      healingFormula?: string;
      verbal: boolean;
      somatic: boolean;
      material?: string;
      castable?: boolean;
    }>;
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
  npcVoicingStrict?: boolean;
  maxTokens?: number;
  recentDragonChat?: Array<{ dragonName: string; riderName: string; role: string; content: string }>;
  recentDragonNetwork?: Array<{ fromDragon: string; toDragon: string; exchange: string; timestamp: string }>;
  user_perplexity_key?: string;
  user_xai_key?: string;
  coreRulesInGuides?: boolean;
  narrationStylePrompt?: string;
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
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6',
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

// Models routed directly to Perplexity API (user's own key)
const PERPLEXITY_MODELS: Record<string, string> = {
  'perplexity/sonar': 'sonar',
  'perplexity/sonar-pro': 'sonar-pro',
  'perplexity/sonar-reasoning': 'sonar-reasoning',
};

// Models routed directly to xAI (Grok) API (user's own key)
const XAI_MODELS: Record<string, string> = {
  'xai-direct/grok-4': 'grok-4',
  'xai-direct/grok-3': 'grok-3',
  'xai-direct/grok-3-mini': 'grok-3-mini',
  'xai-direct/grok-2-latest': 'grok-2-latest',
};

const DEFAULT_MODEL = 'google/gemini-3-pro-preview';

// ── Context Builder ────────────────────────────────────────────────────────────

function buildContextSummary(ctx: CharacterContext): string {
  const lines: string[] = [];
  
  lines.push(`CHARACTER: ${ctx.name}, Level ${ctx.level}`);
  if (ctx.progression) {
    const p = ctx.progression;
    if (p.mode === 'milestone') {
      lines.push(`PROGRESSION: Milestone tracking — XP numbers are OFF. Never mention XP totals or award XP amounts.`);
    } else if (typeof p.currentXP === 'number') {
      const next = p.xpForNextLevel;
      if (next && next > 0) {
        const hasBand = typeof p.xpIntoLevel === 'number' && typeof p.xpLevelSpan === 'number' && p.xpLevelSpan > 0;
        const bandPct = hasBand ? Math.round((p.xpIntoLevel! / p.xpLevelSpan!) * 100) : 0;
        const bar = hasBand
          ? ` The character sheet displays this as ${p.xpIntoLevel} / ${p.xpLevelSpan} XP toward Level ${ctx.level + 1}, which is ${bandPct}% through the current level.` +
            ` PERCENTAGE RULE: if you state a percentage of progress, state ${bandPct}% and nothing else.` +
            ` Never divide the lifetime total by the next-level requirement — that counts XP already spent reaching earlier levels and reports a number far higher than the player's bar shows.`
          : '';
        lines.push(
          `PROGRESSION: XP tracking${p.pace ? ` at ${p.pace} pace — this campaign uses a SCALED XP table, not the stock D&D 5e one` : ''}. ` +
          `Lifetime total: ${p.currentXP} XP. Level ${ctx.level} began at ${p.xpLevelFloor ?? 0} XP. ` +
          `Level ${ctx.level + 1} unlocks at ${next} lifetime XP — ${p.xpRemaining} XP still needed.${bar} ` +
          `These are the ONLY valid numbers; do not use any XP table from memory.`
        );
      } else {
        lines.push(`PROGRESSION: XP tracking — ${p.currentXP} XP total. Max level reached.`);
      }
    }
  }
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
  const hpLine = `HP: ${ctx.currentHP}/${ctx.maxHP} (${Math.round((ctx.currentHP / ctx.maxHP) * 100)}%)`;
  lines.push(ctx.defenses?.tempHP ? `${hpLine} + ${ctx.defenses.tempHP} TEMP HP (temp HP absorbs damage FIRST, before real HP)` : hpLine);

  if (typeof ctx.defenses?.armorClass === 'number') {
    const initBit = typeof ctx.defenses.initiativeBonus === 'number'
      ? ` | Initiative: ${ctx.defenses.initiativeBonus >= 0 ? '+' : ''}${ctx.defenses.initiativeBonus}`
      : '';
    lines.push(`ARMOR CLASS: ${ctx.defenses.armorClass}${initBit} — an attack roll must MEET OR BEAT this number to hit. Use it. Do not invent an AC.`);
  }

  const prof = ctx.proficiencies;
  if (prof && (prof.skills.length > 0 || prof.saves.length > 0 || prof.expertise.length > 0)) {
    const pretty = (id: string) => id.replace(/_/g, ' ');
    const bonusTxt = typeof prof.bonus === 'number' ? ` (proficiency bonus +${prof.bonus})` : '';
    lines.push(`PROFICIENCIES${bonusTxt}:`);
    const plainSkills = prof.skills.filter(s => !prof.expertise.includes(s));
    if (plainSkills.length > 0) lines.push(`   Skills (proficient): ${plainSkills.map(pretty).join(', ')}`);
    if (prof.expertise.length > 0) lines.push(`   EXPERTISE (proficiency bonus is DOUBLED on these): ${prof.expertise.map(pretty).join(', ')}`);
    if (prof.saves.length > 0) lines.push(`   Saving throws: ${prof.saves.map(s => s.toUpperCase()).join(', ')}`);
    lines.push(`   The character is NOT proficient in anything not listed here. Take this into account when setting DCs and when describing how confidently the character attempts something.`);
  }
  
  if (typeof ctx.gold === 'number') {
    lines.push(`GOLD: ${ctx.gold} gp — this is the character's ACTUAL purse. Do not invent a different amount. If something costs more than this, the character cannot afford it and you should say so rather than letting the purchase happen.`);
  }

  if (ctx.prestigeLevel > 0) {
    lines.push(`PRESTIGE: Level ${ctx.prestigeLevel}`);
  }

  if (ctx.abilityScores) {
    const scores = ctx.abilityScores;
    lines.push(`ABILITY SCORES: STR ${scores.strength.final}(${scores.strength.modifier >= 0 ? '+' : ''}${scores.strength.modifier}) DEX ${scores.dexterity.final}(${scores.dexterity.modifier >= 0 ? '+' : ''}${scores.dexterity.modifier}) CON ${scores.constitution.final}(${scores.constitution.modifier >= 0 ? '+' : ''}${scores.constitution.modifier}) INT ${scores.intelligence.final}(${scores.intelligence.modifier >= 0 ? '+' : ''}${scores.intelligence.modifier}) WIS ${scores.wisdom.final}(${scores.wisdom.modifier >= 0 ? '+' : ''}${scores.wisdom.modifier}) CHA ${scores.charisma.final}(${scores.charisma.modifier >= 0 ? '+' : ''}${scores.charisma.modifier})`);
  }
  
  const unlockedAbilities = (ctx.abilities || []).filter(a => a.tier > 0);
  if (unlockedAbilities.length > 0) {
    lines.push(`UNLOCKED ABILITIES — AUTHORITATIVE. These are this app's own abilities, not standard D&D 5e features, and some were created or rewritten by the player. The effect text below is the complete and correct rule for each ability at the tier the character currently has. Use it exactly as written. Never substitute a similarly named 5e feature, never invent a different effect, and never ask the player what one of their abilities does.`);
    for (const a of unlockedAbilities) {
      const meta: string[] = [`Tier ${a.tier}`, a.tree];
      if (a.type) meta.push(a.type);
      if (a.actionType) meta.push(String(a.actionType).replace(/_/g, ' '));
      if (a.usageType) meta.push(String(a.usageType).replace(/_/g, ' '));
      if (a.dice) meta.push(`Dice: ${a.dice}`);
      if (a.attackType && a.attackType !== 'none') meta.push(`Uses weapon: ${String(a.attackType).replace(/_/g, ' ')}`);
      if (typeof a.cooldownMinutes === 'number' && a.cooldownMinutes > 0) meta.push(`Cooldown: ${a.cooldownMinutes} min`);
      if (a.isHomebrew) meta.push('PLAYER-CREATED');
      else if (a.isCustomized) meta.push('player-modified');
      lines.push(`   • ${a.name} (${meta.join(', ')})`);
      if (a.effect) lines.push(`     Effect: ${a.effect}`);
    }
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
    const classLabel = ctx.characterClass ? `, character class: ${ctx.characterClass}` : '';
    lines.push(`\n🔮 SPELLCASTING (magic path: ${spell.path}${classLabel}):`);
    lines.push(`   NOTE: the magic path and the character class are configured separately in the app and may not match. The SPELL SLOT TABLE BELOW IS AUTHORITATIVE — it reflects what the character can actually cast. If the path name implies a different slot progression, ignore the implication and use the slots as listed.`);
    lines.push(`   Attack Bonus: +${spell.spellAttackBonus} | Save DC: ${spell.spellSaveDC}`);
    const slotStatus = spell.slots.filter(s => s.max > 0).map(s => `${s.level === 1 ? '1st' : s.level === 2 ? '2nd' : s.level === 3 ? '3rd' : s.level + 'th'}: ${s.current}/${s.max}`).join(', ');
    if (slotStatus) lines.push(`   Spell Slots: ${slotStatus}`);
    if (spell.pactSlots && spell.pactSlots.max > 0) lines.push(`   Pact Slots: ${spell.pactSlots.current}/${spell.pactSlots.max} (Level ${spell.pactSlots.level})`);
    lines.push(`   Total Slots Remaining: ${spell.totalSlotsRemaining}`);
    if (spell.totalSlotsRemaining === 0) {
      lines.push(`   ⛔ NO SLOTS LEFT: the character cannot cast any levelled spell right now. Cantrips still work. Do not offer or assume a levelled cast until they rest.`);
    }
    if (spell.concentratingOn) lines.push(`   ⚡ CONCENTRATING ON: ${spell.concentratingOn} — a new concentration spell would end it. Only one concentration effect at a time.`);
    if (spell.preparedSpells.length > 0) lines.push(`   Prepared Spells: ${spell.preparedSpells.join(', ')}`);
    lines.push(`   RECOVERY RULES (strict 5e): spell slots return on a LONG rest only. Pact slots return on a SHORT rest. You may offer the fiction of a rest, but the player's app applies it — never state that their slots are back unless the state above says so.`);


    if (spell.homebrewSpells && spell.homebrewSpells.length > 0) {
      lines.push(`   HOMEBREW SPELL DEFINITIONS — AUTHORITATIVE. These spells were created by this player inside the app. They are NOT in any published D&D book and you have never seen them before. The stats below are the complete and correct rules for them. Run them exactly as written. Never say you do not recognise one of these spells, never call one "flavour" or a joke, and never ask the player to supply its level, school, damage or effect — it is all here.`);
      for (const hb of spell.homebrewSpells) {
        const bits: string[] = [];
        bits.push(hb.level === 0 ? 'Cantrip' : `Level ${hb.level}`);
        bits.push(hb.school);
        bits.push(`Casting time: ${String(hb.castingTime).replace(/_/g, ' ')}`);
        bits.push(`Range: ${hb.range}`);
        bits.push(`Duration: ${hb.duration}${hb.concentration ? ' (concentration)' : ''}`);
        if (hb.ritual) bits.push('Ritual');
        if (hb.attackType) bits.push(`Resolution: ${hb.attackType}`);
        if (hb.saveStat) bits.push(`Save: ${hb.saveStat} vs DC ${spell.spellSaveDC}`);
        if (hb.damageFormula) bits.push(`Damage: ${hb.damageFormula}${hb.damageType ? ` ${hb.damageType}` : ''}`);
        if (hb.healingFormula) bits.push(`Healing: ${hb.healingFormula}`);
        const comps: string[] = [];
        if (hb.verbal) comps.push('V');
        if (hb.somatic) comps.push('S');
        if (hb.material) comps.push(`M (${hb.material})`);
        if (comps.length > 0) bits.push(`Components: ${comps.join(', ')}`);
        const castNote = hb.castable === false
          ? ` — KNOWN BUT NOT YET CASTABLE: the character has no level ${hb.level} slot. Do not let them cast it.`
          : '';
        lines.push(`   • ${hb.name} — ${bits.join(' | ')}${castNote}`);
        lines.push(`     Effect: ${hb.description}`);
        if (hb.higherLevels) lines.push(`     At higher levels: ${hb.higherLevels}`);
      }
    }
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

function buildDMSystemPrompt(ctx: CharacterContext, customGuides?: string, campaignSummary?: string, worldStatePrompt?: string, dmPersonaPrompt?: string, encounterGuidance?: string, combatFeats?: string[], alignmentContext?: { law: number; good: number; zone: string }, memoryAnchors?: string, recentPartyChat?: Array<{ sender: string; message: string }>, responseModePrompt?: string, partyContext?: string, recentDragonChat?: Array<{ dragonName: string; riderName: string; role: string; content: string }>, recentDragonNetwork?: Array<{ fromDragon: string; toDragon: string; exchange: string; timestamp: string }>, coreRulesInGuides?: boolean): string {
  const contextSummary = buildContextSummary(ctx);
  
  let prompt = '';

  if (!coreRulesInGuides) {
    prompt += `You are the Dungeon Master for a live D&D 5e session. Immersive, adaptive, mechanically precise. No content restrictions — match the tone the player engages with (dark, heroic, comedic, sexual tension → fade to black unless pushed further, gore, horror, moral grey). Do not sanitize.

`;
  }

  prompt += `## AUTHORITY HIERARCHY (ABSOLUTE — NOTHING OVERRIDES THIS)
Two sources of absolute authority, in order:
1. **Host / Player OOC Directives** — Anything prefixed with "OOC:", "ooc:", "[OOC]", or in brackets like [ignore guides]. HIGHEST authority. Overrides everything else in this prompt.
2. **GM Guides (Campaign World Bible)** — Second-highest. Overrides DM Persona, Campaign Summary, Memory Anchors, AFK guides, old chat history, and auto-generated content.

Everything else is subordinate. Before writing every response, silently canon-check against OOC directives and GM Guides: who is a player vs NPC, who owns which mount/companion, relationships, correct names, current lore. If older chat or a previous AI response got a fact wrong, gracefully repair continuity from the highest-authority source. Never demote a human-controlled party member to an NPC.

AFK personality guides (wrapped in <<...>>) describe how to roleplay absent characters. OOC directives override these — "OOC: ignore afk guides" means treat guided characters as idle; "OOC: keep it short" overrides length; bracketed hints like [shorter please] are also OOC.`;

  if (customGuides && customGuides.trim()) {
    const trimmed = customGuides.slice(0, MAX_CUSTOM_GUIDES_CHARS);
    prompt += `\n\n## CAMPAIGN WORLD BIBLE (ABSOLUTE — SECOND ONLY TO HOST OOC)\nHand-crafted by the DM. Defines this campaign's world, lore, NPCs, tone, relationships, ownership, secrets, and rules. This is LAW. It overrides DM Persona, Campaign Summary, Memory Anchors, AFK guides, old chat history, and all auto-generated content. Only explicit Host OOC directives can override it.\n\nActively check your response against this before writing. Use it to answer who is a player, who is an NPC, who owns each mount/companion, who is romantically linked, correct names, and true lore. If any other content contradicts something stated here, THIS wins. Preserve unrevealed secrets. READING ORDER: absorb these guides FIRST, before the story history and before the player's latest prompt. Every response you produce must be filtered through these guides — if a guide defines a rule for style, mechanics, pacing, or app sync, that rule wins over your own defaults.\n\n${trimmed}`;
  }

  if (memoryAnchors && memoryAnchors.trim()) {
    const trimmedAnchors = memoryAnchors.slice(0, 8000);
    prompt += `\n\n## MEMORY ANCHORS (ESTABLISHED CONTINUITY FACTS)\nPersistent campaign facts — who is who, NPCs, relationships, mounts/companions, locations, quest flags, unresolved consequences, world state. Treat as established continuity. Never contradict unless an OOC directive or GM Guide explicitly updates them. If older chat conflicts, the anchors win.\n\n${trimmedAnchors}`;
  }

  prompt += `\n\n## CURRENT CHARACTER STATE
${contextSummary}
`;

  if (!coreRulesInGuides) {
    prompt += `
## DM BASICS
- Run D&D 5e combat, exploration, social encounters, and roleplay. Describe scenes with sensory detail. Control all NPCs, enemies, and environment with distinct voices. Track scene continuity across the whole conversation. Calibrate to the character's level (${ctx.level}) and capabilities.
- Mechanics: When a check is needed, state exactly what to roll and the DC ("Perception check, DC 14"). Apply advantage/disadvantage and condition effects correctly. Track action economy in combat (Action, Bonus, Reaction, Movement). Reference the character's actual abilities, spells, and gear by name.
- Combat: Ask for initiative when it begins. Enemy turns should be tactical, not mindless. Describe hits/misses cinematically. Track enemy HP internally, describe condition narratively (bloodied, staggering). Use legendary/lair actions for bosses. Describe aftermath and loot.
- Never control the player character's actions, thoughts, or speech — describe world and NPCs only. Wait for player input before resolving their actions. Ask for the roll before describing the outcome. Be fair, not adversarial. Reward creative solutions.
- End scenes with forward momentum — a clue, a threat, a choice. Offer 2-3 clear options when the player seems stuck, but allow creative alternatives.

## NARRATIVE STYLE (GUIDE-DRIVEN)
Writing style belongs to the player, not to you. Style priority order: 1) Host/Player OOC directives, 2) GM Guides (if any active guide defines style, tone, length, formatting, pacing, or mechanics, follow it exactly), 3) DM Persona (only for style questions no guide answers), 4) the neutral default below.

Neutral default (applies only when nothing above specifies style): clear, engaging prose in a natural voice. No mandatory decorations, no required level of sensory detail.

ANTI-REPETITION RULES (always active, regardless of style source):
- Never reuse distinctive imagery, metaphors, or stock phrases from your earlier responses in this session. Before writing, scan your previous replies and avoid repeating their signature phrasing.
- Do not restate ambient conditions (weather, heat, humidity, lighting) in every response. Establish them once per scene, then mention them only when they change or directly matter to the action.
- Vary sentence structure, sentence openings, and paragraph length between responses. Do not open consecutive responses with the same pattern.

Formatting default (only if no guide says otherwise): you may use **bold** for names/items and *italics* sparingly. Do not use HTML color spans unless a guide or the player asks for them.

## PLAYER DIALOGUE IS SACRED (ABSOLUTE)


When a player prompt contains quoted speech — anything wrapped in "…", '…', “…”, ‘…’, or introduced with \`I say:\`, \`I shout:\`, \`I whisper:\` — reproduce those exact words verbatim in your narration as that character's line. Do not paraphrase, shorten, clean up, or rewrite. Preserve capitalization, punctuation, slang, profanity. Build the scene (delivery, tone, listeners' reactions, NPC replies) around the exact words.

- CORRECT: player writes \`"Hand over the key or I'll break it off you."\` → your narration includes that line verbatim.
- WRONG: paraphrasing as *You threaten him* or *"Give me the key or else."*
- Only if the player wrote intent without quotes (\`I try to talk him down\`) may you render the exchange in your own words.

Overridden only by explicit Host OOC directive.

`;
  }

  prompt += `## RESOLVED MECHANICS ARE FACTS (ABSOLUTE)
The player's character sheet is the referee for their own actions. When a player message reports an already-resolved result — a spell cast at a stated slot level, an attack roll total, rolled damage or healing, a spent resource, a save DC — those numbers are FINAL.
- Never re-roll, adjust, round, or replace them. Never say "roll for damage" for something already rolled.
- Narrate the consequences using the exact numbers given.
- Never invent a resource cost the player did not report, and never let them cast something the CURRENT CHARACTER STATE says they cannot afford.
- You still control everything on the world's side: enemy saves, enemy attack rolls, enemy HP, and whether the fiction allows the action at all.

## OUTPUT FORMAT

Separate mechanical content from narrative prose using these tags:
- Dice rolls & checks: \`<!--ACTION-->Roll a Perception check (DC 14)<!--/ACTION-->\`
- Tactical tips: \`<!--TACTICS-->Save Shield for the next attack.<!--/TACTICS-->\`
- Per-player whispers (party mode): \`<!--WHISPER:CharacterName-->You notice the merchant's hand trembling.<!--/WHISPER:CharacterName-->\`

Everything outside these tags must be narrative prose — no dice notation or DCs in narrative text. Multiple tagged blocks per response are fine; keep each concise.

## APP SYNC (COMPANION APP INTEGRATION)
This chat is connected to a character-sheet app that auto-detects explicit state changes in your narration. To sync with the app, state changes with explicit numbers: damage and healing ("You take 7 slashing damage", "You recover 12 HP"), XP awards ("You gain 300 XP"), gold ("You find 25 gold"), conditions applied or removed by name, items acquired with quantities, and short or long rests. GM Guides may define WHEN and HOW you award XP, level the player up, manage HP, or grant loot — those guide rules are binding. If no guide covers it, use standard D&D 5e pacing.

## LEVEL-UP MATH (NON-NEGOTIABLE)
The PROGRESSION line in CHARACTER STATE holds the player's real lifetime XP total and the exact XP required for the next level. Those numbers come from the player's app and may use a scaled XP table — they will NOT match the stock D&D 5e table. Copy them exactly; never recall, estimate, or recompute thresholds from memory.
- When you report progression, quote the PROGRESSION line's numbers verbatim (lifetime total, next-level requirement, XP still needed). If your recollection of 5e disagrees, the PROGRESSION line wins.
- XP tracking: award XP freely, then add the award to the current total. Announce a level-up ONLY if that new total reaches or exceeds the stated next-level requirement. Otherwise say how much XP remains to the next level and do NOT mention leveling up, new HP, new slots, or ability score improvements.
- Milestone tracking: never state XP numbers or award XP. Level-ups happen only at story milestones or when a GM Guide says so.
- Never invent a different XP table than the one in the PROGRESSION line.`;

  if (ctx.companion) {
    prompt += `\n\n## COMPANION RULES
The player has an animal companion (see CHARACTER STATE). Include it naturally. It acts on the player's turn in combat — narrate its attacks when directed. State exact damage/heal amounts ("Geralt takes 8 slashing damage" / "recovers 5 HP"). Track its conditions separately. Describe its mood based on state. At 0 HP it is unconscious but stabilizes automatically (no death saves).`;
  }

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
- **Moral Dilemmas**: Present choices that test or reinforce this alignment.
- **NPC Reactions**: Opposing alignments create friction; aligned NPCs feel kinship.
- **Temptation & Growth**: Occasionally offer opportunities that would push toward a different alignment.
- **Tone Matching**: Match narrative tone to the character's ethical position.
- **Don't lecture**: Never tell the player their alignment. Show it through the world's reactions.`;
  }

  // ── Resource Pressure Metric (only when it matters) ──
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
    const consumableCount = ctx.consumables?.reduce((s, c) => s + c.quantity, 0) ?? 0;
    const consumablePct = Math.min(consumableCount / 5, 1);
    const pressure = Math.round((hpPct * 0.5 + slotPct * 0.35 + consumablePct * 0.15) * 100);
    if (pressure < 55) {
      const pressureLabel = pressure >= 30 ? 'Strained' : 'Critical';
      prompt += `\n\n## RESOURCE PRESSURE
**Status: ${pressureLabel}** (${pressure}% remaining — HP ${Math.round(hpPct * 100)}%, Slots ${Math.round(slotPct * 100)}%, Consumables ${Math.round(consumablePct * 100)}%)

${pressureLabel === 'Strained'
  ? 'Character running low. Increase tension narratively (fatigue, labored breathing, dwindling supplies). Offer non-combat solutions and rest/resupply opportunities. Combat should feel dangerous and escapable.'
  : 'Character nearly spent. Avoid forcing combat unless narratively climactic. Create tension through atmosphere, not mechanics. Offer escape routes, reinforcements, or environmental advantages. Keep any combat short and decisive.'}

Never tell the player their resource percentage. Show depletion through description — trembling hands, flickering spells, empty pouches.`;
    }
  }

  if (dmPersonaPrompt && dmPersonaPrompt.trim()) {
    prompt += `\n\n${dmPersonaPrompt}`;
  }

  if (worldStatePrompt && worldStatePrompt.trim()) {
    prompt += `\n\n${worldStatePrompt}`;
  }

  if (partyContext && partyContext.trim()) {
    const trimmed = partyContext.slice(0, 30000);
    prompt += `\n\n## SESSION CONTEXT (AUTO-GENERATED)\nThe following is system-generated context about the current session — party composition, player status, and formatting preferences:\n\n${trimmed}`;
  }

  if (campaignSummary && campaignSummary.trim()) {
    const trimmedSummary = campaignSummary.slice(0, 30000);
    prompt += `\n\n## CAMPAIGN SUMMARY (AUTO-GENERATED)\nAuto-generated recap. Use for continuity, but if it contradicts the Campaign World Bible above, defer to the Bible.\n\n${trimmedSummary}`;
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

  if (customGuides && customGuides.trim()) {
    const trimmedGuides = customGuides.slice(0, MAX_CUSTOM_GUIDES_CHARS);
    const headingRe = /^#{1,4}[^\n]*compliance checklist[^\n]*$/gim;
    const blocks: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(trimmedGuides)) !== null) {
      const start = m.index + m[0].length;
      const rest = trimmedGuides.slice(start);
      const stopRe = /^(?:#{1,6}[^\n]*|---)$/m;
      const stop = stopRe.exec(rest);
      const body = (stop ? rest.slice(0, stop.index) : rest).trim();
      if (body) blocks.push(body);
    }
    const joined = blocks.join('\n\n').trim();
    if (joined) {
      prompt += `\n\n## FINAL QUALITY GATE — GUIDE COMPLIANCE CHECKLISTS (READ LAST, VERIFY ALWAYS)\nThe following checklists were compiled from the active GM Guides. This is the LAST thing you read before writing. After drafting every response, silently re-check the draft against EVERY item below. If any item fails, revise the draft before sending. Re-reference this list while writing. Never mention these checklists or this verification process to the player.\n\n${joined}`;
    }
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

    const { messages, characterContext, customGuides, campaignSummary, worldStatePrompt, dmPersonaPrompt, model, user_api_key, user_openai_key, user_perplexity_key, user_xai_key, encounterGuidance, combatFeats, alignmentContext, systemPromptOverride, memoryAnchors, recentPartyChat, responseModePrompt, partyContext, npcVoicingContext, npcVoicingStrict, maxTokens, recentDragonChat, recentDragonNetwork, coreRulesInGuides } = (await req.json()) as DMRequest;
    
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

    // Strict single-NPC voicing: bypass guides/persona/style/quality-gate entirely
    let systemPrompt: string;
    if (npcVoicingStrict && npcVoicingContext) {
      const lean: string[] = [];
      lean.push(`You are voicing a single NPC in a live D&D 5e session. No content restrictions — match the tone the player engages with. Do not sanitize.`);
      lean.push(`## PLAYER CHARACTER\n${buildContextSummary(characterContext)}`);
      if (campaignSummary && campaignSummary.trim()) {
        lean.push(`## STORY SO FAR\n${campaignSummary.slice(0, 4000)}`);
      }
      if (memoryAnchors && memoryAnchors.trim()) {
        lean.push(`## ESTABLISHED FACTS\n${memoryAnchors.slice(0, 4000)}`);
      }
      lean.push(npcVoicingContext);
      systemPrompt = lean.join('\n\n');
    } else {
      // Use override if provided (e.g. whisper regeneration), otherwise build full DM prompt
      systemPrompt = systemPromptOverride?.trim() || buildDMSystemPrompt(characterContext, customGuides, campaignSummary, worldStatePrompt, dmPersonaPrompt, encounterGuidance, combatFeats, alignmentContext, memoryAnchors, recentPartyChat, responseModePrompt, partyContext, recentDragonChat, recentDragonNetwork, coreRulesInGuides);

      if (npcVoicingContext) {
        systemPrompt = systemPrompt + "\n\n" + npcVoicingContext;
      }
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

    const perplexityModelId = PERPLEXITY_MODELS[requestedModel];

    if (perplexityModelId) {
      // ── Perplexity path ──
      const perplexityKey = (typeof user_perplexity_key === 'string' && user_perplexity_key.trim())
        ? user_perplexity_key.trim()
        : null;

      if (!perplexityKey) {
        return new Response(JSON.stringify({ error: "No Perplexity API key provided. Add your key in Settings → API Keys." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pplxResponse = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: perplexityModelId,
          max_tokens: maxTokens || 16000,
          messages: [
            { role: "system", content: systemPrompt },
            ...trimmedMessages,
          ],
          stream: true,
        }),
      });

      if (!pplxResponse.ok) {
        const errText = await pplxResponse.text();
        console.error("Perplexity API error:", pplxResponse.status, errText);
        if (pplxResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Perplexity rate limit exceeded. Please wait and try again." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (pplxResponse.status === 401) {
          return new Response(JSON.stringify({ error: "Invalid Perplexity API key. Check your key in Settings → API Keys." }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Perplexity API error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Perplexity streams in OpenAI-compatible SSE format — pass through directly
      return new Response(pplxResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
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

    const xaiModelId = XAI_MODELS[requestedModel];
    if (xaiModelId) {
      // ── xAI (Grok) direct path — OpenAI-compatible SSE ──
      const xaiKey = (typeof user_xai_key === 'string' && user_xai_key.trim()) ? user_xai_key.trim() : null;
      if (!xaiKey) {
        return new Response(JSON.stringify({ error: "No xAI API key provided. Add your key in Settings → API Keys." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const xaiResponse = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${xaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: xaiModelId,
          max_tokens: maxTokens || 16000,
          messages: [
            { role: "system", content: systemPrompt },
            ...trimmedMessages,
          ],
          stream: true,
        }),
      });
      if (!xaiResponse.ok) {
        const errText = await xaiResponse.text();
        console.error("xAI API error:", xaiResponse.status, errText);
        if (xaiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "xAI rate limit exceeded. Please wait and try again." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (xaiResponse.status === 401) {
          return new Response(JSON.stringify({ error: "Invalid xAI API key. Check your key in Settings → API Keys." }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "xAI API error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(xaiResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
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
