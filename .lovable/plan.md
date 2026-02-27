

## Plan: AI Creation Assistant

Add a fourth option "AI Creation Assistant" to the character wizard choice screen that leads to a new full-screen, mobile-first AI chat page. The AI guides users through character creation by asking questions about all aspects of their character, then applies everything automatically.

### New Files to Create

1. **`supabase/functions/ai-creation-assistant/index.ts`** — New edge function for the AI character builder chat. Uses Lovable AI (gemini-3-flash-preview) with a system prompt that:
   - Opens by asking how in-depth the user wants creation to be (quick overview vs deep customization)
   - Progressively asks about: name, class, ability scores, game mode, skills/abilities, spells/arcana, equipment/gear, consumables, settings preferences
   - Aware of all app systems (ability trees: hunter/warrior/assassin, magic paths, equipment presets, game modes, XP presets, dice odds)
   - Returns structured JSON tool calls for each decision category
   - Summarizes all planned changes and asks for confirmation before finalizing
   - Uses tool-calling to extract structured character data at the end

2. **`src/pages/AICreationAssistant.tsx`** — New full-screen, mobile-first page with vertical scrolling chat interface. Contains:
   - Streaming AI chat UI (message list + input bar) using the same SSE pattern as other AI features
   - Dark themed to match the app aesthetic
   - Back button to return to wizard choice screen
   - "Apply & Continue" button that appears after AI confirms the build summary
   - On completion, navigates to `/ ` with the built character data applied, then shows mode selection screen

3. **`src/hooks/use-ai-creation-chat.ts`** — Hook managing chat state, streaming, message history, and parsing the AI's structured output into a `WizardState`-compatible object plus additional app state (homebrew abilities, spells, gear, consumables, settings)

### Files to Modify

4. **`src/components/wizard/CharacterWizard.tsx`** — Add a 4th button "AI Creation Assistant" in the choice screen (between Custom Build and Load from Cloud). Uses a `Bot` or `Sparkles` icon. Clicking navigates to `/ai-create`.

5. **`src/App.tsx`** — Add route: `<Route path="/ai-create" element={<AICreationAssistant />} />`

6. **`src/pages/Index.tsx`** — Handle incoming navigation state from the AI assistant (similar to how `rosterState` works). The AI assistant will navigate to `/` with state containing all the character data to apply.

### Flow

```text
Wizard Choice Screen
  ├─ Quick Start
  ├─ Custom Build (existing wizard)
  ├─ AI Creation Assistant ← NEW
  │    └─ /ai-create (full-screen chat)
  │         ├─ AI asks depth preference
  │         ├─ AI asks character questions progressively
  │         ├─ AI summarizes all changes
  │         ├─ User confirms → data applied
  │         └─ Navigate to / with character data
  │              └─ Mode Selection Screen shown
  └─ Load from Cloud
```

### AI System Prompt Design

The edge function system prompt will encode knowledge of:
- **Classes**: rogue, wizard, sorcerer, warlock, cleric, druid, bard (with suggested ability arrays from `CLASS_SUGGESTED_ARRAYS`)
- **Ability scores**: standard array, point buy, or manual
- **Game modes**: honest vs infinity pool, XP presets, dice odds
- **Magic paths** (rogue only): the available paths from the magic system
- **Equipment presets**: from `equipment-presets.ts`
- **Skill trees**: hunter, warrior, assassin ability trees
- **Consumables**: starting potions and items
- **Settings**: play mode preferences

The AI uses tool-calling to return a structured `CharacterBuildResult` at the end, which the frontend parses and applies through the same `applyWizardState` + additional setter paths used by Quick Start and the full wizard.

### Technical Details

- Edge function streams responses via SSE for real-time chat feel
- Chat history is sent with each request (conversation memory in frontend state)
- The final "apply" step uses the same `WizardState` setters and `handleLoadCloudSave`-style bulk state application
- Homebrew abilities created by the AI are saved via `abilityCustomization` hooks
- Custom spells saved via `spellCustomization` hooks
- Equipment applied via the same equipment state setters

