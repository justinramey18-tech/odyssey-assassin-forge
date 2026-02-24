

## Add Anti-Truncation Prompt to Scribe AI

### Change

**File:** `supabase/functions/scribe-ai/index.ts`, lines 280-282

Replace the user message construction with the user's provided prompt text for the transform path, keeping the enhance path as-is.

**From:**
```typescript
const userMessage = isEnhance
  ? `Enhance this prose with rich descriptive detail while preserving every original word:\n\n${slicedText}`
  : `Transform this TTRPG chat log into ${styleDesc} narrative:\n\n${slicedText}`;
```

**To:**
```typescript
const userMessage = isEnhance
  ? `Enhance this prose with rich descriptive detail while preserving every original word:\n\n${slicedText}`
  : `Transform this TTRPG snippet into ${styleDesc} prose narrative. You must complete the entire transformation in this single response without truncation. Be concise and efficient—use tight, vivid prose that captures the essence of each moment without elaborate flourishes. Prioritize covering all events, dialogue, and actions from start to finish over detailed descriptions. If the snippet is substantial, use shorter sentences and compact phrasing to ensure you reach the end.\n\n${slicedText}`;
```

One line change. The anti-truncation instructions tell Claude to prioritize completeness over verbosity, fitting the full narrative within the 5000-token output cap.

### Files Changed
1. `supabase/functions/scribe-ai/index.ts` — updated transform user message prompt

