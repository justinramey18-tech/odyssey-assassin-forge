// Shared helper for detecting whether a multiplayer campaign reads as
// Fourth Wing / Empyrean based on its narrative content.
// Used at campaign-builder Apply time so parties get tagged correctly
// without the host having to manually flip the toggle.

const FOURTH_WING_KEYWORDS = [
  'basgiath', 'navarre', 'empyrean', 'threshing', 'venin',
  'signet', 'tyrrendor', 'aretia', 'fourth wing',
  'wyvern', 'gryphon', 'dragon bond', 'dragon rider',
];

export function detectCampaignType(text: string | null | undefined): 'dnd' | 'empyrean' {
  if (!text) return 'dnd';
  const lower = text.toLowerCase();
  // Require at least two distinct keyword matches to avoid false positives
  // (a stock D&D campaign that mentions "dragon" once shouldn't flip).
  const matched = FOURTH_WING_KEYWORDS.filter(k => lower.includes(k));
  return matched.length >= 2 ? 'empyrean' : 'dnd';
}
