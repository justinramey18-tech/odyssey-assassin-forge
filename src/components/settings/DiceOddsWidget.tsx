import { 
  DiceOddsMode, 
  DICE_ODDS_CONFIGS, 
  ADAPTIVE_PROFILES,
  ODDS_PROFILES,
  loadOddsProfileId,
  saveOddsProfileId,
  describeProfileScenes,
} from '@/lib/diceOdds';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { loadCritCinematicsEnabled, saveCritCinematicsEnabled } from '@/components/dice/CritCinematicProvider';
import { Dices, Sparkles, Flame, Skull, Shuffle, Scale, Crown, CloudRainWind } from 'lucide-react';

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
  godmode: <Crown className="w-5 h-5" />,
  doomed: <CloudRainWind className="w-5 h-5" />,
};

const modeColors: Record<DiceOddsMode, string> = {
  fair: 'border-muted-foreground/50 bg-muted/20 text-muted-foreground data-[selected=true]:border-primary data-[selected=true]:bg-primary/20 data-[selected=true]:text-primary',
  heroic: 'border-amber-500/30 bg-amber-500/5 text-amber-600/70 data-[selected=true]:border-amber-400 data-[selected=true]:bg-amber-500/20 data-[selected=true]:text-amber-400',
  dramatic: 'border-purple-500/30 bg-purple-500/5 text-purple-600/70 data-[selected=true]:border-purple-400 data-[selected=true]:bg-purple-500/20 data-[selected=true]:text-purple-400',
  chaotic: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-600/70 data-[selected=true]:border-cyan-400 data-[selected=true]:bg-cyan-500/20 data-[selected=true]:text-cyan-400',
  cursed: 'border-red-500/30 bg-red-500/5 text-red-600/70 data-[selected=true]:border-red-400 data-[selected=true]:bg-red-500/20 data-[selected=true]:text-red-400',
  godmode: 'border-yellow-300/40 bg-yellow-300/5 text-yellow-500/80 data-[selected=true]:border-yellow-300 data-[selected=true]:bg-yellow-300/20 data-[selected=true]:text-yellow-300',
  doomed: 'border-red-700/40 bg-red-700/5 text-red-700/80 data-[selected=true]:border-red-600 data-[selected=true]:bg-red-700/20 data-[selected=true]:text-red-500',
};

const bracketColors = [
  'bg-green-500/60',
  'bg-emerald-500/60',
  'bg-amber-500/60',
  'bg-red-500/60',
];

export function DiceOddsWidget({ value, onChange }: DiceOddsWidgetProps) {
  const modes = Object.values(DICE_ODDS_CONFIGS);
  const [profileId, setProfileId] = useState<string>(() => loadOddsProfileId() ?? value);
  const activeProfile = ODDS_PROFILES[profileId] ?? ODDS_PROFILES[value];
  const isAdaptive = !activeProfile.uniform;
  const currentConfig = isAdaptive ? activeProfile : DICE_ODDS_CONFIGS[value];
  const colorKey: DiceOddsMode = isAdaptive ? 'heroic' : value;

  const handleSelect = (mode: DiceOddsMode) => {
    setProfileId(mode);
    saveOddsProfileId(mode);
    onChange(mode);
  };
  const handleSelectAdaptive = (id: string) => {
    setProfileId(id);
    saveOddsProfileId(id);
  };
  const [critCine, setCritCine] = useState(loadCritCinematicsEnabled);

  return (
    <div className="space-y-4" data-tutorial-id="dice-odds-widget">
      <label className="flex items-center justify-between gap-3 min-h-12 rounded-lg border border-border px-3" style={{ touchAction: 'manipulation' }}>
        <span className="text-sm font-body text-foreground">Natural 20 cinematic</span>
        <Switch checked={critCine} onCheckedChange={(v) => { setCritCine(v); saveCritCinematicsEnabled(v); }} />
      </label>

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

      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Simple</div>
      {/* Mode Selection Grid */}
      <div className="grid grid-cols-4 gap-2">
        {modes.map((config) => (
          <button
            key={config.mode}
            data-selected={!isAdaptive && value === config.mode}
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

      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Adaptive</div>
      <div className="grid grid-cols-1 gap-2">
        {Object.values(ADAPTIVE_PROFILES).map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelectAdaptive(p.id)}
            aria-pressed={profileId === p.id}
            className={cn(
              'min-h-12 w-full rounded-lg border-2 px-3 py-2 text-left transition-all active:scale-95',
              profileId === p.id ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-muted/20 text-muted-foreground'
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <div className="font-cinzel text-sm font-semibold">{p.label}</div>
            <div className="text-[11px] font-body opacity-80">{describeProfileScenes(p)}</div>
          </button>
        ))}
      </div>

      {/* Selected Mode Details */}
      <div className={cn(
        'rounded-lg border p-3 transition-all',
        modeColors[colorKey].replace('data-[selected=true]:', '')
      )} data-selected="true">
        <div className="flex items-center gap-2 mb-2">
          {modeIcons[colorKey]}
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
        
        {isAdaptive && (
          <p className="text-[11px] font-body text-foreground/80">{describeProfileScenes(activeProfile)}</p>
        )}
        {/* Bracket Visualization */}
        {!isAdaptive && (<div className="mt-3 pt-3 border-t border-current/20">
          <div className="text-[9px] uppercase tracking-wider mb-2 opacity-70 font-mono">
            Roll Distribution
          </div>
          <div className="flex gap-1 h-5">
            {DICE_ODDS_CONFIGS[value].brackets.length === 0 ? (
              <div 
                className="bg-primary/40 rounded-sm flex items-center justify-center text-[8px] font-mono flex-1"
                title="Uniform 1-20"
              >
                1-20 (uniform)
              </div>
            ) : (
              DICE_ODDS_CONFIGS[value].brackets.map((bracket, i) => (
                <div 
                  key={i}
                  className={cn(bracketColors[i % bracketColors.length], "rounded-sm flex items-center justify-center text-[7px] font-mono leading-none")}
                  style={{ flex: bracket.chance }}
                  title={`${bracket.label}: ${Math.round(bracket.chance * 100)}%`}
                >
                  {bracket.label}
                </div>
              ))
            )}
          </div>
        </div>)}
      </div>
    </div>
  );
}
