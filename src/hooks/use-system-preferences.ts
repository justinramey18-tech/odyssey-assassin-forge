import { useState, useEffect } from 'react';
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
  loadTimezone,
  saveTimezone,
  TIMEZONE_CHANGE_EVENT,
} from '@/lib/timezone-storage';

export function useSystemPreferences() {
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

  return {
    fourthWallTime,
    handleFourthWallTimeToggle,
    timezone,
    handleTimezoneChange,
    combatSettings,
    handleCombatSettingToggle,
  };
}
