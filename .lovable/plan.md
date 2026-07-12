## Plan

### What I’ll fix

The DM is receiving some of your extra context, but it is not being protected strongly enough at the exact moment it writes the next response. I’ll make the app lift the important pieces into a clear “current canon” block before every AI response, so details like:

- Candace is a player, not an NPC
- Phoenix is Candace’s horse
- Gwen is Ramey’s horse
- Candace is Ramey’s lover and companion
- OOC notes are instructions, not story dialogue

are treated as rules for the next answer instead of optional background.

### 1. Promote current OOC notes into a top-priority instruction block

When a player prompt contains OOC text, such as:

```text
[OOC: CANDACE IS A PLAYER. HER HORSE IS NAMED PHOENIX...]
```

I’ll have the party DM separate that from the roleplay text and send it to the AI as a high-priority “Current Round OOC Directives” section.

This makes the AI use it as truth before it interprets the scene.

### 2. Strengthen GM Guides as campaign law

I’ll adjust the DM’s rulebook so the enabled GM Guides are not just included, but explicitly checked before the response is written.

The DM will be told, in plain terms:

- GM Guides define canon.
- Do not contradict them.
- If a message, summary, or old AI response conflicts with the guides, the guides win.
- Use guide facts for names, relationships, ownership, locations, and lore.

### 3. Strengthen Memory Anchors as continuity facts

I’ll upgrade memory anchors from “reference them naturally” to “these are established facts.”

The DM will be told to use them for:

- who is who
- who owns which companion/mount
- relationships between characters
- unresolved promises, threats, social tension, and scene facts

Memory anchors will also be placed in a stronger “canon continuity” section so they are harder for the AI to ignore.

### 4. Add a current-round continuity check

Before the AI responds, the app will assemble a small checklist from the current prompt, guides, anchors, and party list. The AI will be instructed to silently check for contradictions before writing.

This is specifically aimed at preventing mistakes like treating a player character as an NPC, confusing whose horse is whose, or inventing relationship dynamics that contradict the latest OOC note.

### 5. Keep player dialogue verbatim

I’ll keep the previous “player dialogue is sacred” rule, but make it work alongside OOC handling:

- Quoted in-character speech must appear exactly as the player wrote it.
- OOC text should guide the response but should not be repeated as story dialogue.
- The AI should build NPC reactions around the player’s exact words, not paraphrase them.

### 6. Verify the exact call path used by party DM

I’ll update the normal party response path, turn-based path, split-party path, and hidden OOC-command path so they all receive the same strengthened canon rules.

## Files I expect to touch

- `src/hooks/use-party-dm.ts`
- `supabase/functions/ai-dm/index.ts`

I do not plan to change the database or reset any campaign data.