

## Problem

Currently the login form uses `space-y-3` on the `<form>`, which controls spacing uniformly between all children (inputs, button, links). The button uses `mt-9` for extra gap from inputs, and links use `pt-1.5`. Because these are all inside one flex-flow with uniform gap logic, you can't independently position the button and links to match the background.

From the screenshot:
- **Inputs**: Aligned perfectly — do not touch.
- **"SUMMON YOUR HERO" button**: Needs to move **down** (closer to background's LOG IN).
- **Links row**: Needs to move **up** (closer to the button / background's links).

## Plan

**Remove `space-y-3` from the form** and use explicit margins on each element so they can be adjusted independently:

1. **Inputs**: Keep current spacing between them using `mb-3` on the first input wrapper (replicating the `space-y-3` gap). No margin on the second input.

2. **Button**: Replace `mt-9` with a larger value (e.g., `mt-12` or a custom value like `mt-[2.8rem]`) to push it further down to align with the background's LOG IN button. This will require visual testing.

3. **Links row**: Replace `pt-1.5` with a smaller or negative value (e.g., `pt-0` or `mt-1`) to pull them closer to the button, aligning with the background's link positions. May also need a slight upward shift via negative margin.

### Implementation steps

In `src/pages/Auth.tsx`, login form section only:

- Line 138: Change `className="w-full space-y-3"` → `className="w-full"`
- Line 139 (username input wrapper): Add `mb-3` to the `<div className="relative">`
- Line 153 (password input wrapper): No margin needed (stays as-is)
- Line 171 (button): Adjust `mt-9` to a tuned value (start with `mt-[2.5rem]`)
- Line 179 (links div): Adjust `pt-1.5` to a tuned value (start with `pt-0` or `-mt-1`)

Each element's vertical position is now independently controllable for fine-tuning.

