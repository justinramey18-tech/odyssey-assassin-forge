
# File Upload & Campaign Parsing for Scribe

## Overview

Add the ability to upload entire campaign files (`.txt`, `.md`, `.json`) to the Narrative Forge screen. The system will parse the file, optionally detect session boundaries, and process the entire campaign into a unified story.

---

## Current State

The Narrative Forge currently:
- Accepts pasted text via a `<Textarea>`
- Processes text using either Offline Logic (regex-based) or AI Scribe (edge function)
- Has a maximum input limit of **15,000 characters** in the edge function
- Saves output to a single `SavedStory` in localStorage
- Already has file handling patterns in the codebase (see `AchievementsScreen.tsx`, `use-equipment-images.ts`)

---

## Technical Architecture

### Core Challenge: Large Files

Campaign files can be **very large** (100,000+ characters). Two processing strategies:

1. **Chunked Processing**: Split the file into ~10,000 character chunks, process each through AI, combine results
2. **Session-Based Processing**: Detect session boundaries, process each session separately, allow user to build story incrementally

**Recommendation**: Implement **both** - auto-detect sessions if markers exist, otherwise chunk by size.

---

## Files to Create/Modify

### 1. File Upload Component
**File:** `src/components/scribe/CampaignFileUpload.tsx` (NEW)

A dropzone/button component for file upload:
- Accepts `.txt`, `.md`, `.json` files
- Shows file name and size after selection
- Extracts text content using `FileReader`
- Displays preview of detected sessions (if any)
- Has "Clear" button to reset

```typescript
interface CampaignFileUploadProps {
  onFileLoaded: (content: string, fileName: string, sessions: DetectedSession[]) => void;
  onClear: () => void;
  currentFile: string | null;
}
```

### 2. Session Detection Logic
**File:** `src/lib/scribe/sessionDetection.ts` (NEW)

Functions to detect session boundaries in campaign text:

```typescript
interface DetectedSession {
  id: string;
  title: string;           // "Session 1" or detected name
  startIndex: number;
  endIndex: number;
  preview: string;         // First 100 chars
  wordCount: number;
}

// Detection patterns:
const SESSION_MARKERS = [
  /^---+\s*Session\s+(\d+)/gim,                    // "--- Session 1 ---"
  /^##?\s*Session\s+(\d+)[:\s-]*(.+)?$/gim,        // "# Session 1: The Beginning"
  /^Session\s+(\d+)[:\s-]*(.+)?$/gim,              // "Session 1 - The Dark Forest"
  /^\[Session\s+(\d+)\]/gim,                        // "[Session 1]"
  /^={3,}$/gm,                                      // "===" separators
  /^-{3,}$/gm,                                      // "---" separators
  /^DAY\s+(\d+)/gim,                                // "DAY 1" markers
  /^CHAPTER\s+(\d+)/gim,                            // "CHAPTER 1"
];

function detectSessions(text: string): DetectedSession[];
function splitByChunkSize(text: string, chunkSize: number): DetectedSession[];
```

### 3. Chunked Processing Hook
**File:** `src/hooks/use-campaign-processor.ts` (NEW)

Manages the multi-chunk processing workflow:

```typescript
interface UseCampaignProcessorReturn {
  // State
  sessions: DetectedSession[];
  processedSessions: ProcessedSession[];
  currentlyProcessing: string | null;
  progress: number;                    // 0-100
  isProcessing: boolean;
  error: string | null;
  
  // Actions
  loadFile: (content: string, fileName: string) => void;
  processAllSessions: (mode: 'ai' | 'offline', options: ProcessingOptions) => Promise<void>;
  processSession: (sessionId: string, mode: 'ai' | 'offline', options: ProcessingOptions) => Promise<void>;
  combineProcessedSessions: () => string;
  reset: () => void;
}
```

**Processing Logic:**
1. If sessions detected → process each session sequentially with delays between AI calls
2. If no sessions → split into ~10,000 char chunks at paragraph boundaries
3. Store each processed chunk in state
4. Show progress bar during multi-chunk processing
5. Combine all processed chunks into final narrative

### 4. Modify NarrativeForgeScreen
**File:** `src/components/scribe/NarrativeForgeScreen.tsx`

**Changes:**
- Add import toggle: "Paste Text" vs "Upload File"
- When "Upload File" selected, show `CampaignFileUpload` instead of textarea
- Show detected sessions list with option to process all or select specific ones
- Add progress bar for multi-session processing
- Handle large file processing with chunking
- Integrate with existing story save system

**New UI Flow:**

```text
┌─────────────────────────────────────────────────────────────┐
│  INPUT SOURCE:  [Paste Text ○]  [Upload File ●]             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │  📁  campaign_log.txt                               │    │
│  │      Size: 145 KB • 32,450 words                    │    │
│  │      Detected: 8 sessions                           │    │
│  │      [Clear]                                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  DETECTED SESSIONS:                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ☑ Session 1: The Beginning (2,340 words)            │    │
│  │ ☑ Session 2: Into the Dungeon (3,120 words)         │    │
│  │ ☑ Session 3: The Dragon's Lair (4,500 words)        │    │
│  │ ... (8 total)                                       │    │
│  │                                                     │    │
│  │ [Select All]  [Deselect All]                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│         [🔧 Process Selected Sessions]                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Processing: Session 3 of 8...                      │    │
│  │  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  37%   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5. Update Edge Function (Optional Enhancement)
**File:** `supabase/functions/narrative-forge/index.ts`

**Changes:**
- Increase `MAX_TEXT_LENGTH` to 20,000 (optional)
- Add `chunkIndex` and `totalChunks` to request for context continuity
- If processing a chunk, include summary of previous chunk in prompt

```typescript
// Enhanced request body
interface RequestBody {
  text: string;
  characterName?: string;
  style?: string;
  // NEW: Multi-chunk context
  isChunkedProcessing?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
  previousChunkSummary?: string;  // Last 200 chars of previous output
}
```

---

## Implementation Phases

### Phase 1: Core File Upload
1. Create `sessionDetection.ts` with session detection patterns
2. Create `CampaignFileUpload.tsx` component
3. Add file upload toggle to `NarrativeForgeScreen.tsx`
4. Test with single-chunk files (under 15K chars)

### Phase 2: Multi-Session Processing
1. Create `use-campaign-processor.ts` hook
2. Add session selection UI to NarrativeForgeScreen
3. Implement sequential processing with progress tracking
4. Add session-by-session output preview

### Phase 3: Polish
1. Add drag-and-drop support to file upload
2. Add rate limiting protection (delay between AI calls)
3. Handle edge function errors with retry logic
4. Store file processing state in localStorage for resume capability

---

## Session Detection Patterns

The system will look for these markers to split campaigns into sessions:

| Pattern | Example |
|---------|---------|
| Session headers | `# Session 3: The Dark Forest` |
| Horizontal rules | `---` or `===` |
| Bracketed markers | `[Session 5]` |
| Day markers | `DAY 7:` |
| Chapter markers | `CHAPTER 2` |
| Time jumps | `--- Three days later ---` |
| Long rest indicators | `The party takes a long rest` |

If no markers detected, the system falls back to **chunk-by-paragraph** splitting at ~10,000 character boundaries.

---

## File Type Handling

| File Type | Handling |
|-----------|----------|
| `.txt` | Read as plain text |
| `.md` | Read as text (markdown preserved) |
| `.json` | Parse JSON, extract `content` or `sessions` array if structured |
| `.log` | Read as plain text |

**Size Limits:**
- Maximum file size: 1 MB (approximately 200,000 words)
- Warning shown for files over 500 KB
- Processing may take several minutes for large files

---

## Error Handling

1. **File too large**: Show warning, offer to process first N sessions only
2. **AI rate limiting**: Add 2-second delay between AI calls, exponential backoff on 429 errors
3. **Processing interrupted**: Save processed chunks to localStorage, offer resume
4. **Invalid file format**: Show clear error message with supported formats
5. **No sessions detected**: Fall back to chunk-based processing with user confirmation

---

## Testing Criteria

1. Upload `.txt` file under 15K chars → processes normally
2. Upload large file (50K+ chars) with session markers → detects sessions correctly
3. Upload large file without markers → falls back to chunk splitting
4. Process 5 sessions with AI mode → progress bar updates, all complete
5. Cancel mid-processing → state resets cleanly
6. Combine processed sessions → single coherent story output
7. Save combined output to story → persists correctly
8. Resume interrupted processing → picks up where left off
9. Test with malformed files → graceful error messages

---

## Backward Compatibility

- Paste text mode remains the default
- File upload is an optional toggle
- Existing story save format unchanged
- All current processing options work with file upload

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/scribe/sessionDetection.ts` | CREATE | Session boundary detection logic |
| `src/components/scribe/CampaignFileUpload.tsx` | CREATE | File upload dropzone component |
| `src/hooks/use-campaign-processor.ts` | CREATE | Multi-chunk processing state management |
| `src/components/scribe/NarrativeForgeScreen.tsx` | MODIFY | Add file upload mode and session UI |
| `src/lib/scribe/index.ts` | CREATE | Barrel export for scribe utilities |
| `supabase/functions/narrative-forge/index.ts` | MODIFY (optional) | Add chunk context support |
