
# Implement Context Counter & Limit for AI Narrative

## User Need
The user needs to track the character count of text sent to Claude in "Novel Builder" mode to stay within the 200,000 character limit. They requested a visible counter for both Paste and Upload modes, and a "Warn + Block" behavior when the limit is exceeded. Additionally, the existing edge function has a hardcoded 60k character truncation that needs to be increased to match this new limit.

## Proposed Changes

### 1. Update `NarrativeForgeScreen.tsx`
- **Add Constant**: Define `MAX_AI_CHARS = 200000`.
- **Calculate Total Characters**:
  - Create a `currentTotalChars` memoized value.
  - If `inputSource` is `'paste'`, use `inputText.length`.
  - If `inputSource` is `'upload'`, sum the `charCount` of all selected sessions from `campaignProcessor`.
- **UI Updates**:
  - Insert a character count display above the "Forge Narrative" button.
  - Show the count in `text-muted-foreground` normally, and `text-destructive` (red) if over the limit.
  - **Block Action**: Disable the "Forge Narrative" button if `processingMode === 'ai'` AND `currentTotalChars > MAX_AI_CHARS`.
  - Add an explanatory warning message below the button when the limit is exceeded.

### 2. Update `scribe-ai` Edge Function
- **Increase Truncation Limit**: The current implementation slices input text at 60,000 characters. I will increase this to 200,000 characters to match the new UI limit and allow full context processing.

## Implementation Details

### `NarrativeForgeScreen.tsx`
```tsx
const MAX_AI_CHARS = 200000;

// ... inside component ...
const currentTotalChars = useMemo(() => {
  if (inputSource === 'paste') return inputText.length;
  if (!campaignProcessor.selectedSessionIds.size) return 0;
  return campaignProcessor.sessions
    .filter(s => campaignProcessor.selectedSessionIds.has(s.id))
    .reduce((sum, s) => sum + s.charCount, 0);
}, [inputSource, inputText, campaignProcessor.sessions, campaignProcessor.selectedSessionIds]);

const isOverLimit = processingMode === 'ai' && currentTotalChars > MAX_AI_CHARS;

// ... inside render ...
<div className="flex flex-col items-center gap-3">
  {processingMode === 'ai' && currentTotalChars > 0 && (
    <div className={cn("text-xs font-medium", isOverLimit ? "text-destructive" : "text-muted-foreground")}>
      {currentTotalChars.toLocaleString()} / {MAX_AI_CHARS.toLocaleString()} chars
      {isOverLimit && " (Limit Exceeded)"}
    
<lov-tool-use id="thinking-7fce844d-b730-41a0-9188-d12cdb95d682" name="lov-think" data="**Calculating and Displaying Length**

I&apos;m now integrating the character count display within `NarrativeForgeScreen.tsx`.  After calculating `currentTotalChars`, I&apos;m placing it above the &quot;Forge Narrative&quot; button. The button&apos;s `disabled` prop will check  `currentTotalChars` against `MAX_AI_CHARS` if `processingMode` is &apos;ai&apos;. I&apos;ve updated the edge function to match, increasing the slice limit to ensure the entire input is sent.


" duration="0.053395">
</lov-tool-use>
</div>
  )}
  <Button disabled={... || isOverLimit}>...</Button>
</div>
```

### `supabase/functions/scribe-ai/index.ts`
```typescript
// Update slice limit from 60000 to 200000
const userMessage = isEnhance
  ? `...${text.slice(0, 200000)}`
  : `...${text.slice(0, 200000)}`;
```

