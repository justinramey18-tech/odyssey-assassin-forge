import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  load4thWallTimeSetting,
  save4thWallTimeSetting,
  FOURTH_WALL_TIME_CHANGE_EVENT,
} from '@/lib/fourthWallTime';
import {
  CombatSettings,
  loadCombatSettings,
  saveCombatSettings,
  COMBAT_SETTINGS_CHANGE_EVENT,
} from '@/lib/combat/combatSettings';
import {
  TIMEZONE_OPTIONS,
  loadTimezone,
  saveTimezone,
  TIMEZONE_CHANGE_EVENT,
} from '@/lib/timezone-storage';

export function SystemPreferences() {
  const [fourthWallTime, setFourthWallTime] = useState(() => load4thWallTimeSetting());
  const [combatSettings, setCombatSettings] = useState<CombatSettings>(() => loadCombatSettings());
  const [timezone, setTimezone] = useState(() => loadTimezone());

  useEffect(() => {
    const handleChange = (e: Event) => {
      setFourthWallTime((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener(FOURTH_WALL_TIME_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(FOURTH_WALL_TIME_CHANGE_EVENT, handleChange);
  }, []);

  useEffect(() => {
    const handleChange = (e: Event) => {
      setCombatSettings((e as CustomEvent<CombatSettings>).detail);
    };
    window.addEventListener(COMBAT_SETTINGS_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(COMBAT_SETTINGS_CHANGE_EVENT, handleChange);
  }, []);

  useEffect(() => {
    const handleChange = (e: Event) => {
      setTimezone((e as CustomEvent<string>).detail);
    };
    window.addEventListener(TIMEZONE_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(TIMEZONE_CHANGE_EVENT, handleChange);
  }, []);

  const handleTimezoneChange = (value: string): void => {
    setTimezone(value);
    saveTimezone(value);
  };

  const handleFourthWallTimeToggle = (checked: boolean): void => {
    setFourthWallTime(checked);
    save4thWallTimeSetting(checked);
  };

  const handleCombatSettingToggle = (key: keyof CombatSettings, checked: boolean): void => {
    const newSettings = { ...combatSettings, [key]: checked };
    setCombatSettings(newSettings);
    saveCombatSettings(newSettings);
  };

  return (
    <div className="space-y-4">
      <AIIntegrationSection
        fourthWallTime={fourthWallTime}
        onFourthWallTimeToggle={handleFourthWallTimeToggle}
        timezone={timezone}
        onTimezoneChange={handleTimezoneChange}
      />
      <NotificationsSection
        combatSettings={combatSettings}
        onCombatSettingToggle={handleCombatSettingToggle}
      />
    </div>
  );
}

interface AIIntegrationSectionProps {
  fourthWallTime: boolean;
  onFourthWallTimeToggle: (checked: boolean) => void;
  timezone: string;
  onTimezoneChange: (value: string) => void;
}

export function AIIntegrationSection({ fourthWallTime, onFourthWallTimeToggle, timezone, onTimezoneChange }: AIIntegrationSectionProps) {
  return (
    <div className="space-y-3">
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
              htmlFor="fourth-wall-time-sys"
              className={cn(
                'text-sm font-medium cursor-pointer',
                fourthWallTime ? 'text-cyan-400' : 'text-foreground'
              )}
            >
              4th Wall Time
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Prefix all AI prompts with the current timestamp so your AI DM knows the real-world time.
            </p>
          </div>
          <Switch
            id="fourth-wall-time-sys"
            checked={fourthWallTime}
            onCheckedChange={onFourthWallTimeToggle}
            className="data-[state=checked]:bg-cyan-500"
          />
        </div>
      </div>

      <div className="p-3 rounded-lg border border-border/30 bg-card/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <Label className="text-sm font-medium text-foreground cursor-pointer">
                Time Zone
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your local clock is shown on your party card for other players.
            </p>
          </div>
        </div>
        <select
          value={timezone}
          onChange={e => onTimezoneChange(e.target.value)}
          className="mt-2 w-full bg-card/60 border border-border/40 rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-cyan-500/50"
        >
          {TIMEZONE_OPTIONS.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

interface NotificationsSectionProps {
  combatSettings: CombatSettings;
  onCombatSettingToggle: (key: keyof CombatSettings, checked: boolean) => void;
}

export function NotificationsSection({ combatSettings, onCombatSettingToggle }: NotificationsSectionProps) {
  return (
    <div className="space-y-3">
      <div
        className={cn(
          'p-3 rounded-lg border transition-all',
          combatSettings.showRoundNotifications
            ? 'border-purple-500/50 bg-purple-500/5'
            : 'border-border/30 bg-card/30'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Label
              htmlFor="round-notifications-sys"
              className={cn(
                'text-sm font-medium cursor-pointer',
                combatSettings.showRoundNotifications ? 'text-purple-400' : 'text-foreground'
              )}
            >
              Round Advance Notifications
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show toast notifications when combat rounds advance.
            </p>
          </div>
          <Switch
            id="round-notifications-sys"
            checked={combatSettings.showRoundNotifications !== false}
            onCheckedChange={(checked) => onCombatSettingToggle('showRoundNotifications', checked)}
            className="data-[state=checked]:bg-purple-500"
          />
        </div>
      </div>

    </div>
  );
}
