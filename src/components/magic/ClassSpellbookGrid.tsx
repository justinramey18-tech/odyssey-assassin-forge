// Class-Based Spellbook Grid
// Displays spells filtered by D&D class instead of Magic Path

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Search, Filter, BookOpen, Star, Focus, Sparkles } from 'lucide-react';
import { DnDClass } from '@/lib/classes/types';
import { SpellDefinition, SpellSchool } from '@/lib/magic/types';
import { getSpellsByClass, getSpellLevelLabel } from '@/lib/magic/spells';
import { SCHOOL_CONFIGS } from '@/lib/magic/schools';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}: ClassSpellbookGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<SpellFilter>('all');
  const [schoolFilters, setSchoolFilters] = useState<SpellSchool[]>([]);

  // Get all spells available to this class
  const classSpells = useMemo(() => {
    const spells = getSpellsByClass(classId);
    // Filter to max spell level the character can access
    return spells.filter(spell => spell.level <= maxSpellLevel);
  }, [classId, maxSpellLevel]);

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
            Prepared
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
                <div key={level}>
                  {/* Level Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider",
                      level === 0
                        ? "bg-emerald-600/30 text-emerald-400"
                        : "bg-indigo-600/30 text-indigo-400"
                    )}>
                      {getSpellLevelLabel(level)}
                      {level === 0 ? 's' : ' Level'}
                    </div>
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-muted-foreground">
                      {spells.length} spell{spells.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Spell Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {spells.map(spell => (
                      <SpellCard
                        key={spell.id}
                        spell={spell}
                        isPrepared={preparedSpells.includes(spell.id)}
                        isFavorite={favoriteSpells.includes(spell.id)}
                        isConcentrating={concentratingOn === spell.id}
                        characterLevel={characterLevel}
                        onClick={() => onSpellSelect(spell)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
