

## Plan: Add App-Level Fullscreen Mode to Solo & Party DM Chats

### What It Does
A maximize button in each DM header hides the header, subheader, and bottom nav toolbar — leaving only the chat messages and input bar visible. A small floating button in the corner lets users exit fullscreen.

### File Changes

1. **`src/components/ai-dm/AIDMScreen.tsx`** (Solo DM)
   - Add `isFullscreen` state (`useState(false)`)
   - Add an `Maximize2` icon button in the header's right-side controls
   - Conditionally hide: Row 1 header, Row 2 subheader, and `DMBottomNav` when `isFullscreen` is true
   - Render a floating exit button (fixed, bottom-right corner, semi-transparent) showing `Minimize2` icon when fullscreen is active

2. **`src/components/ai-dm/PartyDMScreen.tsx`** (Party DM)
   - Same pattern: `isFullscreen` state, `Maximize2` button in Row 1 header
   - Conditionally hide: Row 1 header, Row 2 subheader strip, and `DMBottomNav`
   - Render floating exit button when fullscreen

### Floating Exit Button Design
```text
┌──────────────────────────┐
│                          │
│     (chat messages)      │
│                          │
│                          │
│                    [⊡]   │  ← semi-transparent, bottom-right
│  [input bar ........]    │
└──────────────────────────┘
```

- Fixed position, `bottom-20 right-3` (above the input bar)
- `bg-black/40 hover:bg-black/60`, rounded-full, `w-8 h-8`
- `Minimize2` icon from lucide-react
- `z-[61]` to float above chat content

### Implementation Details
- Both screens use `{!isFullscreen && (<header>...</header>)}` to hide header rows
- Bottom nav gets `{!isFullscreen && (<DMBottomNav ... />)}`
- When entering fullscreen, collapse the nav (`setNavExpanded(false)`) to clean up
- No new files needed — changes contained within the two existing screen components

