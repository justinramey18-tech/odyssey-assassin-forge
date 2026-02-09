// Druid Circle Panel
// Displays subclass selection and features for Moon/Land circles

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Moon, 
  Trees, 
  ChevronRight,
  Sparkles,
  BookOpen,
  Snowflake,
  Waves,
  Sun,
  TreeDeciduous,
  Wheat,
  Mountain,
  Droplets,
  Eclipse,
  Check,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DruidCircle,
  LandType,
  ALL_CIRCLES,
  LAND_TYPES,
  getCircleById,
  getLandTypeById,
  getCircleBonusSpells,
  getCircleFeaturesForLevel,
  getMoonCircleWildShape,
} from '@/lib/classes/druidCircles';
import { formatCR } from '@/lib/magic/wildShape';

// Icon mapping
const LAND_ICONS: Record<LandType, React.ComponentType<{ className?: string }>> = {
  arctic: Snowflake,
  coast: Waves,
  desert: Sun,
  forest: TreeDeciduous,
  grassland: Wheat,
  mountain: Mountain,
  swamp: Droplets,
  underdark: Eclipse,
};

interface DruidCirclePanelProps {
  druidLevel: number;
  selectedCircle: DruidCircle | null;
  selectedLand: LandType | null;
  onSelectCircle: (circle: DruidCircle) => void;
  onSelectLand: (land: LandType) => void;
  compact?: boolean;
}

export function DruidCirclePanel({
  druidLevel,
  selectedCircle,
  selectedLand,
  onSelectCircle,
  onSelectLand,
  compact = false,
}: DruidCirclePanelProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const circleConfig = selectedCircle ? getCircleById(selectedCircle) : null;
  const landConfig = selectedLand ? getLandTypeById(selectedLand) : null;
  const features = selectedCircle ? getCircleFeaturesForLevel(selectedCircle, druidLevel) : [];
  const bonusSpells = getCircleBonusSpells(selectedCircle ?? 'land', selectedLand, druidLevel);
  const moonWildShape = selectedCircle === 'moon' ? getMoonCircleWildShape(druidLevel) : null;

  if (druidLevel < 2) {
    return (
      <Card className="bg-background/40 border-white/10">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Druid Circle unlocks at level 2
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <button className="flex items-center gap-2 p-2 rounded-lg bg-background/30 hover:bg-background/50 transition-colors w-full text-left">
            {selectedCircle === 'moon' ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : selectedCircle === 'land' ? (
              <Trees className="w-4 h-4 text-green-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {circleConfig?.name ?? 'Choose Circle'}
              </p>
              {selectedCircle === 'land' && landConfig && (
                <p className="text-[10px] text-muted-foreground">{landConfig.name}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] bg-background/95">
          <SheetHeader>
            <SheetTitle>Druid Circle</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full mt-4 pr-4">
            <CircleSelectionContent
              druidLevel={druidLevel}
              selectedCircle={selectedCircle}
              selectedLand={selectedLand}
              onSelectCircle={(c) => {
                onSelectCircle(c);
              }}
              onSelectLand={onSelectLand}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Card className="bg-background/40 border-green-900/30">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedCircle === 'moon' ? (
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
                <Moon className="w-4 h-4 text-indigo-400" />
              </div>
            ) : selectedCircle === 'land' ? (
              <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center">
                <Trees className="w-4 h-4 text-green-400" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted/30 border border-muted/50 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div>
              <h3 className="font-cinzel text-sm text-foreground">
                {circleConfig?.name ?? 'Druid Circle'}
              </h3>
              {circleConfig && (
                <p className="text-[10px] text-muted-foreground">{circleConfig.subtitle}</p>
              )}
            </div>
          </div>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                {selectedCircle ? 'Change' : 'Choose'}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] bg-background/95">
              <SheetHeader>
                <SheetTitle>Choose Druid Circle</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-full mt-4 pr-4">
                <CircleSelectionContent
                  druidLevel={druidLevel}
                  selectedCircle={selectedCircle}
                  selectedLand={selectedLand}
                  onSelectCircle={(c) => {
                    onSelectCircle(c);
                    if (c !== 'land') setIsSheetOpen(false);
                  }}
                  onSelectLand={(l) => {
                    onSelectLand(l);
                    setIsSheetOpen(false);
                  }}
                />
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        {/* Land Type (if Circle of the Land) */}
        {selectedCircle === 'land' && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              {landConfig && (
                <>
                  {(() => {
                    const Icon = LAND_ICONS[selectedLand!];
                    return <Icon className="w-4 h-4 text-green-400" />;
                  })()}
                  <span className="text-sm font-medium text-green-400">{landConfig.name}</span>
                </>
              )}
              {!landConfig && (
                <span className="text-sm text-muted-foreground">Choose a land type</span>
              )}
            </div>

            {/* Bonus Spells */}
            {bonusSpells.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Circle Spells (Always Prepared)</p>
                <div className="flex flex-wrap gap-1">
                  {bonusSpells.map(spell => (
                    <Badge key={spell.spellId} variant="secondary" className="text-[10px] bg-green-500/20 text-green-300">
                      {spell.spellName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Moon Circle Wild Shape Enhancement */}
        {selectedCircle === 'moon' && moonWildShape && (
          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
            <p className="text-[10px] text-muted-foreground uppercase mb-2">Enhanced Wild Shape</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-indigo-400">
                <Zap className="w-3 h-3" /> Max CR {moonWildShape.maxCR}
              </span>
              {moonWildShape.canSwim && (
                <span className="text-blue-400">Swim ✓</span>
              )}
              {moonWildShape.canFly && (
                <span className="text-sky-400">Fly ✓</span>
              )}
              {moonWildShape.canElemental && (
                <span className="text-orange-400">Elemental ✓</span>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        {features.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase">Active Features</p>
            {features.map(feature => (
              <div key={feature.id} className="p-2 rounded bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{feature.name}</span>
                  <Badge variant="outline" className="text-[10px]">Lv {feature.level}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// CIRCLE SELECTION CONTENT
// ============================================

interface CircleSelectionContentProps {
  druidLevel: number;
  selectedCircle: DruidCircle | null;
  selectedLand: LandType | null;
  onSelectCircle: (circle: DruidCircle) => void;
  onSelectLand: (land: LandType) => void;
}

function CircleSelectionContent({
  druidLevel,
  selectedCircle,
  selectedLand,
  onSelectCircle,
  onSelectLand,
}: CircleSelectionContentProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* Circle Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase">Choose Your Circle</h4>
        {ALL_CIRCLES.map(circle => (
          <button
            key={circle.id}
            onClick={() => onSelectCircle(circle.id)}
            className={cn(
              "w-full p-4 rounded-lg border-2 text-left transition-all",
              selectedCircle === circle.id
                ? circle.id === 'moon'
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-green-500 bg-green-500/10"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                circle.id === 'moon' ? "bg-indigo-500/20" : "bg-green-500/20"
              )}>
                {circle.id === 'moon' ? (
                  <Moon className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Trees className="w-5 h-5 text-green-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h5 className="font-medium text-foreground">{circle.name}</h5>
                  {selectedCircle === circle.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{circle.subtitle}</p>
                <p className="text-xs text-muted-foreground mt-1">{circle.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Land Type Selection (if Circle of the Land) */}
      {selectedCircle === 'land' && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase">Choose Your Land</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(LAND_TYPES).map(land => {
              const Icon = LAND_ICONS[land.id];
              const bonusSpells = land.bonusSpells.filter(s => druidLevel >= s.level);
              
              return (
                <button
                  key={land.id}
                  onClick={() => onSelectLand(land.id)}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    selectedLand === land.id
                      ? "border-green-500 bg-green-500/10"
                      : "border-border hover:border-green-500/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-foreground">{land.name}</span>
                    {selectedLand === land.id && (
                      <Check className="w-3 h-3 text-green-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {bonusSpells.length} bonus spells available
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Circle Features Preview */}
      {selectedCircle && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase">Circle Features</h4>
          {getCircleById(selectedCircle)?.features.map(feature => (
            <div 
              key={feature.id} 
              className={cn(
                "p-3 rounded-lg border",
                druidLevel >= feature.level 
                  ? "border-primary/30 bg-primary/5" 
                  : "border-muted/30 bg-muted/10 opacity-60"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">{feature.name}</span>
                <Badge 
                  variant={druidLevel >= feature.level ? "default" : "outline"} 
                  className="text-[10px]"
                >
                  Level {feature.level}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
