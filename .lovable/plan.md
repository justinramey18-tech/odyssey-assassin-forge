

## Revised Empyrean System Expansion -- Redundancy Fixed

### Changes from Previous Plan

- **Removed** tone selection from Session Zero Wizard (already handled by Campaign Pack + Air Wizard)
- **Removed** "The Restricted Section" prompt (overlaps with existing "Archives Discovery" `emp-basgiath-archives`)
- **Removed** "Forbidden Knowledge" arc template (overlaps with new Forbidden Lore stone)
- **Removed** 3 session type templates that overlap with existing tone guides: "Combat Gauntlet" (overlaps `Combat and Warfare` lore guide), "Social Intrigue" (overlaps `Academy Slice-of-Life` tone), "Exploration Run" (overlaps `Exploration and Discovery` tone)
- **Accounted for** the fact that Empyrean prompts and Infinity Stone prompts are **separate systems** -- Forbidden Lore only touches `EmpyreanPromptLibrary.tsx`'s `STONE_MAP`, not the Infinity Stone drawers
- **Added** `'session'` to the `EmpyreanGuide` interface type union and `CATEGORY_META`

---

### 1. Forbidden Lore Stone (New 8th Empyrean Stone)

**9 prompts** (not 10 -- "The Restricted Section" removed as it duplicates "Archives Discovery").

Added to: `empyreanPrompts.ts`, `empyreanPromptCategories`, and `EmpyreanPromptLibrary.tsx` STONE_MAP.

**Not** added to the Infinity Stone drawers (`InfinityStoneDrawer.tsx`, `InfinityStoneDMDrawer.tsx`, `InfinityGauntletScreen.tsx`) -- those use a different prompt system (`characterPrompts` with categories like 'Emotional', 'Combat', etc.).

**STONE_MAP entry:**
- Stone name: Void Stone
- Color: indigo/dark theme (`text-indigo-400`, `bg-indigo-500/10`, `border-indigo-500/30`, icon: `'⚫'`)

**Prompts:**

| # | Title | Angle |
|---|-------|-------|
| 1 | Cipher Text | Coded journal describing signet abilities the college claims don't exist |
| 2 | The Burned History | Dragon reveals riders destroyed a civilization and erased the records |
| 3 | Forbidden Thesis | Dead scholar's research proves signet-venin connection -- suppressed by the college |
| 4 | Memory Stone | Artifact plays back a centuries-old scene that contradicts official history |
| 5 | The Heretic's Map | Map showing locations beyond the wards the college insists are uninhabitable |
| 6 | Living Document | Text rewrites itself based on reader's signet -- personalized truths |
| 7 | The Price of Knowing | Learn something so dangerous that knowing it makes you a target |
| 8 | Oral Tradition | Gryphon rider shares knowledge never written down -- on purpose |
| 9 | The Redacted Name | Every record of a specific rider erased -- find out why |

**Files changed:**
- `src/lib/empyreanPrompts.ts` -- add 9 prompts, add `'Forbidden Lore'` to `empyreanPromptCategories`
- `src/components/settings/EmpyreanPromptLibrary.tsx` -- add Void Stone to `STONE_MAP` (line ~58)

---

### 2. Session Zero Wizard

Interactive builder that generates a Session Zero guide. **No tone selection** -- tone is already managed by the Campaign Pack and Air Wizard.

**Player inputs:**

| Setting | Options |
|---------|---------|
| Content Boundaries | Toggles: Romance, Graphic Violence, Horror, Character Death, PvP Conflict, Psychological Themes |
| Backstory Depth | Light / Medium / Deep |
| Session Length | Short (30 min) / Standard (1 hr) / Long (2+ hrs) |
| Player Style | Combat-focused / RP-focused / Exploration-focused / Balanced |
| Character Hooks | Text input (1-2 sentences) |

**Generated guide** includes sections for Content Boundaries, Backstory Integration, Session Pacing, Player Style, and Character Hooks. No tone section.

**Files:**
- New: `src/components/settings/SessionZeroWizard.tsx`
- Modified: `src/components/settings/EmpyreanCampaignPack.tsx` -- add section

---

### 3. Arc Planner Wizard

Interactive builder for multi-session campaign arcs.

**7 arc templates** (not 8 -- "Forbidden Knowledge" removed as it overlaps the Forbidden Lore stone):

| Template | Description |
|----------|-------------|
| Revenge | Track down whoever wronged the character across escalating confrontations |
| Redemption | Fallen from grace -- earn back trust through sacrifice |
| Rise to Power | From nobody to leader through political maneuvering |
| Mystery Unraveled | Investigate something wrong that nobody else sees |
| The Hunt | A specific target must be found -- each session narrows the search |
| War Campaign | Large-scale conflict escalating from skirmishes to full war |
| Bond Tested | Dragon bond is strained or evolving -- each session pushes the relationship |

**Session count pacing:** 3 / 5 / 8 / 12 sessions with appropriate beat distribution.

**Branching paths:** Up to 3 decision points with session number, choice description, and path consequences.

**Files:**
- New: `src/components/settings/ArcPlannerWizard.tsx`
- Modified: `src/components/settings/EmpyreanCampaignPack.tsx` -- add section

---

### 4. Session Planner

#### 4a. Session Type Templates (3 static guides, not 6)

Removed overlapping templates:
- ~~Combat Gauntlet~~ (overlaps `Combat and Warfare` lore guide)
- ~~Social Intrigue~~ (overlaps `Academy Slice-of-Life` tone guide)
- ~~Exploration Run~~ (overlaps `Exploration and Discovery` tone guide)

**Remaining 3 templates:**

| Template | Focus |
|----------|-------|
| Heist Session | One job: plan, execute, improvise when it goes wrong |
| Trial by Fire | Character faces judgment -- formal or informal -- must defend themselves |
| Downtime and Recovery | Rest session between arcs -- character development, side quests, relationship building |

Added as `EmpyreanGuide` objects with `category: 'session'`.

**Type changes required:**
- `EmpyreanGuide['category']` type union updated: `'lore' | 'tone' | 'pacing' | 'alternate' | 'session'`
- `CATEGORY_META` in `EmpyreanCampaignPack.tsx` updated with new `session` entry

#### 4b. Custom Session Builder (Wizard)

Interactive builder for a custom single-session guide.

**Player inputs:**
- Session Type (dropdown: Heist / Trial / Downtime / Custom)
- Primary Objective (text input)
- Key NPCs (up to 3: name + role)
- Complication (dropdown: Betrayal / Time Pressure / Moral Dilemma / Environmental Hazard / Unexpected Ally / None)
- Desired Ending (dropdown: Cliffhanger / Resolution / Player's Choice / Bittersweet)

**Files:**
- New: `src/components/settings/SessionPlannerWizard.tsx`
- Modified: `src/lib/empyreanGMGuides.ts` -- add 3 session guides, update type, add exports
- Modified: `src/components/settings/EmpyreanCampaignPack.tsx` -- add `session` to `CATEGORY_META`, add Session Planner section

---

### Summary of All Changes

| File | Change |
|------|--------|
| `src/lib/empyreanPrompts.ts` | Add 9 Forbidden Lore prompts + update categories array |
| `src/components/settings/EmpyreanPromptLibrary.tsx` | Add Void Stone to STONE_MAP |
| `src/lib/empyreanGMGuides.ts` | Update `EmpyreanGuide` type, add 3 session guides + exports |
| `src/components/settings/EmpyreanCampaignPack.tsx` | Add `session` to CATEGORY_META, add 3 wizard sections |
| `src/components/settings/SessionZeroWizard.tsx` | New -- Session Zero builder (no tone selection) |
| `src/components/settings/ArcPlannerWizard.tsx` | New -- Arc planner with 7 templates + branching |
| `src/components/settings/SessionPlannerWizard.tsx` | New -- Session type templates + custom builder |

**What was removed vs original plan:**
- 1 duplicate Forbidden Lore prompt (The Restricted Section)
- 1 duplicate arc template (Forbidden Knowledge)
- 3 duplicate session type templates (Combat Gauntlet, Social Intrigue, Exploration Run)
- Tone selection from Session Zero Wizard
- No changes to Infinity Stone drawers (separate system)

**Total new content:** 9 prompts + 3 session guides + 3 interactive wizards.
