

## Fix: Run whisper enrichment after regeneration

**Single line change** in `src/hooks/use-party-dm.ts`, line 1421.

Replace the raw state update with one that calls `enrichMessageWithWhispers` on the updated message, so the `whispers` array and clean `narrative` are populated — exactly as they are during initial message loading.

**Before (line 1421):**
```typescript
setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent } : m));
```

**After:**
```typescript
setMessages(prev => prev.map(m => m.id === messageId ? enrichMessageWithWhispers({ ...m, content: newContent }, characterName) : m));
```

The `characterName` variable is already available in the hook's scope. This ensures the parsed whispers array is set on the message object, which the UI already knows how to render.

