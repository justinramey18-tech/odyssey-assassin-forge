import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Timer, Save, Hourglass, Infinity as InfinityIcon, Focus, LucideIcon, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getIconByName } from '@/lib/iconUtils';
import {
  ActiveCondition,
  formatDuration,
  SEVERITY_COLORS,
  CATEGORY_COLORS,
  generateConditionPrompt,
} from '@/lib/conditions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ConditionCardProps {
  condition: ActiveCondition;
  onRemove: (id: string) => void;
  onTap?: (condition: ActiveCondition) => void;
  compact?: boolean;
  characterName?: string;
}

export function ConditionCard({
  condition,
  onRemove,
  onTap,
  compact = false,
  characterName,
}: ConditionCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const Icon = getIconByName(getIconForCondition(condition));
  const severityColors = SEVERITY_COLORS[condition.severity];
  const categoryColors = CATEGORY_COLORS[condition.category];

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(condition.id);
    },
    [condition.id, onRemove]
  );

  const handleTap = useCallback(() => {
    onTap?.(condition);
  }, [condition, onTap]);

  const handleCopyPrompt = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      
      const prompt = generateConditionPrompt(
        condition.conditionId,
        condition.name,
        condition.category,
        condition.severity,
        condition.source,
        characterName
      );
      
      navigator.clipboard.writeText(prompt).then(() => {
        setCopied(true);
        toast({
          title: 'Prompt Copied',
          description: `AI DM prompt for ${condition.name} copied to clipboard`,
          duration: 2000,
        });
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        toast({
          title: 'Copy Failed',
          description: 'Unable to copy to clipboard',
          variant: 'destructive',
        });
      });
    },
    [condition, characterName, toast]
  );

  // Get duration icon based on type
  const DurationIcon = getDurationIcon(condition.durationType);

  // Animation variants based on severity
  const severityVariants = {
    minor: {},
    moderate: {
      boxShadow: [
        '0 0 0 0 rgba(251, 191, 36, 0)',
        '0 0 8px 2px rgba(251, 191, 36, 0.3)',
        '0 0 0 0 rgba(251, 191, 36, 0)',
      ],
    },
    severe: {
      boxShadow: [
        '0 0 0 0 rgba(239, 68, 68, 0)',
        '0 0 12px 4px rgba(239, 68, 68, 0.4)',
        '0 0 0 0 rgba(239, 68, 68, 0)',
      ],
    },
  };

  // Get duration icon component
  const DurationIconComponent = DurationIcon;

  if (compact) {
    return (
      <motion.button
        onClick={handleTap}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full',
          'border backdrop-blur-sm touch-manipulation',
          'min-h-[32px] text-xs font-medium',
          severityColors.bg,
          severityColors.border,
          severityColors.text
        )}
        whileTap={{ scale: 0.95 }}
        animate={
          condition.severity !== 'minor'
            ? severityVariants[condition.severity]
            : undefined
        }
        transition={{
          repeat: Infinity,
          duration: condition.severity === 'severe' ? 1.5 : 2.5,
        }}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="truncate max-w-[80px]">{condition.name}</span>
        {condition.durationType !== 'indefinite' && (
          <span className="opacity-70 text-[10px]">
            {condition.durationType === 'save_ends'
              ? 'Save'
              : condition.durationValue}
          </span>
        )}
      </motion.button>
    );
  }

  return (
    <motion.div
      onClick={handleTap}
      className={cn(
        'relative flex items-center gap-3 p-3 rounded-lg',
        'border backdrop-blur-sm cursor-pointer touch-manipulation',
        'min-h-[48px]', // 48px touch target
        categoryColors.bg,
        categoryColors.border,
        condition.category === 'concentration' && 'ring-1 ring-amber-400/50'
      )}
      whileTap={{ scale: 0.98 }}
      animate={
        condition.severity !== 'minor'
          ? severityVariants[condition.severity]
          : undefined
      }
      transition={{
        repeat: Infinity,
        duration: condition.severity === 'severe' ? 1.5 : 2.5,
      }}
      layout
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-full',
          severityColors.bg,
          'border',
          severityColors.border
        )}
      >
        <Icon className={cn('w-4.5 h-4.5', severityColors.icon)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-semibold text-sm truncate',
              categoryColors.text
            )}
          >
            {condition.name}
          </span>
          {condition.category === 'concentration' && (
            <Focus className="w-3 h-3 text-amber-400 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <DurationIconComponent className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {formatDuration(condition.durationType, condition.durationValue)}
          </span>
          {condition.saveType && condition.saveDC && (
            <span className="text-xs text-muted-foreground">
              • DC {condition.saveDC} {condition.saveType}
            </span>
          )}
        </div>

        {condition.source && (
          <span className="text-[10px] text-muted-foreground/70 truncate block mt-0.5">
            From: {condition.source}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Copy prompt button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopyPrompt}
          className={cn(
            'h-8 w-8 rounded-full flex-shrink-0',
            'hover:bg-primary/20 hover:text-primary',
            copied && 'text-emerald-400'
          )}
          title="Copy AI DM Prompt"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>

        {/* Remove button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          className={cn(
            'h-8 w-8 rounded-full flex-shrink-0',
            'hover:bg-destructive/20 hover:text-destructive'
          )}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// Helper to get appropriate icon for condition
function getIconForCondition(condition: ActiveCondition): string {
  // Use condition's stored icon from config, or fallback
  const configMatch = {
    paralyzed: 'Zap',
    petrified: 'Mountain',
    stunned: 'Star',
    unconscious: 'Moon',
    blinded: 'EyeOff',
    frightened: 'Ghost',
    incapacitated: 'Ban',
    poisoned: 'Skull',
    restrained: 'Link',
    charmed: 'Heart',
    deafened: 'VolumeX',
    grappled: 'Hand',
    prone: 'ArrowDown',
    invisible: 'Eye',
    blessed: 'Sparkles',
    hasted: 'Zap',
    invisible_self: 'Eye',
    bardic_inspiration: 'Music',
    guidance: 'Compass',
    shield_of_faith: 'Shield',
    mirror_image: 'Users',
    hunters_mark: 'Target',
    hex: 'Flame',
  };

  return (
    configMatch[condition.conditionId as keyof typeof configMatch] ||
    'HelpCircle'
  );
}

// Helper to get duration icon
function getDurationIcon(durationType: ActiveCondition['durationType']): LucideIcon {
  switch (durationType) {
    case 'rounds':
      return Timer;
    case 'minutes':
    case 'hours':
      return Hourglass;
    case 'save_ends':
      return Save;
    case 'indefinite':
      return InfinityIcon;
    default:
      return Timer;
  }
}
