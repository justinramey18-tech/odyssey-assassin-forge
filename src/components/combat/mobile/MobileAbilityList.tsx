import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ability } from '@/lib/types';
import { getAbilityDice } from '@/lib/diceRoller';
import {
  Dices,
  ChevronRight,
  Sword,
  Zap,
  Shield,
  Clock,
  Search,
  Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MobileAbilityListProps {
  abilities: (Ability & { tier: 1 | 2 | 3 })[];
  onUseAbility: (ability: Ability & { tier: 1 | 2 | 3 }) => void;
  emptyMessage?: string;
  showFilters?: boolean;
}

export function MobileAbilityList({
  abilities,
  onUseAbility,
  emptyMessage = "No abilities unlocked",
  showFilters = false,
}: MobileAbilityListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActionType, setFilterActionType] = useState<string | null>(null);

  // Filter abilities
  const filteredAbilities = abilities.filter(a => {
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
    <div className="p-4 pb-24 space-y-3">
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
        <div className="space-y-2">
          {filteredAbilities.map(ability => (
            <MobileAbilityCard
              key={ability.id}
              ability={ability}
              onUse={() => onUseAbility(ability)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MobileAbilityCard({
  ability,
  onUse,
}: {
  ability: Ability & { tier: 1 | 2 | 3 };
  onUse: () => void;
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

  const isPassive = ability.type === 'passive';
  
  return (
    <div
      role="button"
      tabIndex={isPassive ? -1 : 0}
      onClick={() => !isPassive && onUse()}
      onKeyDown={(e) => e.key === 'Enter' && !isPassive && onUse()}
      className={cn(
        "w-full flex items-center gap-3 p-4 bg-card border border-muted/30 border-l-4 rounded-xl cursor-pointer touch-manipulation",
        "active:scale-[0.99] transition-all",
        treeColors[ability.tree],
        isPassive && "opacity-60 cursor-default"
      )}
    >
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{ability.name}</span>
          <Badge variant="outline" className="text-[9px] capitalize h-5">
            {ability.tree}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full",
            actionBadgeColors[ability.actionType]
          )}>
            {ability.actionType.replace('_', ' ')}
          </span>
          <span className="text-[10px] text-muted-foreground capitalize">
            {ability.usageType.replace('_', ' ')}
          </span>
        </div>
      </div>
      
      {!isPassive && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 rounded-lg text-sm text-red-300">
            <Dices className="w-4 h-4" />
            <span className="font-mono">{count}{die}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      
      {isPassive && (
        <div className="w-3 h-3 rounded-full bg-green-500/50" />
      )}
    </div>
  );
}

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
