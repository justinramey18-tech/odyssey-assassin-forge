

## Add Recap Mode to Party DM Oracle

### What it does
Adds `recap` as a 6th Oracle mode with a structured 3-part response format. The AI uses both `characterContext` data (HP, conditions, enemies) and the chat history (`recentNarrative` — last 10 DM messages already piped to the Oracle) plus `campaignSummary` to produce accurate recaps. Token budget varies by quick prompt.

### Response format
The AI responds in 3 labeled sections:

- **📖 Story** — Narrative recap of recent events (2-3 sentences)
- **⚔️ Situation** — Tactical state as bullet points, using real data from characterContext (HP, conditions, enemies, resources) narrated in the personality's voice
- **➡️ Next Move** — One sentence, context-dependent: tactical suggestion during combat, narrative hook during roleplay

### Quick prompts with variable token budgets

| Prompt | Token limit | Intent |
|--------|-------------|--------|
| "Quick catch-up" | 400 | Missed the last few messages |
| "What happened this scene?" | 600 | Scene-level summary |
| "Full session recap" | 1200 | Rejoining after absence |
| "Tactical briefing" | 500 | Combat-focused situation report |

### Files changed

**1. `src/components/oracle/types.ts`** — Add `'recap'` to the `OracleMode` union type.

**2. `src/components/oracle/modes.ts`** — Add recap entry to `oracleModes` array (icon: 📜, color: `#EC4899`, description: "Structured scene recap"). Add 4 quick prompts. Add `recap` case to `getModePromptModifier` with the 3-section format instructions and context-dependent Next Move logic.

**3. `supabase/functions/oracle-assistant/index.ts`** — Three changes:
- Add `'recap'` to the `OracleMode` type (line 10)
- Add `'recap'` to the mode validation array (line 919)
- Add `recap` case to `getModePromptModifier` (after line 850) with full structured prompt including instructions to use `recentNarrative` and `campaignSummary` for Story, `characterContext` fields for Situation, and combat state for Next Move tone
- Add variable token logic: default 600, but check the user's message content to match quick-prompt keywords ("quick catch-up" → 400, "full session" → 1200, "tactical briefing" → 500)

**4. No other files need changes** — `ModeSelector`, `QuickPromptBar`, `use-oracle`, and `OraclePanel` all dynamically read from the `oracleModes` array and `OracleMode` type.

