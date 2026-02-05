
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

## Files Modified
- `CombatBottomNav.tsx` - Updated tab type and definitions
- `MobileCombatLayout.tsx` - Updated TAB_ORDER, renderTabContent, filter state
- `CombatFAB.tsx` - Updated tab-based action switching
