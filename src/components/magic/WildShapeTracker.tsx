// Wild Shape Tracker
// Displays Druid's Wild Shape uses, current form HP, and transformation controls

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  PawPrint, 
  RotateCcw, 
  Heart, 
  Shield, 
  Clock, 
  ChevronDown,
  Zap,
  Waves,
  Wind,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BeastForm, formatCR, WildShapeConfig } from '@/lib/magic/wildShape';
import { ElementalForm, DragonForm } from '@/lib/classes/druidCircles';

interface WildShapeTrackerProps {
  usesRemaining: number;
  maxUses: number;
  isTransformed: boolean;
  currentForm: BeastForm | null;
  formHP: number;
  formMaxHP: number;
  config: WildShapeConfig | null;
  availableForms: BeastForm[];
  elementalForms?: ElementalForm[];
  dragonForms?: DragonForm[];
  compact?: boolean;
  onTransform: (form: BeastForm) => void;
  onTransformElemental?: (form: ElementalForm) => boolean;
  onTransformDragon?: (form: DragonForm) => boolean;
  onRevert: () => void;
  onRestoreUse?: () => void;
}

export function WildShapeTracker({
  usesRemaining,
  maxUses,
  isTransformed,
  currentForm,
  formHP,
  formMaxHP,
  config,
  availableForms,
  elementalForms,
  dragonForms,
  compact = false,
  onTransform,
  onTransformElemental,
  onTransformDragon,
  onRevert,
  onRestoreUse,
}: WildShapeTrackerProps) {
  const [isFormSheetOpen, setIsFormSheetOpen] = useState(false);
  const hpPercentage = formMaxHP > 0 ? (formHP / formMaxHP) * 100 : 0;

  // Group forms by CR
  const formsByCR = availableForms.reduce((acc, form) => {
    const crKey = formatCR(form.cr);
    if (!acc[crKey]) acc[crKey] = [];
    acc[crKey].push(form);
    return acc;
  }, {} as Record<string, BeastForm[]>);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <PawPrint className={cn(
                "w-4 h-4",
                isTransformed ? "text-green-400 animate-pulse" : "text-green-600"
              )} />
              {isTransformed && currentForm ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-green-400 font-medium">
                    {currentForm.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formHP}/{formMaxHP}
                  </span>
                </div>
              ) : (
                <div className="flex gap-1">
                  {Array.from({ length: maxUses }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-3 h-3 rounded-full border transition-colors',
                        i < usesRemaining
                          ? 'bg-green-500 border-green-600 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                          : 'bg-muted/30 border-muted-foreground/30'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {isTransformed && currentForm ? (
              <div>
                <p className="font-medium">{currentForm.name} (CR {formatCR(currentForm.cr)})</p>
                <p className="text-xs text-muted-foreground">HP: {formHP}/{formMaxHP} • AC: {currentForm.ac}</p>
              </div>
            ) : (
              <p>Wild Shape: {usesRemaining}/{maxUses} uses (short rest)</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="bg-background/40 border border-green-900/30 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            isTransformed 
              ? "bg-green-500/30 border border-green-500 animate-pulse" 
              : "bg-green-500/20 border border-green-500/50"
          )}>
            <PawPrint className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h3 className="font-cinzel text-sm text-foreground">Wild Shape</h3>
            <p className="text-[10px] text-muted-foreground">
              {isTransformed ? 'Transformed' : 'Recovers on short rest'}
            </p>
          </div>
        </div>

        {/* Uses Pips */}
        <div className="flex gap-1">
          {Array.from({ length: maxUses }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-4 h-4 rounded-full border-2 transition-all',
                i < usesRemaining
                  ? 'bg-green-500 border-green-600 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                  : 'bg-muted/30 border-muted-foreground/30'
              )}
            />
          ))}
        </div>
      </div>

      {/* Transformed State */}
      {isTransformed && currentForm ? (
        <div className="space-y-2">
          {/* Current Form Info */}
          <div className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/30">
            <div>
              <p className="text-sm font-medium text-green-400">{currentForm.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>CR {formatCR(currentForm.cr)}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <Shield className="w-3 h-3" /> {currentForm.ac}
                </span>
                <span>•</span>
                <span>{currentForm.speed}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRevert}
              className="text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Revert
            </Button>
          </div>

          {/* Form HP Bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Heart className="w-3 h-3 text-green-400" /> Beast Form HP
              </span>
              <span className="text-green-400 font-medium">{formHP} / {formMaxHP}</span>
            </div>
            <Progress 
              value={hpPercentage} 
              className="h-3 bg-muted/30"
            />
          </div>

          {/* Special Abilities */}
          {currentForm.specialAbilities && currentForm.specialAbilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {currentForm.specialAbilities.map((ability, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] bg-green-500/10 text-green-400">
                  {ability}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Restrictions Info */}
          {config && (
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" /> Max CR {formatCR(config.maxCR)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {config.maxHours}h duration
              </span>
              {config.canSwim && (
                <span className="flex items-center gap-1 text-blue-400">
                  <Waves className="w-3 h-3" /> Swim
                </span>
              )}
              {config.canFly && (
                <span className="flex items-center gap-1 text-sky-400">
                  <Wind className="w-3 h-3" /> Fly
                </span>
              )}
            </div>
          )}

          {/* Transform Button */}
          <Sheet open={isFormSheetOpen} onOpenChange={setIsFormSheetOpen}>
            <SheetTrigger asChild>
              <Button
                className="w-full text-xs bg-green-600 hover:bg-green-700 text-white"
                disabled={usesRemaining <= 0}
              >
                <PawPrint className="w-3 h-3 mr-1" />
                Transform ({usesRemaining}/{maxUses})
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] bg-background/95">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <PawPrint className="w-5 h-5 text-green-400" />
                  Choose Beast Form
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-full mt-4 pr-4">
                <div className="space-y-4 pb-8">
                  {(() => {
                    // Build unified form list
                    type UnifiedTrackerForm = {
                      form: BeastForm;
                      category: 'beast' | 'elemental' | 'dragon';
                      useCost: number;
                      onSelect: () => void;
                      isDisabled: boolean;
                    };

                    const allForms: UnifiedTrackerForm[] = [
                      ...availableForms.map(f => ({
                        form: f,
                        category: 'beast' as const,
                        useCost: 1,
                        onSelect: () => { onTransform(f); setIsFormSheetOpen(false); },
                        isDisabled: usesRemaining < 1 || isTransformed,
                      })),
                      ...(elementalForms && onTransformElemental ? elementalForms.map(f => ({
                        form: f as BeastForm,
                        category: 'elemental' as const,
                        useCost: 2,
                        onSelect: () => { onTransformElemental(f); setIsFormSheetOpen(false); },
                        isDisabled: usesRemaining < 2 || isTransformed,
                      })) : []),
                      ...(dragonForms && onTransformDragon ? dragonForms.map(f => ({
                        form: f as BeastForm,
                        category: 'dragon' as const,
                        useCost: 3,
                        onSelect: () => { onTransformDragon(f); setIsFormSheetOpen(false); },
                        isDisabled: usesRemaining < 3 || isTransformed,
                      })) : []),
                    ];

                    const grouped = allForms.reduce((acc, item) => {
                      const crKey = formatCR(item.form.cr);
                      if (!acc[crKey]) acc[crKey] = [];
                      acc[crKey].push(item);
                      return acc;
                    }, {} as Record<string, UnifiedTrackerForm[]>);

                    const sortedKeys = Object.keys(grouped).sort((a, b) => {
                      return grouped[b][0].form.cr - grouped[a][0].form.cr;
                    });

                    const catColors = {
                      beast: { border: 'border-border hover:border-green-500/50 hover:bg-green-500/5', accent: 'text-green-400' },
                      elemental: { border: 'border-orange-500/30 hover:border-orange-500/50 hover:bg-orange-500/5', accent: 'text-orange-400' },
                      dragon: { border: 'border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/5', accent: 'text-purple-400' },
                    };

                    return sortedKeys.map(crKey => (
                      <Collapsible key={crKey} defaultOpen={grouped[crKey][0].form.cr >= 1}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded bg-muted/30 hover:bg-muted/50">
                          <span className="text-sm font-medium">CR {crKey}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{grouped[crKey].length} forms</span>
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {grouped[crKey].map(({ form, category, useCost, onSelect, isDisabled }) => {
                              const colors = catColors[category];
                              return (
                                <button
                                  key={form.id}
                                  onClick={onSelect}
                                  disabled={isDisabled}
                                  className={cn(
                                    "p-3 rounded-lg border transition-all text-left disabled:opacity-40",
                                    colors.border
                                  )}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-medium text-foreground">{form.name}</p>
                                        {useCost > 1 && (
                                          <span className={cn("text-[10px] font-mono", colors.accent)}>
                                            {useCost} uses
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {form.description}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 mt-2 text-xs">
                                    <span className="flex items-center gap-1 text-red-400">
                                      <Heart className="w-3 h-3" /> {form.hp}
                                    </span>
                                    <span className="flex items-center gap-1 text-blue-400">
                                      <Shield className="w-3 h-3" /> {form.ac}
                                    </span>
                                    <span className="text-muted-foreground">{form.speed}</span>
                                  </div>
                                  {form.specialAbilities && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {form.specialAbilities.slice(0, 3).map((ability, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px]">
                                          {ability}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ));
                  })()}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Restore Button (for debugging/manual adjustment) */}
          {onRestoreUse && usesRemaining < maxUses && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestoreUse}
              className="w-full text-xs text-muted-foreground hover:text-green-400"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Restore Use
            </Button>
          )}
        </>
      )}
    </div>
  );
}
