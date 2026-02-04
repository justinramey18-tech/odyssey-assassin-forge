import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Ability, AbilityTree } from '@/lib/types';
import { WeaponAttack } from '@/lib/combat/combatTypes';
import { ActiveConditionInfo } from '@/lib/combat/promptContext';
import { DiceRoll } from '@/lib/diceRoller';
import { CombatAbilityCard } from './CombatAbilityCard';
import {
  Dices,
  Search,
  Sword,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface EnhancedMobileAbilityListProps {
  abilities: (Ability & { tier: 1 | 2 | 3 })[];
  characterName: string;
  weapons: {
    primary?: WeaponAttack | null;
    secondary?: WeaponAttack | null;
    ranged?: WeaponAttack | null;
  };
  cooldownState: Map<string, {
    isOnCooldown: boolean;
    remaining: number;
    total: number;
  }>;
  abilityImages?: Record<string, string>;
  activeConditions?: ActiveConditionInfo[];
  onUseAbility: (
    ability: Ability & { tier: 1 | 2 | 3 },
    roll: DiceRoll,
    prompt: string,
    combinedDamage: string
  ) => void;
  onTriggerCooldown?: (abilityId: string) => void;
  emptyMessage?: string;
  showFilters?: boolean;
}

export function EnhancedMobileAbilityList({
  abilities,
  characterName,
  weapons,
  cooldownState,
  abilityImages = {},
  activeConditions = [],
  onUseAbility,
  onTriggerCooldown,
  emptyMessage = "No abilities unlocked",
  showFilters = false,
}: EnhancedMobileAbilityListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActionType, setFilterActionType] = useState<string | null>(null);
  const [filterTree, setFilterTree] = useState<AbilityTree | null>(null);

  // Filter abilities
  const filteredAbilities = useMemo(() => {
    return abilities.filter(a => {
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
      if (filterTree && a.tree !== filterTree) {
        return false;
      }
      return true;
    });
  }, [abilities, searchQuery, filterActionType, filterTree]);

  // Group abilities by tree for synergy display
  const groupedByTree = useMemo(() => {
    const groups: Record<AbilityTree, (Ability & { tier: 1 | 2 | 3 })[]> = {
      hunter: [],
      warrior: [],
      assassin: [],
    };
    
    filteredAbilities.forEach(ability => {
      groups[ability.tree].push(ability);
    });
    
    return groups;
  }, [filteredAbilities]);

  // Count abilities with weapon synergy
  const synergyStats = useMemo(() => ({
    hunter: { count: groupedByTree.hunter.length, hasWeapon: !!weapons.ranged },
    warrior: { count: groupedByTree.warrior.length, hasWeapon: !!weapons.primary },
    assassin: { count: groupedByTree.assassin.length, hasWeapon: !!weapons.secondary },
  }), [groupedByTree, weapons]);

  if (abilities.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
          <Dices className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">{emptyMessage}</p>
        <p className="text-[11px] text-red-400 italic mt-2">
          "Maybe check the Skills tab, champ."
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 pb-24 space-y-4">
      {/* Synergy Summary */}
      <div className="grid grid-cols-3 gap-2">
        <SynergySummaryCard
          tree="hunter"
          label="Hunter → Ranged"
          weaponName={weapons.ranged?.name}
          count={synergyStats.hunter.count}
          hasWeapon={synergyStats.hunter.hasWeapon}
          isActive={filterTree === 'hunter'}
          onClick={() => setFilterTree(filterTree === 'hunter' ? null : 'hunter')}
        />
        <SynergySummaryCard
          tree="warrior"
          label="Warrior → Primary"
          weaponName={weapons.primary?.name}
          count={synergyStats.warrior.count}
          hasWeapon={synergyStats.warrior.hasWeapon}
          isActive={filterTree === 'warrior'}
          onClick={() => setFilterTree(filterTree === 'warrior' ? null : 'warrior')}
        />
        <SynergySummaryCard
          tree="assassin"
          label="Assassin → Secondary"
          weaponName={weapons.secondary?.name}
          count={synergyStats.assassin.count}
          hasWeapon={synergyStats.assassin.hasWeapon}
          isActive={filterTree === 'assassin'}
          onClick={() => setFilterTree(filterTree === 'assassin' ? null : 'assassin')}
        />
      </div>

      {/* Search and Filters */}
      {showFilters && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search abilities..."
              className="h-12 pl-10 bg-black/30 border-muted/30 rounded-xl"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1">
            <FilterChip
              label="All"
              active={filterActionType === null}
              onClick={() => setFilterActionType(null)}
            />
            <FilterChip
              label="Action"
              icon={<Sword className="w-3 h-3" />}
              active={filterActionType === 'action'}
              onClick={() => setFilterActionType(filterActionType === 'action' ? null : 'action')}
            />
            <FilterChip
              label="Bonus"
              icon={<Zap className="w-3 h-3" />}
              active={filterActionType === 'bonus_action'}
              onClick={() => setFilterActionType(filterActionType === 'bonus_action' ? null : 'bonus_action')}
            />
            <FilterChip
              label="Reaction"
              icon={<Shield className="w-3 h-3" />}
              active={filterActionType === 'reaction'}
              onClick={() => setFilterActionType(filterActionType === 'reaction' ? null : 'reaction')}
            />
            <FilterChip
              label="Passive"
              icon={<Clock className="w-3 h-3" />}
              active={filterActionType === 'passive'}
              onClick={() => setFilterActionType(filterActionType === 'passive' ? null : 'passive')}
            />
          </div>
        </div>
      )}

      {/* Ability List */}
      {filteredAbilities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No abilities match your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAbilities.map(ability => {
            const cdState = cooldownState.get(ability.id);
            return (
              <CombatAbilityCard
                key={ability.id}
                ability={ability}
                characterName={characterName}
                weapons={weapons}
                cooldownState={cdState ? {
                  isOnCooldown: cdState.isOnCooldown,
                  remaining: cdState.remaining,
                  total: cdState.total,
                } : undefined}
                customImage={abilityImages[ability.id]}
                activeConditions={activeConditions}
                onUse={onUseAbility}
                onTriggerCooldown={onTriggerCooldown}
              />
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

// Synergy summary card component
function SynergySummaryCard({
  tree,
  label,
  weaponName,
  count,
  hasWeapon,
  isActive,
  onClick,
}: {
  tree: AbilityTree;
  label: string;
  weaponName?: string;
  count: number;
  hasWeapon: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const treeColors = {
    hunter: 'border-green-500/50 bg-green-500/10',
    warrior: 'border-amber-500/50 bg-amber-500/10',
    assassin: 'border-purple-500/50 bg-purple-500/10',
  };

  const activeColors = {
    hunter: 'border-green-500 bg-green-500/30',
    warrior: 'border-amber-500 bg-amber-500/30',
    assassin: 'border-purple-500 bg-purple-500/30',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "p-2 rounded-lg border transition-all active:scale-95",
        isActive ? activeColors[tree] : treeColors[tree]
      )}
    >
      <div className="text-[9px] font-mono text-muted-foreground truncate">
        {label}
      </div>
      <div className="text-sm font-bold">{count}</div>
      {hasWeapon ? (
        <div className="text-[8px] text-green-400 truncate">
          ✓ {weaponName}
        </div>
      ) : (
        <div className="text-[8px] text-muted-foreground">
          No weapon
        </div>
      )}
    </button>
  );
}

// Filter chip component
function FilterChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-mono whitespace-nowrap transition-all active:scale-95",
        active
          ? "bg-red-500/20 text-red-300 border border-red-500/50"
          : "bg-muted/20 text-muted-foreground border border-muted/30"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
