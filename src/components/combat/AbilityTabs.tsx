import { useState, useMemo } from 'react';
import { Character, Ability, getActiveSlotsByLevel } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { WeaponCard } from './WeaponCard';
import { 
  DEFAULT_WEAPONS,
  UNARMED_STRIKE,
  WeaponAttack,
  getSneakAttackDice 
} from '@/lib/combat/combatTypes';
import { rollDice, getAbilityDice, DiceRoll } from '@/lib/diceRoller';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { useAbilityCustomization } from '@/hooks/use-ability-customization';
import { applyOverrides, homebrewToAbility } from '@/lib/abilityCustomization/utils';
import {
  Sword,
  Eye,
  Sparkles,
  FlaskConical,
  List,
  Search,
  Dices,
  ChevronRight,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import '../combat/CombatHUDStyles.css';

interface AbilityTabsProps {
  character: Character;
  conditions: string[];
  attackBonus: number;
  damageBonus: number;
  equippedWeapons?: WeaponAttack[];
  onAbilityUse: (ability: Ability, tier: 1 | 2 | 3, roll: DiceRoll, prompt: string) => void;
  onWeaponRoll: (
    rollType: 'normal' | 'sneak' | 'assassinate',
    weapon: WeaponAttack,
    roll: DiceRoll,
    damage: string
  ) => void;
  onAddToTurn: (actionType: 'action' | 'bonus' | 'reaction', description: string, roll?: string) => void;
}

export function AbilityTabs({
  character,
  conditions,
  attackBonus,
  damageBonus,
  equippedWeapons,
  onAbilityUse,
  onWeaponRoll,
  onAddToTurn,
}: AbilityTabsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActionType, setFilterActionType] = useState<string | null>(null);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  // Ability customization hook for homebrew support
  const abilityCustomization = useAbilityCustomization();

  const sneakAttackDice = getSneakAttackDice(character.level);
  const hasPoisonedWeapon = conditions.includes('poisonedWeapon');
  
  // Use equipped weapons from gear, fallback to defaults
  // Always include unarmed strike as an option
  const equippedOrDefault = equippedWeapons && equippedWeapons.length > 0 ? equippedWeapons : DEFAULT_WEAPONS;
  const weapons = [...equippedOrDefault, UNARMED_STRIKE];

  // Get unlocked abilities (including homebrew)
  const unlockedAbilities = useMemo(() => {
    return character.abilities
      .filter(ca => ca.currentTier > 0)
      .map(ca => {
        // Check if it's a homebrew ability
        if (ca.abilityId.startsWith('homebrew_')) {
          const homebrew = abilityCustomization.state.homebrewAbilities.find(h => h.id === ca.abilityId);
          if (!homebrew) return null;
          return {
            ...homebrewToAbility(homebrew),
            tier: ca.currentTier as 1 | 2 | 3,
          };
        }
        
        // Base ability with overrides
        const baseAbility = allAbilities.find(a => a.id === ca.abilityId);
        if (!baseAbility) return null;
        const override = abilityCustomization.getOverride(ca.abilityId);
        const customized = applyOverrides(baseAbility, override);
        return {
          ...customized,
          tier: ca.currentTier as 1 | 2 | 3,
        };
      })
      .filter(Boolean) as (Ability & { tier: 1 | 2 | 3; isHomebrew?: boolean })[];
  }, [character.abilities, abilityCustomization.state.homebrewAbilities, abilityCustomization.state.overrides]);

  // Filter abilities by category
  const stealthAbilities = unlockedAbilities.filter(a => 
    a.tree === 'assassin' || 
    a.id.includes('shadow') || 
    a.id.includes('vanish') ||
    a.id.includes('hide')
  );

  const specialAbilities = unlockedAbilities.filter(a => 
    a.type === 'active' && !stealthAbilities.includes(a)
  );

  const passiveAbilities = unlockedAbilities.filter(a => a.type === 'passive');

  // Handle ability use
  const handleUseAbility = (ability: Ability & { tier: 1 | 2 | 3 }) => {
    const { die, count } = getAbilityDice(ability.tier);
    const roll = rollDice(die, count);
    const prompt = generateRPPrompt(ability, ability.tier, roll, character.name);
    
    onAbilityUse(ability, ability.tier, roll, prompt);

    // Add to turn summary
    const actionType = ability.actionType === 'bonus_action' ? 'bonus' : 
                       ability.actionType === 'reaction' ? 'reaction' : 'action';
    onAddToTurn(actionType, ability.name, `${count}${die}`);
  };

  // Filter for "All Actions" tab
  const filteredAbilities = unlockedAbilities.filter(a => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!a.name.toLowerCase().includes(query) && 
          !a.tree.toLowerCase().includes(query)) {
        return false;
      }
    }
    if (filterActionType && a.actionType !== filterActionType) {
      return false;
    }
    return true;
  });

  return (
    <div className="hud-panel flex-1 overflow-hidden flex flex-col">
      <Tabs defaultValue="attacks" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-5 bg-black/40 border border-red-900/30 p-0.5 rounded-none mb-3">
          <TabsTrigger 
            value="attacks" 
            className="text-[10px] font-mono data-[state=active]:bg-red-600/30 data-[state=active]:text-red-300 rounded-none"
          >
            <Sword className="w-3 h-3 mr-1" />
            ATTACKS
          </TabsTrigger>
          <TabsTrigger 
            value="stealth"
            className="text-[10px] font-mono data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300 rounded-none"
          >
            <Eye className="w-3 h-3 mr-1" />
            STEALTH
          </TabsTrigger>
          <TabsTrigger 
            value="special"
            className="text-[10px] font-mono data-[state=active]:bg-amber-600/30 data-[state=active]:text-amber-300 rounded-none"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            SPECIAL
          </TabsTrigger>
          <TabsTrigger 
            value="items"
            className="text-[10px] font-mono data-[state=active]:bg-cyan-600/30 data-[state=active]:text-cyan-300 rounded-none"
          >
            <FlaskConical className="w-3 h-3 mr-1" />
            ITEMS
          </TabsTrigger>
          <TabsTrigger 
            value="all"
            className="text-[10px] font-mono data-[state=active]:bg-green-600/30 data-[state=active]:text-green-300 rounded-none"
          >
            <List className="w-3 h-3 mr-1" />
            ALL
          </TabsTrigger>
        </TabsList>

        {/* Sneak Attack Reference - Persistent in attacks tab */}
        <TabsContent value="attacks" className="flex-1 overflow-auto space-y-3 mt-0">
          <div className="p-2 bg-green-500/10 border border-green-500/30 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-green-400">SNEAK ATTACK</span>
              <span className="text-sm font-bold text-green-300">{sneakAttackDice}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Once per turn when you hit with advantage OR ally within 5ft of target (no disadvantage)
            </p>
          </div>

          {/* Weapon Cards - From Equipped Gear */}
          <div className="space-y-2">
            {weapons.map(weapon => (
              <WeaponCard
                key={weapon.id}
                weapon={weapon}
                level={character.level}
                attackBonus={attackBonus}
                damageBonus={damageBonus}
                conditions={conditions}
                hasPoisonedWeapon={hasPoisonedWeapon}
                onRoll={onWeaponRoll}
              />
            ))}
            {weapons.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm font-mono">
                NO WEAPONS EQUIPPED
                <div className="text-[10px] mt-1 text-red-400">
                  "Maybe equip something in the Gear tab, genius."
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="stealth" className="flex-1 overflow-auto space-y-2 mt-0">
          {stealthAbilities.length === 0 ? (
            <EmptyState message="No stealth abilities unlocked yet" />
          ) : (
            stealthAbilities.map(ability => (
              <AbilityButton
                key={ability.id}
                ability={ability}
                onUse={() => handleUseAbility(ability)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="special" className="flex-1 overflow-auto space-y-2 mt-0">
          {specialAbilities.length === 0 ? (
            <EmptyState message="No special abilities unlocked yet" />
          ) : (
            <>
              {/* Active abilities */}
              <div className="space-y-2">
                {specialAbilities.filter(a => a.type === 'active').map(ability => (
                  <AbilityButton
                    key={ability.id}
                    ability={ability}
                    onUse={() => handleUseAbility(ability)}
                  />
                ))}
              </div>

              {/* Passive abilities section */}
              {passiveAbilities.length > 0 && (
                <div className="pt-3 border-t border-muted/20">
                  <div className="text-[10px] font-mono text-muted-foreground mb-2">
                    PASSIVE BONUSES (Always Active)
                  </div>
                  <div className="space-y-1">
                    {passiveAbilities.map(ability => (
                      <div
                        key={ability.id}
                        className="flex items-center gap-2 px-2 py-1.5 bg-muted/10 rounded text-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-green-500/50" />
                        <span className="flex-1">{ability.name}</span>
                        <span className="text-[10px] text-muted-foreground">T{ability.tier}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="items" className="flex-1 overflow-auto space-y-2 mt-0">
          <ItemCard
            name="Poison Vial"
            quantity={3}
            description="Coat weapon with poison (bonus action). +2d6 poison damage for 1 minute."
            onUse={() => onAddToTurn('bonus', 'Apply poison to weapon')}
          />
          <ItemCard
            name="Thieves' Tools"
            quantity={1}
            description="Proficiency: +{prof}. Use to pick locks and disarm traps."
            onUse={() => onAddToTurn('action', 'Use thieves\' tools')}
          />
          <ItemCard
            name="Healing Potion"
            quantity={2}
            description="Drink to restore 2d4+2 HP. Bonus action to consume."
            onUse={() => onAddToTurn('bonus', 'Drink healing potion (2d4+2)')}
          />
          <ItemCard
            name="Smoke Bomb"
            quantity={2}
            description="Create 10ft heavily obscured area. Hide as part of same action."
            onUse={() => onAddToTurn('action', 'Throw smoke bomb')}
          />
        </TabsContent>

        <TabsContent value="all" className="flex-1 overflow-auto space-y-3 mt-0">
          {/* Search and filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search abilities..."
                className="h-7 pl-7 text-xs bg-black/30"
              />
            </div>
          </div>

          {/* Filter buttons */}
          <div className="flex flex-wrap gap-1">
            <FilterButton
              label="Action"
              active={filterActionType === 'action'}
              onClick={() => setFilterActionType(filterActionType === 'action' ? null : 'action')}
              icon={<Sword className="w-3 h-3" />}
            />
            <FilterButton
              label="Bonus"
              active={filterActionType === 'bonus_action'}
              onClick={() => setFilterActionType(filterActionType === 'bonus_action' ? null : 'bonus_action')}
              icon={<Zap className="w-3 h-3" />}
            />
            <FilterButton
              label="Reaction"
              active={filterActionType === 'reaction'}
              onClick={() => setFilterActionType(filterActionType === 'reaction' ? null : 'reaction')}
              icon={<Shield className="w-3 h-3" />}
            />
            <FilterButton
              label="Passive"
              active={filterActionType === 'passive'}
              onClick={() => setFilterActionType(filterActionType === 'passive' ? null : 'passive')}
              icon={<Clock className="w-3 h-3" />}
            />
          </div>

          {/* Filtered list */}
          <div className="space-y-2">
            {filteredAbilities.length === 0 ? (
              <EmptyState message="No abilities match your filters" />
            ) : (
              filteredAbilities.map(ability => (
                <AbilityButton
                  key={ability.id}
                  ability={ability}
                  onUse={() => handleUseAbility(ability)}
                  showTree
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Ability button component
function AbilityButton({
  ability,
  onUse,
  showTree = false,
}: {
  ability: Ability & { tier: 1 | 2 | 3 };
  onUse: () => void;
  showTree?: boolean;
}) {
  const { die, count } = getAbilityDice(ability.tier);
  const treeColors = {
    hunter: 'border-l-green-500',
    warrior: 'border-l-amber-500',
    assassin: 'border-l-purple-500',
  };

  const actionBadgeColors = {
    action: 'bg-red-500/20 text-red-300',
    bonus_action: 'bg-amber-500/20 text-amber-300',
    reaction: 'bg-cyan-500/20 text-cyan-300',
    passive: 'bg-green-500/20 text-green-300',
  };

  return (
    <button
      onClick={onUse}
      className={cn(
        "w-full flex items-center gap-2 p-2 bg-black/30 border border-muted/30 border-l-2 rounded",
        "hover:bg-muted/20 hover:border-red-500/30 transition-all group",
        treeColors[ability.tree]
      )}
    >
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold group-hover:text-red-300 transition-colors">
            {ability.name}
          </span>
          {showTree && (
            <Badge variant="outline" className="text-[9px] capitalize">
              {ability.tree}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] px-1 py-0.5 rounded", actionBadgeColors[ability.actionType])}>
            {ability.actionType.replace('_', ' ')}
          </span>
          <span className="text-[10px] text-muted-foreground capitalize">
            {ability.usageType.replace('_', ' ')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded text-xs text-red-300">
          <Dices className="w-3 h-3" />
          <span className="font-mono">{count}{die}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
      </div>
    </button>
  );
}

// Item card component
function ItemCard({
  name,
  quantity,
  description,
  onUse,
}: {
  name: string;
  quantity: number;
  description: string;
  onUse: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 bg-black/30 border border-muted/30 rounded">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{name}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-mono">
            x{quantity}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onUse}
        className="h-7 px-2 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
      >
        Use
      </Button>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all",
        active
          ? "bg-red-500/20 text-red-300 border border-red-500/50"
          : "bg-muted/20 text-muted-foreground border border-muted/30 hover:border-muted/50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p className="text-sm">{message}</p>
      <p className="text-[10px] text-red-400 mt-1 italic">
        "Maybe check the Skills tab, champ."
      </p>
    </div>
  );
}
