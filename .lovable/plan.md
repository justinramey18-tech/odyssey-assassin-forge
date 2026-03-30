
## Add Empyrean Default Background to DM Chat Screens

### What
When in Empyrean mode (both Solo EmpyreanDMScreen and PartyDMScreen in Empyrean campaign type), show the uploaded dragon silhouette image as a background behind the chat messages area. This background is only visible when no burnout background is active (burnout level = 0). Text readability is enhanced with warm, high-contrast colors.

### Files to change

**1. Save the uploaded image as a new asset**
- Copy `user-uploads://Screenshot_20260329_210416_ChatOn.jpg` to `src/assets/empyrean-dm-bg.jpg`

**2. `src/components/empyrean/EmpyreanDMScreen.tsx`**
- Import the new background image
- Inside the messages container (the `flex-1 min-h-0 relative flex flex-col overflow-hidden` div around line 921), add a background image layer that shows when `burnoutLevel === 0`:
  - Absolute-positioned div with `backgroundImage`, `backgroundSize: cover`, `backgroundPosition: center`, low opacity (~0.2) so text remains readable
  - Add a dark gradient overlay on top for text contrast
- Update text colors in the message area for better readability against the dark dragon image:
  - Assistant message prose text: use `text-gray-100` (light gray)
  - Bold text: keep `text-purple-300` 
  - Italic/emphasis: use `text-amber-300` (gold)
  - Empty state text: use `text-gray-300`

**3. `src/components/ai-dm/PartyDMScreen.tsx`**
- Import the new background image and `isEmpyreanMode` or use the existing `isEmpyrean` local variable
- Inside the messages container div (around line 1710), add the same background image layer, conditioned on `isEmpyrean && burnoutLevel === 0` (where burnout level comes from the existing dragon bonds check)
- The background shows only when:
  - `isEmpyrean` is true, AND
  - burnout level is 0 (no burnout backgrounds from BurnoutFlameOverlay are active)

### Background layer structure
Both screens get the same pattern inside their message container:
```tsx
{/* Default empyrean background — hidden when burnout is active */}
{burnoutLevel <= 0 && (
  <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
    <div className="absolute inset-0" style={{
      backgroundImage: `url(${empyreanDmBg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: 0.18,
    }} />
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
  </div>
)}
```

### Text readability
The image is very dark (silhouette dragon against stormy sky), so the existing light text colors will mostly work. Minor tweaks:
- Ensure the scrollable message div has `relative` and `z-index: 1` so text renders above the background layer
- No major color overhaul needed — the dark image + overlay keeps contrast high
