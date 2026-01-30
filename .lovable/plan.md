
# Enhanced Home Screen Background Implementation

## Overview

Transform the Home Screen into an immersive dashboard featuring the Deadpool T-pose leap of faith artwork (`deadpool-assassin-tpose-dive.jpg`) as a full-screen background. This implementation incorporates architectural best practices including a reusable Glass component, design tokens, and staggered entry animations for a premium experience.

---

## What Will Change

The Home Screen will evolve from a solid dark background to feature your epic leap of faith artwork as a fixed, full-screen background. All cards, headers, and panels will become semi-transparent frosted glass elements. The character diving through storm clouds will be visible behind all interface elements while text remains crisp and readable.

---

## Phase 0: Architecture and Tooling

Before implementing the visual changes, establish the foundational components and design tokens for maintainability.

### 0.1 Create Glass Component

Create a new reusable `Glass` component using class-variance-authority (CVA) for consistent glassmorphism styling across the app:

| Variant | Style | Use Case |
|---------|-------|----------|
| `default` | `bg-black/40 backdrop-blur-md` | Static containers, stat cards |
| `interactive` | `bg-black/50 backdrop-blur-lg` + hover effects | Buttons, navigation cards |
| `header` | `bg-black/50 backdrop-blur-xl` | Header and footer bars |

The component will use `@radix-ui/react-slot` (already installed) for polymorphism, allowing it to render as any HTML element.

### 0.2 Add Design Tokens to Tailwind Config

Extend `tailwind.config.ts` with semantic glassmorphism tokens:

| Token | Value | Purpose |
|-------|-------|---------|
| `colors.glass.DEFAULT` | `rgba(0, 0, 0, 0.50)` | Standard glass background |
| `colors.glass.subtle` | `rgba(0, 0, 0, 0.40)` | Lighter glass effect |
| `colors.glass.strong` | `rgba(0, 0, 0, 0.60)` | High contrast glass |
| `borderColor.glass` | `rgba(255, 255, 255, 0.10)` | Glass border color |
| `boxShadow.glass-glow` | `inset 0 1px 0 rgba(255,255,255,0.1)` | Inner highlight |

### 0.3 Install Framer Motion (Optional)

Add `framer-motion` for staggered entry animations. This can be deferred if performance is a concern, as CSS-only alternatives exist.

---

## Phase 1: BackgroundWrapper Enhancement

Extend the existing `BackgroundWrapper` component to support the Home Screen requirements:

| New Prop | Type | Default | Purpose |
|----------|------|---------|---------|
| `backgroundPosition` | `string` | `'center center'` | Control focal point |
| `fallbackGradient` | `string` | Dark gradient | Fallback when image fails |
| `enablePerformanceHints` | `boolean` | `true` | Add `will-change`, `contain` |
| `respectReducedMotion` | `boolean` | `true` | Disable parallax for accessibility |
| `onLoad` | `() => void` | - | Callback when image loads |

**Performance Optimizations:**
- Add `will-change: transform` and `contain: layout style paint` to background layer
- Detect touch devices and disable `bg-fixed` for 60fps scrolling
- Check `prefers-reduced-motion` and skip parallax effects

**Responsive Focal Points:**
```text
Mobile portrait:  center 25%  (focus on upper body/face)
Mobile landscape: center 40%  (balance full figure)
Tablet:           center 35%  (slight upper focus)
Desktop:          center center (full composition)
```

---

## Phase 2: HomeScreen Layout Updates

### 2.1 Wrap with BackgroundWrapper

Replace the solid `bg-background` container with `BackgroundWrapper`:

```text
Configuration:
- imagePath: deadpool-assassin-tpose-dive.jpg
- overlayOpacity: 45 (slightly higher for readability)
- tintColor: 'red' (subtle thematic tint)
- tintOpacity: 10
- fixed: true (parallax on desktop)
```

### 2.2 Refactor UI Elements to Glass

| Element | Current | New Glass Style |
|---------|---------|-----------------|
| Main container | `bg-background` | Transparent (wrapper handles) |
| Header | `bg-card/80 backdrop-blur-md` | Glass `header` variant |
| Stat cards | `Card` component | Glass `default` variant |
| Navigation cards | `Card` component | Glass `interactive` variant |
| Footer | `bg-card/80 backdrop-blur-md` | Glass `header` variant |

---

## Phase 3: Text Contrast and Readability

Ensure WCAG AA compliance (4.5:1 contrast ratio for normal text):

| Enhancement | Implementation |
|-------------|----------------|
| Text shadows | `text-shadow: 0 2px 4px rgba(0,0,0,0.8)` on headers and labels |
| Bright foreground | Replace `text-foreground` with `text-white` where needed |
| Stat values | Add `drop-shadow-lg` to numbers |
| Descriptions | Change `text-muted-foreground` to `text-white/70` |
| XP bar text | Add subtle text shadow for visibility |

---

## Phase 4: Staggered Entry Animations

Add premium entry animations using Framer Motion:

**Container Configuration:**
```text
staggerChildren: 0.05 (50ms between each card)
delayChildren: 0.1 (100ms initial delay)
```

**Item Animation:**
```text
Initial: opacity: 0, y: 20px
Animate: opacity: 1, y: 0
Transition: duration: 0.3s, ease: "easeOut"
```

**CSS-Only Fallback (if Framer Motion not added):**
Use CSS custom properties with `animation-delay` calculated per card index.

---

## Phase 5: Loading Experience

Implement progressive loading with fallback:

| State | Display |
|-------|---------|
| Loading | Solid gradient: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)` |
| Loaded | Fade-in animation (0.3s ease-out) on background image |
| Error | Fallback gradient persists (image is purely decorative) |

---

## Phase 6: Accessibility Compliance

| Requirement | Implementation |
|-------------|----------------|
| Decorative background | Add `aria-hidden="true"` to BackgroundWrapper image layer |
| Reduced motion | Check `prefers-reduced-motion` and disable parallax + entry animations |
| Focus indicators | Ensure focus rings use `ring-white/50` for visibility against glass |
| Keyboard navigation | All cards remain fully keyboard accessible |
| Screen readers | Background is decorative; content announces correctly |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/glass.tsx` | Reusable Glass component with CVA variants |

## Files to Modify

| File | Changes |
|------|---------|
| `tailwind.config.ts` | Add glassmorphism design tokens and animations |
| `src/components/ui/BackgroundWrapper.tsx` | Add new props, performance hints, reduced-motion support, responsive positioning |
| `src/components/home/HomeScreen.tsx` | Import BackgroundWrapper and Glass, refactor all UI elements, add text contrast |
| `package.json` | Add `framer-motion` dependency (optional) |

---

## Visual Result Preview

```text
+------------------------------------------+
|  [glass header: bg-black/50 blur-xl]     |
|  [<] Avatar  Name  Lv.X  [XP===] [Clock] |
+------------------------------------------+
|                                          |
|   +-------+  +-------+  +-------+        |
|   | HP    |  | AC    |  | Init  |  Stats |
|   | glass |  | glass |  | glass |        |
|   +-------+  +-------+  +-------+        |
|                                          |
|          /\                              |
|    =====[  ]T-POSE======                 |
|         [  ] DIVE                        |
|         [  ] (visible behind glass)      |
|          \/                              |
|                                          |
|   +---------+  +---------+               |
|   | Skills  |  |Abilities|  Nav Cards    |
|   | [glass] |  | [glass] |  (9 total)    |
|   | hover:  |  | hover:  |               |
|   | glow+   |  | glow+   |               |
|   | scale   |  | scale   |               |
|   +---------+  +---------+               |
|                                          |
+------------------------------------------+
|  [glass footer: bg-black/50 blur-xl]     |
|    [Short Rest] [Long Rest] [Level Up]   |
+------------------------------------------+
```

---

## Testing Checklist

### Visual QA
- Background visible on all screen sizes (320px - 2560px)
- Character's face/weapons remain in frame on mobile
- All text passes WCAG AA contrast (4.5:1 minimum)
- Glass cards have visible borders/separation
- No text clipping or overflow
- Staggered animations play smoothly on load

### Performance QA
- Lighthouse Performance score greater than 90 (mobile)
- No jank during scroll (60fps maintained)
- Backdrop blur doesn't cause repaints on mobile
- Entry animations complete within 500ms

### Cross-Browser/Device
- Chrome/Edge (latest)
- Safari iOS (latest 2 versions)
- Firefox (latest)
- iPhone SE, iPhone 14 Pro, iPad, Android mid-range

### Accessibility
- Screen reader announces content correctly
- Parallax and animations disabled when `prefers-reduced-motion: reduce`
- Keyboard navigation unaffected
- Focus indicators visible against glass background

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Performance on mid-range mobile | Disable `bg-fixed` on touch devices, use `backdrop-blur-md` instead of `backdrop-blur-xl` |
| Poor contrast on bright screens | 45% overlay + text shadows ensure readability |
| Image crops character awkwardly | Responsive `background-position` adjusts focal point per breakpoint |
| Backdrop blur unsupported | CSS fallback to solid `bg-black/60` |
| Framer Motion bundle size | Optional; CSS-only fallback available |

---

## Implementation Priority

1. Create Glass component and add design tokens (Phase 0)
2. Enhance BackgroundWrapper with new props (Phase 1)
3. Wrap HomeScreen and apply Glass to all elements (Phase 2)
4. Add text contrast enhancements (Phase 3)
5. Add staggered entry animations (Phase 4)
6. Implement loading states (Phase 5)
7. Final accessibility compliance pass (Phase 6)
8. Execute testing checklist
