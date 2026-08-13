# Download a finished narration to your phone

Right now each DM message with audio has a "Save offline" chip that tucks the clips away inside the app. That gets replaced with a real **Download** button that hands you one audio file you can keep, share, or play in any music app.

## How it behaves

- The chip only appears once the narration is actually finished and "Play all" is available — so what you download always matches what you hear.
- Tapping **Download** joins every clip for that message, in exact story order (the DM aside first, then each voiced passage), into a single MP3 and saves it to your phone.
- While it works the button shows "Preparing…" with a small count (e.g. 3 of 9), then confirms with a toast.
- The file is named after the campaign and message so your downloads folder stays readable, e.g. `Odyssey-DM-2026-08-13-1.mp3`.
- On the installed/native app it opens the normal phone save/share sheet; in the browser it downloads straight away.
- If a clip can't be fetched, the download stops and tells you which part is missing instead of saving a broken file.

## What stays the same

- The bulk "Save all for offline play" control in Party Settings is unchanged — that's still how you make a whole campaign playable with no signal.
- Downloaded files are also kept in the offline store as a side effect, so downloading a message makes it play offline too.

## Technical detail

- `src/components/ai-dm/MessageNarrationBar.tsx`: replace the `offlineReady` / `onDownloadOffline` chip with a `onDownloadFile` chip, gated on the same `playAllReady` condition already computed there. Keep `Download` icon; drop the `Check`/"Offline" state.
- New helper `src/lib/narrationDownload.ts`:
  - `buildMessageAudioBlob(rows, order)` — fetches each clip URL (reusing the offline cache when a clip is already stored), concatenates the MP3 byte arrays into one `Blob({ type: 'audio/mpeg' })`, and reports `{done,total}` progress.
  - `saveAudioFile(blob, filename)` — anchor + object URL on web; when `Capacitor.isNativePlatform()`, write via Filesystem to `Directory.Cache` and open the Share sheet.
- `src/hooks/use-message-narration.ts`: add `downloadMessage(messageId)` that resolves the same ordered part list `playAll` uses (`table`, then `seg-*` by index, falling back to legacy `story`), calls the helper, stores fetched bytes in the existing IndexedDB cache, and exposes `downloadingMessageId` + progress.
- `src/components/ai-dm/PartyDMScreen.tsx` (and the solo path where the bar is rendered): swap the prop wiring from `onDownloadOffline`/`offlineMessageIds` to the new callback.
- MP3 frame concatenation is the same approach already used when stitching long narrations, so no new dependency is needed.
