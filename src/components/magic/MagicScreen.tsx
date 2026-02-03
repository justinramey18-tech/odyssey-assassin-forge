import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Wand2, Lock, Sparkles, BookOpen, Zap, Settings, Eye, X, RefreshCw } from 'lucide-react';
import { MagicPath, PathConfig, SpellDefinition } from '@/lib/magic/types';
import { PATH_LIST, getPathConfig } from '@/lib/magic/paths';
import { getSpellById } from '@/lib/magic/spells';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { SpellbookGrid } from './SpellbookGrid';
import { SpellDetailsSheet } from './SpellDetailsSheet';
import { SpellCastSheet } from './SpellCastSheet';
import { SpellSlotTracker } from './SpellSlotTracker';

// Background image
import arcanaBackground from '@/assets/trees/arcana-wizards-mobile.jpg';

interface MagicScreenProps {
  characterLevel: number;
  characterName: string;
  spellcasting: UseSpellcastingReturn;
}

export function MagicScreen({ 
  characterLevel, 
  characterName,
  spellcasting 
}: MagicScreenProps) {
  const { state, hasPath, selectPath, clearPath, castSpell, breakConcentration } = spellcasting;
  const [selectedSpell, setSelectedSpell] = useState<SpellDefinition | null>(null);
  const [castingSpell, setCastingSpell] = useState<SpellDefinition | null>(null);
  const [activeTab, setActiveTab] = useState<'spellbook' | 'slots' | 'features'>('spellbook');

  // If no path selected, show path selection
  if (!hasPath) {
    return (
      <PathSelectionScreen 
        characterLevel={characterLevel}
        characterName={characterName}
        onSelectPath={selectPath}
      />
    );
  }

  // Path is selected - show main magic interface
  const pathConfig = getPathConfig(state.path!);

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
      castingSpell.concentration
    );
    
    setCastingSpell(null);
  };

  // Get concentration spell name
  const concentrationSpell = state.concentratingOn 
    ? getSpellById(state.concentratingOn)
    : null;

  return (
    <div className="relative min-h-screen pb-24">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url(${arcanaBackground})` }}
      />
      {/* Gradient Overlay for legibility */}
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
            <h1 className="font-cinzel text-xl text-foreground">{pathConfig.name}</h1>
            <p className="text-xs text-muted-foreground">{pathConfig.subtitle}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/20"
            onClick={clearPath}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            <span className="text-xs">Change</span>
          </Button>
        </div>
        
        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="bg-background/40 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-indigo-400">
              +{spellcasting.spellAttackBonus}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">Attack</div>
          </div>
          <div className="bg-background/40 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-purple-400">
              {spellcasting.spellSaveDC}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">Save DC</div>
          </div>
          <div className="bg-background/40 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-violet-400">
              {spellcasting.totalSlotsRemaining}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">Slots</div>
          </div>
        </div>

        {/* Concentration Indicator */}
        {concentrationSpell && (
          <div className="mt-3 p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-sm text-amber-200">
                Concentrating: <span className="font-medium">{concentrationSpell.name}</span>
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
              onClick={breakConcentration}
            >
              <X className="w-4 h-4" />
            </Button>
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
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="relative z-10 flex-1">
        <TabsList className="w-full justify-start rounded-none border-b border-white/10 bg-transparent p-0">
          <TabsTrigger 
            value="spellbook" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Spellbook
          </TabsTrigger>
          <TabsTrigger 
            value="slots"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
          >
            <Zap className="w-4 h-4 mr-2" />
            Slots
          </TabsTrigger>
          <TabsTrigger 
            value="features"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent"
          >
            <Settings className="w-4 h-4 mr-2" />
            Features
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spellbook" className="mt-0 flex-1">
          <SpellbookGrid
            path={state.path!}
            characterLevel={characterLevel}
            knownSpells={state.knownSpells}
            preparedSpells={state.preparedSpells}
            favoriteSpells={state.favoriteSpells}
            concentratingOn={state.concentratingOn}
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
                  onUseSlot={spellcasting.useSlot}
                  onRestoreSlot={spellcasting.restoreSlot}
                  onUsePactSlot={spellcasting.usePactSlot}
                  onRestorePactSlot={spellcasting.restorePactSlot}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features" className="mt-0 flex-1 overflow-y-auto">
          <div className="p-4 pb-24">
            <Card className="bg-background/40 border-white/10">
              <CardContent className="p-4">
                <h3 className="font-cinzel text-sm text-muted-foreground mb-3 uppercase tracking-wider">
                  Path Features
                </h3>
                <div className="space-y-2">
                  {pathConfig.features.map((feature) => (
                    <div 
                      key={feature.id}
                      className={cn(
                        "p-3 rounded-lg",
                        characterLevel >= feature.level 
                          ? "bg-indigo-600/20 border border-indigo-500/30"
                          : "bg-muted/20 border border-muted/20 opacity-50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{feature.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Level {feature.level}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  ))}
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
        canCast={spellcasting.totalSlotsRemaining > 0 || (selectedSpell?.level === 0)}
        onPrepare={() => selectedSpell && spellcasting.prepareSpell(selectedSpell.id)}
        onUnprepare={() => selectedSpell && spellcasting.unprepareSpell(selectedSpell.id)}
        onToggleFavorite={() => selectedSpell && spellcasting.toggleFavorite(selectedSpell.id)}
        onCast={handleOpenCastSheet}
      />

      {/* Spell Cast Sheet */}
      <SpellCastSheet
        spell={castingSpell}
        isOpen={!!castingSpell}
        onClose={() => setCastingSpell(null)}
        path={state.path!}
        spellSlots={state.spellSlots}
        pactSlots={state.pactSlots}
        concentratingOn={state.concentratingOn}
        spellAttackBonus={spellcasting.spellAttackBonus}
        spellSaveDC={spellcasting.spellSaveDC}
        characterName={characterName}
        onCast={handleCastSpell}
      />
    </div>
  );
}

// ============================================
// PATH SELECTION SCREEN
// ============================================

interface PathSelectionScreenProps {
  characterLevel: number;
  characterName: string;
  onSelectPath: (path: MagicPath) => void;
}

function PathSelectionScreen({ 
  characterLevel, 
  characterName, 
  onSelectPath 
}: PathSelectionScreenProps) {
  return (
    <div className="relative min-h-screen pb-24">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url(${arcanaBackground})` }}
      />
      {/* Gradient Overlay for legibility */}
      <div className="fixed inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/90 z-0" />
      {/* Header */}
      <div className="relative z-10 p-6 text-center bg-gradient-to-b from-indigo-950/70 to-transparent backdrop-blur-sm">
        <Wand2 className="w-12 h-12 mx-auto text-indigo-400 mb-4" />
        <h1 className="font-cinzel text-2xl mb-2">Choose Your Arcane Path</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {characterName}, select a magical tradition to unlock spellcasting abilities.
          Each path offers unique spells and features.
        </p>
      </div>

      {/* Path Cards */}
      <div className="relative z-10 p-4 grid gap-4">
        {PATH_LIST.map((path) => {
          const isLocked = (path.id === 'hexblade' ? characterLevel < 1 : characterLevel < 3);
          
          return (
            <PathCard
              key={path.id}
              path={path}
              isLocked={isLocked}
              onSelect={() => onSelectPath(path.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// PATH CARD
// ============================================

interface PathCardProps {
  path: PathConfig;
  isLocked: boolean;
  onSelect: () => void;
}

function PathCard({ path, isLocked, onSelect }: PathCardProps) {
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all",
        isLocked 
          ? "opacity-50 border-muted" 
          : `border-${path.primaryColor}-800/50 hover:border-${path.primaryColor}-600/50`
      )}
    >
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn(
          "p-4 flex items-center gap-3",
          `bg-gradient-to-r from-${path.primaryColor}-950/50 to-transparent`
        )}>
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            `bg-${path.primaryColor}-600/30 border border-${path.primaryColor}-500/50`
          )}>
            {isLocked ? (
              <Lock className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Wand2 className={cn("w-5 h-5", path.accentColor)} />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-cinzel text-lg">{path.name}</h3>
            <p className="text-xs text-muted-foreground">{path.subtitle}</p>
          </div>
          <div className="text-right">
            <div className={cn("text-xs font-mono", path.accentColor)}>
              {path.spellcastingAbility}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">
              {path.slotProgression === 'pact' ? 'Pact' : path.slotProgression === 'half' ? 'Half' : 'Third'} Caster
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 pt-0">
          <p className="text-sm text-muted-foreground mb-4">
            {path.flavorText}
          </p>
          
          {/* Features Preview */}
          <div className="flex flex-wrap gap-1 mb-4">
            {path.features.slice(0, 2).map((feature) => (
              <span 
                key={feature.id}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground"
              >
                {feature.name}
              </span>
            ))}
            {path.features.length > 2 && (
              <span className="text-[10px] px-2 py-0.5 text-muted-foreground">
                +{path.features.length - 2} more
              </span>
            )}
          </div>

          <Button
            onClick={onSelect}
            disabled={isLocked}
            className={cn(
              "w-full",
              !isLocked && `bg-${path.primaryColor}-600 hover:bg-${path.primaryColor}-500`
            )}
          >
            {isLocked ? 'Locked (Level 3 Required)' : 'Choose This Path'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
