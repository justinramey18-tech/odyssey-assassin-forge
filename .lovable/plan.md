

## Personality Test Gate for Solo AI DM

### Overview

Before a player can enter the Solo AI DM for the first time, they must complete a comprehensive personality assessment combining Enneagram and MBTI (16 Personalities) frameworks (~80+ questions). The AI DM then adopts a complementary personality based on the results and shows the player a summary of the DM persona it created.

Results are stored in the cloud database (with localStorage fallback). Players can retake the test from the DM Tools Drawer with a confirmation warning.

---

### How It Works

1. Player taps "Solo DM" -- instead of opening the DM screen directly, the system checks if personality test results exist
2. If no results: a full-screen, multi-step personality test wizard launches
3. Player answers ~80-90 questions across Enneagram and MBTI dimensions
4. On completion: results are scored, a "DM Persona Summary" screen shows the complementary DM personality that was generated
5. Results are saved to the database and localStorage
6. The AI DM system prompt is injected with the personality profile, shaping all future narration
7. A "Retake Personality Test" option is added to the DM Tools Drawer (with confirmation dialog)

---

### The Test Structure

**Part 1: MBTI Dimensions (~40 questions)**
- Extraversion vs Introversion (10 questions)
- Sensing vs Intuition (10 questions)
- Thinking vs Feeling (10 questions)
- Judging vs Perceiving (10 questions)

Each question is a forced-choice between two statements (A/B format), themed around D&D scenarios to keep it engaging (e.g., "Before entering the dungeon, do you: A) Scout ahead methodically, B) Charge in and improvise").

**Part 2: Enneagram Core Type (~45 questions)**
- 5 questions per Enneagram type (9 types = 45 questions)
- Likert scale (Strongly Disagree to Strongly Agree)
- Also themed around adventuring scenarios

**Total: ~85 questions**, presented in themed sections with progress indicators.

---

### DM Personality Mapping

The AI doesn't just mirror the player -- it adopts a **complementary** personality:

- Introverted player gets a more expressive, encouraging DM
- Thinking-dominant player gets a DM who weaves more emotional NPC arcs
- Type 8 (Challenger) Enneagram gets a DM who presents worthy adversaries and respects their agency
- Type 4 (Individualist) gets a DM rich in atmospheric, emotionally resonant storytelling

This mapping logic lives in a utility file and generates a structured personality prompt block.

---

### DM Persona Summary Screen

After completing the test, the player sees a summary card:

- Their MBTI type (e.g., "INTJ - The Architect")
- Their Enneagram type (e.g., "Type 5 - The Investigator")
- The DM's adopted persona name and description (e.g., "Your DM: The Fireweaver -- an emotionally expressive storyteller who brings NPCs to vivid life and challenges your analytical nature with moral dilemmas")
- A "Begin Adventure" button to proceed to the DM screen

---

### Technical Plan

**Database:**
- New table: `personality_test_results`
  - `id` (uuid, PK)
  - `user_id` (uuid, not null)
  - `mbti_type` (text) -- e.g., "INTJ"
  - `mbti_scores` (jsonb) -- raw dimension scores
  - `enneagram_type` (integer) -- 1-9
  - `enneagram_scores` (jsonb) -- raw scores per type
  - `dm_persona` (jsonb) -- generated persona config
  - `created_at`, `updated_at` (timestamptz)
  - RLS: users can CRUD their own rows only

**New Files:**

| File | Purpose |
|------|---------|
| `src/lib/personality-test/questions.ts` | All ~85 questions with metadata (section, type, scoring key) |
| `src/lib/personality-test/scoring.ts` | Scoring algorithms for MBTI + Enneagram from raw answers |
| `src/lib/personality-test/dm-persona-mapping.ts` | Maps test results to a complementary DM persona prompt block |
| `src/lib/personality-test/types.ts` | TypeScript interfaces for questions, answers, results, persona |
| `src/components/ai-dm/PersonalityTestWizard.tsx` | Full-screen multi-step test UI with progress bar |
| `src/components/ai-dm/PersonalityResultsScreen.tsx` | Summary screen showing results + DM persona |
| `src/hooks/use-personality-test.ts` | Hook to load/save results from cloud + localStorage, check completion status |

**Modified Files:**

| File | Change |
|------|--------|
| `src/components/drawers/PromptDrawerProvider.tsx` | Gate the `aiDMOpen` state -- check if test is complete before opening DM screen; show wizard if not |
| `src/components/ai-dm/DMToolsDrawer.tsx` | Add "Retake Personality Test" button with confirmation dialog |
| `supabase/functions/ai-dm/index.ts` | Accept `dmPersona` in the request body; inject persona block into system prompt |
| `src/hooks/use-ai-dm.ts` | Pass persona data through to the edge function |

**System Prompt Integration:**

A new section is injected into the DM's system prompt:

```text
## YOUR ADOPTED PERSONALITY
You are "The Fireweaver" -- an emotionally expressive and dramatically vivid storyteller.
Based on the player's analytical, introverted nature (INTJ, Enneagram 5), you
complement them by:
- Leading with rich emotional NPC interactions to draw them out
- Presenting puzzles and mysteries that reward their investigative nature
- Using vivid sensory descriptions to balance their cerebral approach
- Challenging them with moral dilemmas, not just tactical ones

Tone: Warm but not saccharine. Dramatic but grounded. You respect their
intelligence while gently pushing them toward emotional engagement.
```

---

### UI/UX Flow

The test wizard is a full-screen overlay (matching the DM screen's dark fantasy aesthetic):

- Amber/gold accents, glass backgrounds, cinzel headings
- One question per screen on mobile, with swipe or button navigation
- Progress bar showing completion percentage
- Section headers ("Part 1: How You Approach the World", "Part 2: Your Core Motivations")
- Each question is D&D-themed for engagement
- Estimated time shown at the start ("This will take about 15-20 minutes")
- Results can't be skipped -- all questions required

---

### Edge Cases

- **Not signed in:** Test is blocked; prompt to sign in first (results need cloud storage)
- **Retake:** Confirmation dialog warns "This will change your DM's personality for all future sessions. Your current DM persona will be replaced."
- **localStorage fallback:** If cloud save fails, results are cached locally and synced on next successful connection
- **Migration:** Existing users who already use the Solo DM will be prompted to take the test on their next visit

