
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

---

# End Turn Button - COMPLETED ✅

Added prominent "End Turn" button to the Action Economy Bar.

## Features
- **Tap**: Ends turn, resets action economy, advances round counter
- **Hold (1 second)**: Ends turn + opens AI Smart Prompt synthesis sheet
- Visual progress indicator during hold
- Shows current round number (R1, R2, etc.)

---

# Turn Wizard - COMPLETED ✅

Added smart contextual guidance panel that suggests optimal next actions.

## Features
- **Context-aware suggestions** based on:
  - Unused action types (Action, Bonus, Reaction)
  - Current conditions (Hidden, Invisible, Poisoned, etc.)
  - HP percentage (low HP triggers defensive suggestions)
  - Abilities off cooldown (ready to use)
  - Equipped weapons availability

## Suggestion Priority System
- **High**: Critical opportunities (Strike from Shadows when hidden, Critical HP warnings)
- **Medium**: Standard action suggestions (Attack, ready abilities)
- **Low**: Utility reminders (Reaction ready, Turn complete)

## UI
- Collapsible panel between Action Economy Bar and tab content
- Shows up to 3 suggestions at a time
- Tappable suggestions navigate to relevant tab
- "HIDE" button to dismiss for the session

## Files Created/Modified
- Created `TurnWizardPanel.tsx` - Smart suggestion component
- Updated `MobileCombatLayout.tsx` - Integrated Turn Wizard
- Updated `index.ts` - Added export
