

## Plan: Replace Auth Screen with Assassin Ledger Login

Redesign the Auth page to match the reference screenshot exactly -- a dark medieval dungeon-themed login screen with floating inputs over a full-bleed background, no card wrapper.

**Layout (default = Login view):**
- Full-screen dark background using `home-background.jpg` with heavy dark overlay
- Skull emblem image (`assassin-logo.png`) centered at top
- "ASSASSIN LEDGER" title in gold Cinzel font with a small decorative divider
- Username (email) input styled as parchment/stone with a user icon on the left
- Password input styled as parchment/stone with a lock icon on the left
- "LOG IN" button styled as a stone/parchment bar with gold uppercase text
- Bottom row: "Forgot Password?" and "Create Account" side by side as text links

**View switching (no tabs):**
- Clicking "Create Account" switches to a signup form (email, password, confirm password, "Create Account" button, "Back to Login" link)
- Clicking "Forgot Password?" switches to the existing reset password form
- All existing auth logic (validation, signIn, signUp, resetPassword) stays the same

**Styling approach:**
- Custom CSS classes for the parchment-textured inputs (warm beige/tan background, dark borders, gold-ish icon tints)
- Remove the Card/Tabs wrappers entirely
- Inputs and button use custom inline styles or Tailwind classes to achieve the stone/parchment look
- Error/success alerts remain but styled to match the theme

**Files to change:**
1. **`src/pages/Auth.tsx`** -- Complete rewrite of the JSX/layout. Remove Card, Tabs imports. Replace with the new dungeon-themed layout. Keep all handler functions and state unchanged. Use `assassin-logo.png` for the emblem. Switch between login/signup/forgot-password views via state instead of tabs.

**Technical details:**
- Input styling: `bg-[#c4b99a]/90 border-2 border-[#8b7355] text-[#2a1f14] placeholder:text-[#6b5a45] rounded-sm` with icon wrappers
- Button styling: `bg-[#5a4a3a] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-widest`
- Title: `font-cinzel text-[#d4a030] text-3xl tracking-wider` with a small gold star/cross ornament below
- Background: existing `BackgroundWrapper` with `overlayOpacity={90}` and no tint for maximum darkness

