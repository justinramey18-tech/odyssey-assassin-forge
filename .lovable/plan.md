
## AI-Assisted World Building Wizard for Solo AI DM

### What We're Building

A multi-step, AI-assisted world building wizard that launches when a player starts a new Solo AI DM campaign. Instead of facing a blank chat, they are guided through 5 quick steps to define their world — genre, setting, tone, starting situation, and a character hook — and then a lightweight AI call generates a rich campaign bible that gets saved as a GM Guide and injected into the DM's system prompt before the first message is even sent.

### User Experience Flow

```text
Player taps "New" or "New Campaign"
  → World Building Wizard opens (full-screen overlay, z-9999)
  → Step 1: Genre & Tone (fantasy sub-genre, grimdark/heroic/mystery)
  → Step 2: Setting (location archetype — city underbelly, cursed wilderness, etc.)
  → Step 3: Factions & Conflict (who rules, who rebels, what's at stake)
  → Step 4: Your Hook (how does THIS character fit in — job, origin, goal)
  → Step 5: Preview & Generate
       → AI generates campaign bible (~600 words)
       → Saved automatically as a GM Guide titled "Campaign World"
       → Wizard closes, DM screen opens with world context pre-loaded
       → AI DM greets with an immersive opening scene based on the world
```

The wizard is **optional** — players can skip it with "Start Blank" at any point and go straight to a blank campaign like today.

---

### Architecture

The implementation adds 3 new files and modifies 2 existing ones:

#### 1. New Edge Function: `supabase/functions/ai-dm-worldbuilder/index.ts`

Uses `google/gemini-2.5-flash` (balanced speed + quality for ~600-word generation). Accepts:

```typescript
interface WorldBuilderRequest {
  genre: string;          // e.g. "Dark Fantasy"
  tone: string;           // e.g. "Grimdark"
  setting: string;        // e.g. "City of Shadows"
  settingNotes: string;   // user's custom notes
  factions: string;       // e.g. "Thieves Guild, Church Inquisitors"
  conflict: string;       // e.g. "Power vacuum after the king's assassination"
  characterHook: string;  // "I'm a disgraced noble turned street thief"
  characterName: string;  // from characterContext
  characterLevel: number;
}
```

Returns a structured campaign bible in markdown, including:
- **World Overview** (name, atmosphere, flavor)
- **Key Locations** (3 named starting areas with brief descriptions)
- **Active Factions** (2–3 factions with motivations and attitudes toward the player)
- **Current Situation** (what's happening right now, why it matters)
- **Your Hook** (how this specific character is connected)
- **DM Instructions** (tone guidance, what to emphasize, what to avoid)
- **Opening Scene Seed** (a 2-sentence scene-setting prompt for the DM's first message)

Uses tool-calling for structured JSON output, then formats to markdown for injection into the GM Guide system.

#### 2. New Component: `src/components/ai-dm/WorldBuilderWizard.tsx`

A full-screen overlay (z-9999, matching all other DM overlays). Five steps implemented as a single component with internal `currentStep` state — no separate files needed given the modest scope.

**Step 1 — Genre & Tone**
- Genre pills: Dark Fantasy / High Fantasy / Gritty Noir / Cosmic Horror / Sword & Sorcery / Custom
- Tone pills: Heroic / Grimdark / Mystery / Political Intrigue / Survival / Custom
- Single-select, visual card format

**Step 2 — Setting**
- 6 setting archetypes as visual cards with icons:
  - City Underbelly (thieves, guilds, narrow streets)
  - Cursed Wilderness (haunted lands, dangerous travel)
  - Ancient Dungeon (ruins, traps, forgotten gods)
  - Frontier Town (lawless, frontier justice)
  - Noble Court (intrigue, politics, masks)
  - Open Seas (pirates, island exploration)
- Plus a free-text "Setting Notes" textarea for custom flavor

**Step 3 — Factions & Conflict**
- 2–3 faction pill selectors (pre-defined for each setting archetype, e.g. City Underbelly → Thieves' Guild, City Watch, Merchant Consortium)
- "What's the core conflict?" short-text field (pre-filled with a suggestion per genre)

**Step 4 — Your Hook**
- "How does your character fit into this world?" — a guided textarea with 3 starter prompts (clickable, fills the textarea):
  - "I'm a hired blade with no allegiance..."
  - "I'm searching for someone who disappeared..."
  - "I owe a debt I can never repay..."
- Free text override encouraged

**Step 5 — Preview & Generate**
- Summary card showing all chosen options
- "Generate World" button — calls the edge function, shows a loading state with a progress message ("The gods are weaving your fate...")
- On success: shows a preview of the generated campaign bible (scrollable)
- "Begin Adventure" button finalizes and closes the wizard

**Navigation:** Back/Next buttons at the bottom. Skip button at top-right on every step.

#### 3. New Hook: `src/hooks/use-worldbuilder.ts`

A slim hook managing:
- `worldBuilderState` — the form state across all 5 steps
- `isGenerating: boolean` — tracks the AI call
- `generatedBible: string | null` — the AI output
- `generateWorld()` — calls the edge function, handles errors silently with a toast fallback
- `applyWorldToGuide(addGuide: fn)` — calls `gmGuides.addGuide("Campaign World", generatedBible)` to persist it

#### 4. Modified: `src/components/ai-dm/AIDMScreen.tsx`

Add `showWorldBuilder` state (boolean). Wire it:

```typescript
// When "New" is clicked, show world builder instead of calling newGame directly
const handleNewCampaign = useCallback(() => {
  setShowWorldBuilder(true);
}, []);

// When wizard completes:
const handleWorldBuilderComplete = useCallback(async (bible: string, campaignName: string) => {
  await newGame();
  await resetForNewCampaign(null);
  if (bible) {
    gmGuides.addGuide('📖 Campaign World', bible);
    // Also auto-send the opening scene seed as first DM message
    setTimeout(() => sendMessage('Begin the adventure'), 100);
  }
  setShowWorldBuilder(false);
}, [newGame, resetForNewCampaign, gmGuides.addGuide, sendMessage]);
```

The `CampaignDropdown`'s "New Campaign" click also routes through this handler.

#### 5. Modified: `supabase/config.toml`

Register the new `ai-dm-worldbuilder` edge function.

---

### Technical Details

**Edge Function Pattern**

Uses tool-calling (not free-form JSON) to reliably extract the structured campaign bible:

```typescript
tools: [{
  type: "function",
  function: {
    name: "create_campaign_world",
    parameters: {
      type: "object",
      properties: {
        world_name: { type: "string" },
        overview: { type: "string" },
        locations: { type: "array", items: { ... } },
        factions: { type: "array", items: { ... } },
        situation: { type: "string" },
        character_hook: { type: "string" },
        dm_instructions: { type: "string" },
        opening_scene_seed: { type: "string" },
      }
    }
  }
}]
```

Then formats the tool result into a clean markdown document for injection into the GM Guide.

**GM Guide Integration**

The generated bible is saved via the existing `gmGuides.addGuide()` function from `use-gm-guides.ts`. Since GM Guides already get injected into the AI system prompt as `## CUSTOM GM GUIDES`, the world bible is automatically context for every message in the campaign — without any changes to the DM edge function.

**Opening Scene Trigger**

After the wizard closes and `newGame()` runs, a single `sendMessage('Begin the adventure. Use the Campaign World guide to open with an immersive first scene.')` fires automatically so the player sees the DM speak first with a rich, world-specific opening — no blank chat experience.

**Skip Behavior**

At any step, "Start Blank" clears the wizard state and calls `newGame()` directly — same behavior as today.

---

### Files Created

- `supabase/functions/ai-dm-worldbuilder/index.ts` — AI world generation edge function
- `src/components/ai-dm/WorldBuilderWizard.tsx` — 5-step wizard UI component
- `src/hooks/use-worldbuilder.ts` — State management and API call hook

### Files Modified

- `src/components/ai-dm/AIDMScreen.tsx` — Wire `showWorldBuilder` state, intercept New Campaign, handle wizard completion
- `supabase/config.toml` — Register new edge function

---

### What It Does NOT Do

- Does NOT require the player to fill out the wizard — every step is skippable
- Does NOT change the existing DM system prompt or edge function structure
- Does NOT block the chat — world generation is fast (2–4 seconds with `gemini-2.5-flash`)
- Does NOT create a new database table — the bible lives in the existing `gm_guides` table
- Does NOT affect Party DM mode — Solo only
