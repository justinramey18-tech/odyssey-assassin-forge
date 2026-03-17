

# Update Chronicle Sync GM Guide

## What's Missing

The current guide doesn't cover several features the system already parses:

### 1. Expanded Shop & Merchant Inventory (lines 1447-1458)
The current section has only 5 examples. The parser (`shopItems.ts`) supports 12 distinct patterns:
- Merchant verb forms: "offers/sells/selling [Item] for [price]"
- Parenthetical prices: "Cloak of Protection (500 gp)"
- Colon-separated lists: "Potion of Healing: 50 gp"
- Reversed price-first: "500 gp for a Cloak of Protection"
- Purchase verbs: "buy/purchase [Item] for [price]"
- Bullet and numbered lists (already partially covered)
- Quantity notation: "3x Potion of Healing at 50 gp each"
- Discount/haggle: "[Item] reduced to 40 gp"
- Multi-currency: "sells [Item] for 5 pp" / "50 sp" / "100 cp"
- Item names must start with a capital letter and be 3-60 characters

### 2. Companion Tracking (completely absent)
The auto-sync edge function extracts `companion_hp_changes`, `companion_hp_absolute`, `companion_conditions_added`, and `companion_conditions_removed`. The guide needs a new section for:
- Companion damage: "Geralt takes 12 slashing damage"
- Companion healing: "Geralt regains 8 HP"
- Companion absolute HP: "Geralt: 53/59 HP"
- Companion conditions: "Geralt is now poisoned" / "Geralt is no longer stunned"

### 3. Absolute HP Statements (completely absent)
The auto-sync extracts `hp_absolute` and `companion_hp_absolute` from formats like:
- "Momo: 26/38 HP"
- "Geralt: 53/59 HP"
This is the most reliable format for HP tracking. A note should be added to the Damage and Healing sections.

### 4. Map Entity Announcements (completely absent)
The auto-sync extracts `map_entities` (newly introduced creatures/objects) and `map_entities_removed` (killed/defeated/fled). The guide should mention clear introduction and removal phrasing for battlemap auto-populate.

## Changes

### File: `src/lib/gmGuidePrompts.ts` (lines 1447-1458 and 1591)

**A. Replace the Shop & Merchant Inventory section** (lines 1447-1458) with an expanded version covering all 12 parser patterns, organized by format type with clear examples.

**B. Add a new "COMPANION TRACKING" section** after the Healing section (~after line 1168), covering companion HP changes, absolute HP, and companion conditions.

**C. Add "ABSOLUTE HP STATEMENTS" note** to the Damage and Healing sections, showing the "Name: current/max HP" format as the most reliable tracking method.

**D. Add a new "MAP & BATTLEMAP TOKENS" section** after Enemy Encounters (~after line 1421), explaining how clear creature introductions and defeat/flee announcements auto-populate the battlemap.

**E. Update the Quick Reference Cheat Sheet** (lines 1536-1565) with new rows for Shop Items, Companion HP, Companion Conditions, Absolute HP, and Map Tokens.

**F. Update Best Practices** (lines 1568-1591) with tips for companion naming, absolute HP, and shop formatting.

