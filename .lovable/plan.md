

# Video Support: Tutorials, Backgrounds, and Campaign Chat Videos

## Overview
Three pillars of video support: (1) a dedicated Tutorials page with uploadable screen recordings, (2) video backgrounds on all screens, and (3) inline video messages in the AI DM chat for campaign content.

---

## 1. Cloud Storage Setup

Create a `videos` storage bucket (public, 50MB max per file) with RLS policies for authenticated uploads and public reads.

Create a `tutorials` database table for tutorial metadata (title, description, category, video URL, sort order).

---

## 2. Dedicated Tutorials Page

- New route `/tutorials` accessible from the home screen menu
- Components:
  - `src/pages/Tutorials.tsx` -- page layout with category-grouped grid
  - `src/components/tutorials/TutorialCard.tsx` -- thumbnail card with play button overlay
  - `src/components/tutorials/VideoPlayer.tsx` -- reusable modal video player (HTML5 `<video>` with native controls)
  - `src/components/tutorials/TutorialUploadDialog.tsx` -- upload form for signed-in users (title, description, category, file picker)
- Uploads go to `videos/tutorials/{userId}/{filename}` in storage
- All users can browse and watch; authenticated users can upload

---

## 3. Video Backgrounds (Everywhere)

- Update `BackgroundWrapper` (or equivalent background rendering) to accept an optional video URL
  - Render a `<video autoPlay muted loop playsInline>` behind content when a video background is set
  - Respect `prefers-reduced-motion` -- fall back to a static poster image
- Update `BackgroundUploadButton` to accept `video/mp4,video/webm` in addition to images
- Update `useCustomBackground` hook to detect video files, upload to storage, and store the URL separately from images
- Update `useWildShapeBackgrounds` similarly for per-form video backgrounds
- Upload path: `gear-images/backgrounds/{userId}/bg-video.{ext}`

---

## 4. Inline Video Messages in AI DM Chat

This is how campaign videos reach players. The GM (or any user in solo mode) can attach a video file to a chat message, and it renders inline as a playable video bubble.

### How it works

- **Input bar upgrade**: Add a "clip" / attachment button next to the send button in both `AIDMScreen.tsx` (solo) and `PartyDMScreen.tsx` (multiplayer)
- **Upload flow**: Tapping the attachment button opens a file picker for `video/mp4,video/webm` (max 50MB). The file uploads to `videos/chat/{campaignId}/{filename}` in the storage bucket.
- **Message format**: After upload, the video URL is sent as a special message. The message content will use a simple marker format like `[video:{url}]` so it can be distinguished from plain text.
- **Rendering**: Update `DMMessageBubble` in `AIDMScreen.tsx` and `PartyDMMessage` in `PartyDMScreen.tsx` to detect video markers and render an inline `<video>` element with controls, rounded corners, and a max-width constraint -- styled to match the existing chat bubble aesthetic.
- **Party DM**: In multiplayer, the video URL is stored in the `party_dm_messages` table's `content` column using the same marker format. All party members see the video inline via Realtime sync.
- **Persistence**: Video URLs in solo campaigns are saved as part of the message history in `ai_dm_campaigns`. When loading a campaign, video messages render correctly since the URL points to persistent storage.

### Visual behavior
- Video bubbles show a rounded video player with play/pause controls inside the chat bubble
- A small "Video" label or film icon appears above the player
- Videos do not autoplay in chat -- user taps play to watch
- On mobile, videos expand to near-full-width of the bubble

---

## 5. Implementation Sequence

```text
Step 1: Create videos storage bucket + tutorials table (DB migration)
Step 2: Build reusable VideoPlayer component
Step 3: Build Tutorials page + upload dialog + route
Step 4: Add video attachment button to AI DM chat input
Step 5: Update DMMessageBubble + PartyDMMessage to render inline videos
Step 6: Upgrade BackgroundWrapper for video backgrounds
Step 7: Upgrade background upload button + hooks for video support
Step 8: Add Tutorials link to home screen navigation
```

---

## Technical Details

### Storage bucket (SQL migration)

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('videos', 'videos', true, 52428800);

CREATE POLICY "Anyone can view videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');

CREATE POLICY "Authenticated users can upload videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Tutorials table (SQL migration)

```sql
CREATE TABLE public.tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tutorials"
  ON public.tutorials FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert tutorials"
  ON public.tutorials FOR INSERT
  WITH CHECK (auth.uid() = created_by);
```

### Video message detection (in message bubble)

```typescript
const VIDEO_REGEX = /^\[video:(https?:\/\/.+)\]$/;

function DMMessageBubble({ message }: { message: Message }) {
  const videoMatch = message.content.match(VIDEO_REGEX);

  if (videoMatch) {
    return (
      <motion.div /* existing animation props */>
        <div className="rounded-2xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
          <video
            src={videoMatch[1]}
            controls
            playsInline
            className="w-full rounded-xl"
          />
        </div>
      </motion.div>
    );
  }
  // ... existing text rendering
}
```

### Chat input attachment button (concept)

```typescript
const handleVideoAttach = async (file: File) => {
  if (file.size > 50 * 1024 * 1024) {
    toast.error('Video must be under 50MB');
    return;
  }
  const path = `chat/${campaignId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('videos').upload(path, file);
  if (error) { toast.error('Upload failed'); return; }
  const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(path);
  // Send as a message with video marker
  sendMessage(`[video:${publicUrl}]`);
};
```

### New files created

```text
src/pages/Tutorials.tsx
src/components/tutorials/TutorialCard.tsx
src/components/tutorials/VideoPlayer.tsx
src/components/tutorials/TutorialUploadDialog.tsx
```

### Files modified

```text
src/components/ai-dm/AIDMScreen.tsx        -- attachment button + video bubble rendering
src/components/ai-dm/PartyDMScreen.tsx      -- same for multiplayer
src/components/home/BackgroundWrapper.tsx   -- video background support (if exists)
src/components/home/BackgroundUploadButton  -- accept video files
src/hooks/use-custom-background.ts         -- video URL storage
src/App.tsx                                -- /tutorials route
```

