// Encumbrance — carrying capacity based on Strength score (5e rules)

export type EncumbranceLevel = 'unencumbered' | 'encumbered' | 'heavily-encumbered' | 'overloaded';

export interface EncumbranceInfo {
  load: number;
  capacity: number;
  encumberedAt: number;
  heavilyEncumberedAt: number;
  level: EncumbranceLevel;
  label: string;
  /** Tailwind text colour token class. */
  colorClass: string;
  /** Short mechanical effect, empty when unencumbered. */
  effect: string;
  percent: number;
}

export function computeEncumbrance(load: number, strengthScore: number): EncumbranceInfo {
  const str = Number.isFinite(strengthScore) && strengthScore > 0 ? strengthScore : 10;
  const safeLoad = Number.isFinite(load) && load > 0 ? load : 0;

  const capacity = str * 15;
  const encumberedAt = str * 5;
  const heavilyEncumberedAt = str * 10;

  let level: EncumbranceLevel = 'unencumbered';
  if (safeLoad > capacity) level = 'overloaded';
  else if (safeLoad > heavilyEncumberedAt) level = 'heavily-encumbered';
  else if (safeLoad > encumberedAt) level = 'encumbered';

  const meta: Record<EncumbranceLevel, { label: string; colorClass: string; effect: string }> = {
    'unencumbered': { label: 'Unencumbered', colorClass: 'text-muted-foreground', effect: '' },
    'encumbered': { label: 'Encumbered', colorClass: 'text-amber-400', effect: 'Speed -10 ft.' },
    'heavily-encumbered': { label: 'Heavily Encumbered', colorClass: 'text-orange-400', effect: 'Speed -20 ft., disadvantage on STR/DEX/CON checks, attacks and saves.' },
    'overloaded': { label: 'Over Capacity', colorClass: 'text-destructive', effect: 'Cannot carry more — drop or sell gear.' },
  };

  return {
    load: safeLoad,
    capacity,
    encumberedAt,
    heavilyEncumberedAt,
    level,
    percent: capacity > 0 ? Math.min(100, Math.round((safeLoad / capacity) * 100)) : 0,
    ...meta[level],
  };
}
