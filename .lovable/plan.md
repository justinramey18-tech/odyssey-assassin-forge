
# Combat Tab Consolidation - COMPLETED ✅

Consolidated 7 combat tabs into 5 for better mobile UX.

## Final Structure (5 Tabs)

| Tab | Combines | Icon | Color |
|-----|----------|------|-------|
| **COMBAT** | Weapons + Stealth abilities | Crosshair | Red |
| **ACTIONS** | Special abilities + Reactions (with filter) | Zap | Amber |
| **MAGIC** | Spells | Wand | Indigo |
| **ITEMS** | Consumables & loot | Backpack | Green |
| **LOG** | Combat history | FileText | Primary |

## Implementation Details

### COMBAT Tab
- Shows Sneak Attack status at top
- Weapon cards from equipped gear
- Stealth/Assassin abilities below (with section divider)

### ACTIONS Tab  
- Filter chips: All | ⚔️ Action | ⚡ Bonus | 🛡️ Reaction
- Mixed ability list with action type indicators
- Reaction abilities highlighted with cyan left border
- Built-in reactions from MobileReactionsList included

---

# End Turn Button - COMPLETED ✅

Added prominent "End Turn" button to the Action Economy Bar.

## Features
- **Tap**: Ends turn, resets action economy, advances round counter
- **Hold (1 second)**: Ends turn + opens AI Smart Prompt synthesis sheet
- Visual progress indicator during hold
- Shows current round number (R1, R2, etc.)

## Technical Changes
- Updated `ActionEconomyBar.tsx` with new `round`, `onEndTurn`, `onEndTurnWithSynthesis` props
- Added hold-to-activate progress animation using pointer events
- Integrated with existing `handleResetTurn` and `SmartPromptSheet`

## Files Modified
- `CombatBottomNav.tsx` - Updated tab type and definitions
- `MobileCombatLayout.tsx` - Updated TAB_ORDER, renderTabContent, filter state, End Turn handlers
- `CombatFAB.tsx` - Updated tab-based action switching
- `ActionEconomyBar.tsx` - Added End Turn button with hold-to-synthesize
