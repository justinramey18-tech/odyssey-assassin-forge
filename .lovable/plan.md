

# Expand Masterwork Prompts to 48 (6 per Subcategory)

## Summary
Add 32 new masterwork prompts for a total of 48, organized into 8 subcategories of 6 each. Add subcategory grouping UI to all 4 prompt list components.

## 8 Subcategories — Assignment of Existing 16 + 32 New

| Subcategory | Existing (2) | New (4) |
|---|---|---|
| **Tactical Mastery** | Battlefield Savant, Prepared Champion | Siege Breaker, Tempo Commander, Terrain Sculptor, Flanking Phantom |
| **Social Engineering** | Architect of Agreement, Intimate Strategist | Mirror Walker, Silence Weaponist, Mask Collector, Empathy Hacker |
| **Intelligence & Insight** | Truth Reconstructor, Pattern Prophet | Echo Reader, Inverse Analyst, Thread Tracer, Signal Harvester |
| **Influence & Power** | Web Spinner, Network Weaver | Throne Whisperer, Debt Architect, Shadow Broker, Loyalty Forger |
| **Innovation & Knowledge** | Interdisciplinary Mind, Digital Optimizer | Rule Bender, Synthesis Engine, Paradox Smith, Axiom Breaker |
| **Leadership & Legacy** | Catalyst of Excellence, Legacy Architect | Crucible Master, Torch Passer, Tide Turner, Oath Keeper |
| **Survival & Adaptation** | Wilderness Virtuoso, Phantom Liberator | Scar Reader, Current Rider, Famine Artist, Ruin Walker |
| **Art & Healing** | Resonance Creator, Systemic Healer | Wound Alchemist, Harmony Forger, Dream Weaver, Soul Mender |

## File Changes

### 1. `src/lib/characterPrompts.ts`
- Add optional `subcategory?: string` to `CharacterPrompt` interface
- Add `subcategory` field to all 16 existing masterwork prompts
- Add 32 new masterwork prompts with subcategories, icons, and full prompt text
- Export `masterworkSubcategories: string[]` array for UI ordering

### 2. `src/components/character/InfinityGauntletScreen.tsx`
- When `activeStone` is `'masterwork'`, group prompts by `subcategory` with small section headers between groups

### 3. `src/components/drawers/InfinityStoneDrawer.tsx`
- When rendering the Masterwork stone's accordion content, group prompts by subcategory with divider headers

### 4. `src/components/ai-dm/InfinityStoneDMDrawer.tsx`
- Same subcategory grouping for the DM drawer variant

### 5. `src/components/scribe/NovelPromptDrawer.tsx`
- Same subcategory grouping for the scribe drawer variant

## UI Grouping Pattern (all 4 components)
Within the Masterwork stone's prompt list, render subcategory headers:
```text
── Tactical Mastery ──
  [prompt] [prompt] [prompt] [prompt] [prompt] [prompt]
── Social Engineering ──
  [prompt] [prompt] [prompt] [prompt] [prompt] [prompt]
...
```
A small `text-xs text-muted-foreground font-cinzel` label with subtle top border, only shown for the Masterwork stone. Other stones render flat lists as before.

