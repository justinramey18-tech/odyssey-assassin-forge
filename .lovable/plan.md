

# Implementation Plan: Magic Build Video Background

## What This Does

When a user selects "Magic Build" mode, a looping video automatically plays as the Home Screen background — behind all overlays and content. If a custom background is set, it takes priority. All users see this video; it's a built-in atmospheric layer.

## Steps

### 1. Upload the video to cloud storage

Upload `VID_20260225_135652_561.mp4` to the existing public `videos` bucket. Store the resulting public URL as a constant in the codebase.

### 2. Update `BackgroundWrapper.tsx` — add native `videoSrc` support

Add the following props and logic:

- **New prop**: `videoSrc?: string` — when provided, renders a `<video>` element instead of the CSS `background-image` div
- **Video element**: `autoPlay`, `muted`, `loop`, `playsInline`, `object-fit: cover`, same position as the image layer (`absolute inset-0 z-0`)
- **Fade-in**: Track `videoReady` state via the `onCanPlayThrough` event, apply `opacity-0 → opacity-100` transition (same pattern as the existing `imageLoaded` state)
- **Reduced motion**: Use the existing `prefersReducedMotion` detection. When true, pause the video via a `useRef<HTMLVideoElement>` and effect
- **Memory cleanup**: On unmount, pause the video, clear `.src`, and call `.load()` to release the buffer
- **Fallback**: While video loads, the existing `fallbackGradient` shows (already handled by the opacity transition)

The image layer is skipped when `videoSrc` is provided — no competing layers.

### 3. Update `HomeScreen.tsx` — wire video for Magic Build mode

Around line 449 (where `defaultBg` is computed), add:

```ts
const MAGIC_BUILD_VIDEO_URL = 'https://rkkgmonjfvncpvlzsojw.supabase.co/storage/v1/object/public/videos/magic-build-bg.mp4';
const isMagicBuildVideo = appMode === 'magicBuild' && !customBackground;
```

Then at line 464-475, conditionally pass `videoSrc` to `BackgroundWrapper`:

```tsx
<BackgroundWrapper
  imagePath={defaultBg}
  videoSrc={isMagicBuildVideo ? MAGIC_BUILD_VIDEO_URL : undefined}
  overlayOpacity={customBackground ? 55 : 55}
  tintColor="cyan"
  tintOpacity={10}
  fixed={true}
  backgroundSize="cover"
  backgroundPosition="center center"
  className="fixed inset-0 z-0"
>
  <div />
</BackgroundWrapper>
```

When `videoSrc` is present, `BackgroundWrapper` renders the video; when absent, the normal image path applies. Custom background always wins because `isMagicBuildVideo` is false when `customBackground` is set.

## Files Changed

| File | Change |
|------|--------|
| Cloud storage (`videos` bucket) | Upload the MP4 file |
| `src/components/ui/BackgroundWrapper.tsx` | Add `videoSrc` prop, `<video>` rendering, fade-in, reduced-motion pause, cleanup |
| `src/components/home/HomeScreen.tsx` | Add video URL constant, conditional `videoSrc` prop for `magicBuild` mode |

## Testing

1. Switch to Magic Build mode — video loops silently in the background behind overlays
2. Switch to any other mode — video gone, normal image background shows
3. Upload a custom background while in Magic Build — custom image takes priority
4. Clear custom background — video returns
5. Reload the page in Magic Build mode — video loads and plays
6. Enable "reduce motion" in OS accessibility settings — video should pause

