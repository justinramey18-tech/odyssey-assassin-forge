

## Plan: Fix unread badge visibility + add unread animation on party chat icon

### Problem
The unread badge on the party chat floating button (line ~1091) is too small (`min-w-[16px] h-[16px] text-[9px]`) relative to the enlarged 72px button, making it invisible or barely noticeable.

### Changes

**`src/components/ai-dm/PartyDMScreen.tsx`** (~lines 1090-1094)
- Increase badge size to `min-w-[24px] h-[24px] text-[11px]` so it's proportional to the 72px button
- Reposition to `-top-2 -right-2` for better visibility
- Add a pulsing ring animation behind the button when `chatUnreadCount > 0` — a green ring (`ring-2 ring-emerald-400 animate-pulse`) on the button container
- Add `animate-bounce` or a subtle scale pulse on the badge itself to draw attention

**`src/index.css`** (optional)
- Add a `@keyframes chat-unread-pulse` animation if the Tailwind defaults aren't sufficient — a breathing glow effect on the chat icon border

