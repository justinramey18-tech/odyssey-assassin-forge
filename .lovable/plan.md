# Fix: @NPC tagging should give two lines, and dice rolls should count

## What's going wrong

When you tag a single NPC, the app does send a special "voice this one character, two lines only" instruction — but it staples that instruction onto the end of the full storyteller briefing: all your GM Guides, the DM persona (Deadpool), the writing-style rules, and a final "quality checklist" telling the AI to double-check its draft against the guides. The guides win the tug-of-war, so you get full prose with several characters. The reply then stops mid-sentence because the short-reply budget runs out partway through the long scene.

The dice roll is passed along too, but only as a paragraph buried inside that same overloaded briefing — and nothing about the roll ever appears in the chat, so there's no visible sign it happened or that the AI saw it.

## The fix

1. **Single-NPC tagging gets its own clean briefing.** When exactly one NPC is tagged, the reply is built from a stripped-down instruction set: who the character is, the campaign situation, the recent conversation, and the two-line format rule. GM Guides, the DM persona, the writing-style/length settings, and the quality checklist are all left out of that one reply. Nothing else in the app changes — normal turns, multi-NPC scenes, party mode, and Empyrean keep the full briefing exactly as today.

2. **Roll result stated up front, not buried.** The check outcome moves to the very top of that clean briefing as a hard instruction ("this attempt failed — the character resists, pushes back, or sees through it"), rather than a paragraph at the end.

3. **The roll shows in the chat.** Your tagged line is logged with the roll attached, e.g. `(to Gandalf) "..."` followed by a dice line showing your total, the NPC's opposing total, and Success / Failure / Tie — so you can always see the roll landed and what it was.

4. **Room to finish the two lines.** The reply budget for a tagged NPC is raised slightly so a legitimate two- or three-line answer can never get cut off mid-sentence.

## Technical notes

- `supabase/functions/ai-dm/index.ts`: accept a new `npcVoicingStrict` flag. When set, build the system prompt from a minimal context block (character identity + campaign summary + memory anchors) plus `npcVoicingContext`, skipping `customGuides`, `dmPersonaPrompt`, `responseModePrompt`, core rules, and the guide-compliance quality gate.
- `src/hooks/use-ai-dm.ts` (`voiceNPC`): send `npcVoicingStrict: true` only when `names.length === 1`; move the social-check block to the head of `npcVoicingPrompt`; append the formatted roll line to the logged user message; bump `maxTokens` for the single-NPC path (150/200 -> 260).
- `src/lib/npcSocialChecks.ts` already produces `rollBlockText`; pass it through `AIDMScreen`'s `handleSocialResolved` into `voiceNPC` for display.
- No changes to party or Empyrean code paths.
