import { CharacterPrompt, masterworkSubcategories } from './characterPrompts';

export interface SubcategoryGroup {
  subcategory: string;
  prompts: CharacterPrompt[];
}

/**
 * Groups masterwork prompts by subcategory in the defined order.
 * Returns flat list for non-masterwork prompts.
 */
export function groupBySubcategory(prompts: CharacterPrompt[]): SubcategoryGroup[] {
  const groups: SubcategoryGroup[] = [];
  
  for (const sub of masterworkSubcategories) {
    const matching = prompts.filter(p => p.subcategory === sub);
    if (matching.length > 0) {
      groups.push({ subcategory: sub, prompts: matching });
    }
  }
  
  // Any without subcategory go into an "Other" group
  const ungrouped = prompts.filter(p => !p.subcategory);
  if (ungrouped.length > 0) {
    groups.push({ subcategory: 'Other', prompts: ungrouped });
  }
  
  return groups;
}

/**
 * Check if a stone ID is the masterwork stone (for conditional subcategory rendering).
 */
export function isMasterworkStone(stoneId: string): boolean {
  return stoneId === 'masterwork';
}
