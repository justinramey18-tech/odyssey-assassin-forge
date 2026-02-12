import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SpellDefinition, MagicPath, SpellSchool } from '@/lib/magic/types';
import { getSpellsByPath, getSpellLevelLabel } from '@/lib/magic/spells';
import { SpellCard } from './SpellCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Filter, Star, Eye, BookOpen, ChevronDown } from 'lucide-react';

interface SpellbookGridProps {
  path: MagicPath;
  characterLevel: number;
  knownSpells: string[];
  preparedSpells: string[];
  favoriteSpells: string[];
  concentratingOn: string | null;
  onSpellSelect: (spell: SpellDefinition) => void;
}

type FilterOption = 'all' | 'prepared' | 'favorites' | 'concentration';
type LevelFilter = 'all' | 0 | 1 | 2;

export function SpellbookGrid({
  path,
  characterLevel,
  knownSpells,
  preparedSpells,
  favoriteSpells,
  concentratingOn,
  onSpellSelect,
}: SpellbookGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  // Get all spells available for this path
  const availableSpells = useMemo(() => {
    return getSpellsByPath(path);
  }, [path]);

  // Calculate max spell level based on character level and path
  const maxSpellLevel = useMemo(() => {
    if (path === 'hexblade') {
      if (characterLevel >= 3) return 2;
      if (characterLevel >= 1) return 1;
      return 0;
    }
    // Third-casters
    if (characterLevel >= 7) return 2;
    if (characterLevel >= 3) return 1;
    return 0;
  }, [path, characterLevel]);

  // Filter spells based on current filters
  const filteredSpells = useMemo(() => {
    return availableSpells.filter(spell => {
      // Check if spell is available at current level
      if (spell.level > 0 && spell.level > maxSpellLevel) return false;

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = spell.name.toLowerCase().includes(term);
        const matchesSchool = spell.school.toLowerCase().includes(term);
        const matchesDescription = spell.description.toLowerCase().includes(term);
        if (!matchesName && !matchesSchool && !matchesDescription) return false;
      }

      // Level filter
      if (levelFilter !== 'all' && spell.level !== levelFilter) return false;

      // Status filters
      switch (activeFilter) {
        case 'prepared':
          return preparedSpells.includes(spell.id) || spell.level === 0; // Cantrips always "prepared"
        case 'favorites':
          return favoriteSpells.includes(spell.id);
        case 'concentration':
          return spell.concentration;
        default:
          return true;
      }
    });
  }, [availableSpells, searchTerm, activeFilter, levelFilter, maxSpellLevel, preparedSpells, favoriteSpells]);

  // Group spells by level
  const groupedSpells = useMemo(() => {
    const groups: Record<number, SpellDefinition[]> = {};
    for (const spell of filteredSpells) {
      if (!groups[spell.level]) groups[spell.level] = [];
      groups[spell.level].push(spell);
    }
    // Sort spells within each group alphabetically
    for (const level of Object.keys(groups)) {
      groups[parseInt(level)].sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [filteredSpells]);

  const levelKeys = Object.keys(groupedSpells).map(Number).sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full">
      {/* Search & Filters */}
      <div className="p-4 space-y-3 border-b border-white/10">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search spells..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background/50 border-white/10"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setActiveFilter('all')}
          >
            <BookOpen className="w-3 h-3 mr-1" />
            All
          </Badge>
          <Badge
            variant={activeFilter === 'prepared' ? 'default' : 'outline'}
            className={cn("cursor-pointer", activeFilter === 'prepared' && "bg-indigo-600")}
            onClick={() => setActiveFilter('prepared')}
          >
            <Filter className="w-3 h-3 mr-1" />
            Prepared
          </Badge>
          <Badge
            variant={activeFilter === 'favorites' ? 'default' : 'outline'}
            className={cn("cursor-pointer", activeFilter === 'favorites' && "bg-amber-600")}
            onClick={() => setActiveFilter('favorites')}
          >
            <Star className="w-3 h-3 mr-1" />
            Favorites
          </Badge>
          <Badge
            variant={activeFilter === 'concentration' ? 'default' : 'outline'}
            className={cn("cursor-pointer", activeFilter === 'concentration' && "bg-purple-600")}
            onClick={() => setActiveFilter('concentration')}
          >
            <Eye className="w-3 h-3 mr-1" />
            Concentration
          </Badge>
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Level:</span>
          {(['all', 0, 1, 2] as const).map((level) => {
            // Only show levels that are available
            if (typeof level === 'number' && level > 0 && level > maxSpellLevel) return null;
            
            return (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-colors",
                  levelFilter === level
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {level === 'all' ? 'All' : level === 0 ? 'Cantrip' : getSpellLevelLabel(level)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Spell Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {levelKeys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No spells found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            levelKeys.map((level) => (
              <Collapsible key={level}>
                <CollapsibleTrigger className={cn(
                  "flex items-center justify-between w-full group px-4 py-3 rounded-lg",
                  "border border-emerald-500/30 bg-emerald-950/40 backdrop-blur-sm",
                  "hover:bg-emerald-900/40 transition-colors"
                )}>
                  <div className="flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 text-emerald-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                    <h3 className="font-cinzel text-sm font-semibold text-emerald-300 uppercase tracking-widest">
                      {level === 0 ? 'Cantrips' : `${getSpellLevelLabel(level)} Level`}
                    </h3>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {groupedSpells[level].length} Spell{groupedSpells[level].length !== 1 ? 's' : ''}
                  </span>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-2 max-h-[50vh] overflow-y-auto rounded-lg border border-white/5 bg-background/30 p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {groupedSpells[level].map((spell) => (
                        <SpellCard
                          key={spell.id}
                          spell={spell}
                          isPrepared={preparedSpells.includes(spell.id) || spell.level === 0}
                          isFavorite={favoriteSpells.includes(spell.id)}
                          isConcentrating={concentratingOn === spell.id}
                          characterLevel={characterLevel}
                          onClick={() => onSpellSelect(spell)}
                        />
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
