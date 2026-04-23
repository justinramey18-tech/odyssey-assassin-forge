

## Whisper Tray → One-Tap Intent Buttons

Turn the current "Roll" button on each whisper into a plain-English action like **"Try to dodge"** or **"Catch the reins"** that auto-rolls and posts a narrative result to chat. New players never see dice jargon; experienced players still get the number in parentheses.

### What changes for the player

Before: Whisper says "Make a Dexterity save (DC 15)" → tap "🎲 Roll" → full dice roller opens with DEX/DC/advantage controls → confirm → result posts.

After: Same whisper → button reads **"Try to dodge"** → one tap → chat shows *"I tried to dodge."* ✨ **Success** (17).

### Verb selection (in priority order)

1. **DM-provided verb** (most accurate): the DM can optionally include `[verb: catch the reins]` inside an ACTION tag and that exact phrase becomes the button label.
2. **Skill mapping**: `perception → "Try to notice"`, `stealth → "Try to sneak past"`, `athletics → "Push through"`, etc.
3. **Ability mapping**: `DEX save → "Try to dodge"`, `CON save → "Endure it"`, `WIS check → "Trust your gut"`, etc. Saves and checks get different verbs.
4. **Vague fallback**: if the whisper has no skill/ability/verb, button reads **"Roll for it"** and tapping opens the full dice roller (current behavior preserved).

### Result message format

- Standard: `*I tried to notice.* ✨ **Success** (15).`
- Crit: `*I tried to dodge.* ⭐ **Critical success** (25).`
- Fumble: `*I tried to sneak past.* 💀 **Fumble** (4).`
- No DC in whisper: `*I muscled through.* 🎲 **Rolled** (14).`

The roll uses the same dice engine, modifiers, proficiency bonuses, and weighted-odds setting as the full dice roller — no mechanical drift.

### Empyrean terminology recognition

The whisper parser is extended so it understands BOTH D&D terms (Perception, Dexterity save) AND Empyrean terms the DM actually uses:

| Empyrean term | Maps to | Verb |
|---|---|---|
| Awareness | perception | Try to notice |
| Aerial Combat | athletics | Push through |
| Signet Theory | arcana | Recall what you know |
| Riding | animal handling | Try to calm them |
| Shadowcraft | stealth | Try to sneak past |
| Battle Sense | insight | Read them |
| BODY check | STR | Muscle through |
| Reflexes | DEX | Try to react |
| Grit Save | CON save | Endure it |
| Will / Resolve | WIS | Resist the pull |
| Presence | CHA | Work the moment |

### Files

**Create**
- `src/lib/whisperAutoRoll.ts` — verb tables, resolver, roll executor, narrative formatter

**Modify**
- `src/lib/whisperRollHint.ts` — add Empyrean synonym tables, add `[verb: ...]` extraction, add `explicitVerb` to `RollHint`
- `src/components/ai-dm/WhisperTray.tsx` — replace `onRollDice` prop with `onAutoRoll` + `onOpenRoller`; render verb label
- `src/components/empyrean/EmpyreanDMScreen.tsx` — split `handleWhisperRoll` into `handleWhisperAutoRoll` (in-place roll + post to chat via `handleAppendPrompt`) and `handleWhisperOpenRoller` (opens dice sheet); update all 3 `<WhisperTray>` callsites
- `src/lib/empyreanDMPersona.ts` — add an optional **VERB HINT** subsection under "WHEN TO CALL FOR CHECKS" documenting `[verb: ...]` syntax with examples

### Out of scope / preserved

- AIDMScreen and PartyDMScreen render `<WhisperTray>` without a roll prop today — they keep working with no button, no changes needed.
- DMDiceRoller, dice odds, proficiency math, and the roller sheet itself: untouched. Vague whispers still open it as the safety net.
- Signet Management, Cooldowns, Rider Loadout, Ability Trees, Dragon Bond Chat: untouched.
- Advantage/disadvantage from the whisper text is respected automatically (parser already extracts `rollMode`); no user toggle on the button.
- One tap = one roll. No re-roll button, no skip button.

### Verification (post-deploy)

1. Empyrean DM narrates "Make an Awareness check (DC 12)" → button says **"Try to notice"** → tap → chat posts result with success/failure.
2. "Make a Grit Save (DC 13)" → button **"Endure it"** → auto-rolls.
3. DM writes `[verb: catch the reins] Roll Riding (DC 10)` → button **"Catch the reins"** → posts *"I caught the reins."*
4. Vague whisper "Make a check" → button **"Roll for it"** → opens full dice roller (fallback preserved).
5. Disadvantage whisper rolls 2d20 keeps lowest; crit/fumble emoji and label change correctly.

