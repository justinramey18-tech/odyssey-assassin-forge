# Deeper answers in the Table Guide

The guide reads like a set of one-line hints. Every answer gets rewritten to actually teach the thing: what it is, exactly where to tap, what happens after, and the catch people trip over.

## What changes

**1. Richer answer shape**

Each question keeps its short answer as the opening line, then gains two optional extras:

- **Steps** — a numbered "do this, then this" list for anything with a real sequence (equipping gear, casting a spell, sending a round, assigning a voice, taking a rest, accepting loot).
- **Good to know** — the gotcha or the detail people ask about second (limits, who is allowed to do it, why it looks greyed out, what the DM does and does not see).

**2. Rewritten content**

Every existing question is expanded, and gaps are filled in:

- First Steps — a fuller explanation of the loop (you write, the app resolves numbers, the DM narrates), what a strong first message looks like with an example, and what the DM does and does not remember.
- Your Character — where each number comes from and which ones the DM treats as fact; how XP awards and leveling actually work; how equipping changes stats and where to verify it; how casting spends a slot and hands the DM a fixed result.
- Playing a Turn — a worked example of a weak action versus a strong one; when to roll versus when to just describe; exactly what short and long rest restore and their limits; what each bottom-bar tab is for and when you would reach for it.
- Quests and loot — why an offer sometimes does not appear and what Scan does; the accept-before-it-is-yours rule stated plainly in both places.
- Party and Live DM — the three round styles compared side by side (who submits, what reaches the DM, what fires the round); in-character versus table talk and the consequence of picking wrong; ticking, sending, locked lines, the counter and the host threshold; pings, votes, focus fire and shared loot.
- Something is Wrong — each entry gains a short "how to confirm it" line so a player can check the cause before applying the fix.
- What Words Mean — every term gets a second sentence with a concrete example instead of a bare definition.

Party-only entries stay party-only, so a solo player never sees table-chat answers.

**3. Display**

The guide screen renders the new steps and "Good to know" blocks: steps as a compact numbered list, the note as an amber-tinted line beneath. Answers stay collapsed behind the question as they are now, so the guide does not get harder to skim — the extra depth only appears once you open an entry.

## Technical notes

- `src/lib/helpContent.ts` — extend `HelpEntry` with optional `steps?: string[]` and `note?: string`; add the same optional fields to `HELP_FIXES` (a `confirm?` line) and `HELP_GLOSSARY` (an `example?` line). Rewrite all entry copy. Types stay backward compatible so nothing breaks mid-edit.
- `src/components/help/TableGuide.tsx` — render the new optional fields in the entry, fixes and glossary rows. Existing styling tokens only (black/30 cards, white/10 borders, amber accents, `font-cinzel` titles), 44px+ tap targets, no new dependencies.
- No other files touched. No backend, routing or storage changes.
