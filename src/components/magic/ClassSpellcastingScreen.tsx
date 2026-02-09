// Class-Based Spellcasting Screen
// UI for full caster classes (Wizard, Sorcerer, Cleric, Druid, Bard)
// Separate from MagicScreen which handles Rogue Magic Paths

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Wand2, BookOpen, Zap, Settings, Package, RefreshCw } from 'lucide-react';
import { DnDClass } from '@/lib/classes/types';
import { CLASS_REGISTRY } from '@/lib/classes';
import { SpellDefinition } from '@/lib/magic/types';
import { getSpellById } from '@/lib/magic/spells';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UseClassSpellcastingReturn } from '@/hooks/use-class-spellcasting';
import { ClassSpellbookGrid } from './ClassSpellbookGrid';
import { SpellDetailsSheet } from './SpellDetailsSheet';
import { SpellCastSheet } from './SpellCastSheet';
import { SpellSlotTracker } from './SpellSlotTracker';
import { MaterialComponentsPanel } from './MaterialComponentsPanel';
import { ConcentrationCheckPanel } from './ConcentrationCheckPanel';
import { ActiveSpellsPanel } from './ActiveSpellsPanel';

// Background image
import arcanaBackground from '@/assets/trees/arcana-wizards-mobile.jpg';

interface ClassSpellcastingScreenProps {
  primaryClass: DnDClass;
  characterLevel: number;
  characterName: string;
  spellcasting: UseClassSpellcastingReturn;
  /** CON modifier for concentration checks */
  conModifier?: number;
  /** Proficiency bonus for saves */
  proficiencyBonus?: number;
  /** Whether proficient in CON saves */
  isProficientInConSaves?: boolean;
}

export function ClassSpellcastingScreen({
  primaryClass,
  characterLevel,
  characterName,
  spellcasting,
  conModifier = 0,
  proficiencyBonus = 2,
  isProficientInConSaves = false,
}: ClassSpellcastingScreenProps) {
  const {
    state,
    activeSpells,
    maxSpellLevel,
    hasSpellcasting: canCast,
    spellAttackBonus,
    spellSaveDC,
    spellcastingAbility,
    totalSlotsRemaining,
    maxPreparedSpells,
    currentPreparedCount,
    canPrepareMore,
    isPreparedCaster,
    learnSpell,
    forgetSpell,
    prepareSpell,
    unprepareSpell,
    toggleFavorite,
    useSlot,
    restoreSlot,
    usePactSlot,
    restorePactSlot,
    castSpell,
    dismissActiveSpell,
    breakConcentration,
    addComponent,
    useComponent,
    toggleFocus,
    onLongRest,
  } = spellcasting;

  const [selectedSpell, setSelectedSpell] = useState<SpellDefinition | null>(null);
  const [castingSpell, setCastingSpell] = useState<SpellDefinition | null>(null);
  const [activeTab, setActiveTab] = useState<'spellbook' | 'slots' | 'components' | 'features'>('spellbook');

  // Get class configuration
  const classConfig = CLASS_REGISTRY[primaryClass];

  const handleSpellSelect = (spell: SpellDefinition) => {
    setSelectedSpell(spell);
  };

  const handleOpenCastSheet = () => {
    if (selectedSpell) {
      setCastingSpell(selectedSpell);
      setSelectedSpell(null);
    }
  };

  const handleCastSpell = (castLevel: number, usePact: boolean) => {
    if (!castingSpell) return;

    castSpell(
      castingSpell.id,
      castingSpell.name,
      castingSpell.level,
      castLevel,
      usePact,
      castingSpell.concentration,
      castingSpell.duration
    );

    setCastingSpell(null);
  };

  // Get concentration spell name
  const concentrationSpell = state.concentratingOn
    ? getSpellById(state.concentratingOn)
    : null;

  // If no spellcasting ability yet, show a message
  if (!canCast) {
    return (
      <div className="relative min-h-screen pb-24">
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
          style={{ backgroundImage: `url(${arcanaBackground})` }}
        />
        <div className="fixed inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/90 z-0" />
        <div className="relative z-10 p-6 text-center mt-20">
          <Wand2 className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h1 className="font-cinzel text-2xl mb-2 text-muted-foreground">No Spellcasting Yet</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your {classConfig?.name || 'character'} hasn't gained spellcasting abilities yet.
            Continue leveling up to unlock magic!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-24">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url(${arcanaBackground})` }}
      />
      {/* Gradient Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/90 z-0" />

      {/* Header */}
      <div className="relative z-10 p-4 border-b border-indigo-900/30 bg-gradient-to-r from-indigo-950/70 to-purple-950/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            "bg-indigo-600/30 border border-indigo-500/50"
          )}>
            <Wand2 className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h1 className="font-cinzel text-xl text-foreground">
              {classConfig?.name || 'Spellcaster'} Spellbook
            </h1>
            <p className="text-xs text-muted-foreground">
              {spellcastingAbility}-based • {isPreparedCaster ? 'Prepared' : 'Known'} Caster
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/20"
            onClick={onLongRest}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            <span className="text-xs">Rest</span>
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <div className="bg-background/40 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-indigo-400">
              +{spellAttackBonus}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">Attack</div>
          </div>
          <div className="bg-background/40 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-purple-400">
              {spellSaveDC}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">Save DC</div>
          </div>
          <div className="bg-background/40 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-violet-400">
              {totalSlotsRemaining}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">Slots</div>
          </div>
          <div className="bg-background/40 rounded-lg p-2 text-center">
            <div className={`text-lg font-bold ${canPrepareMore ? 'text-emerald-400' : 'text-amber-400'}`}>
              {currentPreparedCount}/{maxPreparedSpells}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">
              {isPreparedCaster ? 'Prepared' : 'Known'}
            </div>
          </div>
        </div>

        {/* Concentration Check Panel */}
        {concentrationSpell && (
          <div className="mt-3">
            <ConcentrationCheckPanel
              concentratingSpellName={concentrationSpell.name}
              conModifier={conModifier}
              proficiencyBonus={proficiencyBonus}
              isProficientInConSaves={isProficientInConSaves}
              onBreakConcentration={breakConcentration}
            />
          </div>
        )}

        {/* Compact Slot Display */}
        <div className="mt-3 p-2 bg-background/30 rounded-lg">
          <SpellSlotTracker
            spellSlots={state.spellSlots}
            pactSlots={state.pactSlots}
            compact
          />
        </div>

        {/* Active Spells Panel */}
        {activeSpells.length > 0 && (
          <div className="mt-3">
            <ActiveSpellsPanel
              activeSpells={activeSpells}
              onDismissSpell={dismissActiveSpell}
              onBreakConcentration={breakConcentration}
              concentratingOn={state.concentratingOn}
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="relative z-10 flex-1">
        <TabsList className="w-full justify-start rounded-none border-b border-white/10 bg-transparent p-0 overflow-x-auto">
          <TabsTrigger
            value="spellbook"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent"
          >
            <BookOpen className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Spellbook</span>
          </TabsTrigger>
          <TabsTrigger
            value="slots"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
          >
            <Zap className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Slots</span>
          </TabsTrigger>
          <TabsTrigger
            value="components"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent"
          >
            <Package className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Components</span>
          </TabsTrigger>
          <TabsTrigger
            value="features"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent"
          >
            <Settings className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Class Info</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spellbook" className="mt-0 flex-1">
          <ClassSpellbookGrid
            classId={primaryClass}
            characterLevel={characterLevel}
            knownSpells={state.knownSpells}
            preparedSpells={state.preparedSpells}
            favoriteSpells={state.favoriteSpells}
            concentratingOn={state.concentratingOn}
            maxSpellLevel={maxSpellLevel}
            onSpellSelect={handleSpellSelect}
          />
        </TabsContent>

        <TabsContent value="slots" className="mt-0 flex-1 overflow-y-auto">
          <div className="p-4 pb-24">
            <Card className="bg-background/40 border-white/10">
              <CardContent className="p-4">
                <h3 className="font-cinzel text-sm text-muted-foreground mb-4 uppercase tracking-wider">
                  Spell Slot Management
                </h3>
                <SpellSlotTracker
                  spellSlots={state.spellSlots}
                  pactSlots={state.pactSlots}
                  onUseSlot={useSlot}
                  onRestoreSlot={restoreSlot}
                  onUsePactSlot={usePactSlot}
                  onRestorePactSlot={restorePactSlot}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="components" className="mt-0 flex-1 overflow-y-auto">
          <div className="p-4 pb-24">
            <MaterialComponentsPanel
              components={state.materialComponents}
              focusEquipped={state.focusEquipped}
              onAddComponent={addComponent}
              onUseComponent={useComponent}
              onToggleFocus={toggleFocus}
            />
          </div>
        </TabsContent>

        <TabsContent value="features" className="mt-0 flex-1 overflow-y-auto">
          <div className="p-4 pb-24">
            <Card className="bg-background/40 border-white/10">
              <CardContent className="p-4">
                <h3 className="font-cinzel text-sm text-muted-foreground mb-3 uppercase tracking-wider">
                  {classConfig?.name} Class Info
                </h3>
                <div className="space-y-4">
                  {/* Class Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
                      <div className="text-xs text-muted-foreground uppercase mb-1">Hit Die</div>
                      <div className="text-lg font-bold text-indigo-400">{classConfig?.hitDie}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-600/20 border border-purple-500/30">
                      <div className="text-xs text-muted-foreground uppercase mb-1">Spellcasting</div>
                      <div className="text-lg font-bold text-purple-400">{spellcastingAbility}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-violet-600/20 border border-violet-500/30">
                      <div className="text-xs text-muted-foreground uppercase mb-1">Max Spell Level</div>
                      <div className="text-lg font-bold text-violet-400">{maxSpellLevel}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-600/20 border border-emerald-500/30">
                      <div className="text-xs text-muted-foreground uppercase mb-1">Caster Type</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {isPreparedCaster ? 'Prepared' : 'Known'}
                      </div>
                    </div>
                  </div>

                  {/* Class Description */}
                  {classConfig?.flavorText && (
                    <div className="p-3 rounded-lg bg-muted/20 border border-muted/30">
                      <p className="text-sm text-muted-foreground italic">
                        {classConfig.flavorText}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Spell Details Sheet */}
      <SpellDetailsSheet
        spell={selectedSpell}
        isOpen={!!selectedSpell}
        onClose={() => setSelectedSpell(null)}
        isPrepared={selectedSpell ? state.preparedSpells.includes(selectedSpell.id) : false}
        isFavorite={selectedSpell ? state.favoriteSpells.includes(selectedSpell.id) : false}
        isConcentrating={selectedSpell ? state.concentratingOn === selectedSpell.id : false}
        canCast={totalSlotsRemaining > 0 || (selectedSpell?.level === 0)}
        canPrepareMore={canPrepareMore}
        characterLevel={characterLevel}
        onPrepare={() => {
          if (selectedSpell) {
            if (isPreparedCaster) {
              prepareSpell(selectedSpell.id);
            } else {
              learnSpell(selectedSpell.id);
            }
          }
        }}
        onUnprepare={() => {
          if (selectedSpell) {
            if (isPreparedCaster) {
              unprepareSpell(selectedSpell.id);
            } else {
              forgetSpell(selectedSpell.id);
            }
          }
        }}
        onToggleFavorite={() => selectedSpell && toggleFavorite(selectedSpell.id)}
        onCast={handleOpenCastSheet}
      />

      {/* Spell Cast Sheet - Pass 'arcane_trickster' as dummy path for now */}
      <SpellCastSheet
        spell={castingSpell}
        isOpen={!!castingSpell}
        onClose={() => setCastingSpell(null)}
        path="arcane_trickster"
        spellSlots={state.spellSlots}
        pactSlots={state.pactSlots}
        concentratingOn={state.concentratingOn}
        spellAttackBonus={spellAttackBonus}
        spellSaveDC={spellSaveDC}
        characterName={characterName}
        characterLevel={characterLevel}
        onCast={handleCastSpell}
      />
    </div>
  );
}
