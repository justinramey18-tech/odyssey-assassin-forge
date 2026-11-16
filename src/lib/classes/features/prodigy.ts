// The Prodigy's features: one per Ascension tier (D-37). The numbers come from the shared
// Prodigy rules (src/lib/empyreanClasses/prodigy.ts), so the sheet always shows what the
// server applies.

import { ClassFeature } from './types';
import { ASCENSION_TIERS, describeTier } from '@/lib/empyreanClasses/prodigy';

export const PRODIGY_FEATURES: ClassFeature[] = ASCENSION_TIERS.map(a => ({
  id: `prodigy-ascension-${a.tier}`,
  classId: 'prodigy',
  name: `Ascension: ${a.name}`,
  level: a.fromLevel,
  description: `${a.motto} ${describeTier(a.tier).join(' ')}`,
  mechanicalEffect: describeTier(a.tier).join(' '),
  usageType: 'at_will',
  isSubclassFeature: false,
  iconName: 'Flame',
}));
