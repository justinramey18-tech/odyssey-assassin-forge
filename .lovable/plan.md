

## Vertical HP Bar in Party DM Chat

### What it does
Adds a narrow vertical HP bar on the right edge of the inline DM narrative chat area. It mirrors the homescreen's `DynamicHealthBar` — same colors, glow, segmentation, and health states — but rendered vertically. It stays fixed on the right side while messages scroll, and is narrow enough (about 20px wide) to not impede text visibility.

### Changes

**1. Create `src/components/home/VerticalHealthBar.tsx`**
- A new component that reuses the same health-state logic from `DynamicHealthBar` (color gradients, glow, critical pulse)
- Renders as a tall, narrow vertical bar (width ~20px, full height of parent)
- HP fill grows from bottom to top (percentage-based)
- Includes temp HP cyan accent on top of the fill
- Shows segmented lines (horizontal dividers instead of vertical)
- Small heart icon at top, compact HP text (`currentHP/maxHP`) rendered vertically or abbreviated
- Semi-transparent background so chat text behind is still somewhat visible
- Same props interface as `DynamicHealthBar`: `currentHP`, `maxHP`, `tempHP`, `onTap`, `isWildShape`, `wildShapeFormName`

**2. Update `src/components/ai-dm/PartyDMScreen.tsx`**
- Import `VerticalHealthBar`
- Inside the messages container div (line ~1712, the `flex-1 min-h-0 relative flex flex-col overflow-hidden` div), add the vertical bar as an absolutely positioned element on the right side: `absolute right-0 top-0 bottom-0 z-10 pointer-events-none` (with the bar itself having `pointer-events-auto` for tap)
- Pass `characterContext?.currentHP`, `characterContext?.maxHP`, `characterContext?.tempHP` as props
- Pass `onTap` to open the stats drawer if available
- Add right padding (~24px) to the scroll area so message text doesn't go behind the bar

**3. Also update `StandalonePartyDMScreen.tsx`**
- Same pattern if it has the same chat layout

### Technical details
- The vertical bar uses `position: absolute; right: 0; top: 0; bottom: 0` inside the existing messages container
- Bar width: `w-5` (20px) — thin enough to stay out of the way
- Fill direction: `bottom-to-top` via `inset-x-0 bottom-0` with height percentage
- The scroll div gets `pr-6` added to prevent text overlap
- Framer Motion entrance animation: `scaleY` from 0 to 1 with `transformOrigin: 'bottom'`
- Uses the same color functions extracted from `DynamicHealthBar` logic

