import { useState, useMemo } from 'react';
import { Sword, Sparkles, BookOpen, FlaskConical, Star, ChevronDown, Play, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import type { CharacterContext } from '@/components/oracle/types';

interface PartyDMQuickActionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterContext?: CharacterContext;
  characterName: string;
  onUsePrompt: (prompt: string) => void;
}

interface QuickActionItem {
  id: string;
  name: string;
  detail: string;
  prompt: string;
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
  defaultOpen?: boolean;
}

function QuickActionSection({ title, icon, items, accentClass, onUse, defaultOpen = false }: SectionProps) {
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
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PartyDMQuickActions({ open, onOpenChange, characterContext, characterName, onUsePrompt }: PartyDMQuickActionsProps) {
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
      // We don't have spell level info in characterContext.spellcasting.preparedSpells (just names)
      // So we'll put them all in spells unless they match known cantrip patterns
      const item: QuickActionItem = {
        id: `spell-${spellName}`,
        name: spellName,
        detail: isCantrip ? 'Cantrip' : 'Prepared Spell',
        prompt: generateSpellPrompt(spellName, charName, isCantrip),
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
      }));

    // Prestige abilities
    const prestige: QuickActionItem[] = (characterContext.prestigeAbilities || []).map(name => ({
      id: `prestige-${name}`,
      name,
      detail: 'Legacy Ability',
      prompt: generatePrestigePrompt(name, charName),
    }));

    // Combine homebrew
    const homebrew = [...homebrewAbilities, ...homebrewSpells];

    return { weapons, abilities: standardAbilities, spells, cantrips, consumables, prestige, homebrew };
  }, [characterContext, characterName]);

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
                defaultOpen={true}
              />
              <QuickActionSection
                title="Abilities"
                icon={<Sparkles className="w-4 h-4" />}
                items={sections.abilities}
                accentClass="text-blue-400"
                onUse={onUsePrompt}
              />
              <QuickActionSection
                title="Spells"
                icon={<BookOpen className="w-4 h-4" />}
                items={sections.spells}
                accentClass="text-purple-400"
                onUse={onUsePrompt}
              />
              <QuickActionSection
                title="Cantrips"
                icon={<Star className="w-4 h-4" />}
                items={sections.cantrips}
                accentClass="text-cyan-400"
                onUse={onUsePrompt}
              />
              <QuickActionSection
                title="Items"
                icon={<FlaskConical className="w-4 h-4" />}
                items={sections.consumables}
                accentClass="text-green-400"
                onUse={onUsePrompt}
              />
              <QuickActionSection
                title="Legacy"
                icon={<Star className="w-4 h-4" />}
                items={sections.prestige}
                accentClass="text-amber-400"
                onUse={onUsePrompt}
              />
              {sections.homebrew.length > 0 && (
                <QuickActionSection
                  title="Homebrew"
                  icon={<Flame className="w-4 h-4" />}
                  items={sections.homebrew}
                  accentClass="text-orange-400"
                  onUse={onUsePrompt}
                />
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
