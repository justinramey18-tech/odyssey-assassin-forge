

## Plan: Convert Ready-Up Pills to Collapsible Dropdown Drawers

### Current State
- Lines 930–1063 of `PartyDMScreen.tsx`: The "Round Queue" section renders player pills in a horizontal `flex-wrap` layout with an expandable prompt viewer below them
- `DMBottomNav.tsx`: Existing slide-up/down drawer pattern with touch gestures and framer-motion animations

### Changes

**1. Replace pills with stacked accordion-style dropdowns** (PartyDMScreen.tsx, lines 930–1063)
- Replace the `flex-wrap` pill row with a vertical stack of dropdown items
- Each item: a clickable row showing character name + ready status icon + team dot (same info as current pills)
- Clicking a row toggles open a panel below it containing the player's prompt in a textarea (editable for self, read-only for others) — same logic as current expanded pill content
- Use Radix Accordion (already installed) or manual open/close state keyed by user_id

**2. Make the entire queue collapsible behind the input area**
- Wrap the queue section in a framer-motion collapsible container
- When collapsed: show a thin tap-to-expand strip between the chat and input areas reading "Round Queue • X/Y ready" with a chevron-up icon
- When expanded: show the full stack of dropdown items with the same strip as header (chevron rotates down)
- Add swipe-down gesture to collapse (reuse the touch pattern from `DMBottomNav.tsx`)
- Default state: expanded

**3. State changes**
- Replace `expandedPillUserId` with `expandedDropdownUserId` (or reuse same variable)
- Add `isQueueExpanded` boolean state, default `true`
- Collapse queue automatically when DM is generating (same as current pill collapse behavior)

### Files Modified
- `src/components/ai-dm/PartyDMScreen.tsx` — replace pill UI with accordion dropdowns + collapsible wrapper

### No new files or dependencies needed
- Framer motion already available for animations
- Touch gesture pattern copied from `DMBottomNav.tsx`

