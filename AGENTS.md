# Project Architecture Rules

- The default Party home uses a dedicated paused, poster-backed Enter Story video element; other background videos stay with the existing looping background system so their behavior cannot change.
- Dice odds are chosen as a profile (odyssey-dice-odds-profile); rollD20 resolves the mode per roll context via resolveOddsForContext, so one setting can differ between combat and roleplay.
- An overlay that must sit above an open drawer renders inside that drawer's content (inline prop, no body portal) and carries data-vaul-no-drag, because a modal drawer keeps focus and treats outside taps as close — raising its z-index alone cannot win.
