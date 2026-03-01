

## Plan: Add More Mood Presets

Currently there are 6 mood presets. I'll add 6 more D&D-themed presets to `DEFAULT_MOOD_PRESETS` in `src/lib/spotify.ts`:

| Preset | Search Query | Emoji |
|--------|-------------|-------|
| Peaceful Village | peaceful village medieval calm ambient | 🏘️ |
| Ocean Voyage | ocean sea voyage sailing adventure ambient | ⛵ |
| Royal Court | royal court medieval regal fanfare orchestral | 👑 |
| Stealth & Shadows | stealth shadows sneaking dark ambient tense | 🗡️ |
| Sacred Temple | sacred temple holy choir ambient peaceful | ⛪ |
| Campfire Rest | campfire rest night calm acoustic ambient | 🔥 |

**File changed:** `src/lib/spotify.ts` — append 6 new entries to the `DEFAULT_MOOD_PRESETS` array.

> Note: Existing users who already have saved presets in localStorage won't see the new ones automatically. I'll update `loadMoodPresets` to merge any new defaults that aren't already present.

