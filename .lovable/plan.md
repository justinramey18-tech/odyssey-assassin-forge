

## Add 52 New Empyrean Prompts (10 Meta + 7 per Stone)

### Overview

Adding 52 new prompts to `src/lib/empyreanPrompts.ts`, bringing the total from 50 to 102. One file modified.

---

### Meta and Narrative (+10 = 15 total)

Focus: **Meta-awareness** and **Alternate POVs** as requested.

| # | Title | Angle |
|---|-------|-------|
| 1 | Villain's Perspective | Scene narrated from the antagonist's POV -- their reasoning, their fear of the rider |
| 2 | The Scribe's Account | A scribe NPC documents an event involving the character -- biased, incomplete, revealing |
| 3 | Campfire Recap | Characters sit around a fire retelling the session's events -- disagreeing on what happened |
| 4 | What If? Divergence | Replay a past decision with the opposite choice -- explore the alternate outcome |
| 5 | The Bystander | A civilian, servant, or groundskeeper describes what they saw when riders clashed |
| 6 | Fourth Wall Crack | The character briefly senses the "player" behind them -- a moment of uncanny awareness |
| 7 | Post-Credits Scene | A short epilogue scene from the future hinting at consequences of current actions |
| 8 | The Narrator Lies | The DM narrates a scene, then reveals a key detail was wrong -- rewind and replay with truth |
| 9 | Enemy Debrief | Venin commanders discuss the character as a tactical threat -- what they plan to do about it |
| 10 | Parallel Lives | Show the same hour from two characters' perspectives -- their paths almost crossing |

---

### Dragon Bond (+7 = 15 total)

Focus: **Dragon politics**, **daily life**, **lore deep cuts**, plus user's "other."

| # | Title | Angle |
|---|-------|-------|
| 1 | Dragon Council | Dragons gather without riders -- a hierarchy negotiation the rider only glimpses through the bond |
| 2 | Grooming Ritual | Quiet maintenance scene: scale care, talon sharpening, the domesticity of dragon partnership |
| 3 | Ancient Memory | The dragon shares a memory from before Basgiath existed -- pre-human, primordial |
| 4 | Dragon Rivalry | Two bonded dragons despise each other -- their riders must work together anyway |
| 5 | Feeding Day | Accompanying the dragon on a hunt -- witnessing the predator side of your partner |
| 6 | Dragon Humor | The dragon does something deliberately funny -- their sense of humor is alien but unmistakable |
| 7 | Den Visit | The rider enters the dragon's private den for the first time -- what it reveals about the dragon's inner world |

---

### Signet Abilities (+7 = 14 total)

Focus: **Balanced variety** -- discovery, danger, social, tactical.

| # | Title | Angle |
|---|-------|-------|
| 1 | Signet Resonance | Two signets react to proximity -- harmonic amplification neither rider expected |
| 2 | Signet Under Oath | Forced to use signet for an official tribunal -- power as testimony |
| 3 | Null Zone | Enter an area where signets don't work -- cope with sudden powerlessness |
| 4 | Signet Inheritance | Learn your signet matches a dead relative's -- the weight of repetition |
| 5 | Signet Weaponization | Command orders creative weaponization of the signet -- moral discomfort |
| 6 | Signet Bleed | The signet activates during sleep -- unconscious power with waking consequences |
| 7 | Signet Duel | Formal one-on-one signet-only combat -- no blades, no dragons, pure power |

---

### Basgiath War College (+7 = 15 total)

Focus: **Balanced variety** -- academic, social, survival, political.

| # | Title | Angle |
|---|-------|-------|
| 1 | Night Exam | A surprise midnight test -- dragged from bed, evaluated half-asleep |
| 2 | New Transfer | A transfer rider arrives mid-year -- disrupts squad dynamics |
| 3 | Instructor's Secret | A professor reveals something personal that changes how you see them |
| 4 | Infirmary Recovery | Extended stay in the healers' ward -- vulnerability, overheard secrets |
| 5 | Graduation Pressure | Final evaluations loom -- the weight of everything riding on performance |
| 6 | Underground Economy | Discover the cadet black market -- contraband, favors, and dangerous debts |
| 7 | Quadrant Riot | Tensions between quadrants erupt into campus-wide unrest |

---

### Venin and Dark Forces (+7 = 14 total)

Focus: **Balanced variety** -- horror, moral complexity, tactical.

| # | Title | Angle |
|---|-------|-------|
| 1 | Venin Trap | An ambush designed specifically for your signet type -- they've been studying you |
| 2 | The Turned Friend | A rider who turned venin tries to recruit you -- using memories of friendship |
| 3 | Corruption Creep | Strange dreams, darkening veins -- is it the environment or something worse? |
| 4 | Venin Nest | Discover a breeding ground -- the scale of the enemy revealed |
| 5 | Dark Wielding Witness | Watch an ally secretly use dark wielding "for the right reasons" |
| 6 | Wyvern Taming | Someone claims wyverns can be turned -- and wants help proving it |
| 7 | The Sage Venin | Encounter an ancient venin who remembers being human -- and grieves it |

---

### Relationships and Politics (+7 = 15 total)

Focus: **Balanced variety** -- romance, rivalry, diplomacy, consequence.

| # | Title | Angle |
|---|-------|-------|
| 1 | The Ex | Someone from before Basgiath shows up -- old feelings, new complications |
| 2 | Political Marriage | A strategic alliance proposal through marriage -- love vs. duty |
| 3 | Squad Fracture | Your squad splits over an ideological disagreement -- pick a side |
| 4 | Mentor's Fall | A trusted mentor is disgraced -- stand by them or distance yourself |
| 5 | Enemy Respect | A rival earns genuine respect through an act of courage -- complicate the rivalry |
| 6 | Secret Correspondence | Intercepted letters reveal a conspiracy -- who do you warn? |
| 7 | The Favor Owed | Someone powerful calls in a debt -- the price is higher than expected |

---

### Combat and Survival (+7 = 14 total)

Focus: **Unconventional warfare**, **large-scale battles**, **personal duels**.

| # | Title | Angle |
|---|-------|-------|
| 1 | Night Raid | Black-ops sabotage mission behind enemy lines -- stealth, no dragons |
| 2 | Siege Warfare | Multi-day siege of a warded fortress -- attrition, morale, supply lines |
| 3 | Honor Duel | Formal challenge with witnesses -- reputation and rank on the line |
| 4 | False Flag | Ordered to stage an attack disguised as the enemy -- ethical combat |
| 5 | Multi-Wing Assault | Coordinated attack across three wings -- chaos of large-scale aerial combat |
| 6 | Assassination Attempt | Someone tries to kill the character -- not in battle, but in their sleep |
| 7 | No-Magic Zone | Combat in a signet-dead zone -- pure blade and tactics, no power |

---

### Technical Details

**File modified**: `src/lib/empyreanPrompts.ts`
- 52 new prompt objects appended to their respective category sections
- Each follows the existing `CharacterPrompt` interface: `id`, `category`, `title`, `description`, `prompt`, `icon`
- IDs follow existing `emp-{category}-{slug}` pattern
- Total prompts: 50 existing + 52 new = 102

**No other files need changes** -- the `EmpyreanPromptLibrary` component already reads from the `empyreanPrompts` array dynamically and groups by category.

