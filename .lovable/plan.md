

## Make Party DM Aware of Wild Shape State

### What
Add wild shape transformation status to the character context sent to the AI DM, so the AI knows when the player is in beast/elemental/dragon form, what form they're in, and their form HP.

### Changes

**1. `src/components/oracle/types.ts`** — Add `wildShape` field to `CharacterContext`
```typescript
wildShape?: {
  isTransformed: boolean;
  formName: string | null;
  formHP: number;
  formMaxHP: number;
  formAC: number | null;
  formCR: number | null;
  usesRemaining: number;
  maxUses: number;
};
```

**2. `supabase/functions/ai-dm/index.ts`** — Two changes:
- Add matching `wildShape` field to the edge function's `CharacterContext` interface
- In `buildContextSummary`, add a section that renders wild shape status:
  - When transformed: `🐻 WILD SHAPE: [FormName] (CR X) | Form HP: Y/Z | Form AC: N | Uses: A/B`
  - When not transformed but has uses: `WILD SHAPE: Not transformed | Uses: A/B`

**3. `src/components/drawers/PromptDrawerProvider.tsx`** — Build `wildShape` context from the `wildShape` hook instance
- Read `wildShape.state` to get `isTransformed`, `currentForm`, `formHP`, `formMaxHP`, `usesRemaining`, `maxUses`
- Add to the returned `CharacterContext` object
- Add `wildShape` to the `useMemo` dependency array

