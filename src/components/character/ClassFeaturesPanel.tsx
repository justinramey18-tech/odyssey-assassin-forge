// Class Features Panel Component
// Displays unlocked class features for a character

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DnDClass, ClassLevelMap, CLASS_REGISTRY } from '@/lib/classes';
import { 
  getUnlockedFeatures, 
  getScalingValue, 
  UnlockedFeature,
  isScalingFeature,
} from '@/lib/classes/features';
import { getIconByName } from '@/lib/iconUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Sparkles, Zap, RefreshCw } from 'lucide-react';

interface ClassFeaturesPanelProps {
  primaryClass: DnDClass;
  primaryLevel: number;
  multiclassLevels?: ClassLevelMap;
  showUsageTracking?: boolean;
  className?: string;
}

const usageTypeLabels: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  at_will: { label: 'At Will', color: 'emerald', icon: Sparkles },
  short_rest: { label: 'Short Rest', color: 'amber', icon: RefreshCw },
  long_rest: { label: 'Long Rest', color: 'violet', icon: Zap },
};

export function ClassFeaturesPanel({
  primaryClass,
  primaryLevel,
  multiclassLevels = {},
  showUsageTracking = false,
  className,
}: ClassFeaturesPanelProps) {
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  // Build class levels map for feature lookup
  const classLevels = useMemo(() => {
    const levels: Partial<Record<DnDClass, number>> = {
      [primaryClass]: primaryLevel,
    };
    for (const [classId, level] of Object.entries(multiclassLevels)) {
      if (level && level > 0) {
        levels[classId as DnDClass] = level;
      }
    }
    return levels;
  }, [primaryClass, primaryLevel, multiclassLevels]);

  // Get all unlocked features
  const unlockedFeatures = useMemo(() => {
    return getUnlockedFeatures(classLevels);
  }, [classLevels]);

  // Group features by class
  const featuresByClass = useMemo(() => {
    const grouped: Record<DnDClass, UnlockedFeature[]> = {} as Record<DnDClass, UnlockedFeature[]>;
    
    for (const uf of unlockedFeatures) {
      const classId = uf.feature.classId;
      if (!grouped[classId]) {
        grouped[classId] = [];
      }
      grouped[classId].push(uf);
    }
    
    return grouped;
  }, [unlockedFeatures]);

  const toggleFeature = (featureId: string) => {
    setExpandedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      return next;
    });
  };

  if (unlockedFeatures.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground text-sm', className)}>
        No class features unlocked yet.
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(featuresByClass).map(([classId, features]) => {
        const classConfig = CLASS_REGISTRY[classId as DnDClass];
        const ClassIcon = getIconByName(classConfig.iconName);
        
        return (
          <div key={classId} className="space-y-2">
            {/* Class Header */}
            <div 
              className="flex items-center gap-2 px-2 py-1 rounded-md"
              style={{
                backgroundColor: `hsl(var(--${classConfig.themeColor}) / 0.1)`,
              }}
            >
              <ClassIcon 
                className="w-4 h-4" 
                style={{ color: `var(--${classConfig.themeColor}, hsl(var(--primary)))` }}
              />
              <span 
                className="text-sm font-semibold"
                style={{ color: `var(--${classConfig.themeColor}, hsl(var(--primary)))` }}
              >
                {classConfig.name} Features
              </span>
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {features.length}
              </Badge>
            </div>

            {/* Features List */}
            <div className="space-y-1.5 pl-2">
              {features.map((uf) => {
                const { feature, classLevel } = uf;
                const isExpanded = expandedFeatures.has(feature.id);
                const Icon = feature.iconName ? getIconByName(feature.iconName) : Sparkles;
                const usageInfo = feature.usageType ? usageTypeLabels[feature.usageType] : null;
                
                // Get scaling value if applicable
                const scalingValue = isScalingFeature(feature) 
                  ? getScalingValue(feature.id, classLevel)
                  : null;

                return (
                  <Collapsible
                    key={feature.id}
                    open={isExpanded}
                    onOpenChange={() => toggleFeature(feature.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-md',
                          'border border-border/50 bg-card/50',
                          'hover:bg-muted/50 transition-colors text-left'
                        )}
                      >
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {feature.name}
                            </span>
                            {scalingValue && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                {scalingValue}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Level {feature.level}
                            {usageInfo && (
                              <span 
                                className="ml-2"
                                style={{ color: `var(--${usageInfo.color}-400)` }}
                              >
                                • {usageInfo.label}
                              </span>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="px-3 py-2 mt-1 rounded-md bg-muted/30 border border-border/30 text-sm space-y-2">
                        <p className="text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                        {feature.mechanicalEffect && (
                          <div className="text-xs px-2 py-1 rounded bg-primary/10 border border-primary/20">
                            <span className="text-primary font-medium">Effect: </span>
                            <span className="text-muted-foreground">{feature.mechanicalEffect}</span>
                          </div>
                        )}
                        {feature.isSubclassFeature && (
                          <Badge variant="outline" className="text-[10px]">
                            Subclass Feature (Coming Soon)
                          </Badge>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
