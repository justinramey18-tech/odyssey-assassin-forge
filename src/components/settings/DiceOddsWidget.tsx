import { useState, useEffect } from 'react';
import { 
  DiceOddsMode, 
  DICE_ODDS_CONFIGS, 
  saveDiceOddsMode, 
  loadDiceOddsMode 
} from '@/lib/diceOdds';
import { cn } from '@/lib/utils';
import { Dices, Sparkles, Flame, Skull, Shuffle, Scale } from 'lucide-react';

interface DiceOddsWidgetProps {
  value: DiceOddsMode;
  onChange: (mode: DiceOddsMode) => void;
}

const modeIcons: Record<DiceOddsMode, React.ReactNode> = {
  fair: <Scale className="w-5 h-5" />,
  heroic: <Sparkles className="w-5 h-5" />,
  dramatic: <Flame className="w-5 h-5" />,
  chaotic: <Shuffle className="w-5 h-5" />,
  cursed: <Skull className="w-5 h-5" />,
};

const modeColors: Record<DiceOddsMode, string> = {
  fair: 'border-muted-foreground/50 bg-muted/20 text-muted-foreground data-[selected=true]:border-primary data-[selected=true]:bg-primary/20 data-[selected=true]:text-primary',
  heroic: 'border-amber-500/30 bg-amber-500/5 text-amber-600/70 data-[selected=true]:border-amber-400 data-[selected=true]:bg-amber-500/20 data-[selected=true]:text-amber-400',
  dramatic: 'border-purple-500/30 bg-purple-500/5 text-purple-600/70 data-[selected=true]:border-purple-400 data-[selected=true]:bg-purple-500/20 data-[selected=true]:text-purple-400',
  chaotic: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-600/70 data-[selected=true]:border-cyan-400 data-[selected=true]:bg-cyan-500/20 data-[selected=true]:text-cyan-400',
  cursed: 'border-red-500/30 bg-red-500/5 text-red-600/70 data-[selected=true]:border-red-400 data-[selected=true]:bg-red-500/20 data-[selected=true]:text-red-400',
};

export function DiceOddsWidget({ value, onChange }: DiceOddsWidgetProps) {
  const modes = Object.values(DICE_ODDS_CONFIGS);
  const currentConfig = DICE_ODDS_CONFIGS[value];

  const handleSelect = (mode: DiceOddsMode) => {
    onChange(mode);
    saveDiceOddsMode(mode);
  };

  return (
    <div className="space-y-4" data-tutorial-id="dice-odds-widget">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Dices className="w-5 h-5 text-primary" />
        <h3 className="font-display text-sm uppercase tracking-wider text-foreground">
          Dice Roll Odds
        </h3>
      </div>
      
      <p className="text-xs text-muted-foreground font-body">
        Adjust how the dice favor your rolls. This affects all combat and ability rolls.
      </p>

      {/* Mode Selection Grid */}
      <div className="grid grid-cols-5 gap-2">
        {modes.map((config) => (
          <button
            key={config.mode}
            data-selected={value === config.mode}
            onClick={() => handleSelect(config.mode)}
            className={cn(
              'flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all',
              'hover:scale-105 active:scale-95',
              modeColors[config.mode]
            )}
            title={config.label}
          >
            {modeIcons[config.mode]}
            <span className="text-[8px] font-mono uppercase mt-1 leading-tight text-center">
              {config.label.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Selected Mode Details */}
      <div className={cn(
        'rounded-lg border p-3 transition-all',
        modeColors[value].replace('data-[selected=true]:', '')
      )} data-selected="true">
        <div className="flex items-center gap-2 mb-2">
          {modeIcons[value]}
          <span className="font-display text-sm font-semibold">
            {currentConfig.label}
          </span>
        </div>
        <p className="text-xs font-body text-foreground/80 mb-2">
          {currentConfig.description}
        </p>
        <p className="text-[10px] font-body italic text-muted-foreground">
          {currentConfig.deadpoolQuote}
        </p>
        
        {/* Weight Visualization */}
        <div className="mt-3 pt-3 border-t border-current/20">
          <div className="text-[9px] uppercase tracking-wider mb-2 opacity-70 font-mono">
            Roll Distribution
          </div>
          <div className="flex gap-1 h-4">
            <div 
              className="bg-red-500/60 rounded-sm flex items-center justify-center text-[8px] font-mono"
              style={{ flex: currentConfig.weights.low }}
              title="Low rolls"
            >
              LOW
            </div>
            <div 
              className="bg-amber-500/60 rounded-sm flex items-center justify-center text-[8px] font-mono"
              style={{ flex: currentConfig.weights.mid }}
              title="Mid rolls"
            >
              MID
            </div>
            <div 
              className="bg-green-500/60 rounded-sm flex items-center justify-center text-[8px] font-mono"
              style={{ flex: currentConfig.weights.high }}
              title="High rolls"
            >
              HIGH
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
