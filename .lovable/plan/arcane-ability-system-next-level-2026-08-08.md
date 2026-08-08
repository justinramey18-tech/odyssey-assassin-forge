# Arcane & Ability System — Next Level

Everything works today. This plan makes magic and abilities feel *alive*: the app is the referee, the DM narrates, and nothing silently drifts out of sync. Applies to Solo, Party and Empyrean.

## 1. The app is the referee

Right now a cast spends a slot and stages a prompt. We extend that so one tap resolves the whole thing before the DM ever sees it:

- Tapping a spell or ability opens a small **cast card**: choose the slot level (upcast), pick a target if relevant, see the exact dice and save DC it will use.
- The app rolls the attack/damage/healing, applies the result, spends the resource, and starts any duration or concentration.
- The DM receives a short, factual receipt of what already happened ("Fireball, 3rd level, 27 fire damage, DC 15 Dex save for half") and its only job is to narrate the consequences. It cannot invent a different outcome, a different cost, or a spell you don't have.
- If a resource is empty, the cast is blocked before the prompt goes out, with a clear reason.

## 2. One resource ledger

A single place that owns every expendable thing: spell slots, pact slots, sorcery points, ki, rage, channel divinity, wild shape, per-day ability uses, potions, and Empyrean signet strain. Every screen — sheet, quick actions, combat, party roster — reads from it, so the numbers can never disagree.

## 3. Strict 5e recovery

- Explicit **Short Rest** and **Long Rest** actions, each showing a preview of exactly what comes back before you confirm.
- Each resource declares its own recharge rule (short rest, long rest, dawn, per encounter, charges with a die).
- The DM can *request* a rest in the story ("you camp for the night"), but the app applies it and the player confirms. Time-of-day and travel in the story can nudge the DM to offer one.
- A visible "since your last long rest" line so you always know how depleted you are.

## 4. Concentration and duration that actually tick

- One concentration slot, enforced. Casting a second concentration spell prompts you to drop the first.
- Taking damage while concentrating triggers an automatic Constitution save at the correct DC, with the roll shown.
- Active effects show remaining rounds/minutes and expire on their own, telling the DM when they drop so the narration matches.
- Buffs currently running are always in the DM's briefing, so it stops forgetting you're invisible or blessed.

## 5. The DM gets a proper spell brief

Instead of a flat list, the DM sees: what you can cast right now (filtered by remaining resources), what's out of reach, what's concentrating, and what recharges on which rest. Plus a short "tactical opportunities" note so it can hint at options you actually own.

## 6. The DM can offer, never take

A new tag lets the DM propose resource changes — "the shrine restores one spell slot", "your ability recharges" — which arrive as a **confirm card** in your feed. Nothing changes until you accept. Same pattern already used for loot.

## 7. Homebrew gets first-class structure

A guided builder for custom spells and abilities that captures: cost, dice, save type and DC, range, duration, concentration, recharge rule, and tags. Once structured, homebrew rolls, spends and expires exactly like official content — and the DM treats it with the same authority. Existing homebrew stays usable; a one-tap "make this mechanical" pass fills in the missing fields from its description.

## 8. Party and Empyrean

- Party: teammates' remaining slots and active concentration show on the shared roster, so the group can plan. Rests can be called party-wide by the host.
- Empyrean: signets and dragon powers move onto the same ledger and recharge rules, so strain, burnout and channelling all behave consistently instead of living in their own world.

## 9. Smaller wins

- **Ritual casting** — cast eligible spells without spending a slot, at a time cost.
- **Counterspell / reaction prompts** — when an enemy casts, you get a short window to react.
- **Spell search** with filters (level, school, castable now, damage type).
- **Favourites bar** — pin 4–6 go-to spells to the top of quick actions.
- **Cast history** — a running log of what you spent this rest, tappable to re-cast.
- **Undo last cast** for the inevitable mis-tap.

## Technical notes

- Extend `src/lib/magic/castBus.ts` from "spend a slot" into a full resolve pipeline (validate → roll → apply → emit receipt), with a typed outcome consumed by `SoloCharacterSheet`, `PartyDMQuickActions` and the combat adapter.
- Introduce a unified resource module under `src/lib/magic/` that wraps `use-spellcasting`, class resources and Empyrean signets behind one interface; keep character-scoped persistence via `scoped-storage` and register any new keys in `scoped-keys.ts`, `resetApp.ts` and `use-auto-save.ts`.
- Rest logic centralised in one hook, reusing existing `restoreSlot` / `restorePactSlot` paths rather than duplicating them.
- Add resolved-cast receipts, castable-now lists and active-concentration to `CharacterContext` — keeping the three definitions (`src/components/oracle/types.ts`, `supabase/functions/ai-dm/index.ts`, `supabase/functions/oracle-assistant/index.ts`) in sync, all new fields optional.
- New DM tag for proposed resource changes, parsed into a confirm card using the existing loot-intake pattern.
- Every number crossing storage or the model guarded with `Number.isFinite`.

## Suggested order

1. Resource ledger + strict rests (foundation)
2. Cast card + app-authoritative resolution + DM receipt
3. Concentration and duration enforcement
4. DM spell brief + propose-and-confirm tag
5. Homebrew structuring
6. Party roster + Empyrean migration
7. Smaller wins
