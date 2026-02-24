

## Remove Target Length Options

The target multiplier UI and system prompt instructions contradict the anti-truncation prompt that tells Claude to be concise and prioritize completeness. The multiplier tells Claude to expand text by 1.5–3×, while the anti-truncation prompt tells it to use compact phrasing. These need to be reconciled by removing the multiplier entirely.

### Changes Required

**1. `src/components/scribe/ScribeContextPanel.tsx`**
- Remove the `MULTIPLIER_LABELS` constant (lines 34-38)
- Remove the `TargetMultiplier` import
- Remove the entire "Target Length" UI section (the label, toggle group with 1.5×/2×/3× options — approximately lines 148-165)

**2. `src/lib/scribe-context.ts`**
- Remove `TargetMultiplier` type export
- Remove `targetMultiplier` from `ScribeContextState` interface
- Remove `targetMultiplier` from `DEFAULT_CONTEXT_STATE`
- Remove `targetMultiplier` from `buildContextBody` extra fields

**3. `supabase/functions/scribe-ai/index.ts`**
- Remove `targetMultiplier` from destructured request body
- Remove `const multiplier = ...` line
- Remove `TARGET LENGTH: Aim for approximately ${multiplier}x...` from both system prompts (enhance and transform)

**4. `supabase/functions/narrative-forge/index.ts`**
- Remove `targetMultiplier` from the request body interface
- Remove `const multiplier = ...` line
- Remove `TARGET LENGTH: Aim for approximately ${multiplier}x...` from both system prompts

All four files changed. The multiplier is fully removed from UI, state, context building, and both edge functions.

