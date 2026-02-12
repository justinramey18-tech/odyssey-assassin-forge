

# AI Dungeon Master -- Full-Screen Chat Screen

## Overview
A dedicated, full-screen AI Dungeon Master screen that runs live D&D sessions tailored to the character's current state. Unlike the existing Oracle (a side-panel tactical advisor), this is a narrative game-runner: it describes scenes, handles NPCs, adjudicates rules, tracks encounters, and responds to player actions -- all synchronized with the app's real-time character data.

---

## Architecture

### New Edge Function: `ai-dm`
A new backend function (`supabase/functions/ai-dm/index.ts`) purpose-built for the DM role:

- **Model:** `google/gemini-3-pro-preview` (upgraded from Flash for deeper narrative reasoning)
- **System Prompt:** A comprehensive DM persona that:
  - Runs D&D 5e encounters, exploration, and roleplay
  - References the character's exact abilities, equipment, HP, spell slots, conditions, loot, and combat state by name
  - Asks for dice rolls and interprets results using the app's ability/tier system
  - Tracks scene continuity across the conversation
  - Adapts difficulty and narrative to the character's level and prestige
  - Handles initiative, enemy actions, environmental effects, and NPC dialogue
- **100-message memory:** The backend accepts up to 100 messages (vs Oracle's 50 limit), enabling long-running sessions
- **Streaming SSE** response identical to the Oracle pattern
- **Rate limit / credit error handling** (429/402) surfaced to the client

### New Hook: `use-ai-dm.ts`
Similar to `use-oracle.ts` but with DM-specific features:
- 100-message sliding window (oldest messages trimmed when exceeding 100)
- localStorage persistence of the session (`dnd-ai-dm-session`) so the game survives page reloads
- Same SSE streaming, abort controller, and error toast patterns
- Accepts the full `CharacterContext` (reuses the Oracle's context-building from `OracleDrawer`)
- Session management: new game, continue, clear

### New Component: `src/components/ai-dm/AIDMScreen.tsx`
A full-screen overlay (like the existing DiceRollerScreen / FullscreenPartyChat pattern):
- Full `100dvh` screen with dark themed gradient background
- **Header:** "AI Dungeon Master" title, back button, "New Game" and "Clear" actions
- **Message list:** Reuses the existing `MessageList` component pattern (markdown rendering, auto-scroll, animated entries) but with a DM-specific avatar and styling
- **Input area:** Text input with send button, cancel mid-stream support
- **Quick action chips:** Contextual prompts like "Look around", "Attack", "Talk to NPC", "Check for traps", "Cast a spell", "Rest", "Investigate"
- **Context banner:** A small collapsible chip showing current HP, level, and active conditions so the player has situational awareness

### Entry Point: Home Screen
- Add an "AI DM" button to the `drawerOptions` array in `HomeScreen.tsx` (the Quick Access sheet), using a distinctive icon (e.g., `Crown` or `BookOpen` from lucide)
- Toggling it opens the full-screen `AIDMScreen` overlay (same pattern as dice roller)

### Config
- Add `[functions.ai-dm]` with `verify_jwt = false` to `supabase/config.toml`

---

## Technical Details

### Files to Create
1. **`supabase/functions/ai-dm/index.ts`** -- Edge function with DM system prompt, 100-message limit, Gemini 3 Pro model, streaming
2. **`src/hooks/use-ai-dm.ts`** -- Client hook with 100-message memory, localStorage persistence, SSE streaming
3. **`src/components/ai-dm/AIDMScreen.tsx`** -- Full-screen chat UI component
4. **`src/components/ai-dm/DMAvatarBubble.tsx`** -- DM-themed message bubble component
5. **`src/components/ai-dm/DMQuickActions.tsx`** -- Quick action chip bar for common D&D actions
6. **`src/components/ai-dm/index.ts`** -- Barrel export

### Files to Modify
1. **`src/components/home/HomeScreen.tsx`** -- Add AI DM to drawer options, add state + overlay render
2. **`supabase/config.toml`** -- Register the new edge function

### System Prompt Design (Edge Function)
The DM system prompt will include:
- Full character context (same `buildContextSummary` pattern from Oracle)
- D&D 5e rules knowledge: action economy, advantage/disadvantage, saving throws, skill checks
- Scene management: describe environments, track NPCs, run combat rounds
- Instruction to ask for rolls when mechanics are needed (e.g., "Roll a Perception check (DC 14)")
- Instruction to reference the character's actual equipped abilities and gear in narrative descriptions
- Adaptive tone: dramatic in combat, atmospheric in exploration, characterful in social encounters
- Session continuity awareness: reference earlier events in the conversation

### Message Memory Strategy
- Store messages in React state + mirror to localStorage
- On send, take the last 100 messages as conversation history
- When exceeding 100, drop the oldest messages but keep the first 2 (which contain the session-opening context)
- On app load, restore from localStorage if a session exists

### Character Context Sync
- The `AIDMScreen` receives the same props as `OracleDrawer` (character, HP, equipment, conditions, etc.)
- Context is rebuilt on every message send via `useMemo`, so the DM always has the latest character state
- The context summary is injected as the system prompt prefix, not as a user message

