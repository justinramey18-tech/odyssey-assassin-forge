

## Add 10 Meta GM Guides + 10 Lore GM Guides + 50 Empyrean Prompt Templates

### Overview

This implementation adds three content packages to the app:

1. **10 Lore GM Guides** -- world-building reference material (Navarre, Basgiath, dragons, signets, runes, venin, factions, combat, NPCs, tone)
2. **10 Meta GM Guides** -- campaign modifiers that change how the AI DM runs the game (pacing, focus, perspective, alternate premises)
3. **50 Empyrean Prompt Templates** -- session prompts for use with external AI DMs

All content lives in two new data files. The UI for browsing/installing reuses existing patterns (GM Guides library, prompt copy system).

---

### The 10 Meta GM Guides

These are split into two categories per the "Mix of Both" stacking preference:

**Tone Changers (mutually exclusive -- pick one):**
Each of these fundamentally redefines the campaign's mood and narrative priority. Only one should be active at a time.

1. **Romance & Bonds First** -- Romance is the primary narrative driver. Every encounter, quest, and combat scenario is filtered through its impact on relationships. The AI DM prioritizes romantic tension, jealousy, vulnerability, stolen moments, and the push-pull of forbidden attraction. Combat and politics serve the love story, not the other way around. Inspired by the Violet/Xaden dynamic.

2. **Military Thriller** -- The campaign runs like a war room. Chain of command is sacred, intelligence is currency, and every mission has strategic consequences. The AI DM emphasizes tactical briefings, classified information, betrayal within ranks, and the moral cost of following (or defying) orders. Romance takes a back seat to duty.

3. **Horror Survival** -- Venin encounters are terrifying. The ward line is failing. Resources are scarce. Death is permanent and the AI DM does not pull punches. Dark atmospheric descriptions, isolation, paranoia about who might be turning, and genuine resource management (spell slots, healing, supplies). The world feels hostile and hope is earned.

4. **Academy Slice-of-Life** -- Low-stakes Basgiath daily life. Training montages, friendships forming over meals, studying for Battle Brief, sparring rivalries that are competitive but not lethal. The AI DM focuses on character development, humor, found-family dynamics, and the quiet moments between the big events. War is a distant threat, not an immediate one.

5. **Dragon-Centric Campaign** -- The dragon is not a mount -- it is a co-protagonist. Scenes are frequently told from the dragon's perspective. Dragon politics, hatchling dynamics, ancient grudges between dragon bloodlines, and the telepathic bond's emotional depth are the narrative core. The AI DM gives the bonded dragon a rich personality, opinions, and agenda that sometimes conflicts with the rider's goals.

**Pacing and Structure Modifiers (stackable -- combine with any tone changer):**
These modify timeline speed and session structure. They layer on top of a tone changer.

6. **Real-Time Crawl** -- Every scene plays out in granular detail. A single day at Basgiath might span an entire session. Conversations are fully dramatized, meals are described, training exercises are step-by-step. The AI DM never summarizes or skips ahead unless explicitly asked. Ideal for deep immersion and character development.

7. **Montage Mode** -- Time moves in broad strokes. Weeks or months pass between fully dramatized scenes. The AI DM provides narrative summaries of training progress, relationship shifts, and world events between the "big moments." Each session covers significant plot beats rather than daily minutiae.

8. **Episodic Structure** -- Each session is a self-contained episode with a beginning, middle, and cliffhanger ending. Time skips between episodes. The AI DM structures each session around a central conflict or revelation that resolves (or escalates) by session's end. Previously on / next time teasers included.

9. **Wartime Escalation** -- Events move fast. The ward line is collapsing, attacks are increasing in frequency, and there is no downtime. The AI DM maintains constant urgency -- interrupted rest, emergency deployments, cascading consequences from previous sessions. Every decision has immediate ripple effects.

**Alternate Campaign Premise (mutually exclusive with each other, stackable with pacing modifiers):**

10. **Alternate Perspectives Pack** -- A single guide containing four alternate campaign frameworks, each clearly sectioned so the AI DM knows which one is active:
    - **Scribe Quadrant:** Play as a scribe -- information warfare, forbidden archives, coded messages, and knowing secrets that could get you killed. No dragon bond, but access to intelligence that riders would kill for.
    - **Pre-Unification Era:** Set centuries before the current timeline. Dragon riders are independent warlords, there is no Basgiath, and alliances are forged through fire. Raw, tribal, politically volatile.
    - **Venin Perspective:** Morally gray campaign. Play as someone drawn to (or already wielding) dark power. The AI DM presents venin not as monsters but as people who made desperate choices. The corruption is seductive and the "heroes" are not always right.
    - **Basgiath Leadership:** Play as a professor, wingleader, or commanding officer. Manage student rivalries, keep institutional secrets, make impossible decisions about who lives and who gets sent on suicide missions. The students are your responsibility and some of them will not survive.

Each section in the Alternate Perspectives guide is marked with a clear header so users can tell the AI DM "I'm playing the Scribe Quadrant scenario" and only that section applies.

---

### The 10 Lore GM Guides

(Unchanged from previous plan -- included here for completeness)

1. **World of Navarre** -- geography, political structure, the Empyrean, the war, the Reunification treaty (~3,000 chars)
2. **Basgiath War College** -- four quadrants, wing/squad structure, daily life, curriculum, chain of command (~2,500 chars)
3. **Dragon Bonds** -- bonding mechanics, mental connection, bleed-through, breeds, second bonds, dragon agency (~3,000 chars)
4. **Signet Abilities** -- manifestation, categories, burnout, growth, creating original signets (~2,500 chars)
5. **Runes and Warding** -- ward line mechanics, runic magic, wardstones, ward failure consequences (~2,500 chars)
6. **Venin and Wyverns** -- what venin are, corruption stages, wyvern biology, tactics, moral complexity (~2,500 chars)
7. **Factions and Politics** -- government, the rebellion, scribe information control, inter-kingdom relations (~2,500 chars)
8. **Combat and Warfare** -- aerial combat, ground combat, squad tactics, large battles, D&D integration (~2,500 chars)
9. **NPCs and Archetypes** -- common NPC types, distinct voices, antagonist design, romance archetypes (~2,000 chars)
10. **Tone and Narrative Style** -- series voice, dragon telepathy conventions, danger, romance, cliffhangers (~2,000 chars)

---

### The 50 Empyrean Prompt Templates

(Unchanged from previous plan -- 50 prompts across 7 categories: Dragon Bond, Signet Abilities, Basgiath War College, Venin and Dark Forces, Relationships and Politics, Combat and Survival, Meta and Narrative)

---

### Stacking Rules (Documented in UI)

The installation UI will show clear labels:

```text
TONE (pick one):
  [ ] Romance & Bonds First
  [ ] Military Thriller
  [ ] Horror Survival
  [ ] Academy Slice-of-Life
  [ ] Dragon-Centric Campaign

PACING (pick one, stacks with tone):
  [ ] Real-Time Crawl
  [ ] Montage Mode
  [ ] Episodic Structure
  [ ] Wartime Escalation

ALTERNATE PREMISE (optional, stacks with pacing):
  [ ] Alternate Perspectives Pack
      → Then tell your AI: "I'm playing [Scribe/Pre-Unification/Venin/Leadership]"
```

---

### Technical Implementation

**New Files:**

| File | Purpose |
|------|---------|
| `src/lib/empyreanPrompts.ts` | 50 prompt template definitions |
| `src/lib/empyreanGMGuides.ts` | 20 GM Guide content definitions (10 lore + 10 meta) with metadata flags for stacking rules |
| `src/components/settings/EmpyreanPromptLibrary.tsx` | Browsable drawer for the 50 prompts with category tabs, copy, and favorites |
| `src/components/settings/EmpyreanCampaignPack.tsx` | Install/preview UI for the 20 GM Guides with stacking rule labels and category sections (Lore / Tone / Pacing / Alternate) |

**Modified Files:**

| File | Change |
|------|--------|
| `src/components/settings/SettingsContent.tsx` | Add "Empyrean Campaign Pack" section with buttons to open prompt library and guide installer |
| `src/components/ai-dm/DMToolsDrawer.tsx` | Add "Empyrean Prompts" tool row |

**Data structure for guides:**

```typescript
interface EmpyreanGuide {
  id: string;           // 'empyrean-lore-navarre', 'empyrean-meta-romance', etc.
  name: string;
  content: string;
  category: 'lore' | 'tone' | 'pacing' | 'alternate';
  stackable: boolean;   // false for tone/alternate, true for pacing/lore
  description: string;  // Short preview shown in installer UI
}
```

**Installation behavior:**
- "Install All Lore Guides" adds all 10 lore guides (all enabled by default)
- Tone/Pacing/Alternate guides are installed individually via toggle
- When enabling a tone guide, any other active tone guide is auto-disabled (with toast warning)
- Pacing guides follow the same mutual-exclusion pattern within their category
- All guides use the existing `useGMGuides().addGuide()` function
- Each guide ID is prefixed with `empyrean-` for identification
- A "Remove All Empyrean Guides" option removes all guides with the prefix
- Total estimated content: ~50,000 characters (well within the 200,000 char budget)

**Prompt template structure:**
- Uses existing `CharacterPrompt` interface (id, category, title, description, prompt, icon)
- `[Character Name]` placeholder auto-replaced on copy
- `applyTimePrefix()` applied when copying
- Favorites stored in localStorage under `empyrean-favorite-prompts`
- Categories displayed as swipeable tabs (same pattern as `GMGuidePrompts` and `InfinityStoneDrawer`)

