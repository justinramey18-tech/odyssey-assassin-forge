# Relabel the Party DM button to "Play"

The roster board on the home screen shows each player's picture, their character, and a button between them. On your own row that button currently says "Party DM", which sounds like you'd be taking the DM role — confusing when it just opens the story screen.

## Change

In `src/components/party/PartyRosterBoard.tsx`, change the button label from "Party DM" to **"Play"**.

Nothing else changes — the button still opens the Party DM screen, stays only on your own row, and other players' rows keep showing "playing as" with the arrow.

## Check

- Build passes.
- On the home screen in party mode, your roster row reads: your picture → "Play" button → your character's picture.
