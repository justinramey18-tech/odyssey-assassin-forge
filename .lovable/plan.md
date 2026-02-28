

## Plan: Add Geralt Gameplay Widget to DM Screens (Momo-Only)

### Overview
Add a 4th "GERALT" tab to the DM bottom navigation bar (visible only when the character is named "momo") that opens a fullscreen, mobile-first widget with 3 tabbed sections: Stats, Actions, and Role-Playing Prompts.

### Architecture

```text
DMBottomNav
  ├── DICE
  ├── RP PROMPTS
  ├── ACTIONS
  └── GERALT (momo-only, 4th tab)
        → Opens fullscreen GeraltGameplayWidget
            ├── Stats tab (HP, Level/XP, Ability Scores, Conditions, Mood)
            ├── Actions tab (Attacks with dice rolls, Bear Hug)
            └── RP Prompts tab (placeholder for future content)
```

### Implementation Steps

1. **Create `src/components/ai-dm/GeraltGameplayWidget.tsx`**
   - Fullscreen mobile-first overlay (like other DM overlays)
   - 3 header tabs using existing `Tabs` component: Stats, Actions, RP Prompts
   - **Stats tab**: Extract and reuse HP widget, Level/XP, Ability Scores, Conditions, and Mood sections from `GeraltCompanionScreen.tsx`
   - **Actions tab**: Extract and reuse Attacks section with dice rolling (Hit/Dmg buttons, roll result banner, NAT 20/1 detection) from `GeraltCompanionScreen.tsx`
   - **RP Prompts tab**: Empty placeholder with "Coming soon" message
   - Uses same `GeraltState` type, `loadState`/`saveState` helpers, and `characterId`-scoped localStorage
   - Back button to close

2. **Update `DMBottomNav.tsx`**
   - Add optional `showGeralt` prop and `'geralt'` to `DMNavTab` type
   - Conditionally render 4th tab with a paw/bird icon (e.g., `Bird` from lucide) in pink/purple theme
   - Only show when `showGeralt` is true

3. **Update `AIDMScreen.tsx`**
   - Import `isMomoEasterEgg` and `GeraltGameplayWidget`
   - Detect momo from `characterName` prop
   - Pass `showGeralt` to `DMBottomNav`
   - Add state for `showGeraltWidget`, open it when the geralt tab is selected
   - Pass `characterId` (derive from `characterContext` or `userId`) to the widget

4. **Update `PartyDMScreen.tsx`**
   - Same momo detection and `showGeralt` passthrough to `DMBottomNav`
   - Same state and overlay rendering for `GeraltGameplayWidget`

### Shared Logic
The `GeraltState` type, `DEFAULT_STATE`, `ATTACKS`, `CONDITIONS`, `MOODS`, `MOOD_CONFIG`, storage helpers, and `formatMod` will be extracted from `GeraltCompanionScreen.tsx` into a shared file `src/components/companion/geralt-data.ts` so both the home screen overlay and the DM gameplay widget reuse the same data and state.

### What Gets Built Now vs Later
- **Now**: Full architecture, Stats tab (complete), Actions tab (complete with dice rolls)
- **Later**: RP Prompts tab content (placeholder only for now)

