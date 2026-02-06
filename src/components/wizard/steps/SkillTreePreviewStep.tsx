import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { WizardState, StepValidation } from '../types';
import { AbilityTree, getAbilityPointsForLevel } from '@/lib/types';
import { TREE_VISUAL_CONFIG } from '@/lib/abilityTrees/colors';
import { Target, Swords, Eye, Sparkles, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ValidationFeedback } from '../ValidationFeedback';
import wizardBackground from '@/assets/wizard-background.jpg';

interface SkillTreePreviewStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<Pick<WizardState, 'starterAbilities'>>) => void;
  validation?: StepValidation;
}

// Tree lore and synergies
const TREE_INFO: Record<AbilityTree, {
  description: string;
  synergies: string;
  playstyle: string;
}> = {
  hunter: {
    description: 'Master of ranged combat and keen perception. Strike from the shadows before enemies know you\'re there.',
    synergies: 'Pairs well with Arcane Trickster for enhanced stealth magic',
    playstyle: 'Ranged DPS, Scouting, Trap Detection',
  },
  warrior: {
    description: 'Frontline combat specialist with unmatched resilience. Hold the line and protect your allies.',
    synergies: 'Pairs well with Eldritch Knight for magical defenses',
    playstyle: 'Tank, Melee DPS, Crowd Control',
  },
  assassin: {
    description: 'The art of the perfect kill. Critical strikes and devastating sneak attacks.',
    synergies: 'Pairs well with Shadow Blade for shadow-infused lethality',
    playstyle: 'Burst Damage, Stealth, Single-Target Elimination',
  },
};

// Icon mapping
const TREE_ICONS: Record<AbilityTree, React.ReactNode> = {
  hunter: <Target className="w-6 h-6" />,
  warrior: <Swords className="w-6 h-6" />,
  assassin: <Eye className="w-6 h-6" />,
};

export function SkillTreePreviewStep({ state, onUpdate, validation }: SkillTreePreviewStepProps) {
  const { level } = state;

  // Calculate available points at this level
  const availablePoints = useMemo(() => getAbilityPointsForLevel(level), [level]);

  const trees: AbilityTree[] = ['hunter', 'warrior', 'assassin'];

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${wizardBackground})` }}
      />
      <div className="fixed inset-0 bg-background/70 -z-10" />

      <div className="container max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 border border-primary/30 mb-3">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            Skill Trees
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Preview your assassin's ability paths
          </p>
        </div>

        {/* Points Preview */}
        <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/30 text-center">
          <p className="text-3xl font-display font-bold text-primary glow-gold">
            {availablePoints}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
            Ability Points at Level {level}
          </p>
        </div>

        {/* Tree Cards */}
        <div className="space-y-4 mb-6">
          {trees.map((tree) => (
            <TreePreviewCard key={tree} tree={tree} />
          ))}
        </div>

        {/* Info Note */}
        <div className="p-3 rounded-lg bg-muted/20 border border-muted/30">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Spend your ability points in the <strong>Abilities</strong> tab after character creation. 
              Each tree offers unique playstyles—experiment to find your perfect build!
            </p>
          </div>
        </div>

        {/* Validation Feedback */}
        {validation && (validation.warnings.length > 0 || validation.errors.length > 0) && (
          <ValidationFeedback validation={validation} compact className="mt-4" />
        )}
      </div>
    </div>
  );
}

interface TreePreviewCardProps {
  tree: AbilityTree;
}

function TreePreviewCard({ tree }: TreePreviewCardProps) {
  const config = TREE_VISUAL_CONFIG[tree];
  const info = TREE_INFO[tree];

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className={cn(
        "p-4 rounded-lg border-2 transition-all",
        `border-${config.primary}/30 bg-gradient-to-br ${config.gradient}`
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
          `bg-${config.primary}/20`
        )}>
          <span className={`text-${config.primary}`}>
            {TREE_ICONS[tree]}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={cn("font-display font-bold", `text-${config.primary}`)}>
              {config.name}
            </h3>
            <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-muted/30">
              {config.subtitle}
            </span>
          </div>
          
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {info.description}
          </p>

          {/* Playstyle Tags */}
          <div className="flex flex-wrap gap-1">
            {info.playstyle.split(', ').map((style) => (
              <span 
                key={style}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full",
                  `bg-${config.primary}/10 text-${config.primary}`
                )}
              >
                {style}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Synergy Hint */}
      <div className="mt-3 pt-3 border-t border-muted/20">
        <p className="text-[10px] text-muted-foreground italic">
          💡 {info.synergies}
        </p>
      </div>
    </motion.div>
  );
}
