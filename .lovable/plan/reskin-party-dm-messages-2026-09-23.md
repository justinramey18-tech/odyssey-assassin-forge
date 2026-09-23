# Reskin Party DM messages

## Changes
- Add the eight supplied transparent artworks as managed app assets.
- Add EB Garamond as a story-only font and define the requested DM drop cap.
- Restyle only assistant messages with the framed parchment treatment, DM crest/sigil, readable story typography, and decorative divider.
- Replace the specified bookmark, regenerate, expand, narration, and pause symbols while preserving every existing action.

## Technical details
- Update `index.html`, `tailwind.config.ts`, and `src/index.css` for the font.
- Update `PartyDMScreen.tsx` and `MessageNarrationBar.tsx` for the message frame and controls.
- Keep player messages, chat backgrounds, narration behavior, and all handlers unchanged.
- Validate by source inspection and TypeScript compilation only; do not open the app or authentication.
