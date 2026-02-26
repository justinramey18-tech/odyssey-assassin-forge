

# Transform DM Headers: Prominent "Dungeon Master" Title + Clean Sub-Header

## Problem

Currently both Solo and Party DM headers cram everything into a single row: back button, crown icon, campaign dropdown, model label, cost, settings button (solo) / player count, sync, map, saves, chat, guides, visibility toggle, new campaign, end session buttons (party). This is cluttered on mobile and doesn't match the prominent "Dungeon Master" title style shown in the reference image.

## Design

The reference image shows a clean, prominent header with "DUNGEON MASTER" in large Cinzel font spanning the full width, with a back arrow on the left. Secondary actions (player count, sync) are beside the title but smaller. Below that is a secondary info strip.

We'll adopt this two-row pattern for both screens:

```text
┌──────────────────────────────────────────┐
│ ← 👑 DUNGEON MASTER ▼    [save badge]   │  ← Row 1: Main header
│         (campaign dropdown)              │
├──────────────────────────────────────────┤
│ 5 Players · Sync · Map · Saves · Chat · │  ← Row 2: Sub-header (scrollable)
│ Guides · 👁 · + · ✕                     │
└──────────────────────────────────────────┘
```

### Row 1 — Main Header (both screens)
- Back arrow (left)
- Crown icon + "DUNGEON MASTER" in large `font-cinzel` text (or campaign name via dropdown)
- Save indicator (party) / model label + cost (solo)
- Settings gear (solo only — opens tools drawer)

### Row 2 — Sub-Header Strip (horizontally scrollable)
- **Solo**: HP · Level · Conditions · Summary size · Cloud sync · Model label (moved from row 1 context banner)
- **Party**: Player count · Sync toggle · Map · Saves · Chat · Guides (with badge) · Visibility toggle · New campaign · End session

This moves the current Solo "context banner" (HP/Level/Conditions/Cloud) into the sub-header, and moves all the Party action buttons from the cramped header row into the sub-header.

## Files Changed

| File | Change |
|------|--------|
| `src/components/ai-dm/AIDMScreen.tsx` | Redesign header (lines 543-586) into two rows: prominent title + sub-header with context info. Remove separate context banner button (lines 589-642) and merge its content into sub-header row |
| `src/components/ai-dm/PartyDMScreen.tsx` | Redesign header (lines 493-648) into two rows: prominent title + scrollable sub-header with all action buttons. Remove/merge the mode indicator strip (lines 651-671) into sub-header |

## Detailed Changes

### Solo DM (`AIDMScreen.tsx`)

**Row 1** (replaces lines 543-586):
- Back button
- Crown icon + CampaignDropdown (with larger font, `text-lg font-cinzel`)
- Model label (small, muted) + Settings button

**Row 2** (replaces the context banner at lines 589-642):
- Horizontally scrollable strip with: HP display, Level, active conditions, campaign summary size, cloud sync status, summarizing indicator
- Tapping still toggles expanded context details (loadout, spell slots)

### Party DM (`PartyDMScreen.tsx`)

**Row 1** (replaces lines 493-531):
- Back button
- Crown icon + "DUNGEON MASTER" title (or CampaignDropdown for creators)
- Save badge (tap to save)
- Player count badge

**Row 2** (replaces lines 532-648 action buttons + mode indicator at 651-671):
- Horizontally scrollable strip containing all the existing action buttons: Sync, Map, Saves, Chat, Guides, visibility toggle, new campaign, end session
- Mode indicator (Shared/Private) + message count integrated into this row

## Technical Notes

- Both row 1 headers use `font-cinzel text-lg` for the title to match the reference image's prominent style
- Sub-header uses `overflow-x-auto scrollbar-hide` for horizontal scroll on mobile
- All existing functionality is preserved — just reorganized into the two-row layout
- The expanded context details panel (solo) remains as an expandable section below the sub-header
- No new components needed — this is a JSX restructuring within the two existing files

