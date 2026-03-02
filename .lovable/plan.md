

## Step-by-Step Rollout Plan

Here's the full sequence, one prompt at a time. We'll start with **Step 1** now and do each subsequent step in its own prompt.

### The Order

1. **Encounter difficulty utility module** — `src/lib/combat/encounterDifficulty.ts` (pure math, no UI, no integrations)
2. **Difficulty preference setting** — Add to `combatSettings.ts` + UI selector in settings
3. **Wire into Solo AI DM** — Update `use-ai-dm.ts` to compute and send `encounterGuidance`
4. **Wire into Party AI DM** — Update `use-party-dm.ts` with party-level extraction
5. **Update edge function** — Accept `encounterGuidance` and inject into system prompt
6. **Class & multiclass context** — Add class identity to `CharacterContext` and pipe to AI
7. **Combat feats context** — Pass `combatSettings` flags to AI prompt
8. **Alignment context** — Feed alignment spectrum data to AI
9. **Resource pressure metric** — Computed HP%/slots/hit dice metric for pacing

### Step 1: Encounter Difficulty Utility Module

**New file: `src/lib/combat/encounterDifficulty.ts`**

Pure functions, zero dependencies beyond TypeScript types:

- `DifficultyPreference` type: `'easy' | 'normal' | 'hard' | 'deadly'`
- `EncounterDifficulty` type: `'trivial' | 'easy' | 'medium' | 'hard' | 'deadly'`
- `EncounterResult` interface with difficulty, adjustedXP, rawXP, multiplier, thresholds, xpPerPlayer
- `XP_THRESHOLDS` — DMG p.82 table, levels 1–20, four tiers
- `CR_TO_XP` — CR 0 through 30 (34 entries including fractional CRs)
- `ENCOUNTER_MULTIPLIERS` — monster count brackets with party-size adjustment
- `getXPThresholds(level)` — single character thresholds
- `getPartyThresholds(partyLevels[])` — summed across party
- `crToXP(cr)` — CR number to XP value
- `getEncounterMultiplier(monsterCount, partySize)` — with bracket shifting for small/large parties
- `calculateEncounterDifficulty(partyLevels[], monsterCRs[])` — full result object
- `getEncounterBudget(partyLevels[], difficulty)` — max XP for a target tier
- `getRecommendedCRRange(partyLevels[], preference)` — CR ranges per tier, shifted by preference
- `formatPartyPowerForPrompt(partyLevels[], preference)` — pre-formatted string for AI injection

**Updated file: `src/lib/combat/index.ts`**

Add `export * from './encounterDifficulty'`.

No UI, no settings changes, no hook modifications. Just the math foundation that everything else will build on.

