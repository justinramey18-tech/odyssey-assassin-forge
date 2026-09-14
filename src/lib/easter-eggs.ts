export type EasterEggBadge = { label: string; color: string };

export function getThistleBadges(name: string): readonly EasterEggBadge[] {
  const n = (name || '').toLowerCase().trim();
  if (n.includes('thistlepig') || n.includes('thistle')) {
    return [
      { label: 'Cosmic Chef', color: 'purple' },
      { label: 'Seasoned', color: 'amber' },
    ];
  }
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

/** Easter egg: detect if the character name is "momo" */
export function isMomoEasterEgg(name: string): boolean {
  return name.toLowerCase().trim().includes('momo');
}

/** Easter egg: detect if the dragon name is "ellie" */
export function isEllieEasterEgg(name: string): boolean {
  return name.toLowerCase().trim().includes('ellie');
}

export function getEllieBadges(dragonName: string): readonly EasterEggBadge[] {
  if (isEllieEasterEgg(dragonName)) {
    return [{ label: "🐉 Ellie's Bond", color: 'rose' }];
  }
  return [];
}
