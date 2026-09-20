import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { isEmpyreanMode } from '@/lib/empyreanLabels';
import { Sword, Sparkles, BookOpen, FlaskConical, Star, ChevronDown, Play, Flame, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { rollAttack, rollCheck, rollHealing, rollEffect, rollSuffix, type HealRollResult } from '@/lib/promptAutoRoll';
import { actionCardFromRoll, encodeActionCard } from '@/lib/roundChatActionCard';
import { getHealingDiceForItem, type HealingDice } from '@/lib/consumables/healing';
import { requestDiceRoll } from '@/lib/diceRollBus';
import { castSpellByName, describeSlotSpend, getMagicResources } from '@/lib/magic/castBus';
import { parseDiceFormula, scaleForUpcast, formatDiceFormula } from '@/lib/magic/castResolver';
import { RollPreviewSheet, type RollPreviewChoice } from '@/components/magic/RollPreviewSheet';
import { COST_META, resolveActionCost, type ActionCost } from '@/lib/combat/actionCost';


import type { CharacterContext } from '@/components/oracle/types';

export type QuickActionRemoveCategory = 'weapon' | 'ability' | 'spell' | 'cantrip' | 'consumable' | 'prestige' | 'homebrew-ability' | 'homebrew-spell';

export interface QuickActionRemoveEvent {
  category: QuickActionRemoveCategory;
  name: string;
  slot?: string;
}

interface PartyDMQuickActionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterContext?: CharacterContext;
  characterName: string;
  onUsePrompt: (prompt: string) => void;
  empyreanDragonName?: string;
  /**
   * Called when a healing item resolves locally: consume one and apply the HP.
   * Returns the prompt-ready outcome, or null if the item could not be consumed.
   */
  onHealingItemUsed?: (itemName: string, healRoll: HealRollResult) => string | null;
  /** Optional direct send (used for healing acknowledgements). Falls back to onUsePrompt. */
  onSendPrompt?: (prompt: string) => void;
  /** Show only combat items ('combat') or only magic items ('magic'). Undefined shows everything. */
  sectionFilter?: 'combat' | 'magic';
  /** Optional exact sections for focused entry points. Omitted preserves the full drawer. */
  sectionsToShow?: Array<'weapons' | 'abilities' | 'spells' | 'cantrips'>;
  /** Which economy slots are already spent, so used items can be dimmed. */
  spentCosts?: { action: boolean; bonus: boolean; reaction: boolean };
  /** Fired when an item is tapped, so the caller can spend the slot. */
  onActionSpent?: (cost: ActionCost, name: string) => void;
}

interface QuickActionItem {
  id: string;
  name: string;
  detail: string;
  prompt: string;
  removeCategory: QuickActionRemoveCategory;
  removeSlot?: string;
  /** How dice attach at tap time: 'attack' rolls to-hit + damage, 'spell' likewise, 'check' rolls one d20 outcome ladder, 'heal' rolls healing dice, 'effect' rolls the item's own dice, 'none' rolls nothing. */
  rollKind?: 'attack' | 'spell' | 'check' | 'heal' | 'effect' | 'none';
  /** Damage dice for attack/spell rolls, e.g. '1d8' or '6d8'. Optional — defaults to 1d8. */
  damageFormula?: string;
  /** Healing dice for 'heal' items. */
  healingDice?: HealingDice;
  /** Plain dice for 'effect' items (non-healing consumables that carry dice). */
  effectDice?: EffectDice;
  /** Base level for spells, so tapping can spend the right slot (0 = cantrip). */
  spellLevel?: number;
  /** To-hit bonus added to the d20 for weapon attacks. */
  attackBonus?: number;
  /** Extra facts shown in the pre-roll breakdown. */
  damageType?: string;
  healingFormula?: string;
  saveStat?: string;
  attackType?: string;
  rulesText?: string;
  /** What tapping this costs on your turn. */
  actionCost?: ActionCost;
}


function generateWeaponPrompt(name: string, characterName: string): string {
  return applyTimePrefix(
    `${characterName} attacks with ${name}. Describe the strike—its trajectory, impact, and the target's reaction. Keep it under 80 words.`
  );
}

function generateAbilityPrompt(
  name: string,
  tier: number,
  characterName: string,
  detail?: { effect?: string; dice?: string; actionType?: string; isHomebrew?: boolean },
): string {
  const bits: string[] = [];
  if (detail?.effect) bits.push(` Its rules text: ${detail.effect}`);
  if (detail?.dice) bits.push(` It rolls ${detail.dice}.`);
  if (detail?.actionType) bits.push(` Used as a ${detail.actionType.replace(/_/g, ' ')}.`);
  if (detail?.isHomebrew) bits.push(' This is a custom ability — follow the rules text exactly, do not substitute a similar power.');
  return applyTimePrefix(
    `${characterName} uses ${name} (Tier ${tier}).${bits.join('')} Describe the activation, visual effects, and immediate impact in vivid detail. Keep it under 80 words.`
  );
}

function generateSpellPrompt(
  name: string,
  characterName: string,
  isCantrip: boolean,
  detail?: {
    level?: number; school?: string; description?: string; damageFormula?: string; damageType?: string;
    healingFormula?: string; saveStat?: string; attackType?: string; isHomebrew?: boolean;
  },
): string {
  const type = isCantrip ? 'cantrip' : 'spell';
  const bits: string[] = [];
  if (detail?.school) bits.push(` ${detail.school} school${typeof detail.level === 'number' ? `, level ${detail.level}` : ''}.`);
  if (detail?.description) bits.push(` Its rules text: ${detail.description}`);
  if (detail?.damageFormula) bits.push(` Damage ${detail.damageFormula}${detail.damageType ? ` ${detail.damageType}` : ''}.`);
  if (detail?.healingFormula) bits.push(` Healing ${detail.healingFormula}.`);
  if (detail?.saveStat) bits.push(` Target makes a ${String(detail.saveStat).toUpperCase()} save.`);
  if (detail?.attackType) bits.push(` Resolved as a ${String(detail.attackType).replace(/_/g, ' ')} attack.`);
  if (detail?.isHomebrew) bits.push(' This is a custom spell — follow the rules text exactly, do not substitute a similar spell.');
  return applyTimePrefix(
    `${characterName} casts ${name} (${type}).${bits.join('')} Describe the somatic/verbal components, the magical manifestation, and its effect. Keep it under 80 words.`
  );
}


interface EffectDice {
  count: number;
  die: number;
  bonus: number;
  formula: string;
}

/** Pull a plain dice formula (e.g. "2d6+1") out of a consumable's effect text. */
function parseEffectDice(effect?: string): EffectDice | null {
  if (!effect) return null;
  const m = /(\d{1,2})\s*d\s*(\d{1,3})\s*(?:([+-])\s*(\d{1,3}))?/i.exec(effect);
  if (!m) return null;
  const count = Math.min(20, Math.max(1, parseInt(m[1], 10)));
  const die = Math.max(2, parseInt(m[2], 10));
  const raw = m[4] ? parseInt(m[4], 10) : 0;
  const bonus = m[3] === '-' ? -raw : raw;
  if (!Number.isFinite(count) || !Number.isFinite(die) || !Number.isFinite(bonus)) return null;
  return { count, die, bonus, formula: `${count}d${die}${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ''}` };
}

function generateConsumablePrompt(name: string, type: string, characterName: string, effect?: string): string {
  const verb = type === 'potion' ? 'drinks' : type === 'scroll' ? 'reads' : 'uses';
  const effectLine = effect?.trim() ? ` Its stated effect: ${effect.trim()}` : '';
  return applyTimePrefix(
    `${characterName} ${verb} ${name}.${effectLine} Describe the sensory experience and immediate effect. Keep it under 80 words.`
  );
}


function generatePrestigePrompt(name: string, characterName: string): string {
  return applyTimePrefix(
    `${characterName} activates prestige ability: ${name}. Describe the legendary power manifesting with dramatic flair. Keep it under 80 words.`
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  items: QuickActionItem[];
  accentClass: string;
  onUse: (prompt: string) => void;
  onRemove?: (item: QuickActionItem) => void;
  defaultOpen?: boolean;
  onHeal?: (item: QuickActionItem) => void;
  /** Closes the drawer so the dice animation is visible. */
  onCloseDrawer?: () => void;
  spentCosts?: { action: boolean; bonus: boolean; reaction: boolean };
  onActionSpent?: (cost: ActionCost, name: string) => void;
  drawerOpen: boolean;
}

interface SpellRulesDetailsProps {
  item: QuickActionItem;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

function SpellRulesDetails({ item, expanded, onExpandedChange }: SpellRulesDetailsProps) {
  const rulesRef = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const element = rulesRef.current;
    if (!element || !item.rulesText) {
      setOverflows(false);
      return;
    }

    const measure = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight);
      const collapsedHeight = Number.isFinite(lineHeight) ? lineHeight * 2 : element.clientHeight;
      setOverflows(element.scrollHeight > collapsedHeight + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [item.rulesText]);

  const facts = [
    item.damageFormula ? `${item.damageFormula}${item.damageType ? ` ${item.damageType}` : ''}` : '',
    item.healingFormula ? `Heals ${item.healingFormula}` : '',
    item.saveStat ? `${String(item.saveStat).toUpperCase()} save` : '',
  ].filter(Boolean);

  return (
    <>
      {item.rulesText && (
        <div className="mt-1">
          <p
            ref={rulesRef}
            className={cn('text-[12px] leading-snug text-white/60', !expanded && 'line-clamp-2')}
          >
            {item.rulesText}
          </p>
          {overflows && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onExpandedChange(!expanded);
              }}
              className="inline-flex min-h-11 items-center text-[11px] text-amber-300/80 hover:text-amber-200"
              style={{ touchAction: 'manipulation' }}
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}
      {facts.length > 0 && (
        <p className="mt-1 text-[11px] text-amber-300/80">{facts.join(' • ')}</p>
      )}
    </>
  );
}

function QuickActionSection({ title, icon, items, accentClass, onUse, onRemove, defaultOpen = false, onHeal, onCloseDrawer, spentCosts, onActionSpent, drawerOpen }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [expandedSpellIds, setExpandedSpellIds] = useState<Set<string>>(() => new Set());
  // The attack/spell about to be rolled, held while the player checks the maths.
  const [pending, setPending] = useState<QuickActionItem | null>(null);

  useEffect(() => {
    if (!drawerOpen) setExpandedSpellIds(new Set());
  }, [drawerOpen]);

  const runAttackOrSpell = (item: QuickActionItem, choice: RollPreviewChoice) => {
    // Casting from quick actions spends the real slot first, so a
    // spell the character can no longer afford never reaches the DM.
    let slotNote = '';
    let spentSlotLevel: number | undefined;
    if (item.rollKind === 'spell') {
      const outcome = castSpellByName({
        name: item.name,
        level: item.spellLevel,
        slotLevel: choice.slotLevel,
        usePact: choice.usePact,
      });
      if (!outcome.ok && outcome.reason === 'no-slots') {
        toast.error(`No spell slot left for ${item.name}.`);
        return;
      }
      if (outcome.ok && !outcome.isCantrip) {
        spentSlotLevel = typeof outcome.slotLevel === 'number' ? outcome.slotLevel : undefined;
        slotNote = outcome.usedPactSlot
          ? ` A pact slot was spent (${outcome.remaining ?? 0} left).`
          : typeof outcome.slotLevel === 'number'
            ? ` A level ${outcome.slotLevel} slot was spent (${outcome.remaining ?? 0} left).`
            : '';
        const spend = describeSlotSpend(outcome);
        if (spend) toast.success(`${item.name} cast`, { description: spend });
      }
    }
    // Scale the damage dice for the slot actually spent, so an
    // upcast Fireball rolls the bigger die pool.
    let damageFormula = item.damageFormula;
    if (item.rollKind === 'spell' && typeof item.spellLevel === 'number' && item.spellLevel > 0 && typeof spentSlotLevel === 'number') {
      const parsed = parseDiceFormula(damageFormula);
      if (parsed) damageFormula = formatDiceFormula(scaleForUpcast(parsed, item.spellLevel, spentSlotLevel));
    }
    const attackBonus = item.rollKind === 'spell'
      ? getMagicResources()?.spellAttackBonus
      : item.attackBonus;
    const roll = rollAttack(item.rollKind === 'spell' ? 'spell' : 'attack', damageFormula, attackBonus);
    onCloseDrawer?.();
    requestDiceRoll({
      title: item.name,
      roll,
      onComplete: () => {
        onUse(encodeActionCard(actionCardFromRoll(item.name, roll, slotNote), item.prompt + rollSuffix(roll) + slotNote));
        toast.success('Prompt added to input');
      },
    });
  };

  if (items.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
        <span className={cn("shrink-0", accentClass)}>{icon}</span>
        <span className="text-sm font-semibold text-white/90 flex-1 text-left">{title}</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", accentClass, "bg-white/10")}>
          {items.length}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-white/40 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 px-2 pb-2">
          {items.map(item => {
            const isSpell = item.removeCategory === 'spell' || item.removeCategory === 'cantrip' || item.removeCategory === 'homebrew-spell';
            const expanded = expandedSpellIds.has(item.id);
            return (
            <div key={item.id} className={cn("flex gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors", isSpell ? 'items-start' : 'items-center')}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 truncate">{item.name}</p>
                <p className="text-[10px] text-white/35 truncate">{item.detail}</p>
                {isSpell && (
                  <SpellRulesDetails
                    item={item}
                    expanded={expanded}
                    onExpandedChange={(nextExpanded) => {
                      setExpandedSpellIds(current => {
                        const next = new Set(current);
                        if (nextExpanded) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      });
                    }}
                  />
                )}
                {item.actionCost && item.actionCost !== 'free' && (
                  <span className={cn(
                    'inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded border font-mono',
                    COST_META[item.actionCost].className,
                    spentCosts && spentCosts[item.actionCost === 'bonus' ? 'bonus' : item.actionCost === 'reaction' ? 'reaction' : 'action'] && 'opacity-40 line-through'
                  )}>
                    {COST_META[item.actionCost].short}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  if (item.actionCost && onActionSpent) onActionSpent(item.actionCost, item.name);
                  if (item.rollKind === 'heal' && item.healingDice && onHeal) {
                    onHeal(item);
                  } else if (item.rollKind === 'attack' || item.rollKind === 'spell') {
                    // Show the maths first — the roll only happens on confirm.
                    setPending(item);
                  } else if (item.rollKind === 'check') {
                    const roll = rollCheck();

                    onCloseDrawer?.();
                    requestDiceRoll({
                      title: item.name,
                      roll,
                      onComplete: () => {
                        onUse(encodeActionCard(actionCardFromRoll(item.name, roll), item.prompt + rollSuffix(roll)));
                        toast.success('Prompt added to input');
                      },
                    });
                  } else if (item.rollKind === 'effect' && item.effectDice) {
                    const d = item.effectDice;
                    const roll = rollEffect(item.name, d.count, d.die, d.bonus);
                    onCloseDrawer?.();
                    requestDiceRoll({
                      title: item.name,
                      roll,
                      onComplete: () => {
                        onUse(encodeActionCard(actionCardFromRoll(item.name, roll), item.prompt + rollSuffix(roll)));
                        toast.success('Prompt added to input');
                      },
                    });

                  } else {
                    onCloseDrawer?.();
                    onUse(item.prompt);
                    toast.success('Prompt added to input');
                  }
                }}
                className={cn(
                  "shrink-0 p-1.5 rounded-lg transition-colors",
                  "bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/20 hover:border-emerald-500/40"
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
              </button>
              {onRemove && (
                <button
                  onClick={() => onRemove(item)}
                  className="shrink-0 p-1.5 rounded-lg transition-colors bg-red-900/20 hover:bg-red-900/40 border border-red-500/15 hover:border-red-500/30"
                  style={{ touchAction: 'manipulation' }}
                  title={`Remove ${item.name}`}
                >
                  <X className="w-3.5 h-3.5 text-red-400/70" />
                </button>
              )}
            </div>
            );
          })}
        </div>
      </CollapsibleContent>

      <RollPreviewSheet
        target={pending ? {
          name: pending.name,
          kind: pending.rollKind === 'spell' ? 'spell' : 'attack',
          spellLevel: pending.spellLevel,
          damageFormula: pending.damageFormula,
          damageType: pending.damageType,
          saveStat: pending.saveStat,
          attackType: pending.attackType,
          attackBonus: pending.attackBonus,
          rulesText: pending.rulesText,
        } : null}
        onCancel={() => setPending(null)}
        onConfirm={(choice) => {
          const item = pending;
          setPending(null);
          if (item) runAttackOrSpell(item, choice);
        }}
      />
    </Collapsible>
  );
}


const EXECUTION_FIRE_AUDIO_URL = '/audio/dragon-execution-fire.mp3';
const DRAGON_ROAR_AUDIO_URL = '/audio/dragon-roar.mp3';
const DRAGON_TAKEOFF_AUDIO_URL = '/audio/dragon-takeoff.mp3';
const DRAGON_LAND_AUDIO_URL = '/audio/dragon-land.mp3';

function playExecutionFireAudio() {
  try {
    const audio = new Audio(EXECUTION_FIRE_AUDIO_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

function playDragonRoarAudio() {
  try {
    const audio = new Audio(DRAGON_ROAR_AUDIO_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

function playDragonTakeoffAudio() {
  try {
    const audio = new Audio(DRAGON_TAKEOFF_AUDIO_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

function playDragonLandAudio() {
  try {
    const audio = new Audio(DRAGON_LAND_AUDIO_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

function buildPartyDragonActions(charName: string, dragonName: string): QuickActionItem[] {
  const d = dragonName;
  return [
    { id: 'da-roar', name: 'Roar', detail: `${d} roars — bone-rattling declaration`, prompt: `${charName} commands ${d} to roar. The sound is primal, bone-rattling — it echoes off stone and shakes the air itself. Describe the roar's effect on everyone within earshot: allies steadied, enemies shaken, smaller creatures fleeing. The ground vibrates. Dust falls from the ceiling. This is not a sound — it is a declaration.`, removeCategory: 'ability' as const },
    { id: 'da-execution-fire', name: 'Execution by Fire', detail: `${d} executes by concentrated flame`, prompt: `${charName} gives ${d} the kill command. The dragon opens its jaws and unleashes a concentrated, devastating stream of fire directly at the target — not a breath weapon, an execution. Describe the heat distortion in the air before it hits, the color of the flame (specific to this dragon), the target's final moment, and the silence that follows. This is not combat. This is a sentence carried out.`, removeCategory: 'ability' as const },
    { id: 'da-takeoff', name: 'Take Off', detail: `Mount ${d} and launch skyward`, prompt: `${charName} mounts ${d} and they launch into the sky. Describe the physical experience: the bunching of muscle beneath the saddle, the explosive thrust of wings, the lurch in the stomach as the ground falls away. Wind hits the rider's face. The world shrinks. Describe what they see as they climb — the terrain below, the horizon opening up, the other dragons in the sky if any.`, removeCategory: 'ability' as const },
    { id: 'da-land', name: 'Land', detail: `${d} descends and lands`, prompt: `${charName} and ${d} descend and land. Describe the approach — the angle of descent, the wind shifting, the ground rushing up. The landing itself: the impact through the rider's spine, the scrape of claws on stone or earth, the fold of wings. Describe the reactions of anyone on the ground watching a dragon land near them.`, removeCategory: 'ability' as const },
    { id: 'da-tail', name: 'Tail Attack', detail: `${d} whips tail with devastating force`, prompt: `${d} whips its tail at the target with devastating force. Describe the speed — the tail moves faster than the eye can track. The impact is not a strike, it's a demolition. Describe what the tail hits, the sound of the impact, and the aftermath. If it hits a person, they do not get back up easily. If it hits a structure, the structure loses.`, removeCategory: 'ability' as const },
    { id: 'da-bite', name: 'Bite', detail: `${d} lunges and bites`, prompt: `${d} lunges and bites. Describe the speed of the strike — the jaw opening wider than seems possible, the rows of teeth, the snap that sounds like a thunderclap. Describe what the dragon bites, the pressure of the jaw, and the result. Dragons do not nibble. This is a predator ending a discussion.`, removeCategory: 'ability' as const },
    { id: 'da-fly', name: 'Fly', detail: `Soar on ${d}'s back`, prompt: `${charName} and ${d} are in flight. Describe the experience of flying: the rhythm of wingbeats, the tilt of turns, the wind, the altitude. What does the world look like from dragonback? Describe the bond between rider and dragon in motion — the way the rider's body moves with the dragon's, the shared awareness of air currents and thermals. Make it feel like freedom.`, removeCategory: 'ability' as const },
    { id: 'da-growl', name: 'Intimidating Growl', detail: `${d} growls — a warning`, prompt: `${d} growls — low, sustained, and threatening. This is not a roar. This is a warning. Describe the sound: it starts in the chest and vibrates through the ground. The dragon's eyes lock onto the target. Its lips pull back just enough to show teeth. Describe the effect on the target — the primal fear response that no amount of training can fully suppress when a dragon is telling you to reconsider your choices.`, removeCategory: 'ability' as const },
    { id: 'da-claw', name: 'Claw Gouge', detail: `${d} rakes claws across target`, prompt: `${d} rakes its claws across the target. Describe the reach — a dragon's foreleg extends further than you expect. The claws are not decorative; they are siege weapons attached to a living creature. Describe the gouges left behind — in armor, in stone, in whatever was unfortunate enough to be in the way. The sound of dragon claws on metal is something you hear once and never forget.`, removeCategory: 'ability' as const },
    { id: 'da-firebreath', name: 'Fire Breath', detail: `${d} unleashes wide breath of fire`, prompt: `${d} unleashes a wide breath of fire across the area. Unlike the precision of an execution, this is area denial — a sweeping wall of flame that turns the battlefield into an inferno. Describe the buildup: the glow in the dragon's chest, the heat shimmer before the flame arrives, the ignition point where air itself seems to catch fire. Describe the spread, the color, and the aftermath. The ground will be scorched. The air will taste like ash.`, removeCategory: 'ability' as const },
  ];
}

export function PartyDMQuickActions({ open, onOpenChange, characterContext, characterName, onUsePrompt, empyreanDragonName, onHealingItemUsed, onSendPrompt, sectionFilter, sectionsToShow, spentCosts, onActionSpent }: PartyDMQuickActionsProps) {
  const handleRemoveItem = useCallback((item: QuickActionItem) => {
    const detail: QuickActionRemoveEvent = {
      category: item.removeCategory,
      name: item.name,
      slot: item.removeSlot,
    };
    window.dispatchEvent(new CustomEvent('dm-quick-action-remove', { detail }));
    toast.success(`Removed ${item.name}`);
  }, []);

  const handleHeal = useCallback((item: QuickActionItem) => {
    const dice = item.healingDice;
    if (!dice || !onHealingItemUsed) return;
    const roll = rollHealing(dice.count, dice.die, dice.bonus);
    // Close the drawer first so the dice animation is visible.
    onOpenChange(false);
    requestDiceRoll({
      title: item.name,
      roll,
      onComplete: () => {
        const prompt = onHealingItemUsed(item.name, roll);
        if (!prompt) return;
        const tagged = encodeActionCard(actionCardFromRoll(item.name, roll), prompt);
        if (onSendPrompt) onSendPrompt(tagged);
        else onUsePrompt(tagged);
      },
    });
  }, [onHealingItemUsed, onSendPrompt, onUsePrompt, onOpenChange]);


  const sections = useMemo(() => {
    if (!characterContext) return { weapons: [], abilities: [], spells: [], cantrips: [], consumables: [], prestige: [], homebrew: [] };

    const charName = characterName || characterContext.name || 'The Adventurer';

    // Weapons from equipment
    const weapons: QuickActionItem[] = (characterContext.equipment || [])
      .filter(e => ['primary_weapon', 'secondary_weapon', 'ranged_weapon'].includes(e.slot))
      .map(e => ({
        id: `weapon-${e.slot}`,
        name: e.name,
        detail: `${e.rarity} • ${e.slot.replace('_', ' ')}`,
        prompt: generateWeaponPrompt(e.name, charName),
        removeCategory: 'weapon' as const,
        removeSlot: e.slot,
        rollKind: 'attack' as const,
        actionCost: resolveActionCost({ kind: 'weapon', equipmentSlot: e.slot }),
      }));

    // Abilities with tier > 0
    const allAbilities = (characterContext.abilities || []).filter(a => a.tier > 0);
    const equippedSet = new Set(characterContext.equippedAbilities || []);

    // Split homebrew vs standard — the reliable signal is the isHomebrew flag,
    // not the tree name (custom abilities are filed under a normal tree).
    const standardAbilities: QuickActionItem[] = [];
    const homebrewAbilities: QuickActionItem[] = [];
    allAbilities.forEach(a => {
      const isHomebrew = a.isHomebrew === true;
      const detailBits = [`Tier ${a.tier}`, a.tree];
      if (a.dice) detailBits.push(a.dice);
      if (equippedSet.has(a.name)) detailBits.push('Equipped');
      const item: QuickActionItem = {
        id: `ability-${a.name}`,
        name: a.name,
        detail: detailBits.join(' • '),
        prompt: generateAbilityPrompt(a.name, a.tier, charName, {
          effect: a.effect, dice: a.dice, actionType: a.actionType, isHomebrew,
        }),
        removeCategory: isHomebrew ? 'homebrew-ability' as const : 'ability' as const,
        rollKind: 'check' as const,
        actionCost: resolveActionCost({ kind: isHomebrew ? 'homebrew-ability' : 'ability', actionType: a.actionType }),
      };
      if (isHomebrew) {
        homebrewAbilities.push(item);
      } else {
        standardAbilities.push(item);
      }
    });

    // Spells and cantrips from prepared. Prefer the full detail list when present
    // so prompts carry real rules text; fall back to bare names.
    const details = characterContext.spellcasting?.preparedSpellDetails;
    const prepared = characterContext.spellcasting?.preparedSpells || [];
    const spells: QuickActionItem[] = [];
    const cantrips: QuickActionItem[] = [];
    const homebrewSpells: QuickActionItem[] = [];

    // Start from the full detail entries when they exist, then add any prepared
    // spell that has no detail entry so it can never silently vanish from the list.
    const detailNames = new Set((details || []).map(d => d.name));
    const orphanEntries = prepared
      .filter(name => !detailNames.has(name))
      .map(name => ({
        name,
        level: name.toLowerCase().includes('cantrip') ? 0 : 1,
        school: undefined as string | undefined,
        isHomebrew: name.startsWith('homebrew_spell_') ? true : undefined,
        description: undefined as string | undefined,
        __unresolved: true as const,
      }));
    const spellEntries = [...(details || []), ...orphanEntries];

    spellEntries.forEach(s => {
      const full = s as NonNullable<typeof details>[number];
      const isCantrip = full.level === 0;
      const label = isCantrip
        ? (isEmpyreanMode() ? 'Minor Signet' : 'Cantrip')
        : (isEmpyreanMode() ? `Prepared Signet • Lv ${full.level}` : `Level ${full.level}`);
      const isUnresolved = (s as { __unresolved?: boolean }).__unresolved === true;
      const item: QuickActionItem = {
        id: `spell-${full.name}`,
        name: full.name,
        detail: isUnresolved
          ? 'Custom spell • details unavailable — reopen your spellbook to reload'
          : [label, full.school].filter(Boolean).join(' • '),
        prompt: generateSpellPrompt(full.name, charName, isCantrip, {
          level: full.level, school: full.school, description: full.description,
          damageFormula: full.damageFormula, damageType: full.damageType,
          healingFormula: full.healingFormula, saveStat: full.saveStat,
          attackType: full.attackType, isHomebrew: full.isHomebrew,
        }),
        removeCategory: full.isHomebrew ? 'homebrew-spell' as const : isCantrip ? 'cantrip' as const : 'spell' as const,
        rollKind: 'spell' as const,
        spellLevel: typeof full.level === 'number' ? full.level : undefined,
        damageFormula: full.damageFormula,
        damageType: full.damageType,
        healingFormula: full.healingFormula,
        saveStat: full.saveStat,
        attackType: full.attackType,
        rulesText: full.description,
        actionCost: resolveActionCost({ kind: full.isHomebrew ? 'homebrew-spell' : isCantrip ? 'cantrip' : 'spell', castingTime: (full as any).castingTime }),
      };

      if (full.isHomebrew) {
        homebrewSpells.push(item);
      } else if (isCantrip) {
        cantrips.push(item);
      } else {
        spells.push(item);
      }
    });


    // Consumables — healing items roll their own dice and resolve locally.
    const consumables: QuickActionItem[] = (characterContext.consumables || [])
      .filter(c => c.quantity > 0)
      .map(c => {
        const healingDice = getHealingDiceForItem(c.name, c.effect);
        const effectDice = healingDice ? null : parseEffectDice(c.effect);
        const detailBits = [`${c.type} • x${c.quantity}`];
        if (healingDice) detailBits.push(`heals ${healingDice.formula}`);
        else if (effectDice) detailBits.push(`rolls ${effectDice.formula}`);
        return {
          id: `consumable-${c.name}`,
          name: c.name,
          detail: detailBits.join(' • '),
          prompt: generateConsumablePrompt(c.name, c.type, charName, c.effect),
          removeCategory: 'consumable' as const,
          rollKind: (healingDice ? 'heal' : effectDice ? 'effect' : 'none') as 'heal' | 'effect' | 'none',
          healingDice: healingDice ?? undefined,
          effectDice: effectDice ?? undefined,
          actionCost: resolveActionCost({ kind: 'consumable' }),
        };
      });


    // Prestige abilities
    const prestige: QuickActionItem[] = (characterContext.prestigeAbilities || []).map(name => ({
      id: `prestige-${name}`,
      name,
      detail: 'Legacy Ability',
      prompt: generatePrestigePrompt(name, charName),
      removeCategory: 'prestige' as const,
      rollKind: 'check' as const,
      actionCost: resolveActionCost({ kind: 'prestige' }),
    }));

    // Combine homebrew
    const homebrew = [...homebrewAbilities, ...homebrewSpells];

    // Dragon actions (Empyrean bonded only)
    const dragonActions = empyreanDragonName ? buildPartyDragonActions(charName, empyreanDragonName) : [];

    return { dragonActions, weapons, abilities: standardAbilities, spells, cantrips, consumables, prestige, homebrew };
  }, [characterContext, characterName, empyreanDragonName]);

  const focused = !!sectionsToShow;
  const showSection = (name: 'weapons' | 'abilities' | 'spells' | 'cantrips') => !focused || sectionsToShow.includes(name);
  const homebrewForFocus = !focused
    ? sections.homebrew
    : sections.homebrew.filter(item =>
        (item.removeCategory === 'homebrew-ability' && sectionsToShow.includes('abilities'))
        || (item.removeCategory === 'homebrew-spell' && (sectionsToShow.includes('spells') || sectionsToShow.includes('cantrips')))
      );
  const totalItems = focused
    ? (showSection('weapons') ? sections.weapons.length : 0)
      + (showSection('abilities') ? sections.abilities.length : 0)
      + (showSection('spells') ? sections.spells.length : 0)
      + (showSection('cantrips') ? sections.cantrips.length : 0)
      + homebrewForFocus.length
    : Object.values(sections).reduce((sum, arr) => sum + arr.length, 0);
  const showSpellSlots = focused && (sectionsToShow.includes('spells') || sectionsToShow.includes('cantrips'));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70vh] bg-gradient-to-b from-[#1a1a2e] to-[#0d0d12] border-amber-900/30 party-dm-quick-actions-content">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-amber-200 font-cinzel text-center">
            Quick Actions
            <span className="text-[10px] text-white/40 ml-2 font-sans">({totalItems} available)</span>
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-6 space-y-1">
          {showSpellSlots && characterContext?.spellcasting && (
            <div className="mx-2 mb-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2" aria-label="Available spell slots">
              <p className="mb-1.5 text-[10px] uppercase text-amber-200/70">Spell slots</p>
              <div className="space-y-1">
                {characterContext.spellcasting.slots.filter(slot => slot.max > 0).map(slot => (
                  <div key={slot.level} className="flex items-center gap-2 text-[11px] text-white/60">
                    <span className="w-8">L{slot.level}</span>
                    <span className="flex flex-wrap gap-1" aria-label={`Level ${slot.level}: ${slot.current} of ${slot.max} remaining`}>
                      {Array.from({ length: slot.max }, (_, index) => (
                        <span key={index} className={cn('h-2.5 w-2.5 rounded-full border border-amber-300/50', index < slot.current ? 'bg-amber-300' : 'bg-transparent')} />
                      ))}
                    </span>
                  </div>
                ))}
                {characterContext.spellcasting.pactSlots && characterContext.spellcasting.pactSlots.max > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-white/60">
                    <span className="w-8">Pact</span>
                    <span className="flex flex-wrap gap-1" aria-label={`Pact slots: ${characterContext.spellcasting.pactSlots.current} of ${characterContext.spellcasting.pactSlots.max} remaining`}>
                      {Array.from({ length: characterContext.spellcasting.pactSlots.max }, (_, index) => (
                        <span key={index} className={cn('h-2.5 w-2.5 rounded-full border border-cyan-300/50', index < characterContext.spellcasting.pactSlots.current ? 'bg-cyan-300' : 'bg-transparent')} />
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {totalItems === 0 ? (
            <p className="text-center text-sm text-white/30 py-8">No actions available. Equip weapons, prepare spells, or unlock abilities.</p>
          ) : (
            <>
              {!focused && sectionFilter !== 'magic' && sections.dragonActions.length > 0 && (
                <QuickActionSection
                  onCloseDrawer={() => onOpenChange(false)}
                  title="Dragon Actions"
                  icon={<Flame className="w-4 h-4" />}
                  items={sections.dragonActions}
                  accentClass="text-amber-400"
                  onUse={(prompt) => {
                    // Play audio for dragon actions
                    if (prompt.includes('kill command')) playExecutionFireAudio();
                     else if (prompt.includes('to roar')) playDragonRoarAudio();
                     else if (prompt.includes('launch into the sky')) playDragonTakeoffAudio();
                     else if (prompt.includes('descend and land')) playDragonLandAudio();
                    onUsePrompt(prompt);
                  }}
                  defaultOpen={true}
                  spentCosts={spentCosts}
                  onActionSpent={onActionSpent}
                  drawerOpen={open}
                />
              )}
              {showSection('weapons') && sectionFilter !== 'magic' && (
                <QuickActionSection
                    onCloseDrawer={() => onOpenChange(false)}
                  title="Weapons"
                  icon={<Sword className="w-4 h-4" />}
                  items={sections.weapons}
                  accentClass="text-red-400"
                  onUse={onUsePrompt}
                  onRemove={handleRemoveItem}
                  defaultOpen={true}
                  spentCosts={spentCosts}
                  onActionSpent={onActionSpent}
                  drawerOpen={open}
                />
              )}
              {showSection('abilities') && sectionFilter !== 'magic' && (
                <QuickActionSection
                    onCloseDrawer={() => onOpenChange(false)}
                  title="Abilities"
                  icon={<Sparkles className="w-4 h-4" />}
                  items={sections.abilities}
                  accentClass="text-blue-400"
                  onUse={onUsePrompt}
                  onRemove={handleRemoveItem}
                  spentCosts={spentCosts}
                  onActionSpent={onActionSpent}
                  drawerOpen={open}
                />
              )}
              {showSection('spells') && sectionFilter !== 'combat' && (
                <QuickActionSection
                    onCloseDrawer={() => onOpenChange(false)}
                  title={isEmpyreanMode() ? 'Signets' : 'Spells'}
                  icon={<BookOpen className="w-4 h-4" />}
                  items={sections.spells}
                  accentClass="text-purple-400"
                  onUse={onUsePrompt}
                  onRemove={handleRemoveItem}
                  spentCosts={spentCosts}
                  onActionSpent={onActionSpent}
                  drawerOpen={open}
                />
              )}
              {showSection('cantrips') && sectionFilter !== 'combat' && (
                <QuickActionSection
                    onCloseDrawer={() => onOpenChange(false)}
                  title={isEmpyreanMode() ? 'Minor Signets' : 'Cantrips'}
                  icon={<Star className="w-4 h-4" />}
                  items={sections.cantrips}
                  accentClass="text-cyan-400"
                  onUse={onUsePrompt}
                  onRemove={handleRemoveItem}
                  spentCosts={spentCosts}
                  onActionSpent={onActionSpent}
                  drawerOpen={open}
                />
              )}
              {!focused && sectionFilter !== 'magic' && (
                <QuickActionSection
                    onCloseDrawer={() => onOpenChange(false)}
                  title="Items"
                  icon={<FlaskConical className="w-4 h-4" />}
                  items={sections.consumables}
                  accentClass="text-green-400"
                  onUse={onUsePrompt}
                  onHeal={handleHeal}
                  onRemove={handleRemoveItem}
                  spentCosts={spentCosts}
                  onActionSpent={onActionSpent}
                  drawerOpen={open}
                />
              )}
              {!focused && sectionFilter !== 'magic' && (
                <QuickActionSection
                    onCloseDrawer={() => onOpenChange(false)}
                  title="Legacy"
                  icon={<Star className="w-4 h-4" />}
                  items={sections.prestige}
                  accentClass="text-amber-400"
                  onUse={onUsePrompt}
                  onRemove={handleRemoveItem}
                  spentCosts={spentCosts}
                  onActionSpent={onActionSpent}
                  drawerOpen={open}
                />
              )}
              {sectionFilter !== 'magic' && homebrewForFocus.length > 0 && (
                <QuickActionSection
                  onCloseDrawer={() => onOpenChange(false)}
                  title="Homebrew"
                  icon={<Flame className="w-4 h-4" />}
                  items={homebrewForFocus}
                  accentClass="text-orange-400"
                  onUse={onUsePrompt}
                  onRemove={handleRemoveItem}
                  spentCosts={spentCosts}
                  onActionSpent={onActionSpent}
                  drawerOpen={open}
                />
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
