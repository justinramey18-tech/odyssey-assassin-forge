

## Staged Alignment Badge Implementation Plan

The alignment data exists but is never shown passively on prompts. We will break this into **5 sequential prompts**, each adding visible alignment badges to one prompt UI at a time.

---

### Prompt 1: Create the reusable `AlignmentBadge` component + update Home Screen drift indicator

**What gets built:**
- A small `<AlignmentBadge promptId={id} />` component that looks up the prompt's alignment via `getPromptAlignment()` → `getAlignmentZone()` and renders a tiny colored pill (e.g., `🌿 CG` in emerald, `💀 CE` in red)
- Returns null if no alignment data exists for that prompt ID
- Update `AlignmentDriftIndicator` to remove the `historyCount === 0` guard — show "True Neutral" with a "No drift data yet" label as the default state

**Why first:** This establishes the shared component every subsequent prompt will use, and immediately makes the drift visible on the home screen.

---

### Prompt 2: Add alignment badges to the Empyrean Prompt Library

**What gets built:**
- Insert `<AlignmentBadge>` next to each prompt title in `EmpyreanPromptLibrary.tsx`
- Badges show passively on every prompt, independent of the alignment target filter
- Uses the existing `getPromptAlignment(p.id)` call already in the render loop

---

### Prompt 3: Add alignment badges to the Novel Prompt Drawer (Scribe)

**What gets built:**
- Insert `<AlignmentBadge>` next to each prompt in `NovelPromptDrawer.tsx`
- Same pattern as Prompt 2, leveraging the shared component

---

### Prompt 4: Add alignment badges to the Dice Roller prompt tab

**What gets built:**
- Insert `<AlignmentBadge>` into the prompt list within `DiceRollerScreen.tsx`
- Same shared component, same pattern

---

### Prompt 5: Add alignment badges to DM Quick Actions + Geralt prompts

**What gets built:**
- Tag each action in `DMQuickActions.tsx` (both starter and inline variants) with alignment scores and display the badge
- Add alignment scores to Geralt prompts in `geralt-prompts.ts` and display badges in `GeraltGameplayWidget.tsx`

---

### Technical Notes

- The `AlignmentBadge` component will live at `src/components/alignment/AlignmentBadge.tsx`
- It will use `cssColor` from the zone data for inline styling (proven pattern from previous fix)
- Each prompt file already imports `getPromptAlignment` — minimal wiring needed
- For DM Quick Actions and Geralt prompts that lack entries in `PROMPT_ALIGNMENT_MAP`, we will add alignment scores directly to the action/prompt data objects

