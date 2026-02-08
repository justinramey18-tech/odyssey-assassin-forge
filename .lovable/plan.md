

# Plan: AI Editing, File Upload & Custom AI Commands for Saved Stories

## Overview
This plan adds three features to the Scribe system, all focused on **saved stories**:
1. **AI Editing for Saved Stories** - Select text within saved stories and regenerate with AI
2. **File Upload to Saved Stories** - Upload text files to append/replace content in saved stories
3. **Custom AI Commands for Saved Stories** - Apply global AI transformations (e.g., "Change 'lzj' to 'xeyle'") to saved stories or freshly imported files

All three features are accessed from the **Story Viewer Sheet** - the panel that opens when you click on a saved story.

---

## Feature 1: AI Editing for Saved Stories (Selection-Based)

### What It Does
Enables users to select specific text within a saved story and regenerate just that portion using AI, with optional custom instructions.

### How It Works
- Add a mode toggle in Story Viewer: "View" / "Text Edit" / "AI Edit"
- In AI Edit mode, the story text becomes selectable
- Selecting text opens a dialog to provide optional instructions
- AI regenerates only the selected portion while maintaining context

### UI Location
Story Viewer Sheet header - mode selector dropdown

---

## Feature 2: File Upload to Saved Stories

### What It Does
Allows users to upload .txt, .md, .docx, or .rtf files directly into an existing saved story.

### How It Works
- "Import File" button in Story Viewer
- Upload a file and preview its content
- Choose to **Append** (adds separator + content) or **Replace** (overwrites story)
- Content is normalized for encoding issues

### UI Location
Story Viewer Sheet header - "Import File" button

---

## Feature 3: Custom AI Commands for Saved Stories

### What It Does
Allows users to apply AI transformations to an **entire saved story** using natural language instructions - without having to select text manually.

### Use Cases
- "Change every instance of 'lzj' to 'xeyle'"
- "Convert all dialogue to first person"
- "Add more sensory details throughout"
- "Make the tone more formal"
- "Remove all references to [character name]"

### How It Works
- "AI Command" button in Story Viewer (available in View or AI Edit mode)
- Opens dialog with textarea for custom instruction
- Sends full story text to edge function with new `mode: 'command'`
- AI processes entire story according to instruction
- Story content is replaced with transformed result

### UI Location
Story Viewer Sheet header - "AI Command" button (wand icon)

### Works With Imported Files
When a user imports a file (Feature 2), the content becomes part of the saved story. They can then immediately apply an AI Command to transform the imported content.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/scribe/StoryFileUpload.tsx` | File upload component for importing to stories |
| `src/components/scribe/AICommandDialog.tsx` | Dialog for custom AI commands on full story |
| `src/components/scribe/StoryEditModeSelector.tsx` | Dropdown for switching View/Text/AI modes |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/scribe/NarrativeForgeScreen.tsx` | Add edit modes, file upload, AI command in Story Viewer |
| `supabase/functions/narrative-forge/index.ts` | Add 'command' mode for full-text transformations |

---

## Implementation Steps

### Step 1: Update Edge Function for Command Mode
Add new `'command'` mode to process full-text transformations:

```typescript
// New mode type
mode?: 'full' | 'partial' | 'command';

// New context for command mode
commandContext?: {
  fullText: string;      // Entire story (up to 50,000 chars)
  instruction: string;   // User's command (max 1000 chars)
};
```

Command mode prompt will instruct the AI to apply the user's instruction to the entire text while maintaining style consistency.

### Step 2: Create AICommandDialog Component
- Textarea for entering custom instruction
- Examples dropdown for common commands
- Loading state during processing
- Error handling with toast feedback

### Step 3: Create StoryFileUpload Component
- Single file drop zone (.txt, .md, .docx, .rtf)
- Content preview with word count
- Append/Replace option buttons
- Uses existing normalization and parsing utilities

### Step 4: Create StoryEditModeSelector Component
- Dropdown with View, Text Edit, AI Edit options
- Icons for each mode
- Maintains selected state

### Step 5: Update Story Viewer in NarrativeForgeScreen
- Replace edit button with mode selector
- Add "Import File" button
- Add "AI Command" button
- Conditional rendering based on mode:
  - View: ScrollArea with read-only prose
  - Text Edit: Textarea for direct editing
  - AI Edit: SelectableOutput for selection-based regeneration
- Handle all save/cancel flows

---

## User Flows

### Flow 1: AI Edit a Section
1. Open saved story
2. Select "AI Edit" from dropdown
3. Highlight text you want to change
4. Dialog opens - add optional instruction
5. AI regenerates just that section
6. Save changes

### Flow 2: Import and Transform a File
1. Open a saved story (or create new one)
2. Click "Import File"
3. Upload a .txt/.docx file
4. Choose "Append" or "Replace"
5. Content is added to story
6. Click "AI Command"
7. Enter: "Change 'lzj' to 'xeyle' throughout"
8. AI transforms entire story
9. Save changes

### Flow 3: Apply Global Command
1. Open any saved story
2. Click "AI Command"
3. Enter instruction: "Make the tone more dramatic"
4. Click "Apply"
5. Story is transformed
6. Save changes

---

## Technical Details

### Edge Function Command Mode Prompt
```text
SYSTEM:
You are an expert prose editor. Apply the user's instruction to the provided text.
Follow the instruction precisely. Return the complete modified text.
Maintain the overall structure and narrative voice unless instructed otherwise.

USER:
INSTRUCTION: ${instruction}

STYLE GUIDE: ${styleGuide}

TEXT TO EDIT:
---
${fullText}
---

Apply the instruction and return the complete edited text.
```

### Validation
- Instruction required (min 3 chars, max 1000 chars)
- Full text required (min 10 chars, max 50,000 chars)
- Button disabled during processing
- Original content preserved if error occurs

---

## Edge Cases Handled

- Empty instruction: Validation prevents submission
- Very long stories: Warning shown, processing continues
- Import empty file: Error toast, no changes made
- File encoding issues: UTF-8 normalization applied
- Failed transformation: Error toast, original content preserved
- Concurrent operations: Buttons disabled during processing

