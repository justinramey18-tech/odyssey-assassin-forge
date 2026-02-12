// Timezone preference storage and formatting utilities

const STORAGE_KEY = 'odyssey-timezone';

export const TIMEZONE_CHANGE_EVENT = 'odyssey-timezone-change';

// Common timezone options grouped by region
export const TIMEZONE_OPTIONS: { label: string; value: string; abbr: string }[] = [
  // Americas
  { label: 'Eastern (ET)', value: 'America/New_York', abbr: 'ET' },
  { label: 'Central (CT)', value: 'America/Chicago', abbr: 'CT' },
  { label: 'Mountain (MT)', value: 'America/Denver', abbr: 'MT' },
  { label: 'Pacific (PT)', value: 'America/Los_Angeles', abbr: 'PT' },
  { label: 'Alaska (AKT)', value: 'America/Anchorage', abbr: 'AKT' },
  { label: 'Hawaii (HT)', value: 'America/Honolulu', abbr: 'HT' },
  { label: 'Atlantic (AT)', value: 'America/Halifax', abbr: 'AT' },
  { label: 'Newfoundland (NT)', value: 'America/St_Johns', abbr: 'NT' },
  { label: 'São Paulo (BRT)', value: 'America/Sao_Paulo', abbr: 'BRT' },
  { label: 'Buenos Aires (ART)', value: 'America/Argentina/Buenos_Aires', abbr: 'ART' },
  { label: 'Mexico City (CST)', value: 'America/Mexico_City', abbr: 'CST' },
  // Europe
  { label: 'London (GMT/BST)', value: 'Europe/London', abbr: 'GMT' },
  { label: 'Central Europe (CET)', value: 'Europe/Berlin', abbr: 'CET' },
  { label: 'Eastern Europe (EET)', value: 'Europe/Helsinki', abbr: 'EET' },
  { label: 'Moscow (MSK)', value: 'Europe/Moscow', abbr: 'MSK' },
  // Asia & Oceania
  { label: 'India (IST)', value: 'Asia/Kolkata', abbr: 'IST' },
  { label: 'China (CST)', value: 'Asia/Shanghai', abbr: 'CST' },
  { label: 'Japan (JST)', value: 'Asia/Tokyo', abbr: 'JST' },
  { label: 'Korea (KST)', value: 'Asia/Seoul', abbr: 'KST' },
  { label: 'Singapore (SGT)', value: 'Asia/Singapore', abbr: 'SGT' },
  { label: 'Dubai (GST)', value: 'Asia/Dubai', abbr: 'GST' },
  { label: 'Sydney (AEST)', value: 'Australia/Sydney', abbr: 'AEST' },
  { label: 'Auckland (NZST)', value: 'Pacific/Auckland', abbr: 'NZST' },
  // Africa
  { label: 'Cairo (EET)', value: 'Africa/Cairo', abbr: 'EET' },
  { label: 'Lagos (WAT)', value: 'Africa/Lagos', abbr: 'WAT' },
  { label: 'Johannesburg (SAST)', value: 'Africa/Johannesburg', abbr: 'SAST' },
];

export function loadTimezone(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && TIMEZONE_OPTIONS.some(tz => tz.value === stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  // Default: try to detect browser timezone, fall back to ET
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_OPTIONS.some(tz => tz.value === detected)) {
      return detected;
    }
  } catch {
    // ignore
  }
  return 'America/New_York';
}

export function saveTimezone(tz: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, tz);
    window.dispatchEvent(new CustomEvent(TIMEZONE_CHANGE_EVENT, { detail: tz }));
  } catch (e) {
    console.error('Failed to save timezone:', e);
  }
}

export function getTimezoneAbbr(tz: string): string {
  const option = TIMEZONE_OPTIONS.find(o => o.value === tz);
  return option?.abbr ?? 'UTC';
}

/** Format a short time string (e.g., "3:45 PM") for a given timezone */
export function formatTimeForTimezone(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return '';
  }
}

/** Format full timestamp for AI prompts */
export function getTimezoneTimestamp(tz: string): string {
  try {
    const abbr = getTimezoneAbbr(tz);
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
    return `${formatted} ${abbr}`;
  } catch {
    return new Date().toLocaleString();
  }
}
