

# Implementation Plan: Enhanced Scribe Features

## Overview

This plan covers 8 new features for the Scribe tab, organized into three implementation phases based on complexity and dependencies.

---

## Phase 1: Core Enhancements (Simpler, Foundation Features)

### Feature 1: Style Blending (70% Fantasy + 30% Noir)

**What it does:** Allow users to combine two narrative styles with adjustable weightings to create hybrid tones.

**User Experience:**
- New "Blend Styles" toggle in Processing Options
- When enabled, shows two style dropdowns with percentage sliders (must total 100%)
- Preview shows blend like "70% Fantasy + 30% Noir"

**Technical Changes:**

| File | Changes |
|------|---------|
| `NarrativeForgeScreen.tsx` | Add `styleBlendEnabled`, `secondaryStyle`, `blendRatio` state |
| `narrative-forge/index.ts` | Accept `blendConfig` parameter, merge two style guides proportionally in prompt |

**Edge Function Prompt Logic:**
```text
// When blending enabled:
const blendedGuide = `
PRIMARY STYLE (${blendRatio}% weight):
${styleGuides[primaryStyle]}

SECONDARY STYLE (${100-blendRatio}% weight):
${styleGuides[secondaryStyle]}

Blend these styles, favoring the primary but incorporating secondary elements.
`;
```

---

### Feature 2: Processing Templates

**What it does:** Save combinations of options + editing rules as named templates that can be quickly applied.

**User Experience:**
- "Save as Template" button in Processing Options header
- "Load Template" dropdown to select saved templates
- Templates include: style, blending config, smart parse setting, and all editing rules

**Technical Changes:**

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/scribe/processingTemplates.ts` | CREATE | Template interface, validation, localStorage persistence |
| `src/hooks/use-processing-templates.ts` | CREATE | Template CRUD operations hook |
| `NarrativeForgeScreen.tsx` | MODIFY | Add template save/load UI in Processing Options card |

**Data Structure:**
```typescript
interface ProcessingTemplate {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string;
  
  // Processing config
  narrativeStyle: string;
  blendConfig?: { secondaryStyle: string; ratio: number };
  smartParseEnabled: boolean;
  processingOptions: ProcessingOptions;
  
  // Editing rules
  editingRules: EditingRule[];
}
```

---

### Feature 3: Batch Style Preview

**What it does:** Preview how different styles would transform the same sample text side-by-side.

**User Experience:**
- "Preview All Styles" button appears when there's input text
- Opens a sheet/modal showing a 500-char sample transformed by 3-4 selected styles
- Users can select which styles to compare

**Technical Changes:**

| File | Action | Purpose |
|------|--------|---------|
| `src/components/scribe/StylePreviewSheet.tsx` | CREATE | Multi-column preview UI with style selector |
| `NarrativeForgeScreen.tsx` | MODIFY | Add button to trigger preview sheet |
| Edge function | No changes | Uses existing endpoint with different styles |

**UI Design:**
```text
+----------------------------------------------------------+
| STYLE COMPARISON PREVIEW                            [X]  |
+----------------------------------------------------------+
| Sample: "The ancient door creaks open..."                |
+----------------------------------------------------------+
| [ ] Fantasy    [ ] Noir    [x] Salvatore    [x] Deadpool |
+----------------------------------------------------------+
|                          |                               |
| SALVATORE                | DEADPOOL                      |
| The blade sang as        | (Oh great, another door.      |
| Drizzt pressed forward...| The writer loves doors...)    |
|                          |                               |
+----------------------------------------------------------+
```

---

## Phase 2: Story Management Enhancements

### Feature 4: Story Organization (Folders/Tags)

**What it does:** Group stories by campaign, character, or custom tags for better organization.

**User Experience:**
- Tags shown as colored chips on story cards
- Filter stories by tag in the story list sheet
- "Add Tag" button on each story with autocomplete from existing tags
- Optional folder grouping view

**Technical Changes:**

| File | Action | Purpose |
|------|--------|---------|
| `use-saved-stories.ts` | MODIFY | Extend `SavedStory` interface with `tags: string[]` and `folderId?: string` |
| `src/lib/scribe/storyOrganization.ts` | CREATE | Tag/folder types, color mapping, filtering utilities |
| `StoryListSheet.tsx` | MODIFY | Add tag filter dropdown, tag display on cards, tag editing |
| `NarrativeForgeScreen.tsx` | MODIFY | Pass tag filter state to sheet |

**Extended Interface:**
```typescript
interface SavedStory {
  // ... existing fields
  tags: string[];           // NEW: ["campaign-1", "character-kira"]
  folderId?: string;        // NEW: optional folder grouping
}

interface StoryFolder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}
```

---

### Feature 5: Story Merging

**What it does:** Combine multiple saved stories into one with ordering control.

**User Experience:**
- "Merge Stories" button in story list sheet
- Opens merge dialog with drag-to-reorder capability
- Preview combined word count and structure
- Creates new merged story (originals optionally preserved)

**Technical Changes:**

| File | Action | Purpose |
|------|--------|---------|
| `src/components/scribe/StoryMergeDialog.tsx` | CREATE | Merge UI with reordering, preview, options |
| `use-saved-stories.ts` | MODIFY | Add `mergeStories(ids: string[], options)` function |
| `StoryListSheet.tsx` | MODIFY | Add merge button, selection mode for merging |

**Merge Options:**
```typescript
interface MergeOptions {
  newTitle: string;
  separator: '---' | '***' | 'chapter' | 'none';
  preserveOriginals: boolean;
  inheritTags: boolean;
}
```

---

### Feature 6: Comparison View (Original vs. Transformed)

**What it does:** Side-by-side view showing original vs. transformed text with diff highlighting.

**User Experience:**
- Toggle button switches output panel to split-view mode
- Left side: original input (or selected session)
- Right side: transformed output
- Visual highlighting of changes (additions in green, removals in red)
- Word count comparison shown

**Technical Changes:**

| File | Action | Purpose |
|------|--------|---------|
| `src/components/scribe/ComparisonView.tsx` | CREATE | Split-panel component with diff rendering |
| `src/lib/scribe/textDiff.ts` | CREATE | Simple word-level diff algorithm |
| `NarrativeForgeScreen.tsx` | MODIFY | Add comparison toggle, store original text, render comparison view |

**Diff Algorithm Approach:**
```typescript
// Simple word-level diff for narrative comparison
interface DiffSegment {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

function computeNarrativeDiff(original: string, transformed: string): DiffSegment[] {
  // Word-level comparison with paragraph awareness
  // Highlight added prose, removed mechanics
}
```

---

## Phase 3: Advanced Features

### Feature 7: Multi-File Upload

**What it does:** Process multiple campaign files and combine them chronologically.

**User Experience:**
- Drag-drop zone accepts multiple files
- File list shows all uploaded files with drag-to-reorder
- Combine button merges all files in order before processing
- Sessions detected across all files with file source indicator

**Technical Changes:**

| File | Action | Purpose |
|------|--------|---------|
| `CampaignFileUpload.tsx` | MODIFY | Accept `multiple` files, manage file list with ordering |
| `use-campaign-processor.ts` | MODIFY | Add `loadFiles()` for multiple files, `combineFiles()` utility |
| `src/lib/scribe/sessionDetection.ts` | MODIFY | Add `detectSessionsMultiFile()` that tracks source file |

**Extended Session Interface:**
```typescript
interface DetectedSession {
  // ... existing fields
  sourceFile?: string;        // NEW: originating filename
  sourceFileIndex?: number;   // NEW: file order position
}
```

**UI Changes:**
```text
+---------------------------------------------+
| UPLOADED FILES (3)                    [+]   |
+---------------------------------------------+
| [≡] campaign-part1.txt    45KB        [X]  |
| [≡] campaign-part2.txt    38KB        [X]  |
| [≡] session-notes.md      12KB        [X]  |
+---------------------------------------------+
| 127 sessions detected across 3 files        |
+---------------------------------------------+
```

---

### Feature 8: Regenerate Partial Sections

**What it does:** Allow users to select and regenerate just a portion of the output.

**User Experience:**
- Text selection in output textarea
- "Regenerate Selection" button appears when text is selected
- Opens dialog to optionally modify style or add specific instructions for that section
- Replaces only the selected portion with new generation

**Technical Changes:**

| File | Action | Purpose |
|------|--------|---------|
| `src/components/scribe/SelectableOutput.tsx` | CREATE | Enhanced output component with selection tracking |
| `NarrativeForgeScreen.tsx` | MODIFY | Replace output textarea with SelectableOutput, add regeneration handler |
| `narrative-forge/index.ts` | MODIFY | Add `mode: 'full' | 'partial'` with context-aware regeneration |

**Edge Function Enhancement:**
```typescript
interface RequestBody {
  // ... existing fields
  mode?: 'full' | 'partial';
  partialContext?: {
    precedingText: string;    // ~500 chars before selection
    selectedText: string;     // text to regenerate
    followingText: string;    // ~500 chars after selection
    instruction?: string;     // optional user guidance
  };
}
```

**Partial Regeneration Prompt:**
```text
CONTEXT (preceding text):
${precedingText}

TEXT TO REGENERATE:
${selectedText}

CONTEXT (following text):
${followingText}

Rewrite the middle section while maintaining continuity with surrounding context.
${instruction ? `Additional instruction: ${instruction}` : ''}
```

---

## File Summary

### New Files (9)
| File | Purpose |
|------|---------|
| `src/lib/scribe/processingTemplates.ts` | Template types and persistence |
| `src/hooks/use-processing-templates.ts` | Template CRUD hook |
| `src/lib/scribe/storyOrganization.ts` | Tags, folders, filtering |
| `src/lib/scribe/textDiff.ts` | Word-level diff algorithm |
| `src/components/scribe/StylePreviewSheet.tsx` | Multi-style comparison |
| `src/components/scribe/StoryMergeDialog.tsx` | Story merge UI |
| `src/components/scribe/ComparisonView.tsx` | Original vs. transformed view |
| `src/components/scribe/SelectableOutput.tsx` | Output with selection tracking |
| `src/components/scribe/MultiFileUpload.tsx` | Multiple file handling (or extend existing) |

### Modified Files (6)
| File | Changes |
|------|---------|
| `NarrativeForgeScreen.tsx` | All UI integrations, new state variables |
| `use-saved-stories.ts` | Tags, folders, merge functionality |
| `use-campaign-processor.ts` | Multi-file support |
| `StoryListSheet.tsx` | Tag filtering, merge selection |
| `CampaignFileUpload.tsx` | Multi-file support |
| `narrative-forge/index.ts` | Style blending, partial regeneration |

---

## Dependencies

- No new npm packages required
- All features use existing UI components (shadcn/ui)
- Diff algorithm is custom (simple word-level, no library needed)

---

## Implementation Order Recommendation

1. ~~**Processing Templates** - Foundation for saving configurations~~ ✅ DONE
2. ~~**Style Blending** - Simple edge function change~~ ✅ DONE
3. **Batch Style Preview** - Uses existing infrastructure
4. **Story Organization (Tags)** - Extends existing story system
5. **Comparison View** - Useful debugging tool
6. **Story Merging** - Builds on tags feature
7. **Multi-File Upload** - Complex but self-contained
8. **Partial Regeneration** - Most complex, requires all foundations

---

## Testing Checklist

For each feature:
- [ ] Core functionality works with sample data
- [ ] Edge cases handled (empty input, max limits)
- [ ] localStorage persistence works across page refreshes
- [ ] Mobile responsive layout
- [ ] Loading/error states display correctly
- [ ] Toast notifications provide feedback
- [ ] Feature integrates smoothly with existing workflow

