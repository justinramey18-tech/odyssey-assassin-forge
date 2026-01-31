import { cn } from '@/lib/utils';
import { Wand2, Lock, Sparkles } from 'lucide-react';
import { MagicPath, PathConfig } from '@/lib/magic/types';
import { PATH_LIST, getPathConfig } from '@/lib/magic/paths';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';

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
  const { state, hasPath, selectPath } = spellcasting;

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

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="p-4 border-b border-indigo-900/30 bg-gradient-to-r from-indigo-950/50 to-purple-950/50">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            `bg-${pathConfig.primaryColor}-600/30 border border-${pathConfig.primaryColor}-500/50`
          )}>
            <Wand2 className={cn("w-6 h-6", pathConfig.accentColor)} />
          </div>
          <div>
            <h1 className="font-cinzel text-xl text-foreground">{pathConfig.name}</h1>
            <p className="text-xs text-muted-foreground">{pathConfig.subtitle}</p>
          </div>
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
      </div>

      {/* Placeholder content - will be expanded in Phase 2 */}
      <div className="p-4 space-y-4">
        <Card className="bg-indigo-950/30 border-indigo-800/30">
          <CardContent className="p-6 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-indigo-400 mb-4" />
            <h2 className="font-cinzel text-lg mb-2">Spellbook Coming Soon</h2>
            <p className="text-sm text-muted-foreground">
              Phase 2 will add spell selection, slot tracking, and casting mechanics.
            </p>
          </CardContent>
        </Card>

        {/* Path Features Preview */}
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
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="p-6 text-center bg-gradient-to-b from-indigo-950/50 to-transparent">
        <Wand2 className="w-12 h-12 mx-auto text-indigo-400 mb-4" />
        <h1 className="font-cinzel text-2xl mb-2">Choose Your Arcane Path</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {characterName}, select a magical tradition to unlock spellcasting abilities.
          Each path offers unique spells and features.
        </p>
      </div>

      {/* Path Cards */}
      <div className="p-4 grid gap-4">
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
