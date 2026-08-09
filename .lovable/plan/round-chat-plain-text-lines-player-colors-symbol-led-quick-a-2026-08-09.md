# Round chat: plain text lines, player colors, symbol-led quick actions

Strip the chat bubbles out of the round chat drawer and turn it into a clean script-style transcript where each player is recognisable by colour.

## What changes

**No bubbles for in-character lines**
- Remove the green bubble container, border and padding. In-character lines become plain text on the chat background.
- Own messages stay right-aligned (name and text right-aligned); other players stay left-aligned.

**A colour per player**
- Each player gets a stable colour picked from a fixed palette, derived from who they are, so the same person always shows the same colour for everyone in the session.
- The character name is shown in that colour; the message text itself stays normal readable white so long lines remain easy to read.

**Table talk unchanged**
- Out-of-character comments keep their current look: amber italic text, left-aligned, no container.

**Quick actions become one symbol-led line**
- The animated card with roll chips is replaced by a single line of text, e.g.
  ```text
  ⚔ Ramey attacks with Longsword — 18 to hit, 9 damage (1d8+3)
  ✦ Ramey casts Fireball — 32 damage (8d6)
  ✚ Ramey uses Potion of Healing — healed 9
  ⬢ Ramey attempts Stealth — d20 14, success
  ```
- Symbol per kind: sword for attacks, wand/spark for spells, cross for healing, flask for item effects, die for skill checks.
- Natural 20 and natural 1 still get a short highlighted tag on the same line (gold / red) rather than their own block.
- The player's colour is used for their name here too.

**Unchanged**
- Reactions, delete, "Sent" marker, the DM-facing prompt (still the full hidden text), and everything outside the drawer.

## Technical notes

- Edit `src/components/ai-dm/RoundChatDrawer.tsx`: replace the bubble wrapper in the message map with plain rows; add a small colour helper (hash of `user_id` into a fixed palette of ~8 readable hues defined in the drawer).
- Replace usage of `src/components/ai-dm/QuickActionCard.tsx` with a new compact inline renderer (either a rewrite of that component to a single line, or a small `QuickActionLine` in the same file). Keeps consuming the existing `ActionCard` shape from `src/lib/roundChatActionCard.ts` — no changes to encoding, rolling, or prompt stripping.
- Symbols use `lucide-react` icons at ~12px, inline before the text.
