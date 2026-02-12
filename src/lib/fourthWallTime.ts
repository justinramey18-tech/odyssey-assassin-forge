// 4th Wall Time System
// Prefixes AI prompts with current timestamp in user's timezone for time-aware AI interactions

import { loadTimezone, getTimezoneTimestamp } from '@/lib/timezone-storage';

const STORAGE_KEY = 'odyssey-4th-wall-time';

// Custom event for same-tab synchronization
export const FOURTH_WALL_TIME_CHANGE_EVENT = 'odyssey-4th-wall-time-change';

export function load4thWallTimeSetting(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

export function save4thWallTimeSetting(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent(FOURTH_WALL_TIME_CHANGE_EVENT, { detail: enabled }));
  } catch (e) {
    console.error('Failed to save 4th Wall Time setting:', e);
  }
}

export function getCurrentESTTimestamp(): string {
  const tz = loadTimezone();
  return getTimezoneTimestamp(tz);
}

export function prefixWithTimestamp(prompt: string): string {
  const timestamp = getCurrentESTTimestamp();
  return `**[REAL-WORLD TIME: ${timestamp}]**

${prompt}`;
}

// Conditionally prefix a prompt based on the 4th Wall Time setting
export function applyTimePrefix(prompt: string): string {
  if (load4thWallTimeSetting()) {
    return prefixWithTimestamp(prompt);
  }
  return prompt;
}
