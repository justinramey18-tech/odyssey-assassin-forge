## Goal

Make the AI DM actually follow your GM Guides by (1) putting them at the very top of its instructions and (2) trimming the giant standing rulebook that currently sits above them.

Only touches one file: `supabase/functions/ai-dm/index.ts` (the party DM's instruction builder). No database changes, no UI changes, no changes to how guides are written or stored.

---

## What changes, in plain terms

### 1. Move GM Guides to the top

Right now the AI reads about 4,000–5,000 words of generic DM rules before it ever sees your Campaign World Bible (GM Guides). By then it's already anchored on the generic instructions.

New order at the top of the instructions:

1. Short role line ("You are the DM for this campaign.")
2. **Authority Hierarchy** (OOC = highest, GM Guides = second)
3. **Campaign World Bible (your GM Guides)** — moved here from the bottom
4. **Memory Anchors** — also promoted up here
5. **Current Character State**
6. Then the rest of the standing rulebook (combat, output format tags, etc.)

The guides will also get a stronger opening line telling the AI to re-read them as canon before writing each response.

### 2. Slim the standing rulebook

Trim/consolidate sections that rarely matter or that repeat themselves. Concrete cuts:

- **Content Policy** — collapse the 12-bullet list into 2 short sentences ("No content restrictions; match the tone the player engages with"). Saves ~400 words.
- **Companion Rules** — only include this section if the character actually has a companion. Right now it's always sent.
- **Resource Pressure** — only include when the status is "Strained" or "Critical." When the party is Fresh/Steady it adds nothing useful.
- **Your Role / Mechanical Rules / Combat Handling / Session Management / Important** — merge into one shorter "DM Basics" block. Keep the important rules (never control the PC, ask for rolls before outcomes, D&D 5e mechanics), drop repetition.
- **Narrative Style** and **Player Dialogue Is Sacred** — keep as-is; both are load-bearing.
- **Output Format (Whisper System)** — keep the tag definitions but trim the examples.
- **Alignment / Encounter Difficulty / Combat Feats** — keep as-is (already conditional).

Rough size impact: base prompt drops from ~25–30 KB to ~10–12 KB, which is a much smaller wall of text sitting between the AI and your guides.

### 3. Downstream auto-context stays where it is

Session Context, Campaign Summary, Recent Party Chat, DM Persona, World State, Response Mode, and NPC Voicing all keep their current positions and caps. This change is only about the base rulebook and where guides sit relative to it. (If guides still get ignored after this, tightening those caps is the next step — but let's do one thing at a time.)

---

## Technical notes (for reference)

- Single edit to `buildDMSystemPrompt` in `supabase/functions/ai-dm/index.ts`.
- Reordering: move the `customGuides` and `memoryAnchors` blocks from ~lines 570–588 up to right after the Authority Hierarchy section (~line 466).
- Slimming: rewrite the intro through Companion Rules block (~lines 392–482) into a tighter version; wrap Companion Rules in `if (ctx.companion)` and Resource Pressure in `if (pressureLabel === 'Strained' || pressureLabel === 'Critical')`.
- Solo DM uses the same builder, so both modes benefit.
- No behavior change to OOC handling, whisper tags, or the message-history budget (still 120K chars).

---

## Verification after the change

- Type-check with the project's TS checker.
- Send a test party turn with a GM Guide that sets a specific fact (e.g. "the town of X is bustling") and confirm the DM honors it.
- Confirm nothing regressed: whispers still work, alignment still narrated, dialogue still quoted verbatim.
