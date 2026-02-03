// ============================================
// SPELL DURATION TYPES & UTILITIES
// ============================================

export type DurationType = 
  | 'instantaneous'
  | '1_round'
  | '1_minute'
  | '10_minutes'
  | '1_hour'
  | '8_hours'
  | '24_hours'
  | 'until_dispelled'
  | 'concentration';

export interface ActiveSpellEffect {
  id: string; // Unique effect ID
  spellId: string;
  spellName: string;
  castLevel: number;
  durationType: DurationType;
  durationMs: number | null; // null = indefinite
  startedAt: number; // timestamp
  expiresAt: number | null; // null = indefinite
  isConcentration: boolean;
  casterName: string;
}

// ============================================
// DURATION CONSTANTS
// ============================================

export const DURATION_MS: Record<string, number> = {
  '1_round': 6 * 1000, // 6 seconds
  '1_minute': 60 * 1000,
  '10_minutes': 10 * 60 * 1000,
  '1_hour': 60 * 60 * 1000,
  '8_hours': 8 * 60 * 60 * 1000,
  '24_hours': 24 * 60 * 60 * 1000,
};

// ============================================
// PARSER - Convert spell duration string to type
// ============================================

export function parseDurationString(duration: string): { type: DurationType; ms: number | null } {
  const lower = duration.toLowerCase().trim();
  
  if (lower === 'instantaneous') {
    return { type: 'instantaneous', ms: null };
  }
  
  if (lower.includes('until dispelled')) {
    return { type: 'until_dispelled', ms: null };
  }
  
  // Check for concentration - extract the actual duration
  const isConcentration = lower.includes('concentration');
  let baseDuration = lower.replace(/concentration[,\s]+up to\s*/i, '').trim();
  
  // Parse time amounts
  if (baseDuration.includes('1 round') || baseDuration.includes('round')) {
    return { type: isConcentration ? 'concentration' : '1_round', ms: DURATION_MS['1_round'] };
  }
  
  // Match patterns like "1 minute", "10 minutes", "1 hour", etc.
  const minuteMatch = baseDuration.match(/(\d+)\s*minute/i);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1]);
    if (minutes === 1) {
      return { type: isConcentration ? 'concentration' : '1_minute', ms: DURATION_MS['1_minute'] };
    }
    if (minutes === 10) {
      return { type: isConcentration ? 'concentration' : '10_minutes', ms: DURATION_MS['10_minutes'] };
    }
    return { type: isConcentration ? 'concentration' : '1_minute', ms: minutes * 60 * 1000 };
  }
  
  const hourMatch = baseDuration.match(/(\d+)\s*hour/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    if (hours === 1) {
      return { type: isConcentration ? 'concentration' : '1_hour', ms: DURATION_MS['1_hour'] };
    }
    if (hours === 8) {
      return { type: isConcentration ? 'concentration' : '8_hours', ms: DURATION_MS['8_hours'] };
    }
    if (hours === 24) {
      return { type: isConcentration ? 'concentration' : '24_hours', ms: DURATION_MS['24_hours'] };
    }
    return { type: isConcentration ? 'concentration' : '1_hour', ms: hours * 60 * 60 * 1000 };
  }
  
  // Default to concentration type if we can't parse but it says concentration
  if (isConcentration) {
    return { type: 'concentration', ms: DURATION_MS['1_minute'] };
  }
  
  // Default fallback
  return { type: 'instantaneous', ms: null };
}

// ============================================
// FORMATTERS
// ============================================

export function formatDurationRemaining(remainingMs: number | null): string {
  if (remainingMs === null) {
    return '∞';
  }
  
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  
  if (totalSeconds <= 0) {
    return 'Expired';
  }
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `${seconds}s`;
}

export function getDurationLabel(type: DurationType): string {
  switch (type) {
    case 'instantaneous': return 'Instant';
    case '1_round': return '1 Round';
    case '1_minute': return '1 Minute';
    case '10_minutes': return '10 Minutes';
    case '1_hour': return '1 Hour';
    case '8_hours': return '8 Hours';
    case '24_hours': return '24 Hours';
    case 'until_dispelled': return 'Until Dispelled';
    case 'concentration': return 'Concentration';
    default: return 'Unknown';
  }
}

// ============================================
// EFFECT CREATION
// ============================================

export function createActiveSpellEffect(
  spellId: string,
  spellName: string,
  durationString: string,
  castLevel: number,
  isConcentration: boolean,
  casterName: string
): ActiveSpellEffect | null {
  const parsed = parseDurationString(durationString);
  
  // Don't track instantaneous spells
  if (parsed.type === 'instantaneous') {
    return null;
  }
  
  const now = Date.now();
  
  return {
    id: `${spellId}-${now}`,
    spellId,
    spellName,
    castLevel,
    durationType: isConcentration ? 'concentration' : parsed.type,
    durationMs: parsed.ms,
    startedAt: now,
    expiresAt: parsed.ms ? now + parsed.ms : null,
    isConcentration,
    casterName,
  };
}

// ============================================
// EXPIRATION CHECKS
// ============================================

export function isSpellExpired(effect: ActiveSpellEffect, now: number = Date.now()): boolean {
  if (effect.expiresAt === null) {
    return false; // Indefinite duration
  }
  return now >= effect.expiresAt;
}

export function getExpiredSpells(effects: ActiveSpellEffect[], now: number = Date.now()): ActiveSpellEffect[] {
  return effects.filter(e => isSpellExpired(e, now));
}

export function filterActiveSpells(effects: ActiveSpellEffect[], now: number = Date.now()): ActiveSpellEffect[] {
  return effects.filter(e => !isSpellExpired(e, now));
}
