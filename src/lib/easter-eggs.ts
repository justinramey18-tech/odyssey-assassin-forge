const THISTLE_NAMES = ['thistle'];

const THISTLE_BADGES = [
  { label: 'R4', color: 'emerald' },
  { label: 'The True Butler', color: 'amber' },
  { label: '007, DTF, Rising Pheonix', color: 'purple' },
] as const;

export type EasterEggBadge = { label: string; color: string };

export function getThistleBadges(name: string): readonly EasterEggBadge[] {
  const n = name.toLowerCase().trim();
  if (THISTLE_NAMES.includes(n)) return THISTLE_BADGES;
  return [];
}

const BADGE_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  rose: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

export function getBadgeColorClasses(color: string): string {
  return BADGE_COLORS[color] ?? '';
}
