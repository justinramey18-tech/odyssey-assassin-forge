// Prestige System Types
// Post-max-level progression for continued ability point earning

export interface PrestigeData {
  prestigeLevel: number;
  prestigeXP: number;
  totalPrestigePoints: number;
  spentPrestigePoints: number;
  availablePrestigePoints: number;
}

export const DEFAULT_PRESTIGE_DATA: PrestigeData = {
  prestigeLevel: 0,
  prestigeXP: 0,
  totalPrestigePoints: 0,
  spentPrestigePoints: 0,
  availablePrestigePoints: 0,
};

export interface PrestigeXPResult {
  type: 'normal' | 'prestige_xp' | 'prestige_levelup';
  amount?: number;
  newLevel?: number;
  pointsAwarded?: number;
}
