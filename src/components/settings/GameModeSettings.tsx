import { useState, useEffect } from 'react';
import { Shield, Infinity, Info, Clock, Swords } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  GameModeSettings as GameModeSettingsType,
  HonestModeRules,
  getRuleDescription,
  getAllRuleKeys,
} from '@/lib/gameModes';
import {
  load4thWallTimeSetting,
  save4thWallTimeSetting,
  FOURTH_WALL_TIME_CHANGE_EVENT,
} from '@/lib/fourthWallTime';
import {
  CombatSettings,
  loadCombatSettings,
  saveCombatSettings,
  getCombatSettingDescription,
  COMBAT_SETTINGS_CHANGE_EVENT,
} from '@/lib/combat/combatSettings';

interface GameModeSettingsProps {
  settings: GameModeSettingsType;
  onChange: (settings: GameModeSettingsType) => void;
}

export function GameModeSettings({ settings, onChange }: GameModeSettingsProps) {
  const isHonestMode = settings.mode === 'honest';
  const isInfinityPool = settings.mode === 'infinityPool';
  const [fourthWallTime, setFourthWallTime] = useState(() => load4thWallTimeSetting());
  const [combatSettings, setCombatSettings] = useState<CombatSettings>(() => loadCombatSettings());

  // Listen for external changes to 4th Wall Time setting
  useEffect(() => {
    const handleChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setFourthWallTime(customEvent.detail);
    };
    window.addEventListener(FOURTH_WALL_TIME_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(FOURTH_WALL_TIME_CHANGE_EVENT, handleChange);
  }, []);

  // Listen for external changes to Combat Settings
  useEffect(() => {
    const handleChange = (e: Event) => {
      const customEvent = e as CustomEvent<CombatSettings>;
      setCombatSettings(customEvent.detail);
    };
    window.addEventListener(COMBAT_SETTINGS_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(COMBAT_SETTINGS_CHANGE_EVENT, handleChange);
  }, []);

  const handleModeToggle = (mode: 'honest' | 'infinityPool') => {
    onChange({ ...settings, mode });
  };

  const handleRuleToggle = (rule: keyof HonestModeRules) => {
    onChange({
      ...settings,
      honestModeRules: {
        ...settings.honestModeRules,
        [rule]: !settings.honestModeRules[rule],
      },
    });
  };

  const handleFourthWallTimeToggle = (checked: boolean) => {
    setFourthWallTime(checked);
    save4thWallTimeSetting(checked);
  };

  const handleCombatSettingToggle = (key: keyof CombatSettings, checked: boolean) => {
    const newSettings = { ...combatSettings, [key]: checked };
    setCombatSettings(newSettings);
    saveCombatSettings(newSettings);
  };

  return (
    <div className="space-y-6" data-tutorial-id="game-mode-section">
      {/* Mode Selection Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Honest Mode Card */}
        <button
          onClick={() => handleModeToggle('honest')}
          className={cn(
            'relative p-4 rounded-lg border-2 transition-all text-left',
            isHonestMode
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-border/50 bg-card/50 hover:border-muted-foreground/50'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                isHonestMode ? 'bg-amber-500/20' : 'bg-muted/50'
              )}
            >
              <Shield
                className={cn(
                  'w-4 h-4',
                  isHonestMode ? 'text-amber-500' : 'text-muted-foreground'
                )}
              />
            </div>
            <span
              className={cn(
                'font-cinzel font-bold text-sm',
                isHonestMode ? 'text-amber-500' : 'text-foreground'
              )}
            >
              Honest Mode
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Play by the rules. Earn your power through dedication and narrative.
          </p>
          {isHonestMode && (
            <Badge className="absolute -top-2 -right-2 bg-amber-500 text-background text-[10px]">
              ACTIVE
            </Badge>
          )}
        </button>

        {/* Infinity Pool Card */}
        <button
          onClick={() => handleModeToggle('infinityPool')}
          className={cn(
            'relative p-4 rounded-lg border-2 transition-all text-left',
            isInfinityPool
              ? 'border-primary bg-primary/10'
              : 'border-border/50 bg-card/50 hover:border-muted-foreground/50'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                isInfinityPool ? 'bg-primary/20' : 'bg-muted/50'
              )}
            >
              <Infinity
                className={cn(
                  'w-4 h-4',
                  isInfinityPool ? 'text-primary' : 'text-muted-foreground'
                )}
              />
            </div>
            <span
              className={cn(
                'font-cinzel font-bold text-sm',
                isInfinityPool ? 'text-primary' : 'text-foreground'
              )}
            >
              Infinity Pool
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Full access to all features. No restrictions. Pure sandbox.
          </p>
          {isInfinityPool && (
            <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px]">
              ACTIVE
            </Badge>
          )}
        </button>
      </div>

      <Separator />

      {/* Combat Features */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-400">Combat Features</span>
        </div>
        
        <div
          className={cn(
            'p-3 rounded-lg border transition-all',
            combatSettings.hasTwoWeaponFightingStyle
              ? 'border-amber-500/50 bg-amber-500/5'
              : 'border-border/30 bg-card/30'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label
                htmlFor="two-weapon-fighting"
                className={cn(
                  'text-sm font-medium cursor-pointer',
                  combatSettings.hasTwoWeaponFightingStyle ? 'text-amber-400' : 'text-foreground'
                )}
              >
                {getCombatSettingDescription('hasTwoWeaponFightingStyle').label}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getCombatSettingDescription('hasTwoWeaponFightingStyle').description}
              </p>
            </div>
            <Switch
              id="two-weapon-fighting"
              checked={combatSettings.hasTwoWeaponFightingStyle}
              onCheckedChange={(checked) => handleCombatSettingToggle('hasTwoWeaponFightingStyle', checked)}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
        </div>

        {/* Dual Wielder Feat */}
        <div
          className={cn(
            'p-3 rounded-lg border transition-all',
            combatSettings.hasDualWielderFeat
              ? 'border-amber-500/50 bg-amber-500/5'
              : 'border-border/30 bg-card/30'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label
                htmlFor="dual-wielder-feat"
                className={cn(
                  'text-sm font-medium cursor-pointer',
                  combatSettings.hasDualWielderFeat ? 'text-amber-400' : 'text-foreground'
                )}
              >
                {getCombatSettingDescription('hasDualWielderFeat').label}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getCombatSettingDescription('hasDualWielderFeat').description}
              </p>
            </div>
            <Switch
              id="dual-wielder-feat"
              checked={combatSettings.hasDualWielderFeat}
              onCheckedChange={(checked) => handleCombatSettingToggle('hasDualWielderFeat', checked)}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
        </div>
      </div>

      {/* 4th Wall Time Setting */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-cyan-400">AI Integration</span>
        </div>
        
        <div
          className={cn(
            'p-3 rounded-lg border transition-all',
            fourthWallTime
              ? 'border-cyan-500/50 bg-cyan-500/5'
              : 'border-border/30 bg-card/30'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label
                htmlFor="fourth-wall-time"
                className={cn(
                  'text-sm font-medium cursor-pointer',
                  fourthWallTime ? 'text-cyan-400' : 'text-foreground'
                )}
              >
                4th Wall Time
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Prefix all AI prompts with the current EST timestamp so your AI DM knows the real-world time.
              </p>
            </div>
            <Switch
              id="fourth-wall-time"
              checked={fourthWallTime}
              onCheckedChange={handleFourthWallTimeToggle}
              className="data-[state=checked]:bg-cyan-500"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Honest Mode Rules */}
      <div className={cn('space-y-4', !isHonestMode && 'opacity-50 pointer-events-none')}>
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Customize Honest Mode rules below
          </span>
        </div>

        <div className="space-y-3">
          {getAllRuleKeys().map((rule) => {
            const { label, description } = getRuleDescription(rule);
            const isActive = settings.honestModeRules[rule];

            return (
              <div
                key={rule}
                className={cn(
                  'p-3 rounded-lg border transition-all',
                  isActive
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : 'border-border/30 bg-card/30'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={rule}
                      className={cn(
                        'text-sm font-medium cursor-pointer',
                        isActive ? 'text-amber-500' : 'text-foreground'
                      )}
                    >
                      {label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {description}
                    </p>
                  </div>
                  <Switch
                    id={rule}
                    checked={isActive}
                    onCheckedChange={() => handleRuleToggle(rule)}
                    disabled={!isHonestMode}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mode Summary */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
        <p className="text-xs text-muted-foreground text-center">
          {isHonestMode ? (
            <>
              <span className="text-amber-500 font-medium">Honest Mode</span> active with{' '}
              {Object.values(settings.honestModeRules).filter(Boolean).length} of 5 rules enabled
            </>
          ) : (
            <>
              <span className="text-primary font-medium">Infinity Pool</span> active — all features
              unlocked
            </>
          )}
        </p>
      </div>
    </div>
  );
}
