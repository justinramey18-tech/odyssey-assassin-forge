import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Swords, Sparkles, Zap, Wand2, Sunrise, RotateCcw,
  ChevronDown, Copy, Check, Timer, Shield, Play, Dices, Target,
  Beaker, Skull, ScrollText, FlaskConical, PawPrint, Clock, Heart,
  ImagePlus, ImageOff, Star, X, Plus, Flame
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Character, Ability } from '@/lib/types';
import { allAbilities, getAbilityById } from '@/lib/abilities';
import { useAbilityCustomization } from '@/hooks/use-ability-customization';
import { useAbilityImages } from '@/hooks/use-ability-images';
import { WeaponAttack, UNARMED_STRIKE } from '@/lib/combat/combatTypes';
import { getEquippedWeapons } from '@/lib/combat/weaponConverter';
import { CharacterEquipment } from '@/lib/inventory/types';
import { InventoryItem, typeConfig as consumableTypeConfig } from '@/lib/consumables/types';
import { generateConsumablePrompt } from '@/lib/consumables/prompts';
import { getSpellById } from '@/lib/magic/spells';
import { SpellDefinition } from '@/lib/magic/types';
import { UseWildShapeReturn } from '@/hooks/use-wild-shape';
import { BeastForm, formatCR } from '@/lib/magic/wildShape';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { generateWildShapeAbilityPrompt } from '@/lib/wildShapePrompts';
import { applyOverrides, homebrewToAbility } from '@/lib/abilityCustomization/utils';
import { isLegacyAbilityId, resolveLegacyAbility } from '@/lib/prestigeTree/abilityConverter';
import { rollDice, getAbilityDice, DiceRoll, DieType, RollMode, isCriticalHit, isCriticalMiss, inferRollMode } from '@/lib/diceRoller';
import { getD20RollQuality } from '@/lib/rollQuality';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { generateChannelDivinityPrompt } from '@/lib/magic/channelDivinityPrompts';
import { HealTargetPicker } from '@/components/party/HealTargetPicker';

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
  toggleFavorite: (spellId: string) => void;
}

// Channel Divinity info for Quick Actions
interface ChannelDivinityInfo {
  current: number;
  max: number;
  clericLevel: number;
  domainName?: string;
  deityName?: string;
  options: Array<{ id: string; name: string; description: string; mechanicalEffect?: string; isDomain: boolean }>;
  useChannelDivinity: (optionName?: string) => boolean;
  restoreChannelDivinity: () => void;
}

interface QuickActionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
  equipment?: CharacterEquipment;
  cooldowns: CooldownInfo;
  spellcasting?: SpellcastingInfo;
  characterName: string;
  consumablesInventory?: InventoryItem[];
  onUseConsumable?: (consumableId: string) => boolean;
  wildShape?: UseWildShapeReturn;
  // Wild Shape background management
  onAssignWildShapeBackground?: (formId: string, file: File) => Promise<void>;
  onRemoveWildShapeBackground?: (formId: string) => void;
  hasWildShapeBackground?: (formId: string) => boolean;
  // HP props for healing potions
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  onHPChange?: (current: number, temp: number) => void;
  // Party props for heal target picker
  partyMembers?: import('@/hooks/use-party-sync').PartyMember[];
  userId?: string;
  onSendHeal?: (targetUserId: string, actionData: { senderName?: string; itemName?: string; hpHealed?: number }) => Promise<void>;
  // Channel Divinity
  channelDivinity?: ChannelDivinityInfo;
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

// ── Parse damage formula like "1d6", "2d8", "1d4+2" ──
function parseDamageFormula(formula: string): { die: DieType; count: number; modifier: number } | null {
  const match = formula.match(/^(\d+)?d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if (!match) return null;
  const count = parseInt(match[1] || '1');
  const sides = parseInt(match[2]);
  const modifier = parseInt(match[3] || '0');
  const validDice: number[] = [4, 6, 8, 10, 12, 20, 100];
  if (!validDice.includes(sides)) return null;
  return { die: `d${sides}` as DieType, count, modifier };
}

function generateWeaponRollPrompt(weapon: WeaponAttack, roll: DiceRoll, characterName: string, rollMode: RollMode, damageRoll?: DiceRoll): string {
  const maxVal = parseInt(roll.die.slice(1));
  const isCrit = roll.die === 'd20'
    ? isCriticalHit(roll.rolls, rollMode, roll.die)
    : roll.rolls.some(r => r === maxVal);
  const isFumble = roll.die === 'd20'
    ? isCriticalMiss(roll.rolls, rollMode, roll.die)
    : roll.rolls.every(r => r === 1);
  
  let rollDisplay = `[${roll.rolls.join(', ')}]`;
  let effectiveTotal = roll.total;
  if (rollMode !== 'normal' && roll.rolls.length === 2 && roll.die === 'd20') {
    const kept = rollMode === 'advantage' ? Math.max(...roll.rolls) : Math.min(...roll.rolls);
    effectiveTotal = kept + roll.modifier;
    rollDisplay = `[${roll.rolls.join(', ')}] → **${kept}**`;
  }
  
  const qualityResult = getD20RollQuality(roll.rolls, rollMode);
  const quality = qualityResult.label;
  const modeLabel = rollMode === 'advantage' ? ' (Advantage)' : rollMode === 'disadvantage' ? ' (Disadvantage)' : '';

  let damageSection = '';
  if (damageRoll) {
    const critLabel = isCrit ? ' (Critical — doubled dice!)' : '';
    damageSection = `\n### 💥 Damage Roll${critLabel}\n**Roll:** ${damageRoll.count}${damageRoll.die} → [${damageRoll.rolls.join(', ')}]${damageRoll.modifier ? ` + ${damageRoll.modifier}` : ''} = **${damageRoll.total}** ${weapon.damageType}\n`;
  }

  return applyTimePrefix(
    `## ⚔️ ${weapon.name} Attack${modeLabel} — ${quality}

**Character:** ${characterName}
**Weapon:** ${weapon.name} | **Damage:** ${weapon.damage} ${weapon.damageType}
**Properties:** ${weapon.properties.join(', ') || 'Standard'}

### 🎲 Attack Roll${modeLabel}
**Roll:** ${roll.count}${roll.die} → ${rollDisplay}${roll.modifier ? ` + ${roll.modifier}` : ''} = **${effectiveTotal}**
**Result:** ${quality}
${damageSection}
${qualityResult.narrativeGuide}

Narrate ${characterName}'s attack with their ${weapon.name}. Describe the weapon's arc, impact, and battlefield consequence.`
  );
}

function generateAbilityRollPrompt(ability: Ability, tier: 1 | 2 | 3, roll: DiceRoll, characterName: string): string {
  return generateRPPrompt(ability, tier, roll, characterName);
}

// ── Inline Roll Result Display ──

function InlineRollResult({ 
  roll, 
  prompt, 
  onReroll, 
  label,
  colorClass,
  rollMode,
  onRollModeChange,
  damageRoll,
  onRollDamage,
  damageType,
}: { 
  roll: DiceRoll; 
  prompt: string; 
  onReroll: () => void;
  label: string;
  colorClass: string;
  rollMode?: RollMode;
  onRollModeChange?: (mode: RollMode) => void;
  damageRoll?: DiceRoll;
  onRollDamage?: () => void;
  damageType?: string;
}) {
  const [copied, setCopied] = useState(false);
  const maxVal = parseInt(roll.die.slice(1));
  
  const effectiveMode = rollMode ?? inferRollMode(roll.rolls, roll.total, roll.modifier);
  const isCrit = roll.die === 'd20'
    ? isCriticalHit(roll.rolls, effectiveMode, roll.die)
    : roll.rolls.some(r => r === maxVal);
  const isFumble = roll.die === 'd20'
    ? isCriticalMiss(roll.rolls, effectiveMode, roll.die)
    : roll.rolls.every(r => r === 1);

  // For adv/disadv, compute effective total
  let effectiveTotal = roll.total;
  if (rollMode && rollMode !== 'normal' && roll.rolls.length === 2 && roll.die === 'd20') {
    const kept = rollMode === 'advantage' ? Math.max(...roll.rolls) : Math.min(...roll.rolls);
    effectiveTotal = kept + roll.modifier;
  }

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
        {/* Advantage/Disadvantage Toggle (weapons only) */}
        {onRollModeChange && (
          <div className="flex items-center justify-center gap-1 mb-2">
            {(['normal', 'advantage', 'disadvantage'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => onRollModeChange(mode)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide transition-all",
                  rollMode === mode
                    ? mode === 'advantage'
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : mode === 'disadvantage'
                        ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : "bg-muted/50 text-foreground border border-border/50"
                    : "bg-transparent text-muted-foreground/60 border border-transparent hover:text-muted-foreground"
                )}
              >
                {mode === 'normal' ? 'Normal' : mode === 'advantage' ? 'ADV' : 'DIS'}
              </button>
            ))}
          </div>
        )}

        {/* Roll result header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground font-mono uppercase">{label}</span>
          <div className="flex items-center gap-1">
            {roll.rolls.map((r, i) => {
              // Dim the "dropped" die for adv/disadv
              const isDropped = rollMode && rollMode !== 'normal' && roll.rolls.length === 2 && roll.die === 'd20' && (
                (rollMode === 'advantage' && r !== Math.max(...roll.rolls)) ||
                (rollMode === 'disadvantage' && r !== Math.min(...roll.rolls))
              );
              return (
                <span key={i} className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold border transition-opacity",
                  isDropped ? "opacity-35" : "",
                  r === maxVal ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : r === 1 ? "bg-red-500/20 border-red-500/50 text-red-300"
                  : "bg-muted/30 border-border/30 text-foreground"
                )}>
                  {r}
                </span>
              );
            })}
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
            {effectiveTotal}
          </span>
          {isCrit && <span className="block text-[10px] text-amber-400 font-semibold uppercase tracking-wider mt-0.5">✦ Critical! ✦</span>}
          {isFumble && <span className="block text-[10px] text-red-400 font-semibold uppercase tracking-wider mt-0.5">✗ Fumble ✗</span>}
        </div>

        {/* Damage Roll Result (step 2) */}
        {damageRoll && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="mb-2"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Damage{isCrit ? ' (Critical)' : ''}</span>
            </div>
            <div className="flex items-center justify-center gap-1 mb-1">
              {damageRoll.rolls.map((r, i) => {
                const dmgMax = parseInt(damageRoll.die.slice(1));
                return (
                  <span key={i} className={cn(
                    "inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border",
                    r === dmgMax ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                    : r === 1 ? "bg-muted/20 border-border/30 text-muted-foreground"
                    : "bg-muted/30 border-border/30 text-foreground"
                  )}>
                    {r}
                  </span>
                );
              })}
              {damageRoll.modifier !== 0 && (
                <span className="text-xs text-muted-foreground">
                  {damageRoll.modifier > 0 ? '+' : ''}{damageRoll.modifier}
                </span>
              )}
            </div>
            <div className="text-center">
              <span className="text-xl font-cinzel font-bold text-orange-400">{damageRoll.total}</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">{damageType || 'damage'}</span>
            </div>
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onReroll}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-muted/30 hover:bg-muted/50 text-xs font-medium transition-colors"
          >
            <Dices className="w-3.5 h-3.5" />
            Reroll
          </button>
          {onRollDamage && !damageRoll && !isFumble && (
            <button
              onClick={onRollDamage}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/30 text-xs font-semibold transition-colors"
            >
              <Target className="w-3.5 h-3.5" />
              Roll Damage
            </button>
          )}
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

// ── Wild Shape Status Bar ──

function WildShapeStatusBar({ wildShape }: { wildShape: UseWildShapeReturn }) {
  const [, setTick] = useState(0);

  // Tick every 30s for live timer
  useEffect(() => {
    if (!wildShape.state.isTransformed || !wildShape.state.transformDurationMinutes) return;
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, [wildShape.state.isTransformed, wildShape.state.transformDurationMinutes]);

  const remaining = wildShape.getRemainingDuration();
  const formatDuration = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PawPrint className="w-4 h-4 text-green-400" />
          <span className="text-xs font-mono text-green-300">
            {wildShape.state.isTransformed
              ? `🐻 ${wildShape.state.currentForm?.name ?? 'Beast Form'}`
              : 'Wild Shape'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Uses */}
          <div className="flex items-center gap-1">
            {Array.from({ length: wildShape.state.maxUses }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full",
                  i < wildShape.state.usesRemaining ? "bg-green-400" : "bg-muted/40"
                )}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-0.5">
              {wildShape.state.usesRemaining}/{wildShape.state.maxUses}
            </span>
          </div>
          {/* Timer */}
          {wildShape.state.isTransformed && remaining !== null && (
            <div className="flex items-center gap-1">
              <Clock className={cn("w-3 h-3", remaining <= 10 ? "text-amber-400" : "text-green-400")} />
              <span className={cn("text-[10px] font-mono", remaining <= 10 ? "text-amber-400" : "text-green-300")}>
                {formatDuration(remaining)}
              </span>
            </div>
          )}
          {/* Beast HP */}
          {wildShape.state.isTransformed && (
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-mono text-green-300">
                {wildShape.state.formHP}/{wildShape.state.formMaxHP}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Wild Shape Beast Form Section ──

function WildShapeSection({ wildShape, characterName, onAssignBackground, onRemoveBackground, hasBackground }: { wildShape: UseWildShapeReturn; characterName: string; onAssignBackground?: (formId: string, file: File) => Promise<void>; onRemoveBackground?: (formId: string) => void; hasBackground?: (formId: string) => boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetFormId, setUploadTargetFormId] = useState<string | null>(null);

  const handlePhotoUpload = useCallback((formId: string) => {
    setUploadTargetFormId(formId);
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetFormId || !onAssignBackground) return;
    try {
      await onAssignBackground(uploadTargetFormId, file);
      toast.success('Background assigned to form');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image');
    }
    e.target.value = '';
    setUploadTargetFormId(null);
  }, [uploadTargetFormId, onAssignBackground]);

  const handleTransform = useCallback((form: any) => {
    wildShape.transform(form);
  }, [wildShape]);

  const handleRevert = useCallback(() => {
    wildShape.revert();
  }, [wildShape]);

  if (wildShape.state.isTransformed && wildShape.state.currentForm) {
    const form = wildShape.state.currentForm;
    return (
      <Collapsible defaultOpen className="group">
        <CollapsibleTrigger className="w-full">
          <CategoryHeader icon={PawPrint} label="Wild Shape" count={1} color="bg-green-500/20 text-green-400" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-1 pl-2 pr-1 pb-2">
            <div className="px-3 py-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-300">{form.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">CR {formatCR(form.cr)}</span>
                </div>
                <button
                  onClick={handleRevert}
                  className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-semibold hover:bg-amber-500/25 active:scale-95 transition-all"
                  style={{ touchAction: 'manipulation' }}
                >
                  Dismiss
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <div className="bg-card/40 rounded px-2 py-1">
                  <p className="text-[10px] text-muted-foreground">HP</p>
                  <p className="text-sm font-bold text-green-400">{wildShape.state.formHP}/{wildShape.state.formMaxHP}</p>
                </div>
                <div className="bg-card/40 rounded px-2 py-1">
                  <p className="text-[10px] text-muted-foreground">AC</p>
                  <p className="text-sm font-bold">{form.ac}</p>
                </div>
                <div className="bg-card/40 rounded px-2 py-1">
                  <p className="text-[10px] text-muted-foreground">Speed</p>
                  <p className="text-[11px] font-medium">{form.speed}</p>
                </div>
              </div>
              {/* Combat Wild Shape Healing (Moon Circle) */}
              {wildShape.canUseElemental && wildShape.state.formHP < wildShape.state.formMaxHP && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-green-300/70">💚 Heal (spell slot):</span>
                  {[1, 2, 3, 4, 5].map(lvl => (
                    <button
                      key={lvl}
                      onClick={(e) => {
                        e.stopPropagation();
                        wildShape.healWithSpellSlot(lvl);
                      }}
                      className="w-6 h-6 rounded bg-green-500/15 border border-green-500/25 text-[11px] font-bold text-green-300 hover:bg-green-500/30 active:scale-90 transition-all"
                      style={{ touchAction: 'manipulation' }}
                      title={`Spend level ${lvl} slot to heal ${lvl}d8`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              )}
              {form.specialAbilities && form.specialAbilities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.specialAbilities.map(ab => (
                    <button
                      key={ab}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const prompt = generateWildShapeAbilityPrompt({
                          abilityName: ab,
                          characterName,
                          formName: form.name,
                          formCR: form.cr,
                          formHP: wildShape.state.formHP,
                          formMaxHP: wildShape.state.formMaxHP,
                          formAC: form.ac,
                          formSpeed: form.speed,
                        });
                        try {
                          await navigator.clipboard.writeText(prompt);
                          toast.success(`${ab} prompt copied!`);
                        } catch { toast.error('Failed to copy'); }
                      }}
                      className="text-[10px] px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-green-300 hover:bg-green-500/25 hover:border-green-500/40 active:scale-95 transition-all cursor-pointer"
                      style={{ touchAction: 'manipulation' }}
                    >
                      {ab}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end px-1">
              <CopyButton text={applyTimePrefix(
                `## 🐻 Wild Shape: ${form.name}\n\n**Character:** ${characterName}\n**Form:** ${form.name} (CR ${formatCR(form.cr)})\n**HP:** ${wildShape.state.formHP}/${wildShape.state.formMaxHP} · **AC:** ${form.ac}\n**Speed:** ${form.speed}\n${form.specialAbilities ? `**Abilities:** ${form.specialAbilities.join(', ')}\n` : ''}\nNarrate ${characterName} in their ${form.name} form. Describe the beast's movements, senses, and primal power.`
              )} />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const forms = wildShape.availableForms;
  const elementals = wildShape.elementalForms;
  const dragons = wildShape.dragonForms;
  const totalForms = forms.length + elementals.length + dragons.length;

  // Build unified list of all forms with metadata for styling/behavior
  type UnifiedForm = {
    form: BeastForm;
    category: 'beast' | 'elemental' | 'dragon';
    useCost: number;
    onTransform: () => void;
    disabled: boolean;
  };

  const allUnifiedForms: UnifiedForm[] = [
    ...forms.map(f => ({
      form: f,
      category: 'beast' as const,
      useCost: 1,
      onTransform: () => handleTransform(f),
      disabled: !wildShape.canTransform,
    })),
    ...elementals.map(f => ({
      form: f as BeastForm,
      category: 'elemental' as const,
      useCost: 2,
      onTransform: () => wildShape.transformElemental(f),
      disabled: wildShape.state.usesRemaining < 2 || wildShape.state.isTransformed,
    })),
    ...dragons.map(f => ({
      form: f as BeastForm,
      category: 'dragon' as const,
      useCost: 3,
      onTransform: () => wildShape.transformDragon(f),
      disabled: wildShape.state.usesRemaining < 3 || wildShape.state.isTransformed,
    })),
  ];

  // Group by CR
  const formsByCR = allUnifiedForms.reduce((acc, item) => {
    const crKey = formatCR(item.form.cr);
    if (!acc[crKey]) acc[crKey] = [];
    acc[crKey].push(item);
    return acc;
  }, {} as Record<string, UnifiedForm[]>);

  // Sort CR keys by numeric value (lowest first)
  const sortedCRKeys = Object.keys(formsByCR).sort((a, b) => {
    const numA = formsByCR[a][0].form.cr;
    const numB = formsByCR[b][0].form.cr;
    return numA - numB;
  });

  const categoryColors = {
    beast: { icon: 'text-green-400', border: 'border-green-500/30 hover:bg-green-500/10 hover:border-green-500/30 active:bg-green-500/15', tag: 'text-green-400/70' },
    elemental: { icon: 'text-orange-400', border: 'border-orange-500/30 hover:bg-orange-500/10 active:bg-orange-500/15', tag: 'text-orange-400/70' },
    dragon: { icon: 'text-purple-400', border: 'border-purple-500/30 hover:bg-purple-500/10 active:bg-purple-500/15', tag: 'text-purple-400/70' },
  };

  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="w-full">
        <CategoryHeader icon={PawPrint} label="Wild Shape" count={totalForms} color="bg-green-500/20 text-green-400" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 pl-2 pr-1 pb-2">
          {!wildShape.canTransform && wildShape.state.usesRemaining <= 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No uses remaining. Take a rest to recover.
            </p>
          )}
          {sortedCRKeys.map(crKey => (
            <Collapsible key={crKey}>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1.5 rounded-md bg-card/30 hover:bg-card/50 transition-colors">
                <span className="text-xs font-semibold text-muted-foreground">CR {crKey}</span>
                <span className="text-[10px] text-muted-foreground">{formsByCR[crKey].length} forms</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                {formsByCR[crKey].map(({ form, category, useCost, onTransform, disabled }) => {
                  const colors = categoryColors[category];
                  return (
                    <div
                      key={form.id}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors text-left",
                        !disabled ? `bg-card/40 ${colors.border}` : "bg-card/40 border-border/30 opacity-50 cursor-not-allowed"
                      )}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { if (!disabled) onTransform(); }}>
                        <div className="flex items-center gap-2">
                          <PawPrint className={cn("w-4 h-4 shrink-0", colors.icon)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">{form.name}</p>
                              {useCost > 1 && (
                                <span className={cn("text-[10px] font-mono", category === 'elemental' ? 'text-orange-400' : 'text-purple-400')}>
                                  {useCost} uses
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              HP {form.hp} · AC {form.ac} · {form.speed}
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Photo assign/remove button */}
                      {onAssignBackground && (
                        <div className="shrink-0">
                          {hasBackground?.(form.id) ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onRemoveBackground?.(form.id); toast.success('Background removed'); }}
                              className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400 transition-colors"
                              aria-label="Remove background photo"
                            >
                              <ImageOff className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handlePhotoUpload(form.id); }}
                              className="p-1.5 rounded-md hover:bg-green-500/20 text-muted-foreground hover:text-green-400 transition-colors"
                              aria-label="Assign background photo"
                            >
                              <ImagePlus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CollapsibleContent>
      {/* Hidden file input for photo uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </Collapsible>
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
  consumablesInventory = [],
  onUseConsumable,
  wildShape,
  onAssignWildShapeBackground,
  onRemoveWildShapeBackground,
  hasWildShapeBackground,
  currentHP,
  maxHP,
  tempHP = 0,
  onHPChange,
  partyMembers = [],
  userId,
  onSendHeal,
  channelDivinity,
}: QuickActionsDrawerProps) {
  // Track which item has an active inline roll
  const [pendingHealConsumable, setPendingHealConsumable] = useState<{ item: InventoryItem; amount: number } | null>(null);
  const [pendingHealSpell, setPendingHealSpell] = useState<{ spellName: string; amount: number } | null>(null);
  const [activeRoll, setActiveRoll] = useState<{ 
    id: string; roll: DiceRoll; prompt: string; 
    damageRoll?: DiceRoll; damageFormula?: string; isCrit?: boolean;
  } | null>(null);
  // Track roll mode for weapon attacks
  const [weaponRollMode, setWeaponRollMode] = useState<RollMode>('normal');
  // Track add-spell picker visibility
  const [showAddSpells, setShowAddSpells] = useState(false);
  const [showAddCantrips, setShowAddCantrips] = useState(false);

  // ── Basics: Equipped weapons + unarmed strike ──
  const weapons = useMemo((): WeaponAttack[] => {
    const items: WeaponAttack[] = [UNARMED_STRIKE];
    if (equipment) {
      items.push(...getEquippedWeapons(equipment.slots));
    }
    return items;
  }, [equipment]);

  // ── Abilities: Equipped active abilities from loadout + auto-populated homebrew ──
  const abilityCustomization = useAbilityCustomization();
  const { images: abilityImages } = useAbilityImages();

  const equippedAbilities = useMemo(() => {
    const ids = character.equippedAbilities || [];
    const seen = new Set<string>();
    const results: { ability: Ability; tier: 1 | 2 | 3 }[] = [];

    const resolveId = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);

      // Legacy prestige abilities
      if (isLegacyAbilityId(id)) {
        const legacy = resolveLegacyAbility(id);
        if (legacy) results.push({ ability: legacy, tier: 1 as const });
        return;
      }
      // Homebrew abilities
      if (id.startsWith('homebrew_')) {
        const homebrew = abilityCustomization.state.homebrewAbilities.find(h => h.id === id);
        if (!homebrew) return;
        const converted = homebrewToAbility(homebrew);
        const charAbility = character.abilities.find(a => a.abilityId === id);
        const tier = (charAbility?.currentTier || 1) as 1 | 2 | 3;
        results.push({ ability: converted as Ability, tier });
        return;
      }
      // Base abilities (with overrides)
      const baseAbility = getAbilityById(id);
      if (!baseAbility) return;
      const ability = applyOverrides(baseAbility, abilityCustomization.getOverride(id));
      const charAbility = character.abilities.find(a => a.abilityId === id);
      const tier = (charAbility?.currentTier || 1) as 1 | 2 | 3;
      results.push({ ability, tier });
    };

    // 1. Resolve loadout abilities
    ids.forEach(resolveId);

    // 2. Auto-populate all homebrew abilities with invested points
    character.abilities
      .filter(a => a.abilityId.startsWith('homebrew_') && a.currentTier > 0)
      .forEach(a => resolveId(a.abilityId));

    return results;
  }, [character.equippedAbilities, character.abilities, abilityCustomization.state.homebrewAbilities, abilityCustomization.getOverride]);

  // ── Magic: Favorited spells auto-populate; fall back to prepared only ──
  const preparedSpells = useMemo((): SpellDefinition[] => {
    if (!spellcasting) return [];

    // All prepared spells resolved (includes homebrew via custom registry)
    const allPrepared = spellcasting.preparedSpells
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level > 0);

    // If user has favorites, show favorited prepared + any prepared homebrew not in favorites
    const favoriteNonCantrips = spellcasting.favoriteSpells
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level > 0 && 
        (spellcasting!.preparedSpells.includes(s.id) || spellcasting!.knownSpells.includes(s.id)));
    if (favoriteNonCantrips.length > 0) {
      // Merge in any prepared homebrew spells not already in the favorites list
      const favIds = new Set(favoriteNonCantrips.map(s => s.id));
      const missingHomebrew = allPrepared.filter(s => (s as any).isHomebrew === true && !favIds.has(s.id));
      return [...favoriteNonCantrips, ...missingHomebrew];
    }

    // Fallback: show ONLY prepared spells (not all known — prevents unprepared from leaking)
    return allPrepared;
  }, [spellcasting]);

  // ── Cantrips ──
  const cantrips = useMemo((): SpellDefinition[] => {
    if (!spellcasting) return [];
    // Cantrips: favorites first, else all known cantrips (cantrips are always "prepared")
    const favoriteCantrips = spellcasting.favoriteSpells
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level === 0 &&
        spellcasting!.knownSpells.includes(s.id));
    if (favoriteCantrips.length > 0) return favoriteCantrips;
    return spellcasting.knownSpells
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level === 0);
  }, [spellcasting]);

  // Available spells to add (prepared/known but NOT favorited, non-cantrip)
  const availableSpellsToAdd = useMemo((): SpellDefinition[] => {
    if (!spellcasting) return [];
    const favoriteSet = new Set(spellcasting.favoriteSpells);
    const allPreparedOrKnown = new Set([...spellcasting.preparedSpells, ...spellcasting.knownSpells]);
    return Array.from(allPreparedOrKnown)
      .filter(id => !favoriteSet.has(id))
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level > 0);
  }, [spellcasting]);

  // Available cantrips to add (known but NOT favorited)
  const availableCantripsToAdd = useMemo((): SpellDefinition[] => {
    if (!spellcasting) return [];
    const favoriteSet = new Set(spellcasting.favoriteSpells);
    return spellcasting.knownSpells
      .filter(id => !favoriteSet.has(id))
      .map(id => getSpellById(id))
      .filter((s): s is SpellDefinition => !!s && s.level === 0);
  }, [spellcasting]);

  // ── Non-homebrew filtered lists for normal sections ──
  const nonHomebrewAbilities = useMemo(() => 
    equippedAbilities.filter(({ ability }) => !ability.id.startsWith('homebrew_')),
    [equippedAbilities]
  );
  const nonHomebrewSpells = useMemo(() => 
    preparedSpells.filter(s => (s as any).isHomebrew !== true),
    [preparedSpells]
  );
  const nonHomebrewCantrips = useMemo(() => 
    cantrips.filter(s => (s as any).isHomebrew !== true),
    [cantrips]
  );

  // ── Homebrew aggregation for dedicated section ──
  const homebrewData = useMemo(() => {
    // Homebrew abilities grouped by tree
    const hbAbilities = equippedAbilities.filter(({ ability }) => ability.id.startsWith('homebrew_'));
    const abilityByTree: Record<string, { ability: Ability; tier: 1 | 2 | 3 }[]> = {};
    hbAbilities.forEach(item => {
      const tree = item.ability.tree;
      if (!abilityByTree[tree]) abilityByTree[tree] = [];
      abilityByTree[tree].push(item);
    });

    // Homebrew spells grouped by level
    const hbSpells = preparedSpells.filter(s => (s as any).isHomebrew === true);
    const hbCantrips = cantrips.filter(s => (s as any).isHomebrew === true);
    const spellsByLevel: Record<number, SpellDefinition[]> = {};
    if (hbCantrips.length > 0) spellsByLevel[0] = hbCantrips;
    hbSpells.forEach(s => {
      if (!spellsByLevel[s.level]) spellsByLevel[s.level] = [];
      spellsByLevel[s.level].push(s);
    });

    const totalCount = hbAbilities.length + hbSpells.length + hbCantrips.length;
    return { abilityByTree, spellsByLevel, totalCount };
  }, [equippedAbilities, preparedSpells, cantrips]);

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
    const diceCount = weaponRollMode === 'normal' ? 1 : 2;
    const roll = rollDice('d20', diceCount, weapon.attackBonus);
    const prompt = generateWeaponRollPrompt(weapon, roll, characterName, weaponRollMode);
    setActiveRoll({ id: `weapon-${weapon.id}`, roll, prompt });
  }, [characterName, weaponRollMode]);

  const handleWeaponReroll = useCallback((weapon: WeaponAttack) => {
    const diceCount = weaponRollMode === 'normal' ? 1 : 2;
    const roll = rollDice('d20', diceCount, weapon.attackBonus);
    const prompt = generateWeaponRollPrompt(weapon, roll, characterName, weaponRollMode);
    setActiveRoll({ id: `weapon-${weapon.id}`, roll, prompt });
  }, [characterName, weaponRollMode]);

  // When roll mode changes, re-roll if a weapon roll is active
  const handleWeaponRollModeChange = useCallback((mode: RollMode) => {
    setWeaponRollMode(mode);
    if (activeRoll?.id.startsWith('weapon-')) {
      // Find the weapon and re-roll with new mode
      const weaponId = activeRoll.id.replace('weapon-', '');
      const weapon = weapons.find(w => w.id === weaponId);
      if (weapon) {
        const diceCount = mode === 'normal' ? 1 : 2;
        const roll = rollDice('d20', diceCount, weapon.attackBonus);
        const prompt = generateWeaponRollPrompt(weapon, roll, characterName, mode);
        setActiveRoll({ id: `weapon-${weapon.id}`, roll, prompt });
      }
    }
  }, [activeRoll, weapons, characterName]);

  // ── Damage roll handler ──
  const handleDamageRoll = useCallback((weapon: WeaponAttack) => {
    if (!activeRoll) return;
    const parsed = parseDamageFormula(weapon.damage);
    if (!parsed) {
      // Flat damage (e.g. "1" for unarmed)
      const flatDmg = parseInt(weapon.damage) || 1;
      const fakeDmgRoll: DiceRoll = { die: 'd4', count: 0, modifier: flatDmg, rolls: [], total: flatDmg };
      const newPrompt = generateWeaponRollPrompt(weapon, activeRoll.roll, characterName, weaponRollMode, fakeDmgRoll);
      setActiveRoll(prev => prev ? { ...prev, damageRoll: fakeDmgRoll, damageFormula: weapon.damage, prompt: newPrompt } : null);
      return;
    }
    // Check if crit — double the dice count
    const isCrit = isCriticalHit(activeRoll.roll.rolls, weaponRollMode, activeRoll.roll.die);
    const diceCount = isCrit ? parsed.count * 2 : parsed.count;
    const dmgRoll = rollDice(parsed.die, diceCount, parsed.modifier);
    const newPrompt = generateWeaponRollPrompt(weapon, activeRoll.roll, characterName, weaponRollMode, dmgRoll);
    setActiveRoll(prev => prev ? { ...prev, damageRoll: dmgRoll, damageFormula: weapon.damage, isCrit, prompt: newPrompt } : null);
    toast.success(`${dmgRoll.total} ${weapon.damageType} damage!`, { 
      description: isCrit ? 'Critical hit — dice doubled!' : undefined 
    });
  }, [activeRoll, characterName, weaponRollMode]);

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

  // ── Healing formula roller ──
  const rollHealingFormula = useCallback((formula: string): number => {
    if (!formula) return 0;
    // Parse formulas like "1d8+mod", "2d8+mod", "1d4+mod", "1", "3d8+mod"
    // Use +3 as default spellcasting modifier (reasonable for mid-tier casters)
    const mod = 3;
    
    const resolved = formula.replace(/mod/gi, String(mod));
    // Match dice pattern: NdM+X
    const diceMatch = resolved.match(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/);
    if (diceMatch) {
      const count = parseInt(diceMatch[1]);
      const sides = parseInt(diceMatch[2]);
      const bonus = parseInt(diceMatch[3] || '0');
      let total = bonus;
      for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * sides) + 1;
      }
      return Math.max(1, total);
    }
    // Plain number
    const plain = parseInt(resolved);
    return isNaN(plain) ? 0 : plain;
  }, []);

  // ── Spell cast handlers ──
  const handleCastSpell = useCallback((spell: SpellDefinition) => {
    if (!spellcasting) return;
    // Auto-detect whether to use pact slot: prefer regular slots, fall back to pact
    const regularSlot = spellcasting.spellSlots[spell.level];
    const hasRegular = regularSlot && regularSlot.current > 0;
    const pact = spellcasting.pactSlots;
    const hasPact = pact && pact.current > 0 && pact.level >= spell.level;
    const usePact = !hasRegular && !!hasPact;
    
    const result = spellcasting.castSpell(
      spell.id,
      spell.name,
      spell.level,
      usePact && pact ? pact.level : spell.level,
      usePact,
      spell.concentration,
      spell.duration || '1 round'
    );
    if (result.success) {
      // Check if this is a healing spell and we're in a party
      if (spell.healingFormula && onHPChange && currentHP !== undefined && maxHP !== undefined) {
        const healAmount = rollHealingFormula(spell.healingFormula);
        const otherMembers = partyMembers.filter(m => m.user_id !== userId);
        
        if (otherMembers.length > 0 && onSendHeal && userId) {
          // Show target picker
          setPendingHealSpell({ spellName: spell.name, amount: healAmount });
          toast.success(`${spell.name} cast!`, {
            description: `Choose a target to heal ${healAmount} HP`,
          });
          return;
        }
        
        // Solo: auto-apply healing
        const newHP = Math.min(maxHP, currentHP + healAmount);
        onHPChange(newHP, tempHP);
        toast.success(`${spell.name} cast!`, {
          description: `Healed ${healAmount} HP${result.brokeConcentration ? ` · Broke ${result.brokeConcentration}` : ''}`,
        });
        return;
      }
      
      toast.success(`${spell.name} cast!`, {
        description: result.brokeConcentration
          ? `Concentration on ${result.brokeConcentration} broken`
          : usePact ? 'Pact slot used' : `Level ${spell.level} slot used`,
      });
    }
  }, [spellcasting, partyMembers, userId, onSendHeal, onHPChange, currentHP, maxHP, tempHP, rollHealingFormula]);

  const handleUseAbility = useCallback((abilityId: string, abilityName: string) => {
    cooldowns.triggerCooldown(abilityId);
    toast.success(`${abilityName} activated!`, {
      description: 'Cooldown started · Prompt copied',
    });
  }, [cooldowns]);

  // ── Consumable use handler ──
  const handleUseConsumable = useCallback((item: InventoryItem) => {
    if (!onUseConsumable) return;
    const success = onUseConsumable(item.consumable.id);
    if (success) {
      const prompt = generateConsumablePrompt(item.consumable, characterName);
      navigator.clipboard.writeText(prompt).catch(() => {});

      // Auto-apply healing for healing potions
      const healMatch = item.consumable.effect.match(/restores?\s+(\d+)d(\d+)(?:\s*\+\s*(\d+))?\s*(?:hit\s*points|hp)/i);
      if (healMatch && onHPChange && currentHP !== undefined && maxHP !== undefined) {
        const diceCount = parseInt(healMatch[1]);
        const diceSides = parseInt(healMatch[2]);
        const modifier = parseInt(healMatch[3] || '0');
        let total = modifier;
        const rolls: number[] = [];
        for (let i = 0; i < diceCount; i++) {
          const roll = Math.floor(Math.random() * diceSides) + 1;
          rolls.push(roll);
          total += roll;
        }
        
        // If in a party with other members, show target picker
        const otherMembers = partyMembers.filter(m => m.user_id !== userId);
        if (otherMembers.length > 0 && onSendHeal && userId) {
          setPendingHealConsumable({ item, amount: total });
          // Don't apply yet — wait for target selection
          return;
        }
        
        const newHP = Math.min(maxHP, currentHP + total);
        onHPChange(newHP, tempHP);
        toast.success(`Used ${item.consumable.name}!`, {
          description: `Healed ${total} HP [${rolls.join('+')}${modifier ? `+${modifier}` : ''}] · ${item.quantity - 1} remaining`,
        });
      } else {
        toast.success(`Used ${item.consumable.name}!`, {
          description: `${item.quantity - 1} remaining · Prompt copied`,
        });
      }
    } else {
      toast.error(`Cannot use ${item.consumable.name}`, { description: 'Insufficient quantity' });
    }
  }, [onUseConsumable, characterName, onHPChange, currentHP, maxHP, tempHP]);

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[100dvh] max-h-[100dvh] sm:h-[85vh] sm:max-h-[85vh] rounded-t-xl sm:rounded-t-xl flex flex-col p-0"
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

        {/* Wild Shape Status Bar */}
        {wildShape && wildShape.config && (
          <WildShapeStatusBar wildShape={wildShape} />
        )}

        <ScrollArea className="flex-1 px-4 pb-6">
          <div className="space-y-1.5">

            {/* ── WILD SHAPE (Druid only) ── */}
            {wildShape && wildShape.config && (
              <WildShapeSection wildShape={wildShape} characterName={characterName} onAssignBackground={onAssignWildShapeBackground} onRemoveBackground={onRemoveWildShapeBackground} hasBackground={hasWildShapeBackground} />
            )}

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
                              rollMode={weaponRollMode}
                              onRollModeChange={handleWeaponRollModeChange}
                              damageRoll={activeRoll.damageRoll}
                              onRollDamage={() => handleDamageRoll(weapon)}
                              damageType={weapon.damageType}
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
                <CategoryHeader icon={Zap} label="Abilities" count={nonHomebrewAbilities.length} color="bg-purple-500/20 text-purple-400" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 pl-2 pr-1 pb-2">
                  {nonHomebrewAbilities.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No abilities equipped. Slot them in the Skills tab.</p>
                  )}
                  {nonHomebrewAbilities.map(({ ability, tier }) => {
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
                          {abilityImages[ability.id] ? (
                            <img src={abilityImages[ability.id]} alt={ability.name} className="w-6 h-6 rounded object-cover shrink-0" />
                          ) : (
                            <Zap className={cn("w-4 h-4 shrink-0", 
                              ability.tree === 'hunter' ? 'text-green-400' :
                              ability.tree === 'warrior' ? 'text-red-400' : 'text-purple-400'
                            )} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">{ability.name}</p>
                              <span className="text-[10px] text-amber-400 font-mono">T{tier}</span>
                              {ability.id.startsWith('homebrew_') && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold leading-none">Homebrew</span>
                              )}
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
                <CategoryHeader icon={Wand2} label="Magic" count={nonHomebrewSpells.length} color="bg-indigo-500/20 text-indigo-400" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 pl-2 pr-1 pb-2">
                  {nonHomebrewSpells.length === 0 && !showAddSpells && (
                    <p className="text-xs text-muted-foreground text-center py-3">No spells prepared. Visit the Arcana tab.</p>
                  )}
                  {nonHomebrewSpells.map(spell => {
                    const slot = spellcasting?.spellSlots[spell.level];
                    const pact = spellcasting?.pactSlots;
                    const hasRegularSlot = slot ? slot.current > 0 : false;
                    const hasPactSlot = pact ? pact.current > 0 && pact.level >= spell.level : false;
                    const hasSlot = hasRegularSlot || hasPactSlot;
                    const isConcentrating = spellcasting?.concentratingOn === spell.id;
                    const isFav = spellcasting?.favoriteSpells.includes(spell.id);
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
                            {(spell as any).isHomebrew && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold leading-none">Homebrew</span>
                            )}
                            {spell.concentration && <span className="text-[10px] text-yellow-400">C</span>}
                            {isConcentrating && <span className="text-[10px] text-amber-400 animate-pulse">●</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {spell.school} · {spell.castingTime.replace('_', ' ')}
                            {slot && slot.max > 0 && <span className="ml-1 text-indigo-300/70">({slot.current}/{slot.max})</span>}
                            {!slot?.max && pact && pact.max > 0 && <span className="ml-1 text-purple-300/70">Pact({pact.current}/{pact.max})</span>}
                          </p>
                        </div>
                        <QuickCastButton
                          label="Cast"
                          disabled={!hasSlot}
                          onCast={() => handleCastSpell(spell)}
                          prompt={prompt}
                        />
                        {isFav && spellcasting && (
                          <button
                            onClick={(e) => { e.stopPropagation(); spellcasting.toggleFavorite(spell.id); }}
                            className="p-1.5 rounded-md hover:bg-red-500/20 transition-colors shrink-0"
                            aria-label="Remove from quick actions"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
                          </button>
                        )}
                        {!isFav && <CopyButton text={prompt} />}
                      </div>
                    );
                  })}
                  {/* Add spell picker */}
                  {showAddSpells && spellcasting && (
                    <div className="space-y-1 pt-1 border-t border-border/20 mt-1">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase px-1 pt-1">Add to Quick Actions</p>
                      {availableSpellsToAdd.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">All prepared spells are already added.</p>
                      )}
                      {availableSpellsToAdd.map(spell => (
                        <button
                          key={spell.id}
                          onClick={() => { spellcasting.toggleFavorite(spell.id); toast.success(`${spell.name} added!`); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-card/20 border border-dashed border-border/30 hover:bg-card/40 transition-colors text-left"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Plus className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{spell.name}</p>
                            <p className="text-xs text-muted-foreground">{spell.school} · L{spell.level}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Add button */}
                  {spellcasting && (
                    <button
                      onClick={() => setShowAddSpells(!showAddSpells)}
                      className={cn(
                        "w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed transition-colors text-xs font-medium",
                        showAddSpells
                          ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
                          : "border-border/30 text-muted-foreground hover:text-indigo-400 hover:border-indigo-500/30"
                      )}
                      style={{ touchAction: 'manipulation' }}
                    >
                      {showAddSpells ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {showAddSpells ? 'Done' : 'Add Spell'}
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ── CHANNEL DIVINITY (Cleric only) ── */}
            {channelDivinity && channelDivinity.max > 0 && channelDivinity.options.length > 0 && (
              <Collapsible className="group">
                <CollapsibleTrigger className="w-full">
                  <CategoryHeader icon={Sunrise} label="Channel Divinity" count={channelDivinity.current} color="bg-yellow-500/20 text-yellow-400" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 pl-2 pr-1 pb-2">
                    {/* Uses indicator */}
                    <div className="flex items-center justify-center gap-1.5 py-1">
                      {Array.from({ length: channelDivinity.max }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-3 h-3 rounded-full border transition-colors',
                            i < channelDivinity.current
                              ? 'bg-yellow-400 border-yellow-500 shadow-[0_0_6px_rgba(250,204,21,0.5)]'
                              : 'bg-muted/30 border-muted-foreground/30'
                          )}
                        />
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {channelDivinity.current}/{channelDivinity.max} uses · Short rest
                      </span>
                      {channelDivinity.current < channelDivinity.max && (
                        <button
                          onClick={channelDivinity.restoreChannelDivinity}
                          className="ml-1 p-0.5 rounded hover:bg-yellow-500/20 transition-colors"
                          title="Restore 1 use (Short Rest)"
                        >
                          <RotateCcw className="w-3 h-3 text-yellow-400" />
                        </button>
                      )}
                    </div>
                    {channelDivinity.options.map(option => (
                      <div key={option.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card/40 border border-border/30">
                        <Sunrise className="w-4 h-4 text-yellow-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{option.name}</p>
                            {option.isDomain && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded border border-yellow-500/30 text-yellow-400">Domain</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{option.mechanicalEffect || option.description}</p>
                        </div>
                        <button
                          onClick={async () => {
                            const success = channelDivinity.useChannelDivinity(option.name);
                            if (success) {
                              const prompt = generateChannelDivinityPrompt(option.name, option.description, characterName, option.mechanicalEffect, option.isDomain, channelDivinity.domainName, channelDivinity.deityName);
                              try {
                                await navigator.clipboard.writeText(prompt);
                                toast.success(`${option.name} prompt copied!`);
                              } catch { /* silent */ }
                            }
                          }}
                          disabled={channelDivinity.current <= 0}
                          className={cn(
                            "shrink-0 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors",
                            channelDivinity.current > 0
                              ? "bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 active:bg-yellow-500/40"
                              : "bg-muted/20 text-muted-foreground cursor-not-allowed"
                          )}
                        >
                          Channel
                        </button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* ── CANTRIPS ── */}
            <Collapsible className="group">
              <CollapsibleTrigger className="w-full">
                <CategoryHeader icon={Sparkles} label="Cantrips" count={nonHomebrewCantrips.length} color="bg-cyan-500/20 text-cyan-400" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 pl-2 pr-1 pb-2">
                  {nonHomebrewCantrips.length === 0 && !showAddCantrips && (
                    <p className="text-xs text-muted-foreground text-center py-3">No cantrips known. Visit the Arcana tab.</p>
                  )}
                  {nonHomebrewCantrips.map(spell => {
                    const isFav = spellcasting?.favoriteSpells.includes(spell.id);
                    const prompt = generateQuickSpellPrompt(spell, characterName, true);
                    return (
                      <div key={spell.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card/40 border border-border/30">
                        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{spell.name}</p>
                            {(spell as any).isHomebrew && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold leading-none">Homebrew</span>
                            )}
                          </div>
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
                        {isFav && spellcasting && (
                          <button
                            onClick={(e) => { e.stopPropagation(); spellcasting.toggleFavorite(spell.id); }}
                            className="p-1.5 rounded-md hover:bg-red-500/20 transition-colors shrink-0"
                            aria-label="Remove from quick actions"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
                          </button>
                        )}
                        {!isFav && <CopyButton text={prompt} />}
                      </div>
                    );
                  })}
                  {/* Add cantrip picker */}
                  {showAddCantrips && spellcasting && (
                    <div className="space-y-1 pt-1 border-t border-border/20 mt-1">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase px-1 pt-1">Add to Quick Actions</p>
                      {availableCantripsToAdd.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">All known cantrips are already added.</p>
                      )}
                      {availableCantripsToAdd.map(spell => (
                        <button
                          key={spell.id}
                          onClick={() => { spellcasting.toggleFavorite(spell.id); toast.success(`${spell.name} added!`); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-card/20 border border-dashed border-border/30 hover:bg-card/40 transition-colors text-left"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Plus className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{spell.name}</p>
                            <p className="text-xs text-muted-foreground">{spell.school}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Add button */}
                  {spellcasting && (
                    <button
                      onClick={() => setShowAddCantrips(!showAddCantrips)}
                      className={cn(
                        "w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed transition-colors text-xs font-medium",
                        showAddCantrips
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                          : "border-border/30 text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/30"
                      )}
                      style={{ touchAction: 'manipulation' }}
                    >
                      {showAddCantrips ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {showAddCantrips ? 'Done' : 'Add Cantrip'}
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ── CONSUMABLES ── */}
            <Collapsible className="group">
              <CollapsibleTrigger className="w-full">
                <CategoryHeader icon={FlaskConical} label="Consumables" count={consumablesInventory.length} color="bg-rose-500/20 text-rose-400" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 pl-2 pr-1 pb-2">
                  {consumablesInventory.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No consumables in inventory. Visit the Shop or Consumables tab.</p>
                  )}
                  {consumablesInventory.map(item => {
                    const prompt = generateConsumablePrompt(item.consumable, characterName);
                    const TypeIcon = item.consumable.type === 'potion' ? Beaker 
                      : item.consumable.type === 'poison' ? Skull : ScrollText;
                    const typeColor = consumableTypeConfig[item.consumable.type].color;
                    return (
                      <div key={item.consumable.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card/40 border border-border/30">
                        <TypeIcon className={cn("w-4 h-4 shrink-0", typeColor)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{item.consumable.name}</p>
                            <span className="text-[10px] text-muted-foreground font-mono">×{item.quantity}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{item.consumable.effect}</p>
                        </div>
                        {onUseConsumable && (
                          <QuickCastButton
                            label="Use"
                            disabled={item.quantity <= 0}
                            onCast={() => handleUseConsumable(item)}
                            prompt={prompt}
                          />
                        )}
                        <CopyButton text={prompt} />
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ── HOMEBREW (Aggregated) ── */}
            {homebrewData.totalCount > 0 && (
              <Collapsible className="group">
                <CollapsibleTrigger className="w-full">
                  <CategoryHeader icon={Flame} label="Homebrew" count={homebrewData.totalCount} color="bg-amber-500/20 text-amber-400" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 pl-2 pr-1 pb-2">
                    {/* Ability sub-categories by tree */}
                    {(['hunter', 'warrior', 'assassin'] as const).map(tree => {
                      const items = homebrewData.abilityByTree[tree];
                      if (!items || items.length === 0) return null;
                      const treeColor = tree === 'hunter' ? 'text-green-400' : tree === 'warrior' ? 'text-red-400' : 'text-purple-400';
                      const treeName = tree.charAt(0).toUpperCase() + tree.slice(1);
                      return (
                        <Collapsible key={tree}>
                          <CollapsibleTrigger className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-muted/10 rounded transition-colors">
                            <Zap className={cn("w-3.5 h-3.5", treeColor)} />
                            <span className="text-xs font-semibold">{treeName}</span>
                            <span className="text-[10px] text-muted-foreground">({items.length})</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto transition-transform data-[state=open]:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-1 pb-1">
                            {items.map(({ ability, tier }) => {
                              const prompt = generateQuickAbilityPrompt(ability, tier, characterName);
                              const onCD = cooldowns.isOnCooldown(ability.id);
                              const remaining = cooldowns.getRemainingTime(ability.id);
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
                                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left",
                                      isRolling
                                        ? "bg-amber-500/10 border-amber-500/30"
                                        : onCD
                                          ? "bg-card/40 border-border/30 opacity-60 cursor-not-allowed"
                                          : "bg-card/40 border-border/30 hover:bg-card/60 active:bg-card/80"
                                    )}
                                    style={{ touchAction: 'manipulation' }}
                                  >
                                    {abilityImages[ability.id] ? (
                                      <img src={abilityImages[ability.id]} alt={ability.name} className="w-5 h-5 rounded object-cover shrink-0" />
                                    ) : (
                                      <Zap className={cn("w-4 h-4 shrink-0", treeColor)} />
                                    )}
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
                                      <Dices className={cn("w-4 h-4 shrink-0 transition-colors", isRolling ? "text-amber-400" : "text-muted-foreground/50")} />
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
                                        colorClass="text-amber-400"
                                      />
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}

                    {/* Spell sub-categories by level */}
                    {Object.keys(homebrewData.spellsByLevel)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map(level => {
                        const spells = homebrewData.spellsByLevel[level];
                        const levelLabel = level === 0 ? 'Cantrips' : `${level}${level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'} Level Spells`;
                        const levelIcon = level === 0 ? Sparkles : Wand2;
                        const LevelIcon = levelIcon;
                        return (
                          <Collapsible key={`spell-lvl-${level}`}>
                            <CollapsibleTrigger className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-muted/10 rounded transition-colors">
                              <LevelIcon className={cn("w-3.5 h-3.5", level === 0 ? "text-cyan-400" : "text-indigo-400")} />
                              <span className="text-xs font-semibold">{levelLabel}</span>
                              <span className="text-[10px] text-muted-foreground">({spells.length})</span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto transition-transform data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-1 pb-1">
                              {spells.map(spell => {
                                const prompt = generateQuickSpellPrompt(spell, characterName, level === 0);
                                const slot = spellcasting?.spellSlots[spell.level];
                                const hasSlot = level === 0 || (slot ? slot.current > 0 : false);
                                return (
                                  <div key={spell.id} className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg bg-card/40 border border-border/30",
                                    !hasSlot && level > 0 && "opacity-50"
                                  )}>
                                    <LevelIcon className={cn("w-4 h-4 shrink-0", level === 0 ? "text-cyan-400" : "text-indigo-400")} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-medium truncate">{spell.name}</p>
                                        {level > 0 && <span className="text-[10px] text-indigo-300 font-mono">L{spell.level}</span>}
                                        {spell.concentration && <span className="text-[10px] text-yellow-400">C</span>}
                                      </div>
                                      <p className="text-xs text-muted-foreground">{spell.school} · {spell.castingTime.replace('_', ' ')}</p>
                                    </div>
                                    {level === 0 ? (
                                      <QuickCastButton
                                        label="Cast"
                                        disabled={false}
                                        onCast={() => toast.success(`${spell.name} cast!`, { description: 'Cantrip — no slot used' })}
                                        prompt={prompt}
                                      />
                                    ) : (
                                      <QuickCastButton
                                        label="Cast"
                                        disabled={!hasSlot}
                                        onCast={() => handleCastSpell(spell)}
                                        prompt={prompt}
                                      />
                                    )}
                                    <CopyButton text={prompt} />
                                  </div>
                                );
                              })}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}

                    {/* Empty state (shouldn't happen since we check totalCount > 0) */}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
    
    {/* Heal Target Picker for party healing */}
    <HealTargetPicker
      open={!!pendingHealConsumable}
      onOpenChange={(open) => { if (!open) setPendingHealConsumable(null); }}
      selfName={characterName}
      partyMembers={partyMembers}
      currentUserId={userId || ''}
      healDescription={pendingHealConsumable ? `${pendingHealConsumable.item.consumable.name} — ${pendingHealConsumable.amount} HP` : ''}
      onSelectSelf={() => {
        if (onHPChange && currentHP !== undefined && maxHP !== undefined && pendingHealConsumable) {
          const newHP = Math.min(maxHP, currentHP + pendingHealConsumable.amount);
          onHPChange(newHP, tempHP);
          toast.success(`Used ${pendingHealConsumable.item.consumable.name}!`, {
            description: `Healed ${pendingHealConsumable.amount} HP`,
          });
        }
        setPendingHealConsumable(null);
      }}
      onSelectMember={(member) => {
        if (onSendHeal && pendingHealConsumable) {
          onSendHeal(member.user_id, {
            senderName: characterName,
            itemName: pendingHealConsumable.item.consumable.name,
            hpHealed: pendingHealConsumable.amount,
          });
          toast.success(`Healed ${member.character_name}!`, {
            description: `Sent ${pendingHealConsumable.amount} HP via ${pendingHealConsumable.item.consumable.name}`,
          });
        }
        setPendingHealConsumable(null);
      }}
    />

    {/* Heal Target Picker for spell healing */}
    <HealTargetPicker
      open={!!pendingHealSpell}
      onOpenChange={(open) => { if (!open) setPendingHealSpell(null); }}
      selfName={characterName}
      partyMembers={partyMembers}
      currentUserId={userId || ''}
      healDescription={pendingHealSpell ? `${pendingHealSpell.spellName} — ${pendingHealSpell.amount} HP` : ''}
      onSelectSelf={() => {
        if (onHPChange && currentHP !== undefined && maxHP !== undefined && pendingHealSpell) {
          const newHP = Math.min(maxHP, currentHP + pendingHealSpell.amount);
          onHPChange(newHP, tempHP);
          toast.success(`${pendingHealSpell.spellName} healed you!`, {
            description: `Restored ${pendingHealSpell.amount} HP`,
          });
        }
        setPendingHealSpell(null);
      }}
      onSelectMember={(member) => {
        if (onSendHeal && pendingHealSpell) {
          onSendHeal(member.user_id, {
            senderName: characterName,
            itemName: pendingHealSpell.spellName,
            hpHealed: pendingHealSpell.amount,
          });
          toast.success(`Healed ${member.character_name}!`, {
            description: `Sent ${pendingHealSpell.amount} HP via ${pendingHealSpell.spellName}`,
          });
        }
        setPendingHealSpell(null);
      }}
    />
    </>
  );
}
