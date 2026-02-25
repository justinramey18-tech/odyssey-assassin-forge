

# Implementation Plan: Magic Build Video Background — COMPLETED

## What This Does

When a user selects "Magic Build" mode, a looping video automatically plays as the Home Screen background — behind all overlays and content. If a custom background is set, it takes priority. All users see this video; it's a built-in atmospheric layer.

## Steps — All Done

### 1. ✅ Upload the video to cloud storage

Uploaded `VID_20260225_135652_561.mp4` to the public `videos` bucket as `magic-build-bg.mp4`.
Public URL: `https://rkkgmonjfvncpvlzsojw.supabase.co/storage/v1/object/public/videos/magic-build-bg.mp4`

### 2. ✅ Updated `BackgroundWrapper.tsx` — native `videoSrc` support

- New prop `videoSrc?: string` renders a `<video>` element instead of the CSS `background-image` div
- Video: `autoPlay`, `muted`, `loop`, `playsInline`, `object-fit: cover`, absolute inset-0 z-0
- Fade-in via `onCanPlayThrough` → `videoReady` state
- Reduced motion: `useRef<HTMLVideoElement>` + effect pauses/plays based on `prefersReducedMotion`
- Memory cleanup: on unmount, `pause()` + `removeAttribute('src')` + `load()`
- Image layer skipped when `videoSrc` is provided

### 3. ✅ Updated `HomeScreen.tsx` — wired video for Magic Build mode

- `MAGIC_BUILD_VIDEO_URL` constant
- `isMagicBuildVideo = appMode === 'magicBuild' && !customBackground`
- `videoSrc` passed conditionally to `BackgroundWrapper`

## Files Changed

| File | Change |
|------|--------|
| Cloud storage (`videos` bucket) | Uploaded `magic-build-bg.mp4` |
| `src/components/ui/BackgroundWrapper.tsx` | Added `videoSrc` prop, `<video>` rendering, fade-in, reduced-motion pause, cleanup |
| `src/components/home/HomeScreen.tsx` | Added video URL constant, conditional `videoSrc` prop for `magicBuild` mode |
