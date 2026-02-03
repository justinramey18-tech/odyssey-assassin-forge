import { cn } from '@/lib/utils';
import { SpellDefinition } from '@/lib/magic/types';
import { 
  Crosshair, 
  ShieldAlert, 
  Eye, 
  BookOpen, 
  Flame, 
  Heart,
  Zap,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SpellStatusIconsProps {
  spell: SpellDefinition;
  characterLevel?: number;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SpellStatusIcons({
  spell,
  characterLevel = 1,
  showLabels = false,
  size = 'sm',
  className,
}: SpellStatusIconsProps) {
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-[8px]' : size === 'md' ? 'text-[10px]' : 'text-xs';
  
  const icons: Array<{
    key: string;
    icon: typeof Crosshair;
    color: string;
    bgColor: string;
    label: string;
    tooltip: string;
    show: boolean;
  }> = [
    {
      key: 'attack',
      icon: Crosshair,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      label: 'Attack',
      tooltip: `Spell Attack (${spell.attackType === 'melee' ? 'Melee' : 'Ranged'})`,
      show: spell.attackType === 'melee' || spell.attackType === 'ranged',
    },
    {
      key: 'save',
      icon: ShieldAlert,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      label: spell.saveStat || 'Save',
      tooltip: `Target makes ${spell.saveStat} saving throw`,
      show: spell.attackType === 'save' && !!spell.saveStat,
    },
    {
      key: 'concentration',
      icon: Eye,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      label: 'Conc.',
      tooltip: 'Requires Concentration',
      show: !!spell.concentration,
    },
    {
      key: 'ritual',
      icon: BookOpen,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/20',
      label: 'Ritual',
      tooltip: 'Can be cast as Ritual (+10 min, no slot)',
      show: !!spell.ritual,
    },
    {
      key: 'damage',
      icon: Flame,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      label: spell.damageType || 'DMG',
      tooltip: `Deals ${spell.damageFormula} ${spell.damageType} damage`,
      show: !!spell.damageFormula && !!spell.damageType,
    },
    {
      key: 'healing',
      icon: Heart,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      label: 'Heal',
      tooltip: `Heals ${spell.healingFormula}`,
      show: !!spell.healingFormula,
    },
    {
      key: 'bonus',
      icon: Zap,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      label: 'Bonus',
      tooltip: 'Cast as Bonus Action',
      show: spell.castingTime === 'bonus_action',
    },
    {
      key: 'reaction',
      icon: Sparkles,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      label: 'React',
      tooltip: 'Cast as Reaction',
      show: spell.castingTime === 'reaction',
    },
    {
      key: 'scaled',
      icon: TrendingUp,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      label: 'Scaled',
      tooltip: 'Cantrip damage scaled with character level',
      show: spell.level === 0 && characterLevel >= 5 && !!spell.damageFormula,
    },
  ];
  
  const visibleIcons = icons.filter(i => i.show);
  
  if (visibleIcons.length === 0) return null;
  
  return (
    <TooltipProvider>
      <div className={cn("flex flex-wrap items-center gap-1", className)}>
        {visibleIcons.map(({ key, icon: Icon, color, bgColor, label, tooltip }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
                bgColor
              )}>
                <Icon className={cn(iconSize, color)} />
                {showLabels && (
                  <span className={cn(textSize, color, "font-medium")}>
                    {label}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
