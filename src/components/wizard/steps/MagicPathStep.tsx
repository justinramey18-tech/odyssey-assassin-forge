import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { WizardState, StepValidation } from '../types';
import { MagicPath, PathConfig } from '@/lib/magic/types';
import { MAGIC_PATHS, isPathAvailable } from '@/lib/magic/paths';
import { 
  Wand2, 
  Moon, 
  Shield, 
  Skull, 
  XCircle, 
  Lock,
  Sparkles,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreToModifier } from '@/lib/abilityScores/types';
import { ValidationFeedback } from '../ValidationFeedback';
import wizardBackground from '@/assets/wizard-background.jpg';

interface MagicPathStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<Pick<WizardState, 'selectedPath'>>) => void;
  validation?: StepValidation;
}

// Map path IDs to icons
const PATH_ICONS: Record<MagicPath | 'none', React.ReactNode> = {
  arcane_trickster: <Wand2 className="w-6 h-6" />,
  shadow_blade: <Moon className="w-6 h-6" />,
  eldritch_knight: <Shield className="w-6 h-6" />,
  hexblade: <Skull className="w-6 h-6" />,
  none: <XCircle className="w-6 h-6" />,
};

// Path color schemes
const PATH_COLORS: Record<MagicPath | 'none', { bg: string; border: string; glow: string }> = {
  arcane_trickster: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/50',
    glow: 'shadow-emerald-500/20',
  },
  shadow_blade: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/50',
    glow: 'shadow-violet-500/20',
  },
  eldritch_knight: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/50',
    glow: 'shadow-blue-500/20',
  },
  hexblade: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/50',
    glow: 'shadow-rose-500/20',
  },
  none: {
    bg: 'bg-muted/20',
    border: 'border-muted/50',
    glow: '',
  },
};

export function MagicPathStep({ state, onUpdate, validation }: MagicPathStepProps) {
  const { level, abilityScores, selectedPath } = state;

  // Calculate spell modifiers for preview
  const modifiers = useMemo(() => ({
    int: scoreToModifier(abilityScores.intelligence),
    cha: scoreToModifier(abilityScores.charisma),
    wis: scoreToModifier(abilityScores.wisdom),
  }), [abilityScores]);

  // Get available paths based on level
  const pathOptions = useMemo(() => {
    const paths = Object.values(MAGIC_PATHS).map(path => ({
      ...path,
      isAvailable: isPathAvailable(path.id, level),
      modifier: path.spellcastingAbility === 'INT' ? modifiers.int 
        : path.spellcastingAbility === 'CHA' ? modifiers.cha 
        : modifiers.wis,
    }));
    return paths;
  }, [level, modifiers]);

  const handleSelectPath = (pathId: MagicPath | null) => {
    onUpdate({ selectedPath: pathId });
  };

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
            Magic Path
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose your spellcasting tradition (optional)
          </p>
        </div>

        {/* Level Warning */}
        {level < 3 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-400 text-center">
              <Lock className="w-3 h-3 inline mr-1" />
              Most paths require Level 3+. Only Hexblade is available at Level {level}.
            </p>
          </div>
        )}

        {/* Path Cards */}
        <div className="space-y-3 mb-4">
          {pathOptions.map((path) => (
            <PathCard
              key={path.id}
              path={path}
              isSelected={selectedPath === path.id}
              isAvailable={path.isAvailable}
              modifier={path.modifier}
              level={level}
              onSelect={() => path.isAvailable && handleSelectPath(path.id)}
            />
          ))}

          {/* No Magic Option */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelectPath(null)}
            className={cn(
              "w-full p-4 rounded-lg border-2 transition-all text-left",
              selectedPath === null
                ? "border-primary bg-primary/10 shadow-lg"
                : "border-border bg-card/50 hover:border-muted-foreground/50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                selectedPath === null ? "bg-primary/20" : "bg-muted/30"
              )}>
                {PATH_ICONS.none}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display font-bold text-foreground">No Magic</p>
                  {selectedPath === null && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pure martial build - rely on skill and steel
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Selected Path Preview */}
        {selectedPath && (
          <SelectedPathPreview 
            path={MAGIC_PATHS[selectedPath]} 
            level={level}
            modifier={
              MAGIC_PATHS[selectedPath].spellcastingAbility === 'INT' ? modifiers.int 
              : MAGIC_PATHS[selectedPath].spellcastingAbility === 'CHA' ? modifiers.cha 
              : modifiers.wis
            }
          />
        )}

        {/* Validation Feedback */}
        {validation && (validation.warnings.length > 0 || validation.errors.length > 0) && (
          <ValidationFeedback validation={validation} compact className="mt-4" />
        )}
      </div>
    </div>
  );
}

interface PathCardProps {
  path: PathConfig & { isAvailable: boolean; modifier: number };
  isSelected: boolean;
  isAvailable: boolean;
  modifier: number;
  level: number;
  onSelect: () => void;
}

function PathCard({ path, isSelected, isAvailable, modifier, level, onSelect }: PathCardProps) {
  const colors = PATH_COLORS[path.id];

  return (
    <motion.button
      whileTap={isAvailable ? { scale: 0.98 } : undefined}
      onClick={onSelect}
      disabled={!isAvailable}
      className={cn(
        "w-full p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden",
        isAvailable 
          ? isSelected
            ? `${colors.border} ${colors.bg} shadow-lg ${colors.glow}`
            : "border-border bg-card/50 hover:border-muted-foreground/50"
          : "border-muted/30 bg-muted/10 opacity-60 cursor-not-allowed"
      )}
    >
      {/* Lock Overlay for Unavailable Paths */}
      {!isAvailable && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] z-10">
          <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-full">
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">Level 3+</span>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
          isSelected ? colors.bg : "bg-muted/30"
        )}>
          {PATH_ICONS[path.id]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-display font-bold text-foreground">{path.name}</p>
            {isSelected && <Check className="w-4 h-4 text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {path.subtitle}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[10px]">
            <span className="px-2 py-0.5 rounded bg-muted/30">
              {path.spellcastingAbility} ({modifier >= 0 ? '+' : ''}{modifier})
            </span>
            <span className="px-2 py-0.5 rounded bg-muted/30">
              {path.slotProgression === 'third' ? '⅓ Caster' 
                : path.slotProgression === 'half' ? '½ Caster' 
                : 'Pact Magic'}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

interface SelectedPathPreviewProps {
  path: PathConfig;
  level: number;
  modifier: number;
}

function SelectedPathPreview({ path, level, modifier }: SelectedPathPreviewProps) {
  // Calculate spell slots based on progression
  const getSpellSlots = () => {
    if (path.slotProgression === 'pact') {
      // Warlock pact magic
      if (level >= 11) return { slots: 3, level: 5 };
      if (level >= 5) return { slots: 2, level: Math.min(5, Math.ceil(level / 2)) };
      if (level >= 2) return { slots: 2, level: 1 };
      return { slots: 1, level: 1 };
    }
    
    // Third caster (Arcane Trickster, Eldritch Knight)
    const casterLevel = Math.floor(level / 3);
    if (casterLevel < 1) return { slots: 0, level: 0 };
    
    return {
      slots: casterLevel >= 3 ? 3 : casterLevel >= 2 ? 2 : 2,
      level: Math.min(4, Math.ceil(casterLevel / 2)),
    };
  };

  const spellInfo = getSpellSlots();
  const profBonus = Math.floor((level - 1) / 4) + 2;
  const spellSaveDC = 8 + profBonus + modifier;
  const spellAttack = profBonus + modifier;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-lg border border-primary/30 bg-primary/5"
    >
      <h3 className="font-display text-sm font-bold text-primary mb-3">
        {path.name} at Level {level}
      </h3>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-foreground">{spellSaveDC}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Spell DC</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">
            {spellAttack >= 0 ? '+' : ''}{spellAttack}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Spell Attack</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">
            {spellInfo.slots > 0 ? `${spellInfo.slots}×L${spellInfo.level}` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Slots</p>
        </div>
      </div>
      {path.spellListRestrictions && (
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          Schools: {path.spellListRestrictions.map(s => 
            s.charAt(0).toUpperCase() + s.slice(1)
          ).join(', ')}
        </p>
      )}
    </motion.div>
  );
}
