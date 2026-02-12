

## What We're Doing

Right now, the home screen content (Party Chat button, dice roller, HP bar, and the Short Rest / Long Rest / Level Up buttons) sits a bit too high on the screen. The goal is to push all of that content downward by adding more space above the Party Chat button, so that the bottom edge of the three action buttons (Short Rest, Long Rest, Level Up) ends up just 2 pixels above the top edge of the expanded navigation footer.

## How It Will Work

1. **Add top padding/margin above the Party Chat button** -- This is the main lever. By increasing the space at the top of the scrollable content area (specifically above where the Party Chat button sits), everything below it (the dice roller, the HP bar, and the three quick-action buttons) will shift downward together.

2. **Fine-tune the gap** so the bottom of the Short Rest / Long Rest / Level Up row lands exactly 2px above the navigation footer's top border when the footer is expanded.

## What Changes

- **One file modified**: `src/components/home/HomeScreen.tsx`
- **One change**: Increase the top padding or margin on the content wrapper that sits above the Party Chat button (around line 543). This will likely involve adjusting the `pt-` (padding-top) value on the scrollable content container, or adding a spacer/margin above the Party Chat button itself.
- **Nothing else changes** -- the order of elements, the footer, the header, and all other styling stays exactly the same.

## Technical Detail

- The exact pixel value for the top padding will need to be calibrated visually since it depends on the heights of the dice roller, HP bar, and button row combined relative to the viewport and the footer height. I'll use Tailwind spacing classes (e.g., `pt-16`, `pt-20`, or a custom `mt-[Xpx]` value) to get the 2px gap right.
- If the spacing can't be pixel-perfect with standard Tailwind classes alone, I'll use an arbitrary value like `mt-[48px]` to dial it in precisely.

