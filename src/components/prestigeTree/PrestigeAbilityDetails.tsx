// Prestige Ability Details - Side Panel / Bottom Sheet for Ability Info

import { Lock, Unlock, AlertCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PrestigeAbility } from '@/lib/prestigeTree/types';
import { BRANCH_VISUAL_CONFIG } from '@/lib/prestigeTree/branchConfig';
import { getPrestigeAbilityById } from '@/lib/prestigeTree/abilities';
import { getIconByName } from '@/lib/iconUtils';
import { PromptCopyButton } from './PromptCopyButton';

interface PrestigeAbilityDetailsProps {
  ability: PrestigeAbility | null;
  isOpen: boolean;
  onClose: () => void;
  isUnlocked: boolean;
  canUnlock: boolean;
  unlockReason?: string;
  onUnlock: (abilityId: string) => void;
  isMobile: boolean;
}

export function PrestigeAbilityDetails({
  ability,
  isOpen,
  onClose,
  isUnlocked,
  canUnlock,
  unlockReason,
  onUnlock,
  isMobile,
}: PrestigeAbilityDetailsProps) {
  if (!ability) return null;

  const branchConfig = BRANCH_VISUAL_CONFIG[ability.branch];
  const Icon = getIconByName(ability.icon);

  // Get prerequisite ability names
  const prereqNames = ability.prerequisites.map(id => {
    const prereq = getPrestigeAbilityById(id);
    return prereq?.name || id;
  });

  const handleUnlock = () => {
    onUnlock(ability.id);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "bg-gradient-to-b from-slate-900 to-black border-l border-purple-900/40",
          isMobile && "h-[85vh] rounded-t-2xl"
        )}
      >
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            {/* Icon with glow */}
            <div 
              className="relative p-3 rounded-full"
              style={{ 
                backgroundColor: `${branchConfig.glowColor}20`,
                boxShadow: isUnlocked ? `0 0 20px ${branchConfig.glowColor}40` : undefined,
              }}
            >
              <Icon 
                className="w-6 h-6"
                style={{ color: branchConfig.glowColor }}
              />
            </div>
            
            <div className="flex-1">
              <SheetTitle className="text-lg font-cinzel text-foreground">
                {ability.name}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline" 
                  className="text-[10px]"
                  style={{ borderColor: branchConfig.glowColor, color: branchConfig.glowColor }}
                >
                  {branchConfig.name}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  Tier {ability.tier}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100%-120px)] pr-4">
          {/* Description */}
          <div className="mb-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Description
            </h4>
            <p className="text-sm text-foreground/90">
              {ability.description}
            </p>
          </div>

          <Separator className="my-4 bg-purple-900/30" />

          {/* AI Prompt Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
                AI DM Prompt
              </h4>
              <PromptCopyButton
                abilityName={ability.name}
                prompt={ability.aiPrompt}
                mechanicalContext={ability.mechanicalContext}
                variant="icon"
              />
            </div>
            <div className="p-3 rounded-lg bg-purple-900/10 border border-purple-500/20">
              <p className="text-sm italic text-purple-200/80 leading-relaxed">
                {ability.aiPrompt}
              </p>
            </div>
          </div>

          {/* Mechanical Context */}
          <div className="mb-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Mechanical Details
            </h4>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <p className="text-xs text-muted-foreground font-mono">
                {ability.mechanicalContext}
              </p>
            </div>
          </div>

          <Separator className="my-4 bg-purple-900/30" />

          {/* Requirements */}
          <div className="space-y-3">
            {/* Cost */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Cost</span>
              <span className="text-sm font-bold text-amber-400">
                {ability.prestigeCost} Prestige Point{ability.prestigeCost > 1 ? 's' : ''}
              </span>
            </div>

            {/* Minimum Prestige Level */}
            {ability.minimumPrestigeLevel && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Min Prestige Level</span>
                <span className="text-sm text-purple-400">
                  Level {ability.minimumPrestigeLevel}
                </span>
              </div>
            )}

            {/* Prerequisites */}
            {prereqNames.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Prerequisites</span>
                <div className="flex flex-wrap gap-1">
                  {prereqNames.map((name, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="text-[10px] bg-slate-800/50"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Effects */}
            {ability.effects.mechanicalBonus && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Bonus</span>
                <span className="text-sm text-green-400">
                  {ability.effects.mechanicalBonus}
                </span>
              </div>
            )}
            
            {ability.effects.cooldown && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Cooldown</span>
                <span className="text-sm text-blue-400">
                  {ability.effects.cooldown}
                </span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action Button */}
        <div className="absolute bottom-6 left-6 right-6">
          {(() => {
            // Detect different lock types from unlock reason
            const isTierLocked = unlockReason?.toLowerCase().includes('locked') && 
              (unlockReason?.includes('Foundation') || unlockReason?.includes('Intermediate'));
            const isPrestigeLevelLocked = unlockReason?.includes('Prestige Level');

            if (isUnlocked) {
              return (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <Unlock className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Unlocked</span>
                </div>
              );
            }
            
            if (canUnlock) {
              return (
                <Button
                  onClick={handleUnlock}
                  className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock for {ability.prestigeCost} Point{ability.prestigeCost > 1 ? 's' : ''}
                </Button>
              );
            }
            
            if (isTierLocked) {
              // Tier Locked - Distinct amber styling
              return (
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-400">Tier Locked</span>
                  </div>
                  <span className="text-xs text-amber-400/70 text-center">{unlockReason}</span>
                </div>
              );
            }
            
            if (isPrestigeLevelLocked) {
              // Prestige Level Locked - Purple styling
              return (
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold text-purple-400">Level Required</span>
                  </div>
                  <span className="text-xs text-purple-400/70 text-center">{unlockReason}</span>
                </div>
              );
            }
            
            // Missing points or prerequisites - Default gray
            return (
              <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-500">{unlockReason}</span>
              </div>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
