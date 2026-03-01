

## AFK Character Roleplay Personality Guide

### Concept
Each party member can upload a short "AFK personality guide" describing how the AI should roleplay their character if the round timer expires before they submit a prompt. When the timer runs out, instead of a generic "holds their action," the AI receives their personality guide and generates an in-character action for absent players.

### Data Storage
- Store the AFK guide in the existing `party_members` table inside the `character_status` JSONB column as `afkPersonalityGuide: string`.
- No migration needed — `character_status` is already a flexible JSONB field that each user can update via existing RLS policies.

### Implementation Steps

**1. Add AFK guide UI component**
- Create `src/components/ai-dm/AfkPersonalityGuide.tsx` — a small dialog/sheet where players write their AFK personality guide (textarea, max ~2000 chars).
- Include a save button that writes to `party_members.character_status.afkPersonalityGuide`.
- Show a small indicator (e.g., a ghost/sleep icon) in the round queue next to their pill if they have an AFK guide configured.

**2. Wire into PartyDMScreen**
- Add an "AFK Guide" button accessible from the sub-header strip or settings area (visible to all players, not just host).
- Load the current user's `character_status.afkPersonalityGuide` and pre-fill the editor.

**3. Modify timer expiry logic in `use-party-dm.ts`**
- When the timer expires and `generateResponse()` is auto-triggered:
  - For each member who has NOT submitted a prompt (or hasn't readied up):
    - Check their `party_members.character_status.afkPersonalityGuide`.
    - If a guide exists: auto-insert a prompt like `[Character] (AFK — AI roleplaying): The AI will roleplay this character based on their personality guide.` and include the guide content in the system prompt sent to the AI.
    - If no guide exists: use the current fallback behavior (generic "holds their action").
- The AFK guide text is injected into the AI system prompt as a special section: `## AFK CHARACTER GUIDES\nRoleplay the following absent characters in-character based on their personality descriptions:\n- [CharName]: [guide text]`.

**4. AI prompt integration**
- In `generateResponse()` and `streamAIResponse()`, when building the guides string, append AFK character personality sections for absent players.
- The combined user message still lists absent players but flags them as `[CharName] (AFK)` rather than `[CharName]: Holds their action`.

### Technical Details

```text
party_members.character_status JSONB shape (extended):
{
  level: number,
  className: string,
  currentHP: number,
  maxHP: number,
  afkPersonalityGuide: string | null   // ← NEW
}
```

Timer expiry flow:
```text
Timer hits 0
  → host's handleTimerExpire() fires
  → generateResponse() called
  → For each member without a ready prompt:
      → Look up their character_status.afkPersonalityGuide
      → If guide exists: auto-create prompt "[CharName] (AFK - AI roleplaying)"
        + inject guide into AI system prompt
      → If no guide: "[CharName]: Holds their action"
  → Normal generation proceeds
```

Files to create/modify:
- **Create**: `src/components/ai-dm/AfkPersonalityGuide.tsx`
- **Modify**: `src/hooks/use-party-dm.ts` (generateResponse, add getAfkGuides helper)
- **Modify**: `src/components/ai-dm/PartyDMScreen.tsx` (add AFK guide button + indicator)

