# Always-visible Seal for DM controls

## What changes
- Add the supplied open and sealed wax artwork to the live-chat assets and preload the sealed state.
- Replace each unsent line’s hidden tick control with an always-visible **Seal for DM** button.
- Keep reactions, edit, delete, delivery behavior, and host controls unchanged.
- Add the stamp-pop animation, a soft reminder pulse on the player’s newest unsealed line, and the requested sealed green highlight.
- Rename visible “ticked” counts to “sealed” and sent-line labels to “delivered.”

## Verification
- Re-read the edited message block and confirm only the requested file and images changed.
- Run the TypeScript check without opening the preview or signing in.
