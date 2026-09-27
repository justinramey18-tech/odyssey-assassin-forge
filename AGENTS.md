# Project Architecture Rules

- The default Party home uses a dedicated paused, poster-backed Enter Story video element; other background videos stay with the existing looping background system so their behavior cannot change.
- Dice odds are chosen as a profile (odyssey-dice-odds-profile); rollD20 resolves the mode per roll context via resolveOddsForContext, so one setting can differ between combat and roleplay.
