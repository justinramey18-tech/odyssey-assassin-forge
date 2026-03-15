

## Replace AFK Tab with Wild Shape Tab for Momo Moon Druid

### Problem
The Momo + Circle of the Moon druid character currently sees an AFK tab in the bottom nav of both Solo DM and Party DM screens. Since this character has the special easter egg granting full wild shape access, it makes more sense to replace that AFK tab with a Wild Shape tab so they can transform directly from the DM screens.

### Changes

**1. `src/components/ai-dm/DMBottomNav.tsx`**
- Add a new `'wildshape'` value to the `DMNavTab` type
- Add a `WILDSHAPE_TAB` constant (PawPrint icon, green color, label "SHAPES")
- Add a `showWildShape?: boolean` prop
- When `showWildShape` is true, replace `AFK_TAB` with `WILDSHAPE_TAB` in the tabs array; otherwise keep AFK

**2. `src/components/ai-dm/AIDMScreen.tsx`**
- Add `wildShape?: UseWildShapeReturn` and `wildShapeBackgrounds` props to `AIDMScreenProps`
- Add `isMomoMoonDruid?: boolean` prop (or derive from characterContext)
- Handle `'wildshape'` tab in `handleNavTabChange` — toggle the full-screen content panel showing a `WildShapeSection` (reuse from QuickActionsDrawer or extract it)
- Pass `showWildShape={isMomoMoonDruid}` to `DMBottomNav`
- Provide `wildshapeContent` as full-screen content when that tab is active

**3. `src/components/drawers/PromptDrawerProvider.tsx`**
- Pass `wildShape` instance to `AIDMScreen` when the momo+moon condition is met

**4. `src/components/ai-dm/PartyDMScreen.tsx`**
- Add `wildShape?: UseWildShapeReturn` prop
- Derive `isMomoMoonDruid` from `characterContext` name + class
- Handle `'wildshape'` tab in the nav tab handler (replacing AFK behavior)
- Pass `showWildShape` to `DMBottomNav`
- Show wild shape content panel when wildshape tab is active

**5. `src/components/ai-dm/StandalonePartyDMScreen.tsx`**
- Thread `wildShape` prop through to `PartyDMScreen`

**6. Extract `WildShapeSection` for reuse**
- The `WildShapeSection` and `WildShapeStatusBar` components in `QuickActionsDrawer.tsx` will be imported by the DM screens. They're already standalone function components — just need to export them.

### Summary
- The AFK tab is conditionally replaced with a Wild Shape tab when character is Momo + Moon Druid
- The Wild Shape tab opens a full-screen panel (same pattern as Dice/Settings/Oracle tabs) showing available forms, transform/revert controls, and status
- Non-Momo characters still see the AFK tab as before

