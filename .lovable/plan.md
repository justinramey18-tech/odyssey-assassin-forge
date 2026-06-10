## Goal
Replace the "Previously in your campaign…" recap banner at the bottom of the Party DM chat with a navigation button labeled "Dad Huddle — Consult with Other Players" that opens the existing Party Chat overlay.

## Where the change happens
- File: `src/components/ai-dm/PartyDMScreen.tsx`
- Location: lines ~2245–2267 (the amber recap block that renders the scroll icon, the "Previously in your campaign..." label, the chevron, and the expandable summary)

## What changes
1. Remove the entire collapsible recap block (the button + expanded summary panel).
2. Remove the now-unused `recapExpanded` state (keep `recapDismissed` — it's still set elsewhere at lines 1466, 1477, 3099 and harmlessly persists).
3. Render a new button in the same spot, styled to match the existing amber/cinzel aesthetic so it feels native to the DM screen:
   - Label: "Dad Huddle — Consult with Other Players"
   - Icon: `MessageSquare` (lucide) on the left, small chevron-right on the right
   - On click: calls the existing `onShowChat?.()` prop (already wired in PartyDMScreen — it opens the Party Chat overlay used by the Tools → Party Chat entry)
4. Visibility rules stay the same as today: only show when there are messages and the recap hasn't been dismissed (so the button doesn't appear on a blank screen and disappears once the player commits an action, mirroring current behavior). If you'd prefer it to always be visible, say so and I'll drop the gating.

## Out of scope
- No changes to Empyrean DM screen (separate file `EmpyreanDMScreen.tsx`), unless you want the same treatment there.
- No changes to Party Chat itself, the Tools menu, onboarding, recap generation logic, or the campaignSummary data — that data simply stops being surfaced from this spot.

## Clarifying note
Your message said "at the bottom of each AI response" — in the current code this banner actually renders **once** at the bottom of the whole message list (not per-message), which matches your screenshot. The plan replaces that single banner. If you actually want a per-message button under every DM reply, that's a different (larger) change — let me know.