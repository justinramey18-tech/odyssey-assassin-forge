import { useState, useEffect } from 'react';
import { Clock, Globe, Bell } from 'lucide-react';
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
    const handle = (e: Event) => setFourthWallTime((e as CustomEvent<boolean>).detail);
    window.addEventListener(FOURTH_WALL_TIME_CHANGE_EVENT, handle);
    return () => window.removeEventListener(FOURTH_WALL_TIME_CHANGE_EVENT, handle);
  }, []);

  useEffect(() => {
    const handle = (e: Event) => setCombatSettings((e as CustomEvent<CombatSettings>).detail);
    window.addEventListener(COMBAT_SETTINGS_CHANGE_EVENT, handle);
    return () => window.removeEventListener(COMBAT_SETTINGS_CHANGE_EVENT, handle);
  }, []);

  useEffect(() => {
    const handle = (e: Event) => setTimezone((e as CustomEvent<string>).detail);
    window.addEventListener(TIMEZONE_CHANGE_EVENT, handle);
    return () => window.removeEventListener(TIMEZONE_CHANGE_EVENT, handle);
  }, []);

  return (
    <div className="space-y-3">
      {/* 4th Wall Time */}
      <div className={cn(
        'p-3 rounded-lg border transition-all',
        fourthWallTime ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-border/30 bg-card/30'
      )}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <Label htmlFor="fourth-wall-time-sys" className={cn(
                'text-sm font-medium cursor-pointer',
                fourthWallTime ? 'text-cyan-400' : 'text-foreground'
              )}>
                4th Wall Time
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Prefix AI prompts with real-world timestamp.
            </p>
          </div>
          <Switch
            id="fourth-wall-time-sys"
            checked={fourthWallTime}
            onCheckedChange={(c) => { setFourthWallTime(c); save4thWallTimeSetting(c); }}
            className="data-[state=checked]:bg-cyan-500"
          />
        </div>
      </div>

      {/* Timezone */}
      <div className="p-3 rounded-lg border border-border/30 bg-card/30">
        <div className="flex items-center gap-1.5 mb-2">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <Label className="text-sm font-medium text-foreground">Time Zone</Label>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Shown on your party card for other players.
        </p>
        <select
          value={timezone}
          onChange={e => { setTimezone(e.target.value); saveTimezone(e.target.value); }}
          className="w-full bg-card/60 border border-border/40 rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-cyan-500/50"
        >
          {TIMEZONE_OPTIONS.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>

      {/* Round Notifications */}
      <div className={cn(
        'p-3 rounded-lg border transition-all',
        combatSettings.showRoundNotifications ? 'border-purple-500/50 bg-purple-500/5' : 'border-border/30 bg-card/30'
      )}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-purple-400" />
              <Label htmlFor="round-notif-sys" className={cn(
                'text-sm font-medium cursor-pointer',
                combatSettings.showRoundNotifications ? 'text-purple-400' : 'text-foreground'
              )}>
                Round Advance Notifications
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show toasts when combat rounds advance.
            </p>
          </div>
          <Switch
            id="round-notif-sys"
            checked={combatSettings.showRoundNotifications !== false}
            onCheckedChange={(checked) => {
              const s = { ...combatSettings, showRoundNotifications: checked };
              setCombatSettings(s);
              saveCombatSettings(s);
            }}
            className="data-[state=checked]:bg-purple-500"
          />
        </div>
      </div>
    </div>
  );
}
