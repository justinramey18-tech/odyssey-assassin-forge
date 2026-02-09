// Channel Divinity Tracker
// Displays Cleric's Channel Divinity uses with visual pips

import { cn } from '@/lib/utils';
import { Sunrise, RotateCcw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getDestroyUndeadCR, BASE_CHANNEL_DIVINITY_OPTIONS } from '@/lib/magic/channelDivinity';

interface ChannelDivinityTrackerProps {
  current: number;
  max: number;
  clericLevel: number;
  compact?: boolean;
  onUseChannelDivinity?: () => void;
  onRestoreChannelDivinity?: () => void;
}

export function ChannelDivinityTracker({
  current,
  max,
  clericLevel,
  compact = false,
  onUseChannelDivinity,
  onRestoreChannelDivinity,
}: ChannelDivinityTrackerProps) {
  const destroyUndeadCR = getDestroyUndeadCR(clericLevel);
  const percentage = max > 0 ? (current / max) * 100 : 0;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Sunrise className="w-4 h-4 text-yellow-400" />
              <div className="flex gap-1">
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
              </div>
              <span className="text-xs text-muted-foreground">
                {current}/{max}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Channel Divinity: {current}/{max} uses</p>
            <p className="text-xs text-muted-foreground">Recovers on short rest</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="bg-background/40 border border-yellow-900/30 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center">
            <Sunrise className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-cinzel text-sm text-foreground">Channel Divinity</h3>
            <p className="text-[10px] text-muted-foreground">Recovers on short rest</p>
          </div>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Info className="w-3 h-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-background/95 border-yellow-900/50">
            <div className="space-y-3">
              <h4 className="font-cinzel text-sm text-yellow-400">Channel Divinity Options</h4>
              
              {BASE_CHANNEL_DIVINITY_OPTIONS.map(option => (
                <div key={option.id} className="p-2 rounded bg-muted/20">
                  <p className="text-xs font-medium text-foreground">{option.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{option.description}</p>
                </div>
              ))}

              {destroyUndeadCR && (
                <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-xs font-medium text-yellow-400">Destroy Undead</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Undead of {destroyUndeadCR} or lower that fail Turn Undead are instantly destroyed.
                  </p>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground italic">
                Additional Channel Divinity options come from your Divine Domain subclass.
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Uses</span>
          <span className="text-yellow-400 font-medium">{current} / {max}</span>
        </div>
        <Progress 
          value={percentage} 
          className="h-2 bg-muted/30"
        />
      </div>

      {/* Use Pips */}
      <div className="flex justify-center gap-2 mt-3">
        {Array.from({ length: max }).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (i < current && onUseChannelDivinity) {
                onUseChannelDivinity();
              }
            }}
            disabled={i >= current}
            className={cn(
              'w-6 h-6 rounded-full border-2 transition-all duration-200',
              i < current
                ? 'bg-yellow-400 border-yellow-500 shadow-[0_0_8px_rgba(250,204,21,0.5)] hover:scale-110 cursor-pointer'
                : 'bg-muted/30 border-muted-foreground/30 cursor-not-allowed'
            )}
            title={i < current ? 'Click to use Channel Divinity' : 'No uses remaining'}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
          onClick={onUseChannelDivinity}
          disabled={current <= 0}
        >
          <Sunrise className="w-3 h-3 mr-1" />
          Use Channel Divinity
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-yellow-400"
          onClick={onRestoreChannelDivinity}
          disabled={current >= max}
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
