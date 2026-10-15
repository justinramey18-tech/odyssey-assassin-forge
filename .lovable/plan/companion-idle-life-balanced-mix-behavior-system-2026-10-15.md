# Companion Idle Life — "Balanced Mix" Behavior System

## Goal
When left alone at camp, the companion should feel like it has its own life: mostly cozy and restful, now and then watchful, and always in its own style based on temperament and body type. No random looping — each behavior has a reason.

## What the player will see

### 1. A quiet camp rhythm (time left untouched)
- **0–10s:** Watches the player's finger, slow blinks, small weight shifts.
- **10–25s:** Curious moments — sniffs the ground, ear twitches, follows a spark rising from the fire.
- **25–45s:** Bigger moments — full-body coat shake, big yawn, grooming a paw or flank.
- **45s+:** Drowsiness — head nods toward the fire, catches itself, then curls up and sleeps.
- Every so often (rare), a **guardian moment**: a sound in the dark, ears snap up, it freezes, looks toward the treeline, then decides camp is safe and settles again.

### 2. Four inner feelings that steer choices
- **Energy** (alert to asleep) — drains slowly while idle, refilled by play and treats.
- **Safety** (wary to comfortable) — dips on a guardian moment, recovers over time.
- **Comfort** (cold to cozy) — rises when near the fire, drives curling up.
- **Attention** (wants you vs. content alone) — rises when ignored, leads to looking at or nudging toward the player.
These are not shown as numbers; they only show through behavior (and optionally a small mood word).

### 3. Temperament changes how often and how it looks
- **Feral:** restless — frequent sniffing, sudden shakes, sharp freezes, sleeps lightly and wakes fast.
- **Sentinel:** calm watcher — slow head sweeps, ear pivots, repositions protectively, long watchful blinks, last to fall asleep.
- **Reckless:** playful — chases sparks, pounce-wiggles, sniffs turn into play, flops down to sleep.
- **Cunning:** sly — half-closed eyes, quick suspicious tests, sneaky glances at the player, sleeps with one eye open.

### 4. Body type changes the physical version
- **Fur beasts (canid, feline, ursine):** fluffy shake, deep yawn, licking paws.
- **Reptile:** tongue-flick instead of sniff, slow basking toward the fire, no shake (a ripple instead).
- **Beaked:** feather ruffle instead of shake, head tilts, preening.
- **Visor/construct:** venting puff instead of yawn, scanning light sweep instead of sniff, "power down" instead of sleep.
- Wings, manes, spines and shells add their own follow-through (wings stretch and fold, mane bounces, spines lift when alert).

### 5. Polite interruptions
- Tapping mid-behavior doesn't snap instantly: it finishes the shake, then looks at you.
- Tapping during a guardian moment: it keeps one eye toward the dark before greeting you.
- Waking from sleep: a slow stretch and blink, not a pop to standing.

## Build order
1. **Behavior director** — the brain that tracks idle time, the four feelings, and picks the next behavior from a weighted list shaped by temperament.
2. **Core idle set** — sniff, ear twitch, spark tracking, shake, yawn, groom, nod-off, curl-up sleep, wake stretch.
3. **Guardian moments** — alert freeze, treeline stare, release and resettle.
4. **Body-type variants** — swap each behavior for its reptile, beaked and construct version, plus back-feature follow-through.
5. **Interruption rules** — finish-then-react, wake transitions.
6. **Tuning pass** — timing per temperament so no two companions feel identical.

## What stays the same
- Saved companion looks and bond are untouched; no new saved data required (feelings reset each time the camp opens).
- Existing touch reactions, treats and sleep keep working; they now feed into the feelings.
- Drawing stays in code (no image files). Animation pauses when the screen is hidden to save battery.

## Technical details
- New pure module `src/lib/companion-idle.ts`: feelings state, decay rates, temperament weight tables, body-type behavior mapping, and a `pickNextBehavior(state, rig, idleMs, rand)` function — fully unit-tested with a seeded random.
- `CompanionCanvas.tsx` gets a behavior timeline (current behavior, start time, phase 0..1) and per-behavior pose functions layered on top of existing breathing/blink motion with eased blending in/out.
- Touch/treat handlers call into the director (`notifyTouch`, `notifyTreat`) instead of setting poses directly; interrupts queue until a behavior's "can interrupt" point.
- Tests: temperament changes behavior frequency; reptile never picks "shake"; construct maps sleep to power-down; long idle reaches sleep; guardian moment lowers safety then recovers.
