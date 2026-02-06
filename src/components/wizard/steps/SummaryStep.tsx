import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ABILITY_ORDER, 
  ABILITY_CONFIG, 
  scoreToModifier,
  modifierToString,
} from '@/lib/abilityScores/types';
import { getAbilityPointsForLevel } from '@/lib/types';
import { getHPBreakdown } from '@/lib/hpCalculation';
import { XP_PRESETS, WizardState } from '../types';
import { DICE_ODDS_CONFIGS } from '@/lib/diceOdds';
import { MAGIC_PATHS } from '@/lib/magic/paths';
import { getPresetById } from '../presets/equipment-presets';
import { cn } from '@/lib/utils';
import { 
  Skull, User, Shield, Swords, Crosshair, Ghost, Flame, Zap, Moon, Sun, Star, Crown,
  Heart, Sparkles, Edit2, Infinity, CheckCircle2, Wand2, Package, Target,
} from 'lucide-react';
import wizardBackground from '@/assets/wizard-background.jpg';
import { PortraitIcon } from '../types';

interface SummaryStepProps {
  state: WizardState;
  onEditStep: (step: number) => void;
  onComplete: () => void;
}

// Icon component map (same as IdentityStep)
const ICON_COMPONENTS: Record<PortraitIcon, React.ComponentType<{ className?: string }>> = {
  Skull,
  User,
  Shield,
  Sword: Swords,
  Crosshair,
  Ghost,
  Flame,
  Zap,
  Moon,
  Sun,
  Star,
  Crown,
};

interface SummarySectionProps {
  title: string;
  stepIndex: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}

function SummarySection({ title, stepIndex, onEdit, children }: SummarySectionProps) {
  return (
    <div className="bg-background/30 rounded-lg border border-border/50 p-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-display uppercase tracking-wider text-muted-foreground">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onEdit(stepIndex)}
        >
          <Edit2 className="w-3 h-3 mr-1" />
          Edit
        </Button>
      </div>
      {children}
    </div>
  );
}

export function SummaryStep({ state, onEditStep, onComplete }: SummaryStepProps) {
  const PortraitIcon = ICON_COMPONENTS[state.portraitIcon];
  const abilityPoints = getAbilityPointsForLevel(state.level);
  
  const conMod = useMemo(() => scoreToModifier(state.abilityScores.constitution), [state.abilityScores.constitution]);
  const hpBreakdown = useMemo(() => getHPBreakdown(state.level, conMod, 0), [state.level, conMod]);
  
  const xpConfig = XP_PRESETS[state.xpPreset];
  const diceConfig = DICE_ODDS_CONFIGS[state.diceOddsMode];

  // Check if character is valid
  const isValid = state.name.trim().length >= 2;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${wizardBackground})` }}
      />
      <div className="fixed inset-0 bg-background/50 -z-10" />
      
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-display font-bold text-foreground">Character Summary</h2>
          <p className="text-sm text-muted-foreground mt-1">Review your assassin before beginning your adventure</p>
        </div>

        <div className="parchment-bg rounded-lg border border-border p-4 space-y-4">
          {/* Character Header */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/20 to-transparent rounded-lg border border-primary/30">
            <div className="w-16 h-16 rounded-full bg-card border-2 border-primary flex items-center justify-center glow-gold">
              <PortraitIcon className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-display font-bold text-foreground">
                {state.name || 'Unnamed Assassin'}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-primary font-display">Level {state.level}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="flex items-center gap-1 text-sm text-destructive">
                  <Heart className="w-3 h-3" />
                  {hpBreakdown.totalHP} HP
                </span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="flex items-center gap-1 text-sm text-primary">
                  <Sparkles className="w-3 h-3" />
                  {abilityPoints} pts
                </span>
              </div>
            </div>
          </div>

          {/* Ability Scores */}
          <SummarySection title="Ability Scores" stepIndex={1} onEdit={onEditStep}>
            <div className="grid grid-cols-6 gap-2">
              {ABILITY_ORDER.map((ability) => {
                const config = ABILITY_CONFIG[ability];
                const score = state.abilityScores[ability];
                const modifier = scoreToModifier(score);
                
                return (
                  <div key={ability} className="text-center">
                    <p className={cn("text-[10px] font-display uppercase", config.color)}>
                      {config.abbr}
                    </p>
                    <p className="text-lg font-display font-bold text-foreground">{score}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {modifierToString(modifier)}
                    </p>
                  </div>
                );
              })}
            </div>
          </SummarySection>

          {/* Game Mode */}
          <SummarySection title="Game Mode" stepIndex={2} onEdit={onEditStep}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {state.gameMode === 'infinityPool' ? (
                  <Infinity className="w-4 h-4 text-primary" />
                ) : (
                  <Shield className="w-4 h-4 text-accent" />
                )}
                <span className="font-display font-semibold text-foreground">
                  {state.gameMode === 'infinityPool' ? 'Infinity Pool' : 'Honest Mode'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  {xpConfig.label}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {diceConfig.label}
                </span>
              </div>
            </div>
          </SummarySection>

          {/* Magic Path */}
          <SummarySection title="Magic Path" stepIndex={3} onEdit={onEditStep}>
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">
                {state.selectedPath 
                  ? MAGIC_PATHS[state.selectedPath].name 
                  : 'No Magic (Pure Martial)'}
              </span>
              {state.selectedPath && (
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/30">
                  {MAGIC_PATHS[state.selectedPath].spellcastingAbility}
                </span>
              )}
            </div>
          </SummarySection>

          {/* Skill Trees */}
          <SummarySection title="Skill Trees" stepIndex={4} onEdit={onEditStep}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">
                {state.starterAbilities.length > 0 
                  ? `${state.starterAbilities.length} starter abilities selected`
                  : 'Allocate points after creation'}
              </span>
              <span className="text-xs text-primary px-2 py-0.5 rounded bg-primary/10">
                {abilityPoints} pts available
              </span>
            </div>
          </SummarySection>

          {/* Equipment */}
          <SummarySection title="Equipment" stepIndex={5} onEdit={onEditStep}>
            {(() => {
              const preset = state.selectedPresetId ? getPresetById(state.selectedPresetId) : null;
              return (
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    {preset ? preset.name : 'Default Equipment'}
                  </span>
                  {preset && preset.id !== 'custom' && (
                    <>
                      <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/30">
                        AC {preset.totalAC}
                      </span>
                      <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/30">
                        {preset.primaryDamage}
                      </span>
                    </>
                  )}
                </div>
              );
            })()}</SummarySection>

          {/* Begin Adventure Button */}
          <Button
            onClick={onComplete}
            disabled={!isValid}
            size="lg"
            className="w-full font-display uppercase tracking-wider text-lg py-6"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Begin Adventure
          </Button>

          {!isValid && (
            <p className="text-center text-xs text-destructive">
              Please enter a valid character name (at least 2 characters)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
