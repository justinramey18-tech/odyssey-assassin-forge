

# Phased Implementation: Intent Gateway + Contextual Hints + Joker Badge

## What We're Building
1. **Theatrical Acts Intent Gateway** — A "What kind of moment?" mood selector as the default entry screen in prompt drawers, with moods like Comedy, Tragedy, Intrigue, Drama, Spectacle, and Unhinged
2. **Contextual Hints** — A `hint` field on prompts showing "Try when..." guidance for new players
3. **Joker Badge (🃏)** — A `tone: 'deadpool'` field to tag Deadpool-inspired prompts with a visible 🃏 badge

---

## Phase 1: Data Layer (2 files)
Update the data model and tag all existing prompts.

**Files touched:**
- `src/lib/characterPrompts.ts` — Add `tone?: 'deadpool' | 'classic'` and `hint?: string` to `CharacterPrompt` interface. Tag all Deadpool-inspired prompts with `tone: 'deadpool'`. Add `hint` strings to all prompts (or at minimum the top ~30 most-used ones).
- `src/lib/moodMappings.ts` (new) — Define the 6 Theatrical Act moods (`Comedy`, `Tragedy`, `Intrigue`, `Drama`, `Spectacle`, `Unhinged`) with emoji, color, description, and a list of prompt IDs that belong to each mood. Prompts can appear in multiple moods. Export a `getMoodPrompts(moodId, allPrompts)` helper.

**Deadpool-tagged prompts** (these are clearly Deadpool-inspired based on fourth-wall breaks, meta-humor, and anti-hero tone):
- All `Voice & Tone` prompts (fourth-wall, inappropriate-humor, internal-monologue)
- All `Meta Requests` prompts (~35 prompts)
- Combat: creative-kills, tactical-incompetence, banter-mid-combat
- Social: negotiation-absurdity, alias-addiction
- Investigation: chaotic-investigation, lateral-thinking, attention-roulette
- Narrative: unreliable-narrator, genre-savvy
- World: property-damage, reputation-dissonance, loot-chaos
- Emotional: mask-slips, trauma-shield

Non-Deadpool: Masterwork prompts, most Soul Stone escalation prompts (genuine emotion), and prompts focused on strategy/depth without humor.

---

## Phase 2: Joker Badge + Hint UI (3 files)
Add the 🃏 badge and "Try when..." hint line to prompt cards across all drawers.

**Files touched:**
- `src/components/ai-dm/InfinityStoneDMDrawer.tsx` — Add 🃏 badge next to title when `prompt.tone === 'deadpool'`. Show `prompt.hint` as muted subtext below description.
- `src/components/drawers/InfinityStoneDrawer.tsx` — Same badge + hint rendering.
- `src/components/scribe/NovelPromptDrawer.tsx` — Same badge + hint rendering.

The badge is a small `🃏` span styled with `text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400` next to existing intensity/alignment badges.

The hint renders as: `💡 Try when: {hint text}` in `text-[11px] text-amber-400/50 italic`.

---

## Phase 3: Intent Gateway UI (3-4 files)
Build the mood selector screen as the default view when opening the prompt drawer, with "Browse All" fallback to existing stone accordion.

**Files touched:**
- `src/lib/moodMappings.ts` — May need minor tweaks based on Phase 1 feedback.
- `src/components/ai-dm/InfinityStoneDMDrawer.tsx` — Add a `view` state (`'moods' | 'browse' | 'mood-results'`). Default to `'moods'`. Render mood grid on `'moods'`, filtered results on `'mood-results'`, existing stone accordion on `'browse'`.
- `src/components/drawers/InfinityStoneDrawer.tsx` — Same gateway pattern.
- `src/components/scribe/NovelPromptDrawer.tsx` — Same gateway pattern.

**Mood selector layout:**
```text
┌──────────────────────────┐
│   What kind of moment?    │
│                           │
│  🎭 Comedy    🗡️ Tragedy │
│  🔍 Intrigue  💔 Drama   │
│  ⚡ Spectacle 🃏 Unhinged│
│                           │
│  [📋 Browse All Prompts]  │
└──────────────────────────┘
```

Tapping a mood shows 6 curated prompts with a "Show me more" shuffle button. Back arrow returns to mood grid. "Browse All" goes to existing stone accordion view.

---

## Phase 4: InfinityGauntletScreen (1 file)
- `src/components/character/InfinityGauntletScreen.tsx` — Add 🃏 badge, hint line, and optionally a mood selector entry point to this variant.

---

## Summary

| Phase | Files | What |
|-------|-------|------|
| 1 | 2 | Data: tone + hint fields, mood mappings |
| 2 | 3 | UI: 🃏 badge + hint on all prompt cards |
| 3 | 3-4 | UI: Mood selector gateway in all drawers |
| 4 | 1 | UI: Badge + hint on gauntlet screen |

