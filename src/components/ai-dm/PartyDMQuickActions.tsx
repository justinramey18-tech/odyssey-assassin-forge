import { useState, useMemo, useCallback } from 'react';
import { isEmpyreanMode } from '@/lib/empyreanLabels';
import { Sword, Sparkles, BookOpen, FlaskConical, Star, ChevronDown, Play, Flame, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { applyTimePrefix } from '@/lib/fourthWallTime';
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
}

interface QuickActionItem {
  id: string;
  name: string;
  detail: string;
  prompt: string;
  removeCategory: QuickActionRemoveCategory;
  removeSlot?: string;
}

function generateWeaponPrompt(name: string, characterName: string): string {
  return applyTimePrefix(
    `${characterName} attacks with ${name}. Describe the strike—its trajectory, impact, and the target's reaction. Keep it under 80 words.`
  );
}

function generateAbilityPrompt(name: string, tier: number, characterName: string): string {
  return applyTimePrefix(
    `${characterName} uses ${name} (Tier ${tier}). Describe the activation, visual effects, and immediate impact in vivid detail. Keep it under 80 words.`
  );
}

function generateSpellPrompt(name: string, characterName: string, isCantrip: boolean): string {
  const type = isCantrip ? 'cantrip' : 'spell';
  return applyTimePrefix(
    `${characterName} casts ${name} (${type}). Describe the somatic/verbal components, the magical manifestation, and its effect. Keep it under 80 words.`
  );
}

function generateConsumablePrompt(name: string, type: string, characterName: string): string {
  const verb = type === 'potion' ? 'drinks' : type === 'scroll' ? 'reads' : 'uses';
  return applyTimePrefix(
    `${characterName} ${verb} ${name}. Describe the sensory experience and immediate effect. Keep it under 80 words.`
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
}

function QuickActionSection({ title, icon, items, accentClass, onUse, onRemove, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

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
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 truncate">{item.name}</p>
                <p className="text-[10px] text-white/35 truncate">{item.detail}</p>
              </div>
              <button
                onClick={() => {
                  onUse(item.prompt);
                  toast.success('Prompt added to input');
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
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const EXECUTION_FIRE_AUDIO_URL = '/audio/dragon-execution-fire.mp3';

function playExecutionFireAudio() {
  try {
    const audio = new Audio(EXECUTION_FIRE_AUDIO_URL);
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

export function PartyDMQuickActions({ open, onOpenChange, characterContext, characterName, onUsePrompt, empyreanDragonName }: PartyDMQuickActionsProps) {
  const handleRemoveItem = useCallback((item: QuickActionItem) => {
    const detail: QuickActionRemoveEvent = {
      category: item.removeCategory,
      name: item.name,
      slot: item.removeSlot,
    };
    window.dispatchEvent(new CustomEvent('dm-quick-action-remove', { detail }));
    toast.success(`Removed ${item.name}`);
  }, []);

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
      }));

    // Abilities with tier > 0
    const allAbilities = (characterContext.abilities || []).filter(a => a.tier > 0);
    const equippedSet = new Set(characterContext.equippedAbilities || []);

    // Split homebrew vs standard
    const standardAbilities: QuickActionItem[] = [];
    const homebrewAbilities: QuickActionItem[] = [];
    allAbilities.forEach(a => {
      const item: QuickActionItem = {
        id: `ability-${a.name}`,
        name: a.name,
        detail: `Tier ${a.tier} • ${a.tree}${equippedSet.has(a.name) ? ' • Equipped' : ''}`,
        prompt: generateAbilityPrompt(a.name, a.tier, charName),
        removeCategory: (a.tree === 'Homebrew' || a.tree === 'Custom') ? 'homebrew-ability' as const : 'ability' as const,
      };
      if (a.tree === 'Homebrew' || a.tree === 'Custom') {
        homebrewAbilities.push(item);
      } else {
        standardAbilities.push(item);
      }
    });

    // Spells and cantrips from prepared
    const prepared = characterContext.spellcasting?.preparedSpells || [];
    const spells: QuickActionItem[] = [];
    const cantrips: QuickActionItem[] = [];
    const homebrewSpells: QuickActionItem[] = [];

    prepared.forEach(spellName => {
      const isCantrip = spellName.toLowerCase().includes('cantrip') || false;
      const item: QuickActionItem = {
        id: `spell-${spellName}`,
        name: spellName,
        detail: isCantrip ? (isEmpyreanMode() ? 'Minor Signet' : 'Cantrip') : (isEmpyreanMode() ? 'Prepared Signet' : 'Prepared Spell'),
        prompt: generateSpellPrompt(spellName, charName, isCantrip),
        removeCategory: isCantrip ? 'cantrip' as const : 'spell' as const,
      };
      if (isCantrip) {
        cantrips.push(item);
      } else {
        spells.push(item);
      }
    });

    // Consumables
    const consumables: QuickActionItem[] = (characterContext.consumables || [])
      .filter(c => c.quantity > 0)
      .map(c => ({
        id: `consumable-${c.name}`,
        name: c.name,
        detail: `${c.type} • x${c.quantity}`,
        prompt: generateConsumablePrompt(c.name, c.type, charName),
        removeCategory: 'consumable' as const,
      }));

    // Prestige abilities
    const prestige: QuickActionItem[] = (characterContext.prestigeAbilities || []).map(name => ({
      id: `prestige-${name}`,
      name,
      detail: 'Legacy Ability',
      prompt: generatePrestigePrompt(name, charName),
      removeCategory: 'prestige' as const,
    }));

    // Combine homebrew
    const homebrew = [...homebrewAbilities, ...homebrewSpells];

    // Dragon actions (Empyrean bonded only)
    const dragonActions = empyreanDragonName ? buildPartyDragonActions(charName, empyreanDragonName) : [];

    return { dragonActions, weapons, abilities: standardAbilities, spells, cantrips, consumables, prestige, homebrew };
  }, [characterContext, characterName, empyreanDragonName]);

  const totalItems = Object.values(sections).reduce((sum, arr) => sum + arr.length, 0);

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
          {totalItems === 0 ? (
            <p className="text-center text-sm text-white/30 py-8">No actions available. Equip weapons, prepare spells, or unlock abilities.</p>
          ) : (
            <>
              <QuickActionSection
                title="Weapons"
                icon={<Sword className="w-4 h-4" />}
                items={sections.weapons}
                accentClass="text-red-400"
                onUse={onUsePrompt}
                onRemove={handleRemoveItem}
                defaultOpen={true}
              />
              <QuickActionSection
                title="Abilities"
                icon={<Sparkles className="w-4 h-4" />}
                items={sections.abilities}
                accentClass="text-blue-400"
                onUse={onUsePrompt}
                onRemove={handleRemoveItem}
              />
              <QuickActionSection
                title={isEmpyreanMode() ? 'Signets' : 'Spells'}
                icon={<BookOpen className="w-4 h-4" />}
                items={sections.spells}
                accentClass="text-purple-400"
                onUse={onUsePrompt}
                onRemove={handleRemoveItem}
              />
              <QuickActionSection
                title={isEmpyreanMode() ? 'Minor Signets' : 'Cantrips'}
                icon={<Star className="w-4 h-4" />}
                items={sections.cantrips}
                accentClass="text-cyan-400"
                onUse={onUsePrompt}
                onRemove={handleRemoveItem}
              />
              <QuickActionSection
                title="Items"
                icon={<FlaskConical className="w-4 h-4" />}
                items={sections.consumables}
                accentClass="text-green-400"
                onUse={onUsePrompt}
                onRemove={handleRemoveItem}
              />
              <QuickActionSection
                title="Legacy"
                icon={<Star className="w-4 h-4" />}
                items={sections.prestige}
                accentClass="text-amber-400"
                onUse={onUsePrompt}
                onRemove={handleRemoveItem}
              />
              {sections.homebrew.length > 0 && (
                <QuickActionSection
                  title="Homebrew"
                  icon={<Flame className="w-4 h-4" />}
                  items={sections.homebrew}
                  accentClass="text-orange-400"
                  onUse={onUsePrompt}
                  onRemove={handleRemoveItem}
                />
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
