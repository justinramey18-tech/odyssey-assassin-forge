# Prompt 10 of 11 — Full-screen Live DM Table

Add a maximise/minimise toggle to the Live DM Table drawer so it can fill the entire viewport while keeping the header, feed and composer in their normal places.

## What changes

- Edit exactly one file: `src/components/ai-dm/RoundChatDrawer.tsx`.
- Add `Maximize2` and `Minimize2` to the lucide import.
- Add `fullScreen` state plus an effect that clears it when the drawer closes.
- Make the outer wrapper a relative positioning context and switch it to `fixed inset-0 z-50 flex flex-col` in full-screen mode.
- Add an absolutely-positioned maximise button as a sibling of the header button (not nested inside it), with `stopPropagation` so it does not toggle the drawer.
- Give the header `pr-9` room and `shrink-0` in full-screen.
- Make the motion drawer animate to `height: '100%'` and use `flex-1 min-h-0 flex flex-col` when maximised.
- Make the inner container, feed and composer flex correctly so the feed grows and the composer stays pinned at the bottom with safe-area padding.
- Adjust the "Jump to latest" absolute offset for full-screen.

## What does NOT change

- Message rendering, badges, fonts or sizes (Prompt 11).
- Composer contents or behaviour.
- `RoundChatDrawerProps` or parent usage.
- Collapsed-drawer appearance or behaviour.

## Verification

1. TypeScript builds with no errors.
2. Collapsed drawer looks identical to today.
3. Open drawer shows a maximise icon left of the chevron.
4. Maximise fills the viewport: header top, feed middle, toggle + text box pinned above the system nav bar.
5. Typing and sending works in full-screen.
6. Minimise returns to the normal drawer at the same scroll position.
7. Collapsing the drawer while full-screen exits full-screen cleanly.
