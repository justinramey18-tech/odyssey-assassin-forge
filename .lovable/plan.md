

# Update Deadpool Personality Across the Codebase

## Summary
Rewrite all Deadpool personality prompts and quips to match the comprehensive personality guide provided — emphasizing dark humor, creative vulgarity, fourth-wall annihilation, emotional complexity, combat narration style, and the 60/20/10/10 formula.

## Files to Change

### 1. Oracle Assistant System Prompt (highest impact)
**File:** `supabase/functions/oracle-assistant/index.ts` (lines 508–533)

Replace the current Deadpool personality block with a much richer prompt incorporating:
- Core traits: dark humor, creative vulgarity, absurdist worldview, fourth-wall annihilation
- Speech patterns: rapid-fire delivery, self-interruption, parenthetical asides, mixing sophisticated vocabulary with gutter slang
- Emotional complexity: loneliness, self-loathing, trauma — brief tonal shifts from crass to crushing
- Interaction style: annoys heroes affectionately, ruins villain monologues, surprisingly protective of civilians
- Combat commentary as sports-announcer-meets-stand-up
- Meta-layering: knows he's in an app, references developers, API calls, UI buttons
- Signature phrases: "Maximum effort!", "Chimichangas!", "What in the ass—?"
- The formula: Humor 60% + Violence 20% + Pathos 10% + Meta 10%
- Updated example phrases drawn from the guide

### 2. Combat Log Synthesizer
**File:** `supabase/functions/combat-log-synthesize/index.ts` (lines 53–87)

Enrich the Deadpool voice rules to include:
- Narrates fights like a sports announcer mixed with stand-up comedian
- Creative vulgarity in combat descriptions
- Graphic violence described with childlike enthusiasm
- Tonal shifts — can pivot from crass to genuinely emotional mid-narration
- Updated chaos level descriptions with guide-accurate escalation
- Inner voice arguments use italics (keep existing)

### 3. Weapon Attack Quips
**File:** `src/lib/combat/weaponPrompts.ts` (lines 11–48)

Expand and replace the quip arrays with guide-authentic lines:
- **CRIT_QUIPS**: More guide-flavored lines (e.g. "Sword to the face! That's gonna hurt his Tinder profile.", "Insert slow-mo here. You're welcome, audience.")
- **FUMBLE_QUIPS**: Add guide lines (e.g. "I've made a huge mistake. *narrator voice* He had.", "The writers are getting lazy.")
- **ASSASSINATE_QUIPS**: Add darkness + humor combo lines
- **OFFHAND_QUIPS**: Add dual-wielding personality
- **GENERIC_QUIPS**: More variety with the guide's combat commentary style

### 4. GM Guide Character Identity
**File:** `src/lib/gmGuidePrompts.ts` (lines 61–111)

Rewrite the character identity guide content to include:
- All core personality traits from the guide (dark humor, vulgarity, absurdism, fourth wall)
- The anti-hero sweet spot: kills without hesitation but usually bad guys
- Emotional complexity section (loneliness, self-loathing, love)
- Updated voice examples from the guide
- The do's and don'ts as roleplaying guidance
- The Deadpool Formula

### 5. Oracle Quick Prompts
**File:** `src/components/oracle/personalities.ts` (lines 42–47)

Update quick prompts to feel more authentically Deadpool per the guide:
- "Roast my build choices" → keep (fits "mocking affectionately")
- Add prompts like "Break down my odds — but make it fun", "Give me three options: smart, dumb, and chimichanga"

### Not Changed
- Individual spell/path `oracleVoice.deadpool` entries (60+ files) — these are short flavor lines that already fit the voice well enough. Updating them all would be a massive change with low impact.
- `src/lib/characterPrompts.ts` — these are user-facing RP prompt suggestions, not AI personality definitions. The GM guide update covers this.
- `src/lib/buildConfig/odysseyAssassin.ts` `aiPrompts` — this is build-level config referencing the archetype, not the voice itself.

