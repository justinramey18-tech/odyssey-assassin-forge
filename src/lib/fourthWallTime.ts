// 4th Wall Time System
// Prefixes AI prompts with current EST timestamp for time-aware AI interactions

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
  const now = new Date();
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return estFormatter.format(now) + ' EST';
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
