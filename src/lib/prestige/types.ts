// Prestige System Types
// Post-max-level progression for continued ability point earning
// Points are unified with regular ability points

export interface PrestigeData {
  prestigeLevel: number;
  prestigeXP: number;
  totalPrestigePoints: number;  // Total points earned from prestige levels
}

export const DEFAULT_PRESTIGE_DATA: PrestigeData = {
  prestigeLevel: 0,
  prestigeXP: 0,
  totalPrestigePoints: 0,
};

export interface PrestigeXPResult {
  type: 'normal' | 'prestige_xp' | 'prestige_levelup';
  amount?: number;
  newLevel?: number;
  pointsAwarded?: number;
}
