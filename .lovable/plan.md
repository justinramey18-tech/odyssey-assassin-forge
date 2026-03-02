

## Whisper System — Granular Build Steps

Here is the whisper system broken into 8 small, isolated prompts. Each step is testable on its own before moving to the next, minimizing risk of breaking existing functionality.

---

### Step 1: Edge Function — Add OUTPUT FORMAT section
**What**: Add a `## OUTPUT FORMAT` section to the end of the system prompt in `supabase/functions/ai-dm/index.ts`. This tells the AI to wrap dice rolls in `<!--ACTION-->`, strategic advice in `<!--TACTICS-->`, and per-player tips in `<!--WHISPER:Name-->`. Everything else must be pure narrative prose.

**Why first**: This is the highest-risk step — we need to verify the AI actually uses the delimiters before building any client code. If it doesn't work, we adjust the prompt before writing a parser.

**Test**: Send a message in Solo AI DM that should trigger a dice roll (e.g., "I search the room for traps"). Verify the raw response includes `<!--ACTION-->` tags by checking console logs or the raw message content.

**Files**: `supabase/functions/ai-dm/index.ts` only.

---

### Step 2: Create the whisper stream parser utility
**What**: Create `src/lib/whisper-parser.ts` — a pure function (no React, no side effects) that takes a string of AI output and returns `{ narrative: string, whispers: Array<{ type, target?, content }> }`. Handles `<!--ACTION-->`, `<!--TACTICS-->`, `<!--WHISPER:Name-->` delimiters. Also includes a regex fallback heuristic for lines like "Roll a D20" that the AI forgot to tag.

**Why isolated**: This is a pure utility with no dependencies on React or UI. Can be unit-tested mentally by reading the code — no integration risk.

**Test**: Temporarily call the parser in the streaming loop and `console.log` the output to verify it splits correctly.

**Files**: `src/lib/whisper-parser.ts` only (new file).

---

### Step 3: Extend the Message type with whispers metadata
**What**: Add an optional `whispers` field to the `Message` interface in `src/components/oracle/types.ts`:
```typescript
whispers?: Array<{ type: 'action' | 'tactics' | 'whisper'; target?: string; content: string }>;
```

**Why isolated**: Type-only change. Zero runtime impact. Prepares the data shape for steps 4 and 5.

**Files**: `src/components/oracle/types.ts` only.

---

### Step 4: Integrate parser into `use-ai-dm.ts` streaming loop
**What**: After the stream finishes (where `assistantContent` is complete), run it through the whisper parser. Store the clean `narrative` as the message `content` and attach the parsed `whispers` array to the message object. During streaming, show the raw text as-is (including delimiters) for responsiveness — only split on completion.

**Why this order**: The parser exists (step 2), the type exists (step 3), now we wire them together. The chat still renders identically because `DMMessageBubble` just shows `message.content`, which is now clean narrative.

**Test**: Send a message, check that `message.content` no longer contains `<!--ACTION-->` tags, and that `message.whispers` is populated in React DevTools or console.

**Files**: `src/hooks/use-ai-dm.ts` only.

---

### Step 5: Build the WhisperTray UI component
**What**: Create `src/components/ai-dm/WhisperTray.tsx` — a collapsible panel that renders below an AI message bubble. Shows action whispers with a 🎲 icon and tactical tips with a 💡 icon. Uses the existing app styling (amber borders, dark backgrounds, `font-cinzel` headers, Radix Collapsible). Includes a badge count on the trigger button.

**Why isolated**: Pure presentational component. Takes `whispers` array as a prop. No hook dependencies, no streaming logic.

**Test**: Render it in `DMMessageBubble` with hardcoded test data first to verify styling matches the app.

**Files**: `src/components/ai-dm/WhisperTray.tsx` (new file).

---

### Step 6: Attach WhisperTray to DMMessageBubble
**What**: Update `DMMessageBubble` in `AIDMScreen.tsx` to render `<WhisperTray>` below AI messages when `message.whispers` has entries. Add a small scroll/compass icon badge on the message to indicate whispers are available.

**Why this order**: The component exists (step 5), the data exists (step 4). This is just wiring.

**Test**: Run a Solo AI DM session. Verify narrative is clean in the chat bubble, and a collapsible tray appears below with the mechanical content.

**Files**: `src/components/ai-dm/AIDMScreen.tsx` only.

---

### Step 7: Add Oracle tab to DMBottomNav
**What**: Add a new "ORACLE" tab (using the `ScrollText` or `Eye` icon) to `DMBottomNav.tsx`. Create `src/components/ai-dm/OracleWhisperFeed.tsx` that receives all session messages and extracts/aggregates whispers into a scrollable feed. Wire the tab's content panel in the bottom nav drawer (same pattern as `diceContent` / `settingsContent`).

**Why this order**: Everything upstream works. This is an additive UI surface — doesn't touch the chat or streaming at all.

**Test**: Expand the bottom nav, tap Oracle tab, verify all whispers from the session appear in a scrollable feed with icons and timestamps.

**Files**: `src/components/ai-dm/DMBottomNav.tsx`, `src/components/ai-dm/OracleWhisperFeed.tsx` (new), `src/components/ai-dm/AIDMScreen.tsx` (pass oracle content prop).

---

### Step 8: Integrate parser into `use-party-dm.ts` + whisper filtering
**What**: Apply the same parser integration from step 4 to the party DM hook. Add character-name filtering so `<!--WHISPER:CharName-->` whispers only show to the matching player. General `<!--ACTION-->` and `<!--TACTICS-->` whispers show to everyone.

**Why last**: Party DM is more complex (database-backed messages, realtime sync). By doing solo first, we've battle-tested the parser and UI. This step is purely extending that to the party context.

**Test**: Run a party DM session with 2+ players. Verify each player only sees their own targeted whispers, while shared actions are visible to all.

**Files**: `src/hooks/use-party-dm.ts`, `src/components/ai-dm/PartyDMScreen.tsx`.

---

### Summary of build order and risk profile

```text
Step  Risk   Files Changed       What
────  ────   ──────────────      ──────────────────────────
  1   HIGH   edge function       Prompt update (validate AI compliance)
  2   LOW    new utility         Pure parser function
  3   NONE   types.ts            Add optional field to Message
  4   MED    use-ai-dm.ts        Wire parser into streaming
  5   LOW    new component       WhisperTray UI
  6   LOW    AIDMScreen.tsx      Attach tray to messages
  7   LOW    DMBottomNav + new   Oracle tab in bottom nav
  8   MED    use-party-dm.ts     Party DM integration
```

Each step produces a working app. If any step fails, we stop and fix before continuing.

