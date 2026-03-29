// Class Level Badge Component
// Displays class icon, name, and level in a compact badge format
import { isEmpyreanMode, EMPYREAN_CLASS_LABELS } from '@/lib/empyreanLabels';

import { cn } from '@/lib/utils';
import { DnDClass, ClassLevelMap, CLASS_REGISTRY, calculateTotalLevel } from '@/lib/classes';
import { getIconByName } from '@/lib/iconUtils';
import { Badge } from '@/components/ui/badge';

interface ClassLevelBadgeProps {
  primaryClass: DnDClass;
  primaryLevel: number;
  multiclassLevels?: ClassLevelMap;
  size?: 'sm' | 'md' | 'lg';
  showTotalLevel?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: {
    badge: 'px-2 py-0.5 text-xs gap-1',
    icon: 'w-3 h-3',
    text: 'text-xs',
  },
  md: {
    badge: 'px-3 py-1 text-sm gap-1.5',
    icon: 'w-4 h-4',
    text: 'text-sm',
  },
  lg: {
    badge: 'px-4 py-1.5 text-base gap-2',
    icon: 'w-5 h-5',
    text: 'text-base',
  },
};

export function ClassLevelBadge({
  primaryClass,
  primaryLevel,
  multiclassLevels = {},
  size = 'md',
  showTotalLevel = false,
  className,
}: ClassLevelBadgeProps) {
  const classConfig = CLASS_REGISTRY[primaryClass];
  const Icon = getIconByName(classConfig.iconName);
  const styles = sizeStyles[size];
  
  const totalLevel = showTotalLevel 
    ? calculateTotalLevel(primaryLevel, multiclassLevels)
    : primaryLevel;

  // Get all active classes for display
  const activeClasses: { id: DnDClass; name: string; level: number; color: string; iconName: string }[] = [
    { 
      id: primaryClass, 
      name: classConfig.name, 
      level: primaryLevel,
      color: classConfig.themeColor,
      iconName: classConfig.iconName,
    }
  ];

  // Add multiclasses
  for (const [classId, level] of Object.entries(multiclassLevels)) {
    if (level && level > 0) {
      const mcConfig = CLASS_REGISTRY[classId as DnDClass];
      activeClasses.push({
        id: classId as DnDClass,
        name: mcConfig.name,
        level,
        color: mcConfig.themeColor,
        iconName: mcConfig.iconName,
      });
    }
  }

  const isMulticlassed = activeClasses.length > 1;

  // Single class display
  if (!isMulticlassed) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border font-display',
          styles.badge,
          className
        )}
        style={{
          borderColor: `var(--${classConfig.themeColor}, hsl(var(--primary)))`,
          backgroundColor: `hsl(var(--${classConfig.themeColor}) / 0.1)`,
          color: `var(--${classConfig.themeColor}, hsl(var(--primary)))`,
        }}
      >
        <Icon className={styles.icon} />
        <span className={cn('font-semibold', styles.text)}>
          {classConfig.name}
        </span>
        <span className="opacity-70">
          Lvl {totalLevel}
        </span>
      </Badge>
    );
  }

  // Multiclass display - show all classes
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {activeClasses.map((cls) => {
        const ClsIcon = getIconByName(cls.iconName);
        return (
          <Badge
            key={cls.id}
            variant="outline"
            className={cn(
              'border font-display',
              size === 'sm' ? 'px-1.5 py-0.5 text-[10px] gap-0.5' : 'px-2 py-0.5 text-xs gap-1'
            )}
            style={{
              borderColor: `var(--${cls.color}, hsl(var(--primary)))`,
              backgroundColor: `hsl(var(--${cls.color}) / 0.1)`,
              color: `var(--${cls.color}, hsl(var(--primary)))`,
            }}
          >
            <ClsIcon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span className="font-semibold">{cls.name}</span>
            <span className="opacity-70">{cls.level}</span>
          </Badge>
        );
      })}
      {showTotalLevel && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
          Total: {totalLevel}
        </Badge>
      )}
    </div>
  );
}
