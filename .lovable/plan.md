

## Add 9 Tones + Air Wizard (Player-Driven Weekly Tone Schedule)

### Overview

Two additions to the Empyrean Campaign Pack:

1. **9 new tone guides** in `empyreanGMGuides.ts` (total: 14 tones)
2. **Air Wizard** -- a UI where the player builds a custom weekly tone schedule, generates a GM guide, and **copies it into their 3rd-party AI DM** to orient it in real time

The player is always the intermediary. The Air Wizard produces a guide the player pastes to the AI DM. The guide tells the AI DM: "The player will tell you what day it is. Match your tone to the schedule below." This keeps the player in control of the real-time orientation -- the app never talks directly to the AI.

---

### 1. The 9 New Tones

Added to `src/lib/empyreanGMGuides.ts` as tone-category guides (`stackable: false`):

| # | Name | One-liner |
|---|------|-----------|
| 6 | Political Intrigue | Diplomacy, court maneuvering, and leverage over swords |
| 7 | Heist and Subterfuge | Every session is a job -- casing, planning, improvising |
| 8 | Mythic Epic | Prophecies, ancient powers, and the weight of destiny |
| 9 | Psychological Thriller | Mind games, unreliable narrators, trust nothing |
| 10 | Exploration and Discovery | Unmapped territories, ancient ruins, wonder of the unknown |
| 11 | Redemption Arc | Fallen hero earning back what was lost |
| 12 | Comedic Chaos | Murphy's Law as campaign philosophy |
| 13 | Noir Investigation | Hardboiled detective tone, moral ambiguity, mystery-driven |
| 14 | Mentor and Legacy | Veteran training the next generation, confronting mortality |

Each follows the existing format: ~1,500-2,500 char content block with Core Directives, Scene Design, and Tone sections.

---

### 2. The Air Wizard -- Player-Driven Weekly Tone Scheduler

**Concept**: The player assigns a tone to each day of the week, then generates a guide they copy-paste into their 3rd-party AI DM (ChatGPT, Claude, etc.). The generated guide instructs the AI DM to ask the player what day it is, or to follow the player's lead when they state the day.

**How the flow works:**

```text
Player opens Air Wizard
        |
Assigns tones to Mon-Sun via dropdowns
        |
Clicks "Generate Guide"
        |
Guide appears in preview (copyable)
        |
Player copies guide and pastes it into their 3rd-party AI DM
        |
AI DM reads the guide and follows the weekly tone schedule
        |
Player tells the AI DM "It's Wednesday" (or uses 4th Wall Time)
        |
AI DM seamlessly shifts tone per the schedule
```

**The generated guide content** explicitly frames the player as the source of real-time information:

```
# Weekly Tone Schedule -- Dynamic Campaign Guide

You are an AI Dungeon Master. The PLAYER who gave you this guide
has assigned a different narrative tone to each day of the week.

## How This Works
- The player will tell you what day of the week it is (or it may
  be prefixed in their messages via a timestamp)
- Match your narration style to the tone assigned for that day
- Transitions between tones should feel organic -- like weather
  changing, not a light switch
- Find narrative bridges: a shift in setting, a time skip, a new
  NPC encounter, or a mood change in the environment
- Never announce the tone change. The player should feel the
  shift without being told about it.

## Weekly Schedule

### Monday: Romance & Bonds First
[Condensed 3-4 paragraph summary of tone directives]

### Tuesday: Military Thriller
[Condensed summary]
...
```

**Key language**: "The player will tell you" / "The player who gave you this guide" -- not "the system detects" or "automatically." The player is always the one orienting the AI.

---

### 3. Air Wizard UI Details

Embedded in `EmpyreanCampaignPack.tsx` as a collapsible section between the Tone category header and the individual tone accordions.

**Components:**
- Section header: "Air Wizard -- Weekly Tone Schedule" with a wind/wand icon
- 7 rows (Monday-Sunday), each with a day label + Select dropdown listing all 14 tones + "None"
- "Surprise Me" button that randomly assigns tones
- "Generate Guide" button (disabled until at least 1 day has a tone)
- Generated preview in a scrollable pre block
- "Copy Guide" and "Install as GM Guide" buttons below the preview
- Installed with id `empyrean-air-wizard-weekly` and name "Weekly Tone Schedule"

---

### Technical Details

**Files modified:**

| File | Changes |
|------|---------|
| `src/lib/empyreanGMGuides.ts` | Add 9 new tone guide definitions; export a `EMPYREAN_TONE_GUIDES` convenience array; update `EMPYREAN_META_GUIDES` and `ALL_EMPYREAN_GUIDES` |
| `src/components/settings/EmpyreanCampaignPack.tsx` | Add Air Wizard section with day-of-week selectors, generate logic, preview, copy/install; import Select components |

**No new files.** Generation is client-side string templating -- no edge function or API call needed.

**The generated guide references the existing `applyTimePrefix` / 4th Wall Time system**: The guide tells the AI DM that the player may prefix messages with a real-world timestamp, so the AI can infer the day automatically if that feature is enabled. But it still frames this as the player's action ("the player's messages may include a timestamp prefix").

