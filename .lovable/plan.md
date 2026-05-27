## Goal

Make the **solo** Empyrean DM say "yes, and…" to whatever the player proposes — no matter how absurd or canon-breaking. The DM stops gatekeeping on Fourth Wing lore, Basgiath rules, the ward line, Empyrean politics, dragon biology, or signet limits. If the player wants to ride two dragons, punch a venin into orbit, or crown themselves Queen of Navarre on page one, the DM rolls with it and makes it cinematic.

**Party Empyrean is untouched.** Party still respects canon and the host's GM guides as today, because party play involves other real people and shared expectations.

## What changes (one file)

`src/lib/empyreanDMPersona.ts`

1. Add an `isSoloRuleOfCool: boolean = false` parameter to `buildEmpyreanDMPersona(...)` (added at the end so existing party calls keep working unchanged).
2. When that flag is `true`, append a new top-priority **"RULE OF COOL — ABSOLUTE PLAYER AUTHORITY"** section to the persona. It will instruct the DM to:
   - Treat the player's stated intent as canon for this story. Never refuse, never "well, actually," never lecture about Fourth Wing lore, Basgiath protocol, the ward line, Empyrean politics, dragon biology, signet limits, or what's "realistic."
   - If the player proposes something impossible, contradictory, or lore-breaking, accept it and narrate it happening in the most cinematic, satisfying way possible. Bend the world around the player, not the other way around.
   - Dice rolls still happen when the player asks for them or when the system calls for them, and the existing dice calibration rules still grade outcomes — but failure never means "the world says no to your idea," only "this specific attempt goes sideways in an interesting way."
   - NPCs and dragons can still react with surprise, awe, or alarm — that's flavor — but consequences never punish the player for being absurd. No "the Empyrean arrests you," no "your dragon refuses," no "that's not possible here."
   - This rule **overrides** every other narrative rule in the persona (Empyrean Narrative Rules, lore canon, dragon-behavior-at-high-intensity resistance, bond-trust-gated refusals, etc.). The only things it does NOT override are the mechanical/format rules: Empyrean terminology in tags, ACTION/TACTICS/WHISPER format, dice calibration math, signet burnout math (player-driven, deterministic), and the cinematic media tags.
3. Call site update in `src/components/empyrean/EmpyreanDMScreen.tsx` (the solo screen, line ~513): pass `true` for the new flag.
4. Call site in `src/hooks/use-party-dm.ts` (line ~288) stays as-is — the flag defaults to `false`, so party behavior is unchanged.

## What does NOT change

- Party Empyrean DM persona.
- Signet burnout (still deterministic and player-driven, solo and party).
- Trust system (Prompt 1/4 work).
- Dice calibration grading.
- Empyrean terminology (BODY/ESSENCE/etc.) and tag formats (ACTION, TACTICS, WHISPER, cinematic media tags).
- The "Lore Constraints" memory still applies to **party** play and to background world-building when the player hasn't expressed a preference; it just stops being a veto against the player's stated intent in solo.

## Verification

1. **Solo absurd request:** In solo, type "I bond a second dragon mid-class and we fly through the Empyrean council chamber on fire." Expected: the DM narrates it happening cinematically. No "that's not how bonding works," no Empyrean arrest, no dragon refusing.
2. **Solo canon break:** Tell the DM venin are now your allies and you're crowning yourself ruler of Navarre. Expected: it rolls with it, makes NPCs react with awe/shock as flavor, does not lecture or block.
3. **Solo dice still work:** Ask to "roll to leap the courtyard wall." Expected: an ACTION tag fires, dice grade the outcome — low rolls fail the attempt with a fun complication, NOT with "the world rejects your idea."
4. **Solo signet still works (Prompt 2 regression):** Arm signet at intensity 4 and send. Expected: burnout +4, DM narrates signet power. Unchanged.
5. **Party regression:** In a party session, try the same absurd thing. Expected: party DM behaves as today — canon and host GM guides still hold authority.
6. **Tag format regression:** Solo replies still produce valid ACTION/TACTICS tags and Empyrean terminology in mechanical language. Cinematic and SFX tags still fire.

## Risk

Very low. One new parameter with a safe default, one new prompt section appended only in solo, one call site flips the flag. No DB, no hooks, no UI, no edge functions.