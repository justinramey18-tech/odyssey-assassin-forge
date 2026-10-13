# Real 3D Physics Dice in the Dice Roller

## What you will see
- Tapping a roll in the Dice Roller (plain die, skill, save, initiative, custom roll) opens a 3D dice tray over the top half of the screen.
- Real 3D dice (d4, d6, d8, d10, d12, d20, and two dice for percentile) are thrown into a dark wooden tray with a felt floor, tumble under gravity, bump into each other and the walls, and settle.
- You can also flick your finger across the tray to throw them yourself.
- When the dice stop, the number that's face-up glows briefly and the usual result card appears, just as it does now. Sharing to the party works exactly as before.
- Advantage/disadvantage throws two d20s; the one that counts is highlighted, the other dims.
- Natural 20: gold glow and a short camera push-in. Natural 1: a red flash and small shake. The existing crit video and sounds still play the same way.
- Dice clatter sounds play on impact.
- A switch in the Dice Roller ("3D dice" on/off) lets players fall back to the current flat animation on slow phones. On by default. Saved per device, not per character.

## The important rule: your dice odds still decide the result
The number you get is still decided first by the existing roller, so God Mode, Doomed and the combat/roleplay odds settings keep working. The physics throw is real, and once the die lands the numbers painted on it are arranged so the face that ended up on top shows the chosen number. It looks and feels completely real, but the odds setting is never bypassed.

## Scope
- Only the dedicated Dice Roller screen in this step (also opens from the combat tab's dice button, since that uses the same screen).
- Combat pop-ups, death saves, chat rolls and the fight bar are unchanged for now — a later step can reuse the same tray there.

## Needs your OK: new add-ons
This needs four new add-ons the app doesn't have yet (3D drawing and a physics engine). Approving this plan approves installing them:
- three, @react-three/fiber 8, @react-three/drei 9 (3D drawing)
- @react-three/rapier 1 (physics)

They only load when the tray first opens, so app start-up speed is unaffected.

## Things you may not like
- The first roll after opening the app takes about a second longer while the 3D add-ons load.
- Older or budget phones may run the tray less smoothly; that's what the off switch is for.
- d10/percentile shapes are built by hand rather than from downloaded models, so they'll look clean and stylized rather than ultra-realistic.

## Technical details
- New `src/components/diceRoller/three/`: `DiceTray3D.tsx` (Canvas, lazy loaded), `dieGeometry.ts` (polyhedra + face normals per die, d10 pentagonal trapezohedron built manually), `faceTextures.ts` (canvas-drawn number textures), `settleDetect.ts` (sleep detection + up-face by max dot of face normal with world up).
- Result-first: `DiceRollerScreen.rollDice` keeps computing values via `rollD20` / existing weighted rolls. Tray receives target values; after settle, detect the up-face and remap face labels so that face shows the target (label permutation, no snapping). Reveal waits on settle, then on `awaitD20Reveal` as today.
- Random throw impulse/torque; flick gesture sets direction and strength. Timeout of 4s forces settle if a die gets stuck (reroll-free nudge).
- Lighting: local `<Environment>` with Lightformers (no CDN presets), one shadowed directional light, pixel ratio capped at 1.5, physics fixed step.
- Setting key `odyssey-dice-3d-enabled` in plain account/device storage (not scoped).
- Overlay follows the z-index ladder inside the existing sheet; touch targets 48px, `touchAction: manipulation`.
- Tests: label remap always yields the target value for every die type; up-face detection picks the correct face for each face normal.
- Verify with screenshots of a settled roll for each die type.
