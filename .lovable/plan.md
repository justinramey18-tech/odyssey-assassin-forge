

## Plan: Add MP3 download toast after TTS generation

### Single file change: `src/hooks/use-narrator.ts`

After `await audio.play()` succeeds (~line 134), show a sonner toast with a "Download" action button. Clicking it triggers a browser download of the `finalBlob` as an MP3 file with a timestamped filename.

```typescript
// After: await audio.play();
toast('Narration audio ready', {
  description: 'Would you like to download the MP3?',
  action: {
    label: 'Download',
    onClick: () => {
      const a = document.createElement('a');
      const dlUrl = URL.createObjectURL(finalBlob);
      a.href = dlUrl;
      a.download = `narration-${new Date().toISOString().slice(0, 10)}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);
    },
  },
  duration: 10000,
});
```

No new dependencies. Uses existing `sonner` toast import. The blob is already `audio/mpeg` from both providers, so no conversion needed.

