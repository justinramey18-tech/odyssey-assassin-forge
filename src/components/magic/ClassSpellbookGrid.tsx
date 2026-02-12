// Class-Based Spellbook Grid
// Displays spells filtered by D&D class instead of Magic Path

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Search, Filter, BookOpen, Star, Focus, Sparkles, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { DnDClass } from '@/lib/classes/types';
import { SpellDefinition, SpellSchool } from '@/lib/magic/types';
import { getSpellsByClass, getSpellLevelLabel } from '@/lib/magic/spells';
import { HomebrewSpell } from '@/lib/spellCustomization/types';
import { SCHOOL_CONFIGS } from '@/lib/magic/schools';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SpellCard } from './SpellCard';

interface ClassSpellbookGridProps {
  classId: DnDClass;
  characterLevel: number;
  knownSpells: string[];
  preparedSpells: string[];
  favoriteSpells: string[];
  concentratingOn: string | null;
  maxSpellLevel: number;
  onSpellSelect: (spell: SpellDefinition) => void;
  homebrewSpells?: HomebrewSpell[];
  onEditHomebrew?: (spell: HomebrewSpell) => void;
  onDeleteHomebrew?: (id: string) => void;
  /** Whether this is a prepared caster (default true) */
  isPreparedCaster?: boolean;
}

type SpellFilter = 'all' | 'known' | 'prepared' | 'favorites';

export function ClassSpellbookGrid({
  classId,
  characterLevel,
  knownSpells,
  preparedSpells,
  favoriteSpells,
  concentratingOn,
  maxSpellLevel,
  onSpellSelect,
  homebrewSpells = [],
  onEditHomebrew,
  onDeleteHomebrew,
  isPreparedCaster = true,
}: ClassSpellbookGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<SpellFilter>('all');
  const [schoolFilters, setSchoolFilters] = useState<SpellSchool[]>([]);

  // Get all spells available to this class, merged with homebrew
  const classSpells = useMemo(() => {
    const spells = getSpellsByClass(classId);
    // Filter to max spell level the character can access
    const filtered = spells.filter(spell => spell.level <= maxSpellLevel);
    // Merge homebrew spells (they appear regardless of class filter)
    const homebrewFiltered = homebrewSpells.filter(s => s.level <= maxSpellLevel);
    return [...filtered, ...homebrewFiltered];
  }, [classId, maxSpellLevel, homebrewSpells]);

  // Apply filters
  const filteredSpells = useMemo(() => {
    let spells = classSpells;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      spells = spells.filter(spell =>
        spell.name.toLowerCase().includes(term) ||
        spell.description.toLowerCase().includes(term) ||
        spell.school.toLowerCase().includes(term)
      );
    }

    // Mode filter
    switch (filterMode) {
      case 'known':
        spells = spells.filter(spell => knownSpells.includes(spell.id));
        break;
      case 'prepared':
        spells = spells.filter(spell => preparedSpells.includes(spell.id));
        break;
      case 'favorites':
        spells = spells.filter(spell => favoriteSpells.includes(spell.id));
        break;
    }

    // School filter
    if (schoolFilters.length > 0) {
      spells = spells.filter(spell => schoolFilters.includes(spell.school));
    }

    return spells;
  }, [classSpells, searchTerm, filterMode, schoolFilters, knownSpells, preparedSpells, favoriteSpells]);

  // Group spells by level
  const spellsByLevel = useMemo(() => {
    const grouped: Record<number, SpellDefinition[]> = {};
    
    filteredSpells.forEach(spell => {
      if (!grouped[spell.level]) {
        grouped[spell.level] = [];
      }
      grouped[spell.level].push(spell);
    });

    // Sort each level's spells alphabetically
    Object.keys(grouped).forEach(level => {
      grouped[parseInt(level)].sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }, [filteredSpells]);

  const toggleSchoolFilter = (school: SpellSchool) => {
    setSchoolFilters(prev =>
      prev.includes(school)
        ? prev.filter(s => s !== school)
        : [...prev, school]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterMode('all');
    setSchoolFilters([]);
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || filterMode !== 'all' || schoolFilters.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filters */}
      <div className="p-4 space-y-3 border-b border-white/10 bg-background/30 backdrop-blur-sm sticky top-0 z-10">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search spells..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background/50 border-white/10"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterMode === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterMode('all')}
            className="h-7 text-xs"
          >
            <BookOpen className="w-3 h-3 mr-1" />
            All
          </Button>
          <Button
            variant={filterMode === 'prepared' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterMode('prepared')}
            className="h-7 text-xs"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {isPreparedCaster ? 'Prepared' : 'Known'}
          </Button>
          <Button
            variant={filterMode === 'favorites' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterMode('favorites')}
            className="h-7 text-xs"
          >
            <Star className="w-3 h-3 mr-1" />
            Favorites
          </Button>

          {/* School Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={schoolFilters.length > 0 ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
              >
                <Filter className="w-3 h-3 mr-1" />
                Schools
                {schoolFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {schoolFilters.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs">Filter by School</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(SCHOOL_CONFIGS) as SpellSchool[]).map(school => {
                const config = SCHOOL_CONFIGS[school];
                return (
                  <DropdownMenuCheckboxItem
                    key={school}
                    checked={schoolFilters.includes(school)}
                    onCheckedChange={() => toggleSchoolFilter(school)}
                    className="text-xs"
                  >
                    <span className={cn("capitalize", config.color)}>{config.name}</span>
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 text-xs text-muted-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Spell List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {filteredSpells.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground opacity-50 mb-3" />
            <p className="text-muted-foreground">
              {hasActiveFilters ? 'No spells match your filters' : 'No spells available yet'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="mt-2"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cantrips first, then by level */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
              const spells = spellsByLevel[level];
              if (!spells || spells.length === 0) return null;

              return (
                <Collapsible key={level}>
                  <CollapsibleTrigger className={cn(
                    "flex items-center justify-between w-full group px-4 py-3 rounded-lg",
                    "border border-emerald-500/30 bg-emerald-950/40 backdrop-blur-sm",
                    "hover:bg-emerald-900/40 transition-colors"
                  )}>
                    <div className="flex items-center gap-2">
                      <ChevronDown className="w-4 h-4 text-emerald-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                      <h3 className="font-cinzel text-sm font-semibold text-emerald-300 uppercase tracking-widest">
                        {getSpellLevelLabel(level)}
                        {level === 0 ? 's' : ' Level'}
                      </h3>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {spells.length} Spell{spells.length !== 1 ? 's' : ''}
                    </span>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="mt-2 max-h-[50vh] overflow-y-auto rounded-lg border border-white/5 bg-background/30 p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {spells.map(spell => (
                          <div key={spell.id} className="relative">
                            <SpellCard
                              spell={spell}
                              isPrepared={preparedSpells.includes(spell.id)}
                              isFavorite={favoriteSpells.includes(spell.id)}
                              isConcentrating={concentratingOn === spell.id}
                              characterLevel={characterLevel}
                              onClick={() => onSpellSelect(spell)}
                            />
                            {(spell as any).isHomebrew && (onEditHomebrew || onDeleteHomebrew) && (
                              <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                                {onEditHomebrew && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onEditHomebrew(spell as HomebrewSpell); }}
                                    className="w-7 h-7 rounded-md bg-indigo-600/40 hover:bg-indigo-600/60 flex items-center justify-center transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-indigo-300" />
                                  </button>
                                )}
                                {onDeleteHomebrew && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteHomebrew(spell.id); }}
                                    className="w-7 h-7 rounded-md bg-red-600/40 hover:bg-red-600/60 flex items-center justify-center transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-300" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
