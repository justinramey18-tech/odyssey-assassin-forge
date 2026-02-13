const THISTLE_NAMES = ['thistle', 'thistlepig'];

const THISTLE_BADGES = [
  { label: 'R4', color: 'emerald' },
  { label: 'The True Butler', color: 'amber' },
  { label: '007, DTF, Rising Pheonix', color: 'purple' },
] as const;

export type EasterEggBadge = (typeof THISTLE_BADGES)[number];

export function getThistleBadges(name: string): readonly EasterEggBadge[] {
  return THISTLE_NAMES.includes(name.toLowerCase().trim())
    ? THISTLE_BADGES
    : [];
}

const BADGE_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export function getBadgeColorClasses(color: string): string {
  return BADGE_COLORS[color] ?? '';
}
