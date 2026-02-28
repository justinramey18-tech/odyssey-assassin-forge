

## Revised Plan: Alignment Spectrum System with Drift Tracking

Based on your answers, here's the refined approach.

### Core Model: Two-Axis Spectrum

Instead of 9 discrete alignment buckets, each prompt gets two numeric scores:

```text
        Good (+5)
          |
          |
Evil -----+------ Lawful
 (-5)     |       (+5)
          |
       Chaotic
        (-5)

Each prompt scored on:
  • Law ↔ Chaos axis: -5 to +5
  • Good ↔ Evil axis: -5 to +5

Examples:
  "Creative Kill Descriptions" → Law: -3, Good: -4  (Chaotic Evil area)
  "Loyalty oath to the party"  → Law: +4, Good: +3  (Lawful Good area)
  "Perception Check"           → Law: 0,  Good: 0   (True Neutral)
```

### Soft Recommend (Not Hard Filter)

- All prompts always visible
- Prompts close to the selected alignment area get a glowing highlight badge and sort to the top
- Distance calculated as simple Euclidean distance from user's selected point on the grid
- Farther prompts appear dimmed but never hidden

### Character Sync: Banner Suggestion

- When opening any prompt library, if the active character has an alignment set, show a dismissible banner: *"Your character is Chaotic Good — tap to highlight matching prompts"*
- Tapping applies the soft filter; dismissing leaves it unfiltered
- No auto-apply

### Alignment Drift Tracker

- Store prompt usage history in localStorage scoped by characterId: `odyssey_${characterId}_alignment_drift`
- Each time a prompt is copied/used, log its `{law, good}` scores
- Calculate a running weighted average (recent prompts weighted more heavily)
- Display a small drift indicator on the character sheet showing current alignment tendency vs. the character's declared alignment
- Optional: toast notification when drift crosses an alignment boundary ("Your actions are shifting toward Chaotic Neutral...")

### Implementation Steps

#### 1. Define alignment types and scoring config
- New file `src/lib/alignmentSpectrum.ts`
- Export `AlignmentScore` type `{ law: number; good: number }`
- Export alignment zone labels, colors, and boundary definitions
- Export distance/matching utility functions

#### 2. Tag all prompts with spectrum scores
- Add optional `alignment?: { law: number; good: number }` to `CharacterPrompt` interface
- Add same to `AIPromptTemplate` interface in `diceRollerConfig.ts`
- Tag ~230 character prompts, ~50 Empyrean prompts, ~12 AI DM prompts

#### 3. Build AlignmentRecommender component
- Shared component: 2D interactive grid (tap to set your alignment point)
- Shows current character alignment as a marker
- Highlights the selected zone
- Returns selected `{ law, good }` coordinates for filtering

#### 4. Build soft-recommend sorting utility
- Sort function that takes prompts + target alignment, returns prompts ordered by proximity
- Nearby prompts get a colored badge; distant prompts get dimmed styling

#### 5. Integrate into NovelPromptDrawer
- Add alignment recommender alongside existing filters
- Banner when character alignment is set
- Sort prompts by proximity, badge matching ones

#### 6. Integrate into EmpyreanPromptLibrary
- Same banner + recommender within the stone accordion view
- Prompts within each stone sorted by alignment proximity when active

#### 7. Integrate into DiceRollerScreen AI DM prompts
- Lightweight version of the recommender for the smaller prompt list

#### 8. Build alignment drift tracker
- localStorage-based tracking per character
- Hook: `useAlignmentDrift(characterId)` — returns current drift position
- Log each prompt usage with its alignment scores
- Weighted rolling average over last 50 uses

#### 9. Add drift display to character sheet
- Small 2D indicator showing declared alignment vs. drift position
- Toast when crossing a boundary

### Technical Notes

- Spectrum scores are static data baked into the prompt arrays — no database changes needed
- Drift tracker is localStorage only, scoped by `odyssey_${characterId}_alignment_drift`
- The 2D grid component uses a simple `<canvas>` or positioned `<div>` elements — no external library needed
- ~292 prompts need manual alignment scoring — this is the bulk of the work

