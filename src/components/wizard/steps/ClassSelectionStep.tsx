// Class Selection Step for Character Wizard
// Allows players to choose their primary D&D class

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { WizardState, CLASS_SUGGESTED_ARRAYS } from '../types';
import { CLASS_REGISTRY, getAllClasses, ClassConfig, DnDClass } from '@/lib/classes';
import { 
  BookOpen, 
  Flame, 
  Moon, 
  Cross, 
  Leaf, 
  Music, 
  Skull,
  LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ClassSelectionStepProps {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

// Map icon names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Skull,
  BookOpen,
  Flame,
  Moon,
  Cross,
  Leaf,
  Music,
};

function getClassIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Skull;
}

// Get theme color class for a class
function getThemeClasses(themeColor: string, isSelected: boolean) {
  const colorMap: Record<string, { border: string; bg: string; text: string }> = {
    'primary': { 
      border: 'border-primary', 
      bg: 'bg-primary/10', 
      text: 'text-primary' 
    },
    'blue-500': { 
      border: 'border-blue-500', 
      bg: 'bg-blue-500/10', 
      text: 'text-blue-400' 
    },
    'red-500': { 
      border: 'border-red-500', 
      bg: 'bg-red-500/10', 
      text: 'text-red-400' 
    },
    'purple-600': { 
      border: 'border-purple-600', 
      bg: 'bg-purple-600/10', 
      text: 'text-purple-400' 
    },
    'yellow-500': { 
      border: 'border-yellow-500', 
      bg: 'bg-yellow-500/10', 
      text: 'text-yellow-400' 
    },
    'green-600': { 
      border: 'border-green-600', 
      bg: 'bg-green-600/10', 
      text: 'text-green-400' 
    },
    'pink-500': { 
      border: 'border-pink-500', 
      bg: 'bg-pink-500/10', 
      text: 'text-pink-400' 
    },
  };

  const colors = colorMap[themeColor] ?? colorMap['primary'];
  
  if (isSelected) {
    return `${colors.border} ${colors.bg}`;
  }
  return 'border-border hover:border-primary/50';
}

interface ClassCardProps {
  config: ClassConfig;
  selected: boolean;
  onSelect: () => void;
}

function ClassCard({ config, selected, onSelect }: ClassCardProps) {
  const Icon = getClassIcon(config.iconName);
  const themeClasses = getThemeClasses(config.themeColor, selected);

  // Get spellcasting info
  const getSpellcastingLabel = () => {
    switch (config.spellcasting.type) {
      case 'full': return 'Full Caster';
      case 'pact': return 'Pact Magic';
      case 'none': return 'MagicPath';
      default: return config.spellcasting.type;
    }
  };

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative p-4 rounded-lg border-2 transition-all text-left",
        "flex flex-col gap-2",
        themeClasses
      )}
    >
      {/* Selected indicator */}
      {selected && (
        <motion.div
          layoutId="selectedClass"
          className="absolute inset-0 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
          initial={false}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}

      {/* Icon and Name */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-md",
          selected ? "bg-primary/20" : "bg-muted"
        )}>
          <Icon className={cn("w-6 h-6", selected ? "text-primary" : "text-muted-foreground")} />
        </div>
        <div>
          <h3 className="font-bold text-foreground">{config.name}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{config.hitDie}</span>
            <span>•</span>
            <span>{config.primaryAbility.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Spellcasting Badge */}
      <Badge 
        variant="secondary" 
        className={cn(
          "w-fit text-xs",
          config.spellcasting.type === 'none' && "bg-muted text-muted-foreground"
        )}
      >
        {getSpellcastingLabel()} ({config.spellcasting.ability})
      </Badge>

      {/* Flavor Text */}
      <p className="text-xs text-muted-foreground line-clamp-2">
        {config.flavorText}
      </p>
    </motion.button>
  );
}

export function ClassSelectionStep({ state, onChange }: ClassSelectionStepProps) {
  const classes = getAllClasses();

  const handleSelectClass = (classId: DnDClass) => {
    // Update primary class
    onChange({ primaryClass: classId });

    // Optionally suggest optimized ability scores for the class
    // (User can still customize in next step)
    if (state.scoreGenerationMethod === 'standard') {
      const suggested = CLASS_SUGGESTED_ARRAYS[classId];
      if (suggested) {
        onChange({ abilityScores: suggested });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Choose Your Class</h2>
        <p className="text-muted-foreground">
          Select your primary class. This determines your hit die, spellcasting, and core abilities.
        </p>
      </div>

      {/* Info Banner for Rogue */}
      <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
        <strong className="text-foreground">Odyssey Assassin (Rogue)</strong> is the original class with 
        the Hunter, Warrior, and Assassin skill trees. Other classes use D&D 5e spellcasting.
      </div>

      {/* Class Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(config => (
          <ClassCard
            key={config.id}
            config={config}
            selected={state.primaryClass === config.id}
            onSelect={() => handleSelectClass(config.id)}
          />
        ))}
      </div>

      {/* Selected Class Info */}
      {state.primaryClass && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4 space-y-2"
        >
          <h3 className="font-semibold text-foreground">
            Selected: {CLASS_REGISTRY[state.primaryClass].name}
          </h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <strong>Hit Die:</strong> {CLASS_REGISTRY[state.primaryClass].hitDie} 
              (Max {CLASS_REGISTRY[state.primaryClass].hitDieMax} HP at level 1)
            </p>
            <p>
              <strong>Primary Ability:</strong> {CLASS_REGISTRY[state.primaryClass].primaryAbility.charAt(0).toUpperCase() + CLASS_REGISTRY[state.primaryClass].primaryAbility.slice(1)}
            </p>
            {state.primaryClass === 'rogue' && (
              <p className="text-primary">
                → You'll choose a Magic Path in a later step (Arcane Trickster, Hexblade, etc.)
              </p>
            )}
            {state.primaryClass !== 'rogue' && (
              <p className="text-primary">
                → Full spellcasting with {CLASS_REGISTRY[state.primaryClass].spellcasting.ability}-based magic
              </p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
