
# Fix Roll Quality Descriptions in AI DM Prompts — ✅ COMPLETE

All tasks implemented. Roll quality now uses natural die values per 5e rules.

## Completed

1. ✅ Created `src/lib/rollQuality.ts` — centralized `getD20RollQuality()` and `getAbilityRollQuality()`
2. ✅ `src/lib/rpPromptGenerator.ts` — replaced broken isHighRoll logic with `getAbilityRollQuality()`
3. ✅ `src/components/drawers/QuickActionsDrawer.tsx` — replaced broken threshold math with `getD20RollQuality()`
4. ✅ `src/components/combat/CombatTabScreen.tsx` — added roll quality narrative to `generateWeaponPrompt()`
5. ✅ `src/components/combat/mobile/CombatAbilityCard.tsx` — replaced hardcoded thresholds with `getAbilityRollQuality()`
6. ✅ `src/lib/combat/attackQueuePrompts.ts` — added roll quality to multi-attack and queued attack prompts
7. ✅ `src/lib/diceRollerConfig.ts` — updated damage description to scale with context
