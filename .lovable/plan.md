

## Plan: Expand DevToolsPanel with New Categories, Descriptions & Prompt Templates

### Changes to `src/components/settings/DevToolsPanel.tsx`

**1. Update data structure** — Add a `description` field to `FILE_MAP` type for layman explanations.

**2. Add layman descriptions to all 10 existing sections**, e.g.:
- Pages: "The main screens of the app — each URL loads one of these."
- Hooks: "The brains behind each feature — they manage data and keep the screen updated."
- etc.

**3. Add 5 new file map sections:**

- **Hooks (Game Logic)** — Key hooks: `use-ai-dm`, `use-combat-actions`, `use-spellcasting`, `use-loot`, `use-conditions`, `use-cooldowns`, `use-party-sync`, `use-prestige`, `use-xp-progression`, `use-wild-shape`, `use-oracle`, `use-consumables`, `use-equipment-stats`, `use-ability-scores`, `use-multiclass`, `use-initiative`, `use-worldbuilder`, etc.
  - *"The brains behind each feature — they manage data, handle button presses, and keep the screen up to date."*

- **Data & Rules (src/lib)** — Major lib folders: combat, magic, inventory, classes, conditions, consumables, cooldowns, prestige, abilityTrees, loot, shop, spellCustomization, abilityScores, abilityCustomization, scribe, chronicleSync.
  - *"The game's rulebook — item stats, spell tables, class configs, and all the numbers that make the game work."*

- **Type Definitions** — Core type files: `src/lib/types.ts`, plus types in loot, combat, magic, conditions, etc.
  - *"Blueprints that define the shape of every character, item, spell, and ability so the code stays consistent."*

- **Utilities** — General helpers: `diceRoller.ts`, `hpCalculation.ts`, `iconUtils.ts`, `scoped-storage.ts`, `xpSystem.ts`, `resetApp.ts`, `fourthWallTime.ts`, `utils.ts`, `rollQuality.ts`, `tts-utils.ts`.
  - *"Small helper tools used everywhere — dice rolling, HP math, data storage shortcuts."*

- **AI & Prompts** — Prompt generators and DM config: `rpPromptGenerator.ts`, `empyreanPrompts.ts`, `characterPrompts.ts`, `gmGuidePrompts.ts`, `dm-models.ts`, `narrativeProcessor.ts`, `wildShapePrompts.ts`, `scribe-models.ts`, plus `src/lib/loot/prompts.ts`, `src/lib/magic/channelDivinityPrompts.ts`.
  - *"The instructions and templates sent to the AI when it plays as the DM, generates stories, or builds worlds."*

**4. Add new section: "Ideal Prompts for Lovable"**
  - *"Copy-paste templates for talking to Lovable. Fill in the [brackets] with your specifics."*
  - Contains copyable prompt templates organized by category:

  **Sync / State Bugs:**
  ```
  When I [do X] in [ComponentA], [ComponentB] doesn't update. Check if they share the same storage key, event name, and characterId.
  ```

  **UI / Visual Changes:**
  ```
  On the [ScreenName] screen, change [element] to [desired look]. Keep everything else the same.
  ```

  **Add a New Feature:**
  ```
  Add [feature] to [ScreenName]. It should [behavior]. Store data scoped to characterId in localStorage key odyssey_${characterId}_[key].
  ```

  **Fix a Bug:**
  ```
  On [Screen], when I [action], [what goes wrong] instead of [expected]. Check [ComponentA] and [ComponentB] for mismatched keys or missing event listeners.
  ```

  **AI DM / Prompt Tuning:**
  ```
  The AI DM response when I [trigger action] is [problem — too long / wrong tone / missing info]. Update the prompt in [file] to [desired change].
  ```

  **Data Not Saving:**
  ```
  When I [change X] on [Screen], it doesn't persist after reload. Check the save logic in [hook/component] — verify the localStorage key and JSON.parse/stringify error handling.
  ```

  **Add New Game Content:**
  ```
  Add a new [spell/ability/item/class] called [Name] with these stats: [stats]. Follow the same pattern as existing entries in [file].
  ```

**5. Update render logic** — Show `description` as italic text above each `<pre>` block. For the prompts section, render each template in a styled code block with a tap-to-copy button.

### Files Modified
- `src/components/settings/DevToolsPanel.tsx` — all changes in this single file

