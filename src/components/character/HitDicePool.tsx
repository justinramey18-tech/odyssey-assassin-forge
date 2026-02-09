// Hit Dice Pool Component
// Displays available hit dice for short rest healing

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DnDClass, ClassLevelMap, CLASS_REGISTRY, HitDie } from '@/lib/classes';
import { formatHitDicePool, HIT_DIE_MAX } from '@/lib/classes/hitDice';
import { getIconByName } from '@/lib/iconUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dices, Heart, Minus, Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HitDicePoolProps {
  primaryClass: DnDClass;
  primaryLevel: number;
  multiclassLevels?: ClassLevelMap;
  constitutionModifier?: number;
  currentHP?: number;
  maxHP?: number;
  onHeal?: (amount: number) => void;
  onLongRest?: () => void;
  compact?: boolean;
  className?: string;
}

interface TrackedHitDice {
  die: HitDie;
  max: number;
  current: number;
  classId: DnDClass;
}

export function HitDicePool({
  primaryClass,
  primaryLevel,
  multiclassLevels = {},
  constitutionModifier = 0,
  currentHP,
  maxHP,
  onHeal,
  onLongRest,
  compact = false,
  className,
}: HitDicePoolProps) {
  const { toast } = useToast();

  // Calculate hit dice pool
  const initialPool = useMemo(() => {
    const pool: TrackedHitDice[] = [];
    
    // Primary class hit dice
    const primaryConfig = CLASS_REGISTRY[primaryClass];
    pool.push({
      die: primaryConfig.hitDie,
      max: primaryLevel,
      current: primaryLevel,
      classId: primaryClass,
    });
    
    // Multiclass hit dice
    for (const [classId, level] of Object.entries(multiclassLevels)) {
      if (level && level > 0) {
        const mcConfig = CLASS_REGISTRY[classId as DnDClass];
        pool.push({
          die: mcConfig.hitDie,
          max: level,
          current: level,
          classId: classId as DnDClass,
        });
      }
    }
    
    return pool;
  }, [primaryClass, primaryLevel, multiclassLevels]);

  const [hitDice, setHitDice] = useState<TrackedHitDice[]>(initialPool);

  // Format for display
  const displayPool = useMemo(() => {
    const poolRecord: Record<HitDie, number> = {
      'd6': 0,
      'd8': 0,
      'd10': 0,
      'd12': 0,
    };
    
    for (const hd of hitDice) {
      poolRecord[hd.die] += hd.current;
    }
    
    return formatHitDicePool(poolRecord);
  }, [hitDice]);

  const totalHitDice = hitDice.reduce((sum, hd) => sum + hd.current, 0);
  const maxHitDice = hitDice.reduce((sum, hd) => sum + hd.max, 0);

  // Roll a hit die
  const rollHitDie = (index: number) => {
    const hd = hitDice[index];
    if (hd.current <= 0) {
      toast({
        title: 'No Hit Dice',
        description: `No ${hd.die} hit dice remaining.`,
        variant: 'destructive',
      });
      return;
    }

    // Roll the die
    const dieMax = HIT_DIE_MAX[hd.die];
    const roll = Math.floor(Math.random() * dieMax) + 1;
    const healing = Math.max(1, roll + constitutionModifier);

    // Use the hit die
    setHitDice(prev => prev.map((d, i) => 
      i === index ? { ...d, current: d.current - 1 } : d
    ));

    // Apply healing if callback provided
    if (onHeal) {
      onHeal(healing);
    }

    toast({
      title: `🎲 ${hd.die} → ${roll}`,
      description: `Healed for ${healing} HP (${roll} + ${constitutionModifier} CON)`,
      className: 'border-green-500 bg-green-500/10',
    });
  };

  // Restore half hit dice on long rest
  const handleLongRest = () => {
    setHitDice(prev => prev.map(hd => {
      const toRestore = Math.max(1, Math.floor(hd.max / 2));
      return {
        ...hd,
        current: Math.min(hd.max, hd.current + toRestore),
      };
    }));

    if (onLongRest) {
      onLongRest();
    }

    toast({
      title: '☀️ Long Rest',
      description: 'Hit dice restored (half, minimum 1 per type).',
      className: 'border-amber-500 bg-amber-500/10',
    });
  };

  // Compact display
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Dices className="w-4 h-4 text-primary" />
        <span className="text-sm font-mono">
          {displayPool}
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {totalHitDice}/{maxHitDice}
        </Badge>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dices className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Hit Dice</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {totalHitDice}/{maxHitDice} available
        </Badge>
      </div>

      {/* Dice Pool */}
      <div className="space-y-2">
        {hitDice.map((hd, index) => {
          const classConfig = CLASS_REGISTRY[hd.classId];
          const Icon = getIconByName(classConfig.iconName);
          const canRoll = hd.current > 0;
          const avgHeal = Math.floor(HIT_DIE_MAX[hd.die] / 2) + 1 + constitutionModifier;

          return (
            <div 
              key={`${hd.classId}-${index}`}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md border',
                'bg-card/50 border-border/50'
              )}
            >
              {/* Class Icon */}
              <Icon 
                className="w-4 h-4 shrink-0"
                style={{ color: `var(--${classConfig.themeColor}, hsl(var(--primary)))` }}
              />

              {/* Die Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold">{hd.die}</span>
                  <span className="text-xs text-muted-foreground">
                    ({classConfig.name})
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Avg heal: {avgHeal} HP
                </div>
              </div>

              {/* Counter */}
              <div className="flex items-center gap-1">
                <span className={cn(
                  'text-lg font-bold font-mono min-w-[2ch] text-center',
                  hd.current === 0 && 'text-muted-foreground'
                )}>
                  {hd.current}
                </span>
                <span className="text-muted-foreground text-sm">/</span>
                <span className="text-muted-foreground text-sm">{hd.max}</span>
              </div>

              {/* Roll Button */}
              <Button
                size="sm"
                variant={canRoll ? 'default' : 'ghost'}
                disabled={!canRoll}
                onClick={() => rollHitDie(index)}
                className="gap-1 h-8"
              >
                <Heart className="w-3 h-3" />
                Roll
              </Button>
            </div>
          );
        })}
      </div>

      {/* Long Rest Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleLongRest}
        className="w-full gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
      >
        <RefreshCw className="w-4 h-4" />
        Long Rest (Restore Hit Dice)
      </Button>

      {/* Info */}
      <p className="text-[10px] text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Use during short rest. Long rest restores half (min 1) of each die type.
      </p>
    </div>
  );
}
