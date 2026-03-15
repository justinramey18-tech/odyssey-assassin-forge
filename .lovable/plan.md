

## Problem

Your party member's druid is being called an "Assassin" because the **oracle-assistant backend function** has a hardcoded `"Assassin"` string on line 118, regardless of the character's actual class. The client already sends the correct `characterClass` field — the backend just ignores it.

The **ai-dm** backend function handles this correctly with proper class detection and multiclass support. The oracle-assistant was never updated to match.

## Changes

### 1. `supabase/functions/oracle-assistant/index.ts` — Three fixes

**A. Add missing fields to the `CharacterContext` interface** (around line 12-15):
Add `characterClass?: string` and `multiclassBreakdown?: Record<string, number>` alongside the existing fields like `gender`, `race`, etc.

**B. Fix the hardcoded "Assassin" on line 118**:
Replace:
```
lines.push(`CHARACTER: ${ctx.name}, Level ${ctx.level} Assassin`);
```
With class-aware logic matching the ai-dm pattern:
```
lines.push(`CHARACTER: ${ctx.name}, Level ${ctx.level}`);
if (ctx.characterClass) {
  if (ctx.multiclassBreakdown && Object.keys(ctx.multiclassBreakdown).length > 1) {
    const breakdown = Object.entries(ctx.multiclassBreakdown)
      .map(([cls, lvl]) => `${cls.charAt(0).toUpperCase() + cls.slice(1)} ${lvl}`)
      .join(' / ');
    lines.push(`CLASS: ${breakdown} (multiclass)`);
  } else {
    lines.push(`CLASS: ${ctx.characterClass.charAt(0).toUpperCase() + ctx.characterClass.slice(1)} ${ctx.level}`);
  }
}
```

**C. No changes needed for party member display** — line 316 already uses `m.className ?? 'Adventurer'` correctly.

One file, two edits (interface + context builder). The client already sends the right data.

