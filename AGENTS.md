# Project Architecture Rules

- The default Party home uses a dedicated paused, poster-backed Enter Story video element; other background videos stay with the existing looping background system so their behavior cannot change.
- Dice odds are chosen as a profile (odyssey-dice-odds-profile); rollD20 resolves the mode per roll context via resolveOddsForContext, so one setting can differ between combat and roleplay.
- An overlay that must sit above an open drawer renders inside that drawer's content (inline prop, no body portal) and carries data-vaul-no-drag, because a modal drawer keeps focus and treats outside taps as close — raising its z-index alone cannot win.
- npc-combat carries identical copies of npc-reply's handler/models/repo/prompt in npc-combat/npc-reply/, because each server function deploys only its own folder; a test fails if the copies drift, so re-copy after editing npc-reply.
- Automatic party launch passes an explicit initial Live Table choice through the existing screen chain; drawer state remains locally owned so Return to Story cannot trigger automatic reopening.
- Cache Live Table rows separately from DM narration by account and party; successful server reads replace stale cached rows while in-flight live changes survive, and failed reads must retain the visible conversation.
- Arena Live Table Sparring renders the real PartyDMScreen through runtimeOverrides with local Arena hooks; never rebuild a separate mock table, because a second copy drifts from the live game.
- Party Sparring runs on the host's phone and is shared over a live broadcast channel (no database rows); members mirror the host's fight and send actions to it, because campaign tables and the fight referee must never see practice fights.
