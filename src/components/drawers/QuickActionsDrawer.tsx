import { useState, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Swords, Sparkles, Zap, Wand2, 
  ChevronDown, Copy, Check, Timer, Shield, Play, Dices
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Character, Ability } from '@/lib/types';
import { allAbilities, getAbilityById } from '@/lib/abilities';
import { WeaponAttack, UNARMED_STRIKE } from '@/lib/combat/combatTypes';
import { getEquippedWeapons } from '@/lib/combat/weaponConverter';
import { CharacterEquipment } from '@/lib/inventory/types';
import { getSpellById } from '@/lib/magic/spells';
import { SpellDefinition } from '@/lib/magic/types';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { applyOverrides, homebrewToAbility } from '@/lib/abilityCustomization/utils';
import { isLegacyAbilityId, resolveLegacyAbility } from '@/lib/prestigeTree/abilityConverter';
import { rollDice, getAbilityDice, DiceRoll, isCriticalHit, isCriticalMiss, inferRollMode } from '@/lib/diceRoller';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';

// Types for cooldown info passed in
interface CooldownInfo {
  isOnCooldown: (abilityId: string) => boolean;
  getRemainingTime: (abilityId: string) => number;
  formatRemainingTime: (seconds: number) => string;
  triggerCooldown: (abilityId: string) => void;
}

// Types for spellcasting info
interface SpellcastingInfo {
  preparedSpells: string[];
  knownSpells: string[];
  favoriteSpells: string[];
  spellSlots: Record<number, { current: number; max: number }>;
  pactSlots?: { current: number; max: number; level: number };
  concentratingOn: string | null;
  castSpell: (spellId: string, spellName: string, baseLevel: number, castLevel: number, usePact: boolean, requiresConcentration: boolean, duration: string) => {
    success: boolean;
    brokeConcentration: string | null;
  };
  useSlot: (level: number) => boolean;
}

interface QuickActionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
  equipment?: CharacterEquipment;
  cooldowns: CooldownInfo;
  spellcasting?: SpellcastingInfo;
  characterName: string;
}

// ── Prompt generators (static, no roll data) ──

function generateQuickWeaponPrompt(weapon: WeaponAttack, characterName: string): string {
  return applyTimePrefix(
    `## ⚔️ ${weapon.name} Attack

**Character:** ${characterName}
**Weapon:** ${weapon.name}
**Damage:** ${weapon.damage} ${weapon.damageType}
**Properties:** ${weapon.properties.join(', ') || 'Standard'}
**Type:** ${weapon.isRanged ? 'Ranged' : 'Melee'}

Narrate ${characterName} attacking with their ${weapon.name}. Describe the strike, the weapon's feel, and the impact.`
  );
}

function generateQuickAbilityPrompt(ability: Ability, tier: number, characterName: string): string {
  const tierEffect = ability.tierEffects.find(e => e.tier === tier)?.description || '';
  const treeContext = {
    hunter: 'precision and predatory instinct',
    warrior: 'raw power and martial prowess',
    assassin: 'shadow and lethal finesse',
  };

  return applyTimePrefix(
    `## ⚡ ${ability.name} (Tier ${tier})

**Character:** ${characterName}
**Tree:** ${ability.tree.charAt(0).toUpperCase() + ability.tree.slice(1)} — ${treeContext[ability.tree]}
**Action:** ${ability.actionType.replace('_', ' ')}
**Effect:** ${tierEffect}

Narrate ${characterName} activating **${ability.name}** with dramatic flair. Describe the visual manifestation and tactical impact.`
  );
}

function generateQuickSpellPrompt(spell: SpellDefinition, characterName: string, isCantrip: boolean): string {
  const levelLabel = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`;
  return applyTimePrefix(
    `## ${isCantrip ? '✨' : '🔮'} ${spell.name} (${levelLabel})

**Character:** ${characterName}
**School:** ${spell.school}
**Casting Time:** ${spell.castingTime.replace('_', ' ')}
**Range:** ${spell.range}
${spell.concentration ? '**⚡ Concentration Required**\n' : ''}
**Description:** ${spell.description}

Narrate ${characterName} casting **${spell.name}**. Describe the arcane gestures, incantation, and magical effect with cinematic detail.`
  );
}

// ── Roll-enhanced prompt generators ──

function generateWeaponRollPrompt(weapon: WeaponAttack, roll: DiceRoll, characterName: string): string {
  const maxVal = parseInt(roll.die.slice(1));
  const isCrit = roll.die === 'd20' 
    ? isCriticalHit(roll.rolls, inferRollMode(roll.rolls, roll.total, roll.modifier), roll.die) 
    : roll.rolls.some(r => r === maxVal);
  const isFumble = roll.die === 'd20'
    ? isCriticalMiss(roll.rolls, inferRollMode(roll.rolls, roll.total, roll.modifier), roll.die)
    : roll.rolls.every(r => r === 1);
  const quality = isCrit ? 'CRITICAL HIT!' : isFumble ? 'CRITICAL MISS!' : roll.total >= maxVal * 0.7 ? 'Solid Hit' : 'Glancing Blow';

  return applyTimePrefix(
    `## ⚔️ ${weapon.name} Attack — ${quality}

**Character:** ${characterName}
**Weapon:** ${weapon.name} | **Damage:** ${weapon.damage} ${weapon.damageType}
**Properties:** ${weapon.properties.join(', ') || 'Standard'}

### 🎲 Dice Roll
**Roll:** ${roll.count}${roll.die} → [${roll.rolls.join(', ')}]${roll.modifier ? ` + ${roll.modifier}` : ''} = **${roll.total}**
**Result:** ${quality}

${isCrit ? '**The strike lands with devastating precision! Double damage dice!**\n\n' : ''}${isFumble ? '**The attack goes wildly astray! Describe the embarrassing miss.**\n\n' : ''}Narrate ${characterName}'s attack with their ${weapon.name}. Factor in the ${quality.toLowerCase()} — describe the weapon's arc, impact, and battlefield consequence.`
  );
}

function generateAbilityRollPrompt(ability: Ability, tier: 1 | 2 | 3, roll: DiceRoll, characterName: string): string {
  // Use the existing high-quality prompt generator
  return generateRPPrompt(ability, tier, roll, characterName);
}

// ── Inline Roll Result Display ──

function InlineRollResult({ 
  roll, 
  prompt, 
  onReroll, 
  label,
  colorClass,
}: { 
  roll: DiceRoll; 
  prompt: string; 
  onReroll: () => void;
  label: string;
  colorClass: string;
}) {
  const [copied, setCopied] = useState(false);
  const maxVal = parseInt(roll.die.slice(1));
  
  const isCrit = roll.die === 'd20'
    ? isCriticalHit(roll.rolls, inferRollMode(roll.rolls, roll.total, roll.modifier), roll.die)
    : roll.rolls.some(r => r === maxVal);
  const isFumble = roll.die === 'd20'
    ? isCriticalMiss(roll.rolls, inferRollMode(roll.rolls, roll.total, roll.modifier), roll.die)
    : roll.rolls.every(r => r === 1);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success('Roll prompt copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [prompt]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className={cn(
        "mx-1 mt-1 mb-2 rounded-lg border p-3",
        isCrit ? "border-amber-500/50 bg-amber-500/10" 
        : isFumble ? "border-red-500/50 bg-red-500/10" 
        : `border-border/40 bg-card/60`
      )}>
        {/* Roll result header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground font-mono uppercase">{label}</span>
          <div className="flex items-center gap-1">
            {roll.rolls.map((r, i) => (
              <span key={i} className={cn(
                "inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold border",
                r === maxVal ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : r === 1 ? "bg-red-500/20 border-red-500/50 text-red-300"
                : "bg-muted/30 border-border/30 text-foreground"
              )}>
                {r}
              </span>
            ))}
            {roll.modifier !== 0 && (
              <span className="text-xs text-muted-foreground ml-1">
                {roll.modifier > 0 ? '+' : ''}{roll.modifier}
              </span>
            )}
          </div>
        </div>

        {/* Total */}
        <div className="text-center mb-2">
          <span className={cn(
            "text-2xl font-cinzel font-bold",
            isCrit ? "text-amber-400 animate-pulse" : isFumble ? "text-red-400" : colorClass
          )}>
            {roll.total}
          </span>
          {isCrit && <span className="block text-[10px] text-amber-400 font-semibold uppercase tracking-wider mt-0.5">✦ Critical! ✦</span>}
          {isFumble && <span className="block text-[10px] text-red-400 font-semibold uppercase tracking-wider mt-0.5">✗ Fumble ✗</span>}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onReroll}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-muted/30 hover:bg-muted/50 text-xs font-medium transition-colors"
          >
            <Dices className="w-3.5 h-3.5" />
            Reroll
          </button>
          <button
            onClick={handleCopy}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors",
              copied 
                ? "bg-emerald-500/20 text-emerald-400" 
                : "bg-primary/15 text-primary hover:bg-primary/25"
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Copy helper ──

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Prompt copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [text]);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleCopy(); }}
      className="p-1.5 rounded-md hover:bg-white/10 transition-colors shrink-0"
      aria-label="Copy prompt"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

// Quick-cast button
function QuickCastButton({ 
  label, 
  disabled, 
  onCast, 
  prompt 
}: { 
  label: string; 
  disabled?: boolean; 
  onCast: () => void; 
  prompt: string;
}) {
  const [fired, setFired] = useState(false);

  const handleCast = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onCast();
    try {
      await navigator.clipboard.writeText(prompt);
    } catch { /* silent */ }
    setFired(true);
    setTimeout(() => setFired(false), 1500);
  }, [disabled, onCast, prompt]);

  return (
    <button
      onClick={handleCast}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all shrink-0",
        "min-h-[28px] min-w-[52px] justify-center",
        fired
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : disabled
            ? "bg-muted/30 text-muted-foreground/40 cursor-not-allowed border border-border/20"
            : "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 active:scale-95"
      )}
      style={{ touchAction: 'manipulation' }}
    >
      {fired ? (
        <Check className="w-3 h-3" />
      ) : (
        <>
          <Play className="w-3 h-3" />
          {label}
        </>
      )}
    </button>
  );
}

// Category header component
function CategoryHeader({ 
  icon: Icon, 
  label, 
  count, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  count: number; 
  color: string;
}) {
  return (
    <div className="flex items-center justify-between w-full py-2.5 px-3">
      <div className="flex items-center gap-2">
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", color)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="font-cinzel font-semibold text-sm">{label}</span>
        <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </div>
  );
}

export function QuickActionsDrawer({
  open,
  onOpenChange,
  character,
  equipment,
  cooldowns,
  spellcasting,
  characterName,
}: QuickActionsDrawerProps) {
  // Track which item has an active inline roll
  const [activeRoll, setActiveRoll] = useState<{ id: string; roll: DiceRoll; prompt: string } | null>(null);

  // ── Basics: Equipped weapons + unarmed strike ──
  const weapons = useMemo((): WeaponAttack[] => {
    const items: WeaponAttack[] = [UNARMED_STRIKE];
    if (equipment) {
      items.push(...getEquippedWeapons(equipment.slots));
    }
    return items;
  }, [equipment]);

  // ── Abilities: Equipped active abilities from loadout ──
  const equippedAbilities = useMemo(() => {
    const ids = character.equippedAbilities || [];
    return ids.map(id => {
      if (isLegacyAbilityId(id)) {
        const legacy = resolveLegacyAbility(id);
        if (legacy) return { ability: legacy, tier: 1 as const };
        return null;
      }
      const ability = getAbilityById(id);
      if (!ability) return null;
      const charAbility = character.abilities.find(a => a.abilityId === id);
      const tier = (charAbility?.currentTier || 1) as 1 | 2 | 3;
      return { ability, tier };
    }).filter(Boolean) as { ability: Ability; tier: 1 | 2 | 3 }[];
  }, [character.equippedAbilities, character.abilities]);

  // ── Magic: Favorited spells auto-populate; fall back to prepared/known ──
  const preparedSpells = useMemo((): SpellDefinition[] => {
    if (!spellcasting) return [];
    const favoriteNonCantrips = spellcasting.favoriteSpells
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level > 0);
    if (favoriteNonCantrips.length > 0) return favoriteNonCantrips;
    const allIds = [...new Set([...spellcasting.preparedSpells, ...spellcasting.knownSpells])];
    return allIds
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level > 0);
  }, [spellcasting]);

  // ── Cantrips ──
  const cantrips = useMemo((): SpellDefinition[] => {
    if (!spellcasting) return [];
    const favoriteCantrips = spellcasting.favoriteSpells
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level === 0);
    if (favoriteCantrips.length > 0) return favoriteCantrips;
    const allIds = [...new Set([...spellcasting.preparedSpells, ...spellcasting.knownSpells])];
    return allIds
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level === 0);
  }, [spellcasting]);

  // Slot summary
  const slotSummary = useMemo(() => {
    if (!spellcasting) return '';
    const parts: string[] = [];
    for (let lvl = 1; lvl <= 9; lvl++) {
      const slot = spellcasting.spellSlots[lvl];
      if (slot && slot.max > 0) {
        parts.push(`L${lvl}: ${slot.current}/${slot.max}`);
      }
    }
    if (spellcasting.pactSlots && spellcasting.pactSlots.max > 0) {
      parts.push(`Pact: ${spellcasting.pactSlots.current}/${spellcasting.pactSlots.max}`);
    }
    return parts.join(' · ');
  }, [spellcasting]);

  // ── Roll handlers ──

  const handleWeaponRoll = useCallback((weapon: WeaponAttack) => {
    // Parse weapon damage for die info, default to d20 attack roll
    const roll = rollDice('d20', 1, weapon.attackBonus);
    const prompt = generateWeaponRollPrompt(weapon, roll, characterName);
    setActiveRoll({ id: `weapon-${weapon.id}`, roll, prompt });
  }, [characterName]);

  const handleWeaponReroll = useCallback((weapon: WeaponAttack) => {
    const roll = rollDice('d20', 1, weapon.attackBonus);
    const prompt = generateWeaponRollPrompt(weapon, roll, characterName);
    setActiveRoll({ id: `weapon-${weapon.id}`, roll, prompt });
  }, [characterName]);

  const handleAbilityRoll = useCallback((ability: Ability, tier: 1 | 2 | 3) => {
    const { die, count } = getAbilityDice(tier);
    const roll = rollDice(die, count);
    const prompt = generateAbilityRollPrompt(ability, tier, roll, characterName);
    // Also trigger cooldown
    cooldowns.triggerCooldown(ability.id);
    setActiveRoll({ id: `ability-${ability.id}`, roll, prompt });
    toast.success(`${ability.name} activated!`, { description: 'Cooldown started' });
  }, [characterName, cooldowns]);

  const handleAbilityReroll = useCallback((ability: Ability, tier: 1 | 2 | 3) => {
    const { die, count } = getAbilityDice(tier);
    const roll = rollDice(die, count);
    const prompt = generateAbilityRollPrompt(ability, tier, roll, characterName);
    setActiveRoll({ id: `ability-${ability.id}`, roll, prompt });
  }, [characterName]);

  // ── Spell cast handlers ──
  const handleCastSpell = useCallback((spell: SpellDefinition) => {
    if (!spellcasting) return;
    const result = spellcasting.castSpell(
      spell.id,
      spell.name,
      spell.level,
      spell.level,
      false,
      spell.concentration,
      spell.duration || '1 round'
    );
    if (result.success) {
      toast.success(`${spell.name} cast!`, {
        description: result.brokeConcentration
          ? `Concentration on ${result.brokeConcentration} broken`
          : `Level ${spell.level} slot used`,
      });
    }
  }, [spellcasting]);

  const handleUseAbility = useCallback((abilityId: string, abilityName: string) => {
    cooldowns.triggerCooldown(abilityId);
    toast.success(`${abilityName} activated!`, {
      description: 'Cooldown started · Prompt copied',
    });
  }, [cooldowns]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] max-h-[85vh] rounded-t-xl flex flex-col p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 mb-1 shrink-0" />
        <SheetTitle className="text-center font-cinzel text-base px-4 pb-2 shrink-0">
          Quick Actions
        </SheetTitle>

        {/* Spell Slot Summary Bar */}
        {slotSummary && (
          <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0">
            <p className="text-xs text-center text-indigo-300 font-mono">{slotSummary}</p>
          </div>
        )}

        <ScrollArea className="flex-1 px-4 pb-6">
          <div className="space-y-1.5">

            {/* ── BASICS (Weapons / Actions) ── */}
            <Collapsible className="group">
              <CollapsibleTrigger className="w-full">
                <CategoryHeader icon={Swords} label="Basics" count={weapons.length} color="bg-red-500/20 text-red-400" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 pl-2 pr-1 pb-2">
                  {weapons.map(weapon => {
                    const prompt = generateQuickWeaponPrompt(weapon, characterName);
                    const isRolling = activeRoll?.id === `weapon-${weapon.id}`;
                    return (
                      <div key={weapon.id}>
                        <button
                          onClick={() => isRolling ? setActiveRoll(null) : handleWeaponRoll(weapon)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors text-left",
                            isRolling 
                              ? "bg-red-500/10 border-red-500/30" 
                              : "bg-card/40 border-border/30 hover:bg-card/60 active:bg-card/80"
                          )}
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Swords className="w-4 h-4 text-red-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{weapon.name}</p>
                            <p className="text-xs text-muted-foreground">{weapon.damage} {weapon.damageType} · {weapon.properties.join(', ') || 'Standard'}</p>
                          </div>
                          <Dices className={cn("w-4 h-4 shrink-0 transition-colors", isRolling ? "text-red-400" : "text-muted-foreground/50")} />
                        </button>
                        <AnimatePresence>
                          {isRolling && activeRoll && (
                            <InlineRollResult
                              roll={activeRoll.roll}
                              prompt={activeRoll.prompt}
                              onReroll={() => handleWeaponReroll(weapon)}
                              label={`${weapon.name} Attack`}
                              colorClass="text-red-400"
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                  {['Dodge', 'Dash', 'Disengage', 'Help', 'Hide'].map(action => (
                    <div key={action} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card/40 border border-border/30">
                      <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{action}</p>
                        <p className="text-xs text-muted-foreground">Action</p>
                      </div>
                      <CopyButton text={applyTimePrefix(
                        `## 🛡️ ${action}\n\n**Character:** ${characterName}\n\n${characterName} uses their action to **${action}**. Narrate the tactical decision and its effect on the battlefield.`
                      )} />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ── ABILITIES (Equipped Loadout) ── */}
            <Collapsible className="group">
              <CollapsibleTrigger className="w-full">
                <CategoryHeader icon={Zap} label="Abilities" count={equippedAbilities.length} color="bg-purple-500/20 text-purple-400" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 pl-2 pr-1 pb-2">
                  {equippedAbilities.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No abilities equipped. Slot them in the Skills tab.</p>
                  )}
                  {equippedAbilities.map(({ ability, tier }) => {
                    const onCD = cooldowns.isOnCooldown(ability.id);
                    const remaining = cooldowns.getRemainingTime(ability.id);
                    const prompt = generateQuickAbilityPrompt(ability, tier, characterName);
                    const isPassive = ability.type === 'passive';
                    const isRolling = activeRoll?.id === `ability-${ability.id}`;
                    return (
                      <div key={ability.id}>
                        <button
                          onClick={() => {
                            if (isPassive || onCD) return;
                            isRolling ? setActiveRoll(null) : handleAbilityRoll(ability, tier);
                          }}
                          disabled={isPassive || onCD}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors text-left",
                            isRolling
                              ? "bg-purple-500/10 border-purple-500/30"
                              : onCD
                                ? "bg-card/40 border-border/30 opacity-60 cursor-not-allowed"
                                : isPassive
                                  ? "bg-card/40 border-border/30 cursor-default"
                                  : "bg-card/40 border-border/30 hover:bg-card/60 active:bg-card/80"
                          )}
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Zap className={cn("w-4 h-4 shrink-0", 
                            ability.tree === 'hunter' ? 'text-green-400' :
                            ability.tree === 'warrior' ? 'text-red-400' : 'text-purple-400'
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">{ability.name}</p>
                              <span className="text-[10px] text-amber-400 font-mono">T{tier}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">{ability.actionType.replace('_', ' ')}</p>
                              {onCD && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                                  <Timer className="w-3 h-3" />
                                  {cooldowns.formatRemainingTime(remaining)}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isPassive && !onCD && (
                            <Dices className={cn("w-4 h-4 shrink-0 transition-colors", isRolling ? "text-purple-400" : "text-muted-foreground/50")} />
                          )}
                          {isPassive && <CopyButton text={prompt} />}
                        </button>
                        <AnimatePresence>
                          {isRolling && activeRoll && (
                            <InlineRollResult
                              roll={activeRoll.roll}
                              prompt={activeRoll.prompt}
                              onReroll={() => handleAbilityReroll(ability, tier)}
                              label={`${ability.name} T${tier}`}
                              colorClass={
                                ability.tree === 'hunter' ? 'text-green-400' :
                                ability.tree === 'warrior' ? 'text-red-400' : 'text-purple-400'
                              }
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ── MAGIC (Prepared Spells) ── */}
            <Collapsible className="group">
              <CollapsibleTrigger className="w-full">
                <CategoryHeader icon={Wand2} label="Magic" count={preparedSpells.length} color="bg-indigo-500/20 text-indigo-400" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 pl-2 pr-1 pb-2">
                  {preparedSpells.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No spells prepared. Visit the Arcana tab.</p>
                  )}
                  {preparedSpells.map(spell => {
                    const slot = spellcasting?.spellSlots[spell.level];
                    const hasSlot = slot ? slot.current > 0 : false;
                    const isConcentrating = spellcasting?.concentratingOn === spell.id;
                    const prompt = generateQuickSpellPrompt(spell, characterName, false);
                    return (
                      <div key={spell.id} className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card/40 border border-border/30",
                        !hasSlot && "opacity-50"
                      )}>
                        <Wand2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{spell.name}</p>
                            <span className="text-[10px] text-indigo-300 font-mono">L{spell.level}</span>
                            {spell.concentration && <span className="text-[10px] text-yellow-400">C</span>}
                            {isConcentrating && <span className="text-[10px] text-amber-400 animate-pulse">●</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {spell.school} · {spell.castingTime.replace('_', ' ')}
                            {slot && <span className="ml-1 text-indigo-300/70">({slot.current}/{slot.max})</span>}
                          </p>
                        </div>
                        <QuickCastButton
                          label="Cast"
                          disabled={!hasSlot}
                          onCast={() => handleCastSpell(spell)}
                          prompt={prompt}
                        />
                        <CopyButton text={prompt} />
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ── CANTRIPS ── */}
            <Collapsible className="group">
              <CollapsibleTrigger className="w-full">
                <CategoryHeader icon={Sparkles} label="Cantrips" count={cantrips.length} color="bg-cyan-500/20 text-cyan-400" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 pl-2 pr-1 pb-2">
                  {cantrips.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No cantrips known. Visit the Arcana tab.</p>
                  )}
                  {cantrips.map(spell => {
                    const prompt = generateQuickSpellPrompt(spell, characterName, true);
                    return (
                      <div key={spell.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card/40 border border-border/30">
                        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{spell.name}</p>
                          <p className="text-xs text-muted-foreground">{spell.school} · {spell.castingTime.replace('_', ' ')}</p>
                        </div>
                        <QuickCastButton
                          label="Cast"
                          disabled={false}
                          onCast={() => {
                            toast.success(`${spell.name} cast!`, { description: 'Cantrip — no slot used' });
                          }}
                          prompt={prompt}
                        />
                        <CopyButton text={prompt} />
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
