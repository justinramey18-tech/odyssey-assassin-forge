// Channel Divinity Option Cards
// Interactive cards for each Channel Divinity option, wired to use CD charges

import { cn } from '@/lib/utils';
import { Sunrise, Sun, Flame, Zap, Shield, Skull, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  BASE_CHANNEL_DIVINITY_OPTIONS,
  ChannelDivinityOption,
  getDestroyUndeadCR,
} from '@/lib/magic/channelDivinity';
import { DomainChannelDivinity } from '@/lib/classes/clericDomains';
import { generateChannelDivinityPrompt } from '@/lib/magic/channelDivinityPrompts';

interface ChannelDivinityCardsProps {
  current: number;
  max: number;
  clericLevel: number;
  characterName: string;
  domainOptions: DomainChannelDivinity[];
  onUseChannelDivinity: (optionName?: string) => boolean;
  onRestoreChannelDivinity?: () => void;
}

// Map option IDs to icons
const OPTION_ICONS: Record<string, typeof Sunrise> = {
  'turn-undead': Sun,
  'preserve-life': Shield,
  'radiance-of-the-dawn': Sunrise,
  'wrath-of-the-storm': Zap,
  'war-gods-blessing': Shield,
  'guided-strike': Zap,
  'invoke-duplicity': Skull,
  'touch-of-death': Skull,
  'read-thoughts': Zap,
  'charm-animals-plants': Shield,
  'destructive-wrath': Flame,
};

function getOptionIcon(id: string) {
  return OPTION_ICONS[id] || Sunrise;
}

export function ChannelDivinityCards({
  current,
  max,
  clericLevel,
  characterName,
  domainOptions,
  onUseChannelDivinity,
  onRestoreChannelDivinity,
}: ChannelDivinityCardsProps) {
  const destroyUndeadCR = getDestroyUndeadCR(clericLevel);
  const hasUses = current > 0;

  // Build the full list: base options + domain options
  const allOptions: Array<{
    id: string;
    name: string;
    description: string;
    mechanicalEffect?: string;
    isDomain: boolean;
  }> = [
    ...BASE_CHANNEL_DIVINITY_OPTIONS
      .filter(opt => clericLevel >= opt.unlockedAtLevel)
      .map(opt => ({
        id: opt.id,
        name: opt.name,
        description: opt.description,
        isDomain: false,
      })),
    ...domainOptions.map(opt => ({
      id: opt.id,
      name: opt.name,
      description: opt.description,
      mechanicalEffect: opt.mechanicalEffect,
      isDomain: true,
    })),
  ];

  if (allOptions.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header with remaining uses */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
            <Sunrise className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <h3 className="font-cinzel text-sm text-foreground">Channel Divinity</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: max }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-3 h-3 rounded-full border transition-colors',
                i < current
                  ? 'bg-yellow-400 border-yellow-500 shadow-[0_0_6px_rgba(250,204,21,0.5)]'
                  : 'bg-muted/30 border-muted-foreground/30'
              )}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-1">{current}/{max}</span>
          {onRestoreChannelDivinity && current < max && (
            <button
              onClick={onRestoreChannelDivinity}
              className="ml-1 p-1 rounded hover:bg-yellow-500/20 transition-colors"
              title="Short Rest — Restore Channel Divinity"
            >
              <RotateCcw className="w-3.5 h-3.5 text-yellow-400" />
            </button>
          )}
        </div>
      </div>

      {/* Option Cards */}
      {allOptions.map(option => {
        const Icon = getOptionIcon(option.id);
        return (
          <div
            key={option.id}
            className={cn(
              'relative rounded-lg border p-3 transition-all',
              hasUses
                ? 'bg-yellow-950/20 border-yellow-500/30 hover:border-yellow-400/50'
                : 'bg-muted/10 border-muted/20 opacity-60'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                hasUses ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-muted/20 border border-muted/30'
              )}>
                <Icon className={cn('w-5 h-5', hasUses ? 'text-yellow-400' : 'text-muted-foreground')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-sm font-semibold',
                    hasUses ? 'text-yellow-200' : 'text-muted-foreground'
                  )}>
                    {option.name}
                  </span>
                  {option.isDomain && (
                    <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400">
                      Domain
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                  {option.description}
                </p>
                {option.mechanicalEffect && (
                  <p className="text-[10px] text-yellow-400/70 mt-1 italic">
                    {option.mechanicalEffect}
                  </p>
                )}
                {option.id === 'turn-undead' && destroyUndeadCR && (
                  <p className="text-[10px] text-yellow-400/70 mt-1 italic">
                    Destroy Undead: {destroyUndeadCR} or lower
                  </p>
                )}
              </div>
            </div>

            {/* Use Button */}
            <Button
              size="sm"
              variant="outline"
              className={cn(
                'w-full mt-3 text-xs',
                hasUses
                  ? 'border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/20 hover:text-yellow-200'
                  : 'border-muted/30 text-muted-foreground cursor-not-allowed'
              )}
              disabled={!hasUses}
              onClick={async () => {
                const success = onUseChannelDivinity(option.name);
                if (success) {
                  const prompt = generateChannelDivinityPrompt(option.name, option.description, characterName, option.mechanicalEffect, option.isDomain);
                  try {
                    await navigator.clipboard.writeText(prompt);
                    toast.success(`${option.name} prompt copied!`);
                  } catch { /* silent */ }
                }
              }}
            >
              <Sunrise className="w-3 h-3 mr-1.5" />
              {hasUses ? `Channel: ${option.name}` : 'No Uses Remaining'}
            </Button>
          </div>
        );
      })}

      <p className="text-[10px] text-muted-foreground text-center italic">
        Recovers on short rest • {current} of {max} uses remaining
      </p>
    </div>
  );
}
