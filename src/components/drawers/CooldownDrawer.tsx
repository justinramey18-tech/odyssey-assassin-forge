import { useState } from 'react';
import { Timer, Play, Pause, RotateCcw, BarChart3, Lock } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CooldownProgress } from '@/components/cooldowns/CooldownProgress';
import { COOLDOWN_CONFIGS } from '@/lib/cooldowns/config';
import { formatSessionDuration } from '@/lib/cooldowns/notifications';
import { 
  AbilityCooldownState, 
  SessionState, 
  SessionStatistics,
  CooldownSettings,
} from '@/lib/cooldowns/types';

interface CooldownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cooldowns: Map<string, AbilityCooldownState>;
  sessionState: SessionState;
  settings: CooldownSettings;
  isHonestMode: boolean;
  enforceCooldowns: boolean;
  onPause: () => void;
  onResume: () => void;
  onResetAll: () => void;
  onGenerateStats: () => SessionStatistics;
  getRemainingTime: (abilityId: string) => number;
  getEffectiveCooldown: (abilityId: string) => number;
}

export function CooldownDrawer({
  open,
  onOpenChange,
  cooldowns,
  sessionState,
  settings,
  isHonestMode,
  enforceCooldowns,
  onPause,
  onResume,
  onResetAll,
  onGenerateStats,
  getRemainingTime,
  getEffectiveCooldown,
}: CooldownDrawerProps) {
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<SessionStatistics | null>(null);
  
  // Categorize abilities
  const readyAbilities: { id: string; config: typeof COOLDOWN_CONFIGS[string] }[] = [];
  const coolingAbilities: { id: string; config: typeof COOLDOWN_CONFIGS[string]; remaining: number; total: number }[] = [];
  const passiveAbilities: { id: string; config: typeof COOLDOWN_CONFIGS[string] }[] = [];
  
  Object.entries(COOLDOWN_CONFIGS).forEach(([id, config]) => {
    if (config.isPassive) {
      passiveAbilities.push({ id, config });
    } else {
      const state = cooldowns.get(id);
      const remaining = getRemainingTime(id);
      
      if (state?.isOnCooldown && remaining > 0) {
        coolingAbilities.push({ 
          id, 
          config, 
          remaining, 
          total: getEffectiveCooldown(id),
        });
      } else {
        readyAbilities.push({ id, config });
      }
    }
  });
  
  // Sort cooling abilities by remaining time
  coolingAbilities.sort((a, b) => a.remaining - b.remaining);
  
  const handleShowStats = () => {
    const generated = onGenerateStats();
    setStats(generated);
    setShowStats(true);
  };
  
  const canReset = !isHonestMode || !enforceCooldowns;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[340px] p-0">
        <SheetHeader className="p-4 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 font-display">
              <Timer className="w-5 h-5 text-cyan-400" />
              Cooldown Tracker
            </SheetTitle>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={sessionState.isPaused ? onResume : onPause}
              className="gap-1.5"
            >
              {sessionState.isPaused ? (
                <>
                  <Play className="w-4 h-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              )}
            </Button>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Session: {formatSessionDuration(sessionState.sessionStart, sessionState.totalPausedTime)}</span>
            {sessionState.isPaused && (
              <Badge variant="outline" className="text-amber-400 border-amber-400/50 text-[10px]">
                ⏸️ PAUSED
              </Badge>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="p-4 space-y-4">
            {/* Stats Modal */}
            {showStats && stats && (
              <div className="p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Session Statistics</span>
                  <Button size="sm" variant="ghost" onClick={() => setShowStats(false)}>
                    ×
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="ml-1">{formatSessionDuration(stats.sessionStart, 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Active:</span>
                    <span className="ml-1">{formatSessionDuration(stats.activeDuration ? Date.now() - stats.activeDuration : null, 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Abilities Used:</span>
                    <span className="ml-1">{stats.totalAbilityActivations}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Most Used:</span>
                    <span className="ml-1">{stats.mostUsedAbility || 'None'}</span>
                  </div>
                </div>
              </div>
            )}
            
            <Accordion type="multiple" defaultValue={['ready', 'cooling']} className="space-y-2">
              {/* Ready Abilities */}
              <AccordionItem value="ready" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/20">
                  <span className="flex items-center gap-2">
                    <span className="text-green-400">✅</span>
                    READY
                    <Badge variant="outline" className="text-green-400 border-green-400/50 text-[10px]">
                      {readyAbilities.length}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  {readyAbilities.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No abilities ready</p>
                  ) : (
                    <div className="space-y-1">
                      {readyAbilities.map(({ id, config }) => (
                        <div
                          key={id}
                          className={cn(
                            'flex items-center justify-between py-1.5 px-2 rounded',
                            'bg-green-500/10 border border-green-500/20'
                          )}
                        >
                          <span className="text-sm">{config.displayName}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {config.tree}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              
              {/* Cooling Down */}
              <AccordionItem value="cooling" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/20">
                  <span className="flex items-center gap-2">
                    <span>⏳</span>
                    COOLING DOWN
                    <Badge variant="outline" className="text-amber-400 border-amber-400/50 text-[10px]">
                      {coolingAbilities.length}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  {coolingAbilities.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No abilities on cooldown</p>
                  ) : (
                    <div className="space-y-2">
                      {coolingAbilities.map(({ id, config, remaining, total }) => (
                        <div
                          key={id}
                          className="py-2 px-2 rounded bg-muted/20 border border-muted/30"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">{config.displayName}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {config.tree}
                            </Badge>
                          </div>
                          <CooldownProgress
                            remaining={remaining}
                            total={total}
                            tree={config.tree}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              
              {/* Passive Abilities */}
              <AccordionItem value="passive" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/20">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">💤</span>
                    PASSIVE
                    <Badge variant="outline" className="text-muted-foreground border-muted/50 text-[10px]">
                      {passiveAbilities.length}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-1">
                    {passiveAbilities.map(({ id, config }) => (
                      <div
                        key={id}
                        className="text-sm text-muted-foreground py-1"
                      >
                        {config.displayName}
                        <span className="text-[10px] ml-2 opacity-60">(No cooldown)</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            <Separator className="bg-border/30" />
            
            {/* Actions */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShowStats}
                className="w-full gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Session Stats
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={onResetAll}
                disabled={!canReset}
                className="w-full gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All Cooldowns
                {!canReset && <Lock className="w-3 h-3 ml-1" />}
              </Button>
              
              {!canReset && (
                <p className="text-[10px] text-amber-400 text-center">
                  ⚠️ Manual resets disabled in Honest Mode
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
