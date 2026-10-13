# The Training Grounds (Arena Mode)

A safe practice space where players learn combat mode against practice opponents, alone or with their party. Nothing that happens in the arena touches the real character or the real story.

## What players get

**Getting in**
- An "Arena" card on the home screen.
- Pick Solo Training, Endless Gauntlet, or Party Arena.

**Zero-risk rule**
- On entry the game remembers the character's health, potions, spell slots, gold and cooldowns.
- On exit (or if the app closes mid-practice) everything is put back exactly as it was.
- Arena fights never post to the Live Table, never wake the story DM, never give XP or loot.

**Practice opponents**
- Wooden Dummy: never attacks, just takes hits. Shows damage numbers.
- Sparring Partner: fights back gently, uses normal attacks.
- Drill Masters: one each for Counter Clash, Pin (Tug and Slip) and Duel.
- Your campaign NPCs: pick any saved NPC as a practice opponent.

**1. Trigger any move on demand**
- Buttons to make the opponent start a Counter Clash, Pin you, or fill your Duel bar instantly, so you can practice one thing over and over.

**2. Practice speed**
- A slider: 0.5x (slow, for learning), 1x (normal), 1.5x (hard). Changes how fast swings, rings and wind-ups move.

**3. Timing feedback**
- After every tap: "Perfect", "Early by 0.12s", "Late by 0.30s", plus a small marker showing where you tapped versus the sweet spot.

**4. Scorecard**
- At the end of each session: damage dealt, damage taken, perfect taps, best chain, Pin escape time, Duel record. Personal bests are saved.

**5. Endless Gauntlet**
- Waves of opponents that get tougher each round. Health carries between waves. Ends when you go down; your best wave is saved.

**6. Party Arena (multiplayer)**
- The host opens an arena room; party members get a "Join Arena" button.
- Two modes: Co-op Trial (everyone versus a practice boss) and Sparring (player versus player using the same timing games, no real damage).
- Shared scorecard at the end.

## Build order (one step at a time)

1. **Safe snapshot and entry.** Home card, arena menu, save-and-restore of the character, crash recovery. No fighting yet.
2. **Solo practice fights.** Dummy, Sparring Partner, Drill Masters and campaign NPCs, reusing the existing fight screen and mini-games, kept fully separate from story fights.
3. **Training tools.** Move trigger buttons, speed slider, timing feedback.
4. **Scorecard and personal bests.**
5. **Endless Gauntlet.**
6. **Party Arena storage and referee support** (needs a small database addition, which I will flag before applying).
7. **Party Arena screens.** Room, join button, Co-op Trial, Sparring, shared scorecard.

Each step is tested before the next one starts.

## Things you may not like
- Party Arena needs new storage on the server; solo practice does not.
- Practice fights use the same AI for opponent lines, so they use AI credits. I can make the Dummy and Drill Masters silent to save credits.
- Player-versus-player sparring is the most complex piece and will take the longest.

## Technical details
- Arena fights reuse the existing fight referee with an "arena" flag that skips story posting, XP, loot, gold and perk purchases, and the battle narrator.
- Snapshot is stored per character (registered in all three storage lists) and restored on exit and on next app open if a session was left unfinished.
- Speed slider scales timing windows on both the phone and the referee so judging stays fair.
- Personal bests stored per character; Party Arena rooms are tied to the party and cleared when the room ends.
