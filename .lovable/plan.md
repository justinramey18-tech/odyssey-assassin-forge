
# Consolidate Combat Tabs from 7 to 5

## Current State (7 Tabs)
| Tab | Content |
|-----|---------|
| ATK | Weapon attacks |
| HIDE | Stealth abilities |
| SKILL | Special abilities |
| REACT | Reaction abilities |
| MAGIC | Spells |
| ITEMS | Consumables & loot |
| LOG | Combat history |

## Proposed Consolidation (5 Tabs)

| New Tab | Combines | Icon | Color |
|---------|----------|------|-------|
| **COMBAT** | ATK + HIDE | Crosshair | Red |
| **ACTIONS** | SKILL + REACT | Zap | Amber |
| **MAGIC** | Spells (unchanged) | Wand | Indigo |
| **ITEMS** | Consumables (unchanged) | Backpack | Green |
| **LOG** | Combat history (unchanged) | FileText | Primary |

---

## How Each Merged Tab Will Work

### 1. COMBAT Tab (Attacks + Stealth)
Shows all weapon cards at the top, then stealth abilities below. This makes sense because:
- Attacks and stealth go together in combat flow
- Sneak Attack is already shown on weapon cards
- Stealth abilities (Hide, Vanish) support weapon attacks

**Layout:**
- Weapon cards section (Primary, Secondary, Ranged)
- Divider
- Stealth abilities section (existing MobileAbilityList for assassin/shadow abilities)

### 2. ACTIONS Tab (Abilities + Reactions)
Groups all non-spell, non-weapon abilities together with filtering:
- Filter chips at top: "All" | "Actions" | "Bonus" | "Reactions"
- Shows special abilities from SKILL tab
- Shows reaction abilities from REACT tab
- Clear visual distinction for reaction abilities (different border/badge)

**Layout:**
- Filter bar (collapsible)
- Mixed ability list with action type indicators
- Reaction abilities marked with ⚡ badge

---

## Technical Changes

### 1. Update CombatBottomNav.tsx
- Change `CombatTab` type from 7 to 5 values
- Update tabs array with new structure
- New icons: Crosshair for Combat, Zap for Actions

### 2. Update MobileCombatLayout.tsx
- Update `TAB_ORDER` array to 5 tabs
- Modify `renderTabContent()` for new structure:
  - `combat`: Render weapons + stealth abilities together
  - `actions`: Render abilities + reactions with filter
- Add filter state for actions tab
- Update ability counts for badges

### 3. Create New Combined Components (Optional)
If needed, create wrapper components for cleaner code organization.

---

## User Experience Benefits
- **Fewer taps**: 5 tabs fit comfortably on all phone sizes
- **Logical grouping**: Related actions are together
- **More scrolling, less switching**: Natural mobile behavior
- **Filters replace tabs**: Users can narrow down within a tab instead of switching

---

## Files to Modify

| File | Changes |
|------|---------|
| `CombatBottomNav.tsx` | Update tab definitions (7 → 5) |
| `MobileCombatLayout.tsx` | Update tab rendering logic, add filter state |

No new files needed - just reorganizing existing component usage.
