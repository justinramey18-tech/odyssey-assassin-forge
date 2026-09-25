import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { isEmpyreanMode } from '@/lib/empyreanLabels';
import { Sword, Sparkles, BookOpen, FlaskConical, Star, ChevronDown, Flame, X } from 'lucide-react';
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
import { parseRollTable } from '@/lib/magic/parseRollTable';
import { DiceOutcomeTable } from '@/components/magic/DiceOutcomeTable';
import schoolAbjuration from '@/assets/quick-actions/schools/abjuration.jpg';
import schoolConjuration from '@/assets/quick-actions/schools/conjuration.jpg';
import schoolDivination from '@/assets/quick-actions/schools/divination.jpg';
import schoolEnchantment from '@/assets/quick-actions/schools/enchantment.jpg';
import schoolEvocation from '@/assets/quick-actions/schools/evocation.jpg';
import schoolIllusion from '@/assets/quick-actions/schools/illusion.jpg';
import schoolNecromancy from '@/assets/quick-actions/schools/necromancy.jpg';
import schoolTransmutation from '@/assets/quick-actions/schools/transmutation.jpg';
import qaBg from '@/assets/quick-actions/qa-bg.jpg';
import qaBanner from '@/assets/quick-actions/qa-banner.png';
import qaSlotTray from '@/assets/quick-actions/qa-slot-tray.png';
import qaCardFrame from '@/assets/quick-actions/qa-card-frame.png';
import qaSectionPlaque from '@/assets/quick-actions/qa-section-plaque.png';
import qaGemFilled from '@/assets/quick-actions/gem-filled.png';
import qaGemEmpty from '@/assets/quick-actions/gem-empty.png';
import qaGemPact from '@/assets/quick-actions/gem-pact.png';
import qaBtnUse from '@/assets/quick-actions/btn-use.png';
import qaBtnRemove from '@/assets/quick-actions/btn-remove.png';
import tokenAction from '@/assets/quick-actions/token-action.png';
import tokenBonus from '@/assets/quick-actions/token-bonus.png';
import tokenReaction from '@/assets/quick-actions/token-reaction.png';
import iconWeapons from '@/assets/quick-actions/icon-weapons.png';
import iconAbilities from '@/assets/quick-actions/icon-abilities.png';
import iconSpells from '@/assets/quick-actions/icon-spells.png';
import iconCantrips from '@/assets/quick-actions/icon-cantrips.png';
import iconHomebrew from '@/assets/quick-actions/icon-homebrew.png';
import iconItems from '@/assets/quick-actions/icon-items.png';
import iconLegacy from '@/assets/quick-actions/icon-legacy.png';
import iconDragon from '@/assets/quick-actions/icon-dragon.png';
import primaryWeaponBackground from '@/assets/weapons/weapon-primary.jpg.asset.json';
import secondaryWeaponBackground from '@/assets/weapons/weapon-secondary.jpg.asset.json';
import rangedWeaponBackground from '@/assets/weapons/weapon-ranged.jpg.asset.json';
import rollAttackSeal from '@/assets/roll-attack-2.png.asset.json';

import type { CharacterContext } from '@/components/oracle/types';
import { rarityConfig, type EquipmentStats, type Enchantment, type Rarity } from '@/lib/inventory/types';

const SCHOOL_BG: Record<string, string> = {
  abjuration: schoolAbjuration,
  conjuration: schoolConjuration,
  divination: schoolDivination,
  enchantment: schoolEnchantment,
  evocation: schoolEvocation,
  illusion: schoolIllusion,
  necromancy: schoolNecromancy,
  transmutation: schoolTransmutation,
};

/** Section medallion by section title (Empyrean titles map to the same art). */
const SECTION_MEDALLION: Record<string, string> = {
  'Dragon Actions': iconDragon,
  Weapons: iconWeapons,
  Abilities: iconAbilities,
  Spells: iconSpells,
  Signets: iconSpells,
  Cantrips: iconCantrips,
  'Minor Signets': iconCantrips,
  Items: iconItems,
  Legacy: iconLegacy,
  Homebrew: iconHomebrew,
};

const COST_TOKEN: Partial<Record<ActionCost, string>> = {
  action: tokenAction,
  bonus: tokenBonus,
  reaction: tokenReaction,
};

/** Gold-rimmed enamel pill for ACT / BNS / RCT. Falls back to the old chip for any other cost. */
function CostToken({ cost, spent }: { cost: ActionCost; spent?: boolean }) {
  const img = COST_TOKEN[cost];
  if (!img) {
    return (
      <span className={cn('inline-block rounded border px-1.5 py-0.5 font-mono text-[9px]', COST_META[cost].className, spent && 'opacity-40 line-through')}>
        {COST_META[cost].short}
      </span>
    );
  }
  return (
    <span
      title={COST_META[cost].label}
      className={cn(
        'relative inline-flex h-[22px] w-[60px] items-center justify-end pr-2.5 font-cinzel text-[9px] font-bold tracking-[0.1em] text-white [text-shadow:0_1px_2px_#000]',
        spent && 'opacity-40 grayscale line-through',
      )}
      style={{ backgroundImage: `url(${img})`, backgroundSize: '100% 100%' }}
    >
      {COST_META[cost].short}
    </span>
  );
}

/** Gold card frame drawn over any card (the center is transparent). */
const CARD_FRAME_STYLE: React.CSSProperties = {
  borderStyle: 'solid',
  borderWidth: '22px',
  borderImage: `url(${qaCardFrame}) 100 / 22px stretch`,
};

/** Last natural d20 rolled per spell name this session, so its table row can be highlighted. */
const lastSpellRolls = new Map<string, number>();

const WEAPON_SLOTS = ['primary_weapon', 'secondary_weapon', 'ranged_weapon'] as const;
type WeaponSlot = typeof WEAPON_SLOTS[number];

const WEAPON_BG: Record<WeaponSlot, string> = {
  primary_weapon: primaryWeaponBackground.url,
  secondary_weapon: secondaryWeaponBackground.url,
  ranged_weapon: rangedWeaponBackground.url,
};

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
  spellSchool?: string;
  /** What tapping this costs on your turn. */
  actionCost?: ActionCost;
  /** Read-only presentation details for the three fixed weapon cards. */
  weaponSlot?: WeaponSlot;
  weaponStats?: EquipmentStats;
  weaponProperties?: string[];
  weaponEnchantments?: Enchantment[];
  weaponRarity?: string;
  isEmptyWeaponSlot?: boolean;
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
  const parsed = useMemo(() => parseRollTable(item.rulesText), [item.rulesText]);

  useLayoutEffect(() => {
    const element = rulesRef.current;
    if (!element || !parsed.intro) {
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
  }, [parsed.intro]);

  const facts = [
    item.damageFormula ? `${item.damageFormula}${item.damageType ? ` ${item.damageType}` : ''}` : '',
    item.healingFormula ? `Heals ${item.healingFormula}` : '',
    item.saveStat ? `${String(item.saveStat).toUpperCase()} save` : '',
  ].filter(Boolean);

  return (
    <>
      {parsed.intro && (
        <div className="mt-1">
          <p
            ref={rulesRef}
            className={cn(
              'whitespace-pre-line text-[12.5px] leading-[1.5]',
              SCHOOL_BG[item.spellSchool?.toLowerCase() ?? ''] ? 'text-[#EDE6D8] [text-shadow:0_1px_2px_#000]' : 'text-white/70',
              !expanded && 'line-clamp-2',
            )}
          >
            {parsed.intro}
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
              className="inline-flex min-h-11 items-center font-cinzel text-[10px] font-bold uppercase tracking-[0.14em] text-[#E9C77B] hover:text-amber-200"
              style={{ touchAction: 'manipulation' }}
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}
      {parsed.table && (
        <DiceOutcomeTable table={parsed.table} highlight={lastSpellRolls.get(item.name)} />
      )}
      {facts.length > 0 && (
        <p className="mt-1 font-cinzel text-[10.5px] font-bold tracking-[0.03em] text-[#fcd9a0]">{facts.join(' • ')}</p>
      )}
    </>
  );
}

function QuickActionSection({ title, icon, items, accentClass, onUse, onRemove, defaultOpen = true, onHeal, onCloseDrawer, spentCosts, onActionSpent, drawerOpen }: SectionProps) {
  const medallion = SECTION_MEDALLION[title];
  const [open, setOpen] = useState(defaultOpen);
  const spellIds = useMemo(() => items
    .filter(item => item.removeCategory === 'spell' || item.removeCategory === 'cantrip' || item.removeCategory === 'homebrew-spell')
    .map(item => item.id), [items]);
  const [expandedSpellIds, setExpandedSpellIds] = useState<Set<string>>(() => new Set(spellIds));
  // The attack/spell about to be rolled, held while the player checks the maths.
  const [pending, setPending] = useState<QuickActionItem | null>(null);

  useEffect(() => {
    if (drawerOpen) {
      setOpen(true);
      setExpandedSpellIds(new Set(spellIds));
    }
  }, [drawerOpen, spellIds]);

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
    if (item.rollKind === 'spell') lastSpellRolls.set(item.name, roll.d20);
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

  const handleItemUse = (item: QuickActionItem) => {
    if (item.isEmptyWeaponSlot) return;
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
  };

  if (items.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="relative mb-2 mt-1.5 flex h-11 w-full items-center pl-1.5 pr-1 text-left transition-transform active:scale-[0.99]"
        style={{
          borderStyle: 'solid',
          borderWidth: '0 22px 0 46px',
          borderImage: `url(${qaSectionPlaque}) 0 100 0 205 fill / 0 22px 0 46px stretch`,
        }}
      >
        {medallion ? (
          <img src={medallion} alt="" aria-hidden="true" className="pointer-events-none absolute top-1/2 h-[38px] w-[38px] -translate-y-1/2" style={{ left: -44 }} />
        ) : (
          <span className={cn('absolute top-1/2 -translate-y-1/2', accentClass)} style={{ left: -34 }}>{icon}</span>
        )}
        <span className="flex-1 font-cinzel text-sm font-bold tracking-[0.05em] text-[#F3DDA8] [text-shadow:0_1px_2px_#000]">{title}</span>
        <span
          className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold text-[#1c1003]"
          style={{ background: 'radial-gradient(circle at 35% 30%, #fde68a, #b45309 70%)', boxShadow: '0 0 6px rgba(245,158,11,.5)' }}
        >
          {items.length}
        </span>
        <ChevronDown className={cn('ml-2 h-3.5 w-3.5 text-[#f0c97a]/80 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn(title === 'Weapons' ? 'flex flex-col gap-3' : 'space-y-2.5', 'px-2 pb-2')}>
          {items.map(item => {
            const isSpell = item.removeCategory === 'spell' || item.removeCategory === 'cantrip' || item.removeCategory === 'homebrew-spell';
            const expanded = expandedSpellIds.has(item.id);
            const schoolBackground = isSpell ? SCHOOL_BG[item.spellSchool?.toLowerCase() ?? ''] : undefined;
            if (item.weaponSlot) {
              const isEmpty = item.isEmptyWeaponSlot === true;
              const stats = item.weaponStats;
              const abilityChips = (['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const)
                .flatMap(ability => {
                  const value = Number(stats?.[ability]);
                  return Number.isFinite(value) && value !== 0
                    ? [`${value > 0 ? '+' : ''}${value} ${ability.slice(0, 3).toUpperCase()}`]
                    : [];
                });
              const rarity = item.weaponRarity && item.weaponRarity in rarityConfig
                ? item.weaponRarity as Rarity
                : undefined;
              const chips = [
                stats?.damage ? `⚔ ${stats.damage}` : '',
                stats?.attackBonus !== undefined && Number.isFinite(Number(stats.attackBonus))
                  ? `${Number(stats.attackBonus) >= 0 ? '+' : ''}${stats.attackBonus} to hit`
                  : '',
                ...abilityChips,
                item.weaponProperties?.length ? item.weaponProperties.join(' · ') : '',
              ].filter(Boolean);

              return (
                <div
                  key={item.id}
                  role={isEmpty ? undefined : 'button'}
                  tabIndex={isEmpty ? undefined : 0}
                  aria-label={isEmpty ? `${item.weaponSlot.replace(/_/g, ' ')}: Nothing equipped` : `Use ${item.name}`}
                  onClick={() => handleItemUse(item)}
                  onKeyDown={(event) => {
                    if (!isEmpty && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      handleItemUse(item);
                    }
                  }}
                  className={cn(
                    'group relative aspect-[3/2] w-full overflow-hidden rounded-md border border-amber-500/25',
                    'transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70',
                    isEmpty ? 'cursor-default opacity-40 grayscale' : 'cursor-pointer',
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <img
                    src={WEAPON_BG[item.weaponSlot]}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" aria-hidden="true" />
                  <div className="pointer-events-none absolute inset-0 z-[1]" style={CARD_FRAME_STYLE} aria-hidden="true" />

                  {!isEmpty && (
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); handleItemUse(item); }}
                      aria-label={`Roll attack — ${item.name}`}
                      className="absolute bottom-3 right-3 z-[2] h-14 w-14 overflow-hidden rounded-lg opacity-90 ring-1 ring-white/10 drop-shadow-lg transition-transform active:scale-95 active:ring-amber-400/40 active:opacity-100"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <img
                        src={rollAttackSeal.url}
                        alt="Roll attack"
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  )}

                  <div className="absolute inset-x-0 bottom-0 z-[1] px-4 pb-3 pr-20 text-left drop-shadow-md">
                    {isEmpty ? (
                      <p className="font-cinzel text-base text-amber-100">Nothing equipped</p>
                    ) : (
                      <>
                        <p className="truncate pr-1 font-cinzel text-base text-amber-100">{item.name}</p>
                        {chips.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {chips.map(chip => (
                              <span key={chip} className="max-w-full rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[11px] leading-4 text-white/85">
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {rarity && <span className={cn('text-[11px] font-medium capitalize', rarityConfig[rarity].color)}>{rarityConfig[rarity].label}</span>}
                          {item.actionCost && item.actionCost !== 'free' && (
                            <CostToken
                              cost={item.actionCost}
                              spent={!!(spentCosts && spentCosts[item.actionCost === 'bonus' ? 'bonus' : item.actionCost === 'reaction' ? 'reaction' : 'action'])}
                            />
                          )}
                        </div>
                        {item.weaponEnchantments?.[0]?.name && (
                          <p className="mt-0.5 truncate text-[10px] italic text-violet-200/70">{item.weaponEnchantments[0].name}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div
                key={item.id}
                className={cn(
                  'relative flex gap-2 overflow-hidden rounded-md px-3 pb-3 pt-3.5',
                  schoolBackground ? 'bg-cover bg-right' : 'bg-[linear-gradient(135deg,rgba(30,24,18,0.94),rgba(12,10,14,0.94))]',
                  isSpell ? 'items-start' : 'items-center',
                )}
                style={schoolBackground ? { backgroundImage: `url(${schoolBackground})` } : undefined}
              >
                {schoolBackground && (
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,6,10,0.78),rgba(8,6,10,0.5)_55%,rgba(8,6,10,0.1))]" aria-hidden="true" />
                )}
                <div className="pointer-events-none absolute inset-0 z-[2]" style={CARD_FRAME_STYLE} aria-hidden="true" />
                <div className="relative z-[1] min-w-0 flex-1">
                  <p className="truncate font-cinzel text-[15px] font-bold text-[#F3E6CC] [text-shadow:0_1px_2px_#000]">{item.name}</p>
                  <p className="truncate font-cinzel text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#E9C77B]/80">{item.detail}</p>
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
                    <div className="mt-1.5">
                      <CostToken
                        cost={item.actionCost}
                        spent={!!(spentCosts && spentCosts[item.actionCost === 'bonus' ? 'bonus' : item.actionCost === 'reaction' ? 'reaction' : 'action'])}
                      />
                    </div>
                  )}
                </div>
                <div className="relative z-[3] flex shrink-0 flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleItemUse(item)}
                    aria-label={`Use ${item.name}`}
                    className="h-[42px] w-[42px] rounded-full transition-transform active:scale-95"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <img src={qaBtnUse} alt="" draggable={false} className="h-full w-full drop-shadow-[0_2px_4px_#000]" />
                  </button>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(item)}
                      aria-label={`Remove ${item.name}`}
                      title={`Remove ${item.name}`}
                      className="h-8 w-8 rounded-full opacity-90 transition-transform active:scale-95"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <img src={qaBtnRemove} alt="" draggable={false} className="h-full w-full" />
                    </button>
                  )}
                </div>
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
    const weapons: QuickActionItem[] = WEAPON_SLOTS.map(slot => {
      const equipped = (characterContext.equipment || []).find(item => item.slot === slot);
      if (!equipped) {
        return {
          id: `weapon-${slot}`,
          name: 'Nothing equipped',
          detail: '',
          prompt: '',
          removeCategory: 'weapon' as const,
          removeSlot: slot,
          weaponSlot: slot,
          isEmptyWeaponSlot: true,
        };
      }
      return {
        id: `weapon-${slot}`,
        name: equipped.name,
        detail: `${equipped.rarity} • ${slot.replace('_', ' ')}`,
        prompt: generateWeaponPrompt(equipped.name, charName),
        removeCategory: 'weapon' as const,
        removeSlot: slot,
        rollKind: 'attack' as const,
        attackBonus: typeof equipped.stats?.attackBonus === 'number' ? equipped.stats.attackBonus : undefined,
        damageFormula: typeof equipped.stats?.damage === 'string' ? equipped.stats.damage : undefined,
        actionCost: resolveActionCost({ kind: 'weapon', equipmentSlot: slot }),
        weaponSlot: slot,
        weaponStats: equipped.stats,
        weaponProperties: equipped.properties,
        weaponEnchantments: equipped.enchantments,
        weaponRarity: equipped.rarity,
      };
    });

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
        spellSchool: full.school,
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
      <DrawerContent
        className="mt-0 h-[100dvh] max-h-[100dvh] rounded-none border-amber-900/30 bg-[#0b0a0e] bg-cover bg-top party-dm-quick-actions-content"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55) 30%, rgba(0,0,0,.62)), url(${qaBg})` }}
      >
        <DrawerHeader className="relative flex shrink-0 flex-col items-center gap-0 px-3 pb-1 pt-2 text-center sm:text-center">
          <DrawerTitle className="sr-only">Quick Actions</DrawerTitle>
          <img src={qaBanner} alt="" aria-hidden="true" draggable={false} className="h-auto w-[82%] max-w-[340px] drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]" />
          <p className="-mt-1 font-cinzel text-[10px] font-bold uppercase tracking-[0.14em] text-amber-100/60">{totalItems} available</p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close Quick Actions"
            className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-[#caa05a]/70 bg-black/70 text-[#f0c97a] active:scale-95"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="h-4 w-4" />
          </button>
        </DrawerHeader>
        {showSpellSlots && characterContext?.spellcasting && (
          <div
            className="mx-4 my-2 shrink-0"
            aria-label="Available spell slots"
            style={{ borderStyle: 'solid', borderWidth: '10px', borderImage: `url(${qaSlotTray}) 60 fill / 16px stretch`, padding: '4px 8px 6px' }}
          >
            <p className="mb-1 font-cinzel text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#E9C77B]/80">Spell slots</p>
            <div className="space-y-1">
              {characterContext.spellcasting.slots.filter(slot => slot.max > 0).map(slot => (
                <div key={slot.level} className="flex items-center gap-1.5">
                  <span className="w-6 font-cinzel text-[11px] font-bold text-amber-50/70">L{slot.level}</span>
                  <span className="flex flex-wrap gap-0.5" aria-label={`Level ${slot.level}: ${slot.current} of ${slot.max} remaining`}>
                    {Array.from({ length: slot.max }, (_, index) => (
                      <img key={index} src={index < slot.current ? qaGemFilled : qaGemEmpty} alt="" className="h-[19px] w-[19px]" />
                    ))}
                  </span>
                </div>
              ))}
              {characterContext.spellcasting.pactSlots && characterContext.spellcasting.pactSlots.max > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-6 font-cinzel text-[11px] font-bold text-cyan-100/70">Pact</span>
                  <span className="flex flex-wrap gap-0.5" aria-label={`Pact slots: ${characterContext.spellcasting.pactSlots.current} of ${characterContext.spellcasting.pactSlots.max} remaining`}>
                    {Array.from({ length: characterContext.spellcasting.pactSlots.max }, (_, index) => (
                      <img key={index} src={index < characterContext.spellcasting!.pactSlots!.current ? qaGemPact : qaGemEmpty} alt="" className="h-[19px] w-[19px]" />
                    ))}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-2.5 pb-6 space-y-1.5">
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
