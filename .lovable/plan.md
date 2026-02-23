

## App Mode System -- Final Visibility Matrix

### Summary of Changes from Original Plan

Based on your feedback, three adjustments were made:

1. **Companion mode** -- Added Empyrean tools (prompts + GM guides) but no health bar, rest buttons, or Solo DM
2. **Party mode** -- Party DM only (no Solo DM or Empyrean)
3. **Loot tab** -- Visible from Player mode and above (not just Party + Full Access)

---

### Final 5 Modes

| Mode | One-liner |
|------|-----------|
| **Companion** | Dice, Empyrean guides/prompts, clock -- pocket DM assistant |
| **Player** | Full character sheet, combat, inventory -- no AI or multiplayer |
| **Storyteller** | Player + AI DM (Solo), Scribe, Chronicle, Empyrean tools |
| **Party** | Player + multiplayer sync, party chat, Party DM, shared loot |
| **Full Access** | Everything unlocked |

---

### Navigation Tabs -- Final Matrix

| Tab | Companion | Player | Storyteller | Party | Full Access |
|-----|-----------|--------|-------------|-------|-------------|
| **Fighting: Combat** | -- | Yes | -- | Yes | Yes |
| **Fighting: Skills** | -- | Yes | -- | Yes | Yes |
| **Fighting: Abilities** | -- | Yes | Yes | Yes | Yes |
| **Fighting: Arcana** | -- | Yes | Yes | Yes | Yes |
| **Fighting: Legacy** | -- | Yes | Yes | Yes | Yes |
| **Inventory: Consumables** | -- | Yes | Yes | Yes | Yes |
| **Inventory: Shop** | -- | Yes | -- | Yes | Yes |
| **Inventory: Loot** | -- | Yes | -- | Yes | Yes |
| **Inventory: Gear** | -- | Yes | Yes | Yes | Yes |
| **Inventory: Stars** | -- | Yes | Yes | Yes | Yes |
| **Inventory: Feats** | -- | Yes | Yes | Yes | Yes |
| **Utility: Scribe** | -- | Yes | Yes | Yes | Yes |
| **Utility: Chronicle** | -- | -- | Yes | -- | Yes |
| **Utility: Cloud** | -- | Yes | Yes | Yes | Yes |
| **Utility: Settings** | Yes | Yes | Yes | Yes | Yes |

**Category visibility rule:** If a category has zero visible tabs, its card and header dropdown are hidden entirely. For Companion, only Settings is visible in Utility -- this single tab is accessed via Quick Access menu, so no category cards appear at all.

---

### Home Screen Elements -- Final Matrix

| Element | Companion | Player | Storyteller | Party | Full Access |
|---------|-----------|--------|-------------|-------|-------------|
| Character name/level | Yes | Yes | Yes | Yes | Yes |
| D20 roller | Yes | Yes | Yes | Yes | Yes |
| Clock widget | Yes | Yes | Yes | Yes | Yes |
| Health bar | No | Yes | Yes | Yes | Yes |
| Rest buttons | No | Yes | Yes | Yes | Yes |
| Category nav cards | No | Yes | Yes | Yes | Yes |
| Play Mode toggle | No | No | No | Yes | Yes |
| Party button/panel | No | No | No | Yes | Yes |
| Wild Shape overlay | No | Yes | Yes | Yes | Yes |
| Battle Map button | No | No | No | Yes | Yes |

---

### DM Drawer Buttons -- Final Matrix

| Button | Companion | Player | Storyteller | Party | Full Access |
|--------|-----------|--------|-------------|-------|-------------|
| Solo DM | No | No | Yes | No | Yes |
| Party DM | No | No | No | Yes | Yes |
| Empyrean Campaign | Yes | No | Yes | No | Yes |

**Note:** In Companion mode, the Empyrean Campaign button needs a different access point since there is no DM Drawer. It will render as a home screen card/button instead.

---

### Quick Access Menu -- Final Matrix

| Item | Companion | Player | Storyteller | Party | Full Access |
|------|-----------|--------|-------------|-------|-------------|
| RP Prompts | Yes | No | Yes | No | Yes |
| Quick Actions | No | Yes | Yes | Yes | Yes |
| Combat | No | Yes | No | Yes | Yes |
| Abilities | No | Yes | Yes | Yes | Yes |
| Arcana | No | Yes | Yes | Yes | Yes |
| Oracle | No | No | Yes | No | Yes |
| Features | Yes | Yes | Yes | Yes | Yes |
| Settings | Yes | Yes | Yes | Yes | Yes |

---

### Feature ID Reference

These are the string IDs used in code for the visibility maps:

**Navigation tabs:** `combat`, `skills`, `abilities`, `arcana`, `legacy`, `consumables`, `shop`, `loot`, `gear`, `stars`, `feats`, `scribe`, `chronicle`, `cloud`, `settings`

**Home screen:** `home.healthBar`, `home.restButtons`, `home.categoryNav`, `home.playModeToggle`, `home.partyButton`, `home.partyChat`, `home.battleMap`, `home.wildShape`, `home.dmDrawer`, `home.empyrean`, `home.empyreanCard`

**Quick access:** `quickAccess.prompts`, `quickAccess.quickActions`, `quickAccess.combat`, `quickAccess.abilities`, `quickAccess.arcana`, `quickAccess.oracle`, `quickAccess.features`, `quickAccess.settings`

**DM drawer:** `dm.solo`, `dm.party`, `dm.empyrean`

---

### Technical Implementation

#### Phase 1: Data Layer + Mode Selection Screen

**New files:**

1. `src/lib/app-modes.ts` -- AppMode type, APP_MODE_CONFIGS with the matrices above, helper functions (`isFeatureVisible`, `getVisibleSubTabs`, `getVisibleCategories`)
2. `src/hooks/use-app-mode.ts` -- Hook managing mode + per-mode customization overrides in localStorage, custom event dispatch
3. `src/components/home/ModeSelectionScreen.tsx` -- First-launch fullscreen mode picker replacing IntroSplashScreen

#### Phase 2: Wire Visibility into Navigation

**Modified files:**

- `src/components/navigation/types.ts` -- Add `getFilteredSubTabsForCategory(category, visibleTabIds)`
- `src/components/navigation/AssassinHeader.tsx` -- Filter dropdowns by visible tabs/categories
- `src/components/navigation/SubTabStrip.tsx` -- Use filtered tab arrays
- `src/components/home/CategoryQuickNav.tsx` -- Filter categories and sub-tab dropdowns

#### Phase 3: Wire into Home Screen + Drawers

**Modified files:**

- `src/pages/Index.tsx` -- Replace IntroSplashScreen, pass mode context down
- `src/components/home/HomeScreen.tsx` -- Conditionally render health bar, rests, category nav, party UI, Empyrean card (for Companion mode)
- `src/components/home/DMDrawer.tsx` -- Gate Solo DM, Party DM, Empyrean buttons by mode

#### Phase 4: Settings + Customization

**Modified files:**

- `src/components/settings/SettingsModal.tsx` -- Add App Mode section at top
- `src/components/settings/MobileSettingsTabs.tsx` -- Add App Mode tab or section

#### Phase 5: Cleanup

**Deleted files:**

- `src/components/home/IntroSplashScreen.tsx` -- Replaced by ModeSelectionScreen

