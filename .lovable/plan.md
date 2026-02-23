

## Add AI Model Selector to Novel Builder and Scribe Tab

### Overview
Add a model selector dropdown to both the Novel Builder home screen and the Scribe tab, allowing users to choose which AI model processes their text. Currently, the Novel Builder only has offline processing, and the Scribe tab's AI mode is hardcoded to use Gemini via the `narrative-forge` edge function. Both will gain the ability to select from all available models (Gemini, GPT, Claude).

### Changes

#### 1. Create Shared Scribe Model Config
**File: `src/lib/scribe-models.ts`** (new)

A dedicated model list for the Scribe/Novel Builder context, reusing the same `DMAIModel` interface from `dm-models.ts`. Includes:
- Subset of models suitable for narrative writing (Gemini 3 Pro, Gemini 2.5 Flash, GPT-5, Claude 4.5 Sonnet)
- `localStorage` persistence under a separate key (`dnd-scribe-ai-model`)
- Default model: `google/gemini-3-pro-preview`
- Helper to determine routing: Anthropic models go to `scribe-ai`, others go to `narrative-forge`

#### 2. Update Novel Builder Home Screen
**File: `src/components/home/ChroniclerHomeView.tsx`**

- Add model selector dropdown below the Style selector (same row or new row)
- Add "AI" button alongside the existing "Transform" (offline) button
- Add `isAiProcessing`, `aiUsage`, and `selectedModel` state
- Route AI requests: Anthropic models call `scribe-ai` edge function, Lovable models call `narrative-forge`
- Display token usage below output when `aiUsage` is present

#### 3. Update Scribe Tab
**File: `src/components/scribe/NarrativeForgeScreen.tsx`**

- Add model selector dropdown in the settings/controls area (near the AI/Offline toggle)
- Add `selectedModel` and `aiUsage` state
- When `processingMode === 'ai'`:
  - If model is Anthropic: route to `scribe-ai` with `model` param, capture usage
  - If model is Lovable gateway: route to `narrative-forge` with `model` param (existing behavior)
- Display usage stats below output when available

#### 4. Update `scribe-ai` Edge Function to Accept Model Parameter
**File: `supabase/functions/scribe-ai/index.ts`**

- Accept optional `model` field in the request body
- Map model IDs to Anthropic model strings (e.g., `anthropic/claude-sonnet-4-5` to `claude-sonnet-4-5-20250514`, `anthropic/claude-sonnet-4` to `claude-sonnet-4-20250514`)
- Default to `claude-sonnet-4-5-20250514` if no model specified

#### 5. Update `narrative-forge` Edge Function to Accept Model Parameter
**File: `supabase/functions/narrative-forge/index.ts`**

- Accept optional `model` field in the request body
- Use the provided model ID when calling the Lovable AI gateway instead of hardcoded `google/gemini-3-pro-preview`
- Fall back to default if not provided

---

### Technical Details

**Model routing logic (shared):**
```text
User selects model
  |
  +-- anthropic/* --> call `scribe-ai` edge function (Anthropic API direct)
  |
  +-- google/* or openai/* --> call `narrative-forge` edge function (Lovable gateway)
```

**Novel Builder UI layout change:**
- Style selector + Model selector on one row
- Two action buttons: "Transform" (offline) and "AI" (uses selected model)
- Usage stats shown below output when AI is used

**Scribe Tab UI layout change:**
- Model selector dropdown added near the existing AI/Offline mode toggle
- Only visible/relevant when AI mode is selected
- Usage stats shown below output

**localStorage keys:**
- `dnd-scribe-ai-model` for persisting the selected model across sessions

**Files to create:**
- `src/lib/scribe-models.ts`

**Files to modify:**
- `src/components/home/ChroniclerHomeView.tsx`
- `src/components/scribe/NarrativeForgeScreen.tsx`
- `supabase/functions/scribe-ai/index.ts`
- `supabase/functions/narrative-forge/index.ts`

