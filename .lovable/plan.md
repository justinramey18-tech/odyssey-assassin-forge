

# Final Implementation Plan: Chronicle Sync Tab

## Verification Summary

All critical infrastructure has been confirmed:

| Item | Status | Location |
|------|--------|----------|
| `getAbilityPointsForLevel` | Confirmed | `src/lib/types.ts` lines 41-56 |
| All 40 achievements with `maxValue` | Confirmed | `src/lib/achievements.ts` lines 58-381 |
| Level-up modal states | Confirmed | `src/pages/Index.tsx` lines 66-68 |
| `useItem(id, quantity)` signature | Confirmed | `src/hooks/use-consumables.ts` line 98 |
| Rest handlers | Confirmed | `src/pages/Index.tsx` lines 396-408 |
| Navigation pattern | Confirmed | `src/components/navigation/AssassinHeader.tsx` |

---

## Architecture

### Phase 1: Data Layer

**New Files in `src/lib/chronicleSync/`:**

| File | Purpose |
|------|---------|
| `types.ts` | All interfaces: ParsedXPChange, ParsedHPChange, ParsedItemChange, ParsedAchievementTrigger, ParsedLevelUp, ChronicleParseResult, ReviewableChange, ApprovedChanges, UndoSnapshot |
| `patterns.ts` | Regex patterns for offline Pattern Match mode (XP, damage, healing, items, gold, crits, level-up, conditions) |
| `achievementMatcher.ts` | Complete keyword mapping for all 40 achievement categories from the existing `achievementCategories` array |
| `fuzzyMatch.ts` | Custom Levenshtein distance implementation with 70% threshold for consumable matching |
| `processor.ts` | Core parsing logic with `parseLogOffline()` and `buildAIPrompt()` functions |
| `validation.ts` | Honest Mode validation: XP cap, item validation, achievement evidence requirements |
| `sampleLogs.ts` | 5 test scenarios: combat, exploration, social, levelUp, mixed |
| `index.ts` | Barrel exports |

---

### Phase 2: Edge Function

**New File: `supabase/functions/chronicle-sync/index.ts`**

Uses Lovable AI Gateway with `google/gemini-3-flash-preview` model.

System prompt instructs AI to extract structured JSON with all categories. Response includes confidence levels and source text snippets for each detection.

Error handling for rate limits (429) and payment required (402) with fallback to Pattern Match mode.

---

### Phase 3: UI Components

**New Files in `src/components/chronicle/`:**

| File | Purpose |
|------|---------|
| `ChronicleSyncScreen.tsx` | Main screen with input area (50k char limit), mode toggle, results section, display-only alerts |
| `ParseResultCard.tsx` | Individual change display with confidence badges and source text snippets |
| `ReviewModal.tsx` | Detailed review interface with batch operations |
| `DisplayOnlyAlerts.tsx` | HP, gold, conditions alerts with copy-to-clipboard |
| `index.ts` | Component exports |

**Visual Theme:** Deep blue/silver palette using `blue-500`, `blue-400` to contrast Scribe's warm amber tones.

---

### Phase 4: Navigation Integration

**Modify: `src/components/navigation/AssassinHeader.tsx`**

Add Chronicle tab between Scribe and Cloud:
- Icon: `Search` from lucide-react
- Active state: `from-blue-600/30`, `border-b-blue-500`
- Text color: `text-blue-300`

**Modify: `src/pages/Index.tsx`**

1. Update activeTab type to include `'chronicle'`
2. Add TabsContent for chronicle tab
3. Implement `handleApplyChronicleChanges` with:
   - Undo snapshot creation (including `character.level`)
   - XP aggregation via existing `handleAddXP`
   - Achievement increments with `Math.min(a.maxValue, a.currentValue + increment)`
   - Item acquisitions via `addConsumableItem(consumable, quantity)`
   - Item consumptions via `useConsumableItem(id, quantity)` with success validation
   - Level-up triggering via existing `setPendingLevelUps`, `setLevelUpPointsToSpend`, `setShowLevelUpModal`

---

### Phase 5: Honest Mode Integration

**Modify: `src/lib/gameModes.ts`**

Add to HonestModeRules interface:
- `requireChronicleEvidence: boolean` (default: true)
- `chronicleItemValidation: boolean` (default: true)
- `chronicleXPCap: number` (default: 5000)

**Modify: `src/hooks/use-game-mode.ts`**

Expose new rules for use in ChronicleSyncScreen.

---

### Phase 6: Safety Features

**Undo System:**
- Create snapshot before applying changes
- Store in localStorage: `odyssey-chronicle-undo`
- Include `characterLevel` in snapshot for level-up reversal
- 1-hour expiration enforcement
- Single-use (clear after successful undo)

**Session History:**
- Store last 10 sessions in localStorage: `odyssey-chronicle-history`
- Track: id, parsedAt, inputPreview, changesApplied, categories, canUndo

---

## Files Summary

### New Files (14)

| File | Purpose |
|------|---------|
| `src/lib/chronicleSync/types.ts` | Type definitions |
| `src/lib/chronicleSync/patterns.ts` | Regex patterns |
| `src/lib/chronicleSync/achievementMatcher.ts` | 40 achievement keyword mappings |
| `src/lib/chronicleSync/fuzzyMatch.ts` | Levenshtein matching |
| `src/lib/chronicleSync/processor.ts` | Core parsing logic |
| `src/lib/chronicleSync/validation.ts` | Honest Mode validation |
| `src/lib/chronicleSync/sampleLogs.ts` | Test scenarios |
| `src/lib/chronicleSync/index.ts` | Barrel exports |
| `supabase/functions/chronicle-sync/index.ts` | AI parsing edge function |
| `src/components/chronicle/ChronicleSyncScreen.tsx` | Main screen |
| `src/components/chronicle/ParseResultCard.tsx` | Change display |
| `src/components/chronicle/ReviewModal.tsx` | Review interface |
| `src/components/chronicle/DisplayOnlyAlerts.tsx` | HP/gold/conditions |
| `src/components/chronicle/index.ts` | Component exports |

### Modified Files (4)

| File | Changes |
|------|---------|
| `src/components/navigation/AssassinHeader.tsx` | Add Chronicle tab trigger |
| `src/pages/Index.tsx` | Add tab content, change handler |
| `src/lib/gameModes.ts` | Add Chronicle Honest Mode rules |
| `src/hooks/use-game-mode.ts` | Expose new rules |

---

## Implementation Order

### Day 1: Data Layer
1. Create `types.ts` with all interfaces
2. Create `patterns.ts` with detection regex
3. Create `achievementMatcher.ts` with complete 40-category mapping (using existing achievement IDs)
4. Create `fuzzyMatch.ts` with Levenshtein implementation
5. Create `processor.ts` with offline parsing logic
6. Create `validation.ts` with Honest Mode checks
7. Create `sampleLogs.ts` with 5 test scenarios
8. Create barrel exports

### Day 2: Edge Function
9. Create `chronicle-sync/index.ts` edge function
10. Build AI prompt with structured JSON output
11. Handle error cases (rate limits, malformed responses)
12. Deploy and test with sample logs

### Day 3: UI Components
13. Create `ChronicleSyncScreen.tsx` with input section, character counter, progress indicator, results section
14. Create `ParseResultCard.tsx` with confidence badges
15. Create `ReviewModal.tsx` with batch operations
16. Create `DisplayOnlyAlerts.tsx` for HP/gold/conditions

### Day 4: Integration
17. Add Chronicle tab to `AssassinHeader.tsx` (between Scribe and Cloud)
18. Add tab content to `Index.tsx`
19. Implement `handleApplyChronicleChanges` with full change application logic
20. Add Honest Mode validation rules

### Day 5: Safety & Polish
21. Implement undo snapshot with character level and 1-hour expiration
22. Add session history tracking
23. Add sample log selector dropdown
24. Final testing with all scenarios

---

## Testing Checklist

### Core Functionality
- [ ] Offline Pattern Match detects XP, items, achievements
- [ ] AI Smart Parse returns valid JSON
- [ ] Fuzzy matching finds consumables at 70%+ similarity
- [ ] Achievement keywords trigger correct categories
- [ ] Review modal shows all detected changes
- [ ] Apply All updates character state

### Integration
- [ ] Chronicle tab appears in navigation with blue theme
- [ ] XP changes integrate with existing `handleAddXP`
- [ ] Achievement increments update Feats tab (capped at `maxValue`)
- [ ] Item acquisitions call `addConsumableItem(consumable, quantity)`
- [ ] Item consumptions call `useConsumableItem(id, quantity)` with success handling
- [ ] Level-up triggers modal via `setPendingLevelUps`, `setLevelUpPointsToSpend`, `setShowLevelUpModal`

### Honest Mode
- [ ] XP cap enforced at 5000 (or configured value)
- [ ] Unknown items rejected with warning
- [ ] Low-confidence achievements rejected
- [ ] Evidence requirement validated (high confidence + 20+ char sourceText)

### Safety
- [ ] Undo creates snapshot including character level
- [ ] Undo expires after 1 hour
- [ ] Session history persists across refreshes
- [ ] Display-only items shown with guidance
- [ ] Clipboard copy works for conditions

### Edge Cases
- [ ] Empty input shows helpful message
- [ ] 50k character limit enforced
- [ ] Insufficient inventory shows warning for consumptions
- [ ] Malformed AI response falls back to Pattern Match
- [ ] 40k character warning threshold triggers alert

