

# Fix: Video Background Not Looping on Mobile

## Root Cause

Mobile browsers (iOS Safari, Android Chrome) have strict autoplay policies and buffering behavior that differ from desktop:

1. **`onCanPlayThrough` rarely fires on mobile** — mobile browsers don't preload video data, so this event never triggers. The video stays at `opacity-0` forever (fade-in never happens), making it appear as a still frame or invisible.

2. **`contain: layout style paint`** can interfere with video rendering on some mobile WebViews — the browser may optimize away the video paint since it thinks nothing has changed.

3. **No explicit `play()` call on mount** — while `autoPlay` works on desktop, mobile browsers sometimes need a programmatic `.play()` call to reliably start playback (especially after the element mounts into the DOM).

## Changes

### `src/components/ui/BackgroundWrapper.tsx`

**A. Switch from `onCanPlayThrough` to multiple readiness events**

Replace the single `onCanPlayThrough` handler with both `onCanPlay` and `onLoadedData` — these fire much earlier and more reliably on mobile:

```tsx
onCanPlay={() => {
  setVideoReady(true);
  onLoad?.();
}}
onLoadedData={() => {
  // Fallback for mobile browsers that skip canplay
  setVideoReady(true);
}}
```

**B. Add explicit `play()` call when video element mounts**

Add an effect that calls `videoRef.current.play()` once the video element is available, as a safety net for mobile autoplay:

```tsx
useEffect(() => {
  if (!videoRef.current || !videoSrc || prefersReducedMotion) return;
  const playPromise = videoRef.current.play();
  if (playPromise) {
    playPromise.catch(() => { /* autoplay blocked */ });
  }
}, [videoSrc, prefersReducedMotion]);
```

**C. Remove `contain` from video element styles**

The `contain: layout style paint` hint can cause mobile renderers to skip repainting the video frames. Remove it from the video element specifically (keep it for the image layer where it's beneficial):

```tsx
style={{ willChange: 'transform' }}
```

**D. Add `webkit-playsinline` attribute**

Older iOS versions need this attribute for inline playback:

```tsx
<video
  ...
  playsInline
  {...{ 'webkit-playsinline': '' }}
/>
```

**E. Add `preload="auto"` to encourage mobile buffering**

```tsx
<video preload="auto" ... />
```

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/ui/BackgroundWrapper.tsx` | Replace `onCanPlayThrough` with `onCanPlay` + `onLoadedData`; add explicit `play()` effect on mount; remove `contain` from video styles; add `webkit-playsinline` and `preload="auto"` |

No other files need changes — the issue is entirely in how the `<video>` element is configured for mobile browsers.

## Testing

1. Open on mobile (or mobile emulator) in Magic Build mode — video should loop, not freeze on first frame
2. Verify fade-in transition still works (video appears smoothly, not a pop-in)
3. Verify desktop behavior is unchanged
4. Test with "reduce motion" enabled — video should pause

