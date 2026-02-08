

# Improved Plan: Custom Editing Prompts for the Scribe

## Summary of Improvements

After reviewing the existing codebase, I've identified several enhancements to make the custom editing rules feature more powerful, user-friendly, and robust.

---

## Key Improvements Over Original Plan

### 1. Rule Templates / Presets
**Original**: Users type free-form rules only
**Improved**: Add a dropdown of common editing rule templates to speed up usage

Templates include:
- "Replace [word] with [word]" - Word substitution
- "Remove all instances of [word/phrase]" - Deletion
- "Change [name] to [name]" - Character renaming
- "Convert profanity to [style]" - Content filtering
- "Adjust tone to be more [adjective]" - Tone shifting

This reduces cognitive load and shows users what's possible.

### 2. Rule Categories with Icons
**Original**: Flat list of text rules
**Improved**: Categorized rules with visual indicators

| Category | Icon | Example |
|----------|------|---------|
| Replacement | `Replace` | "Replace 'ozone' with 'aether'" |
| Removal | `Trash2` | "Remove modern slang" |
| Style | `Palette` | "Make dialogue more formal" |
| Character | `User` | "Rename 'Bob' to 'Archmage Robert'" |

Visual scanning becomes faster, and users understand rule types at a glance.

### 3. Rule Priority / Ordering
**Original**: Rules applied in undefined order
**Improved**: Drag-to-reorder capability with explicit ordering

- Rules are numbered and applied in order
- Users can drag to reorder (using `dnd-kit` or simple up/down arrows)
- The AI prompt clearly states "Apply these rules in order"
- Edge cases like conflicting rules are handled by order

### 4. Rule Validation with Preview
**Original**: Rules validated only at edge function
**Improved**: Client-side validation with live feedback

- Warn if rule is too vague: "This rule might be too general"
- Highlight potential conflicts: "Rule 2 might conflict with Rule 1"
- Show estimated impact: "This will likely affect ~15% of text"
- Test button to show a sample transformation before full processing

### 5. Save/Load Rule Sets
**Original**: Rules are session-only
**Improved**: Persist rule sets to localStorage with names

```typescript
interface RuleSet {
  id: string;
  name: string;          // "My Fantasy Cleanup Rules"
  rules: EditingRule[];
  createdAt: string;
  lastUsed: string;
}
```

Users can:
- Save current rules as a named set
- Load previously saved rule sets
- Share rule sets by export/import (JSON)

### 6. Scope-Limited Rules
**Original**: Rules apply globally to all text
**Improved**: Optional scope limiters

```typescript
interface EditingRule {
  id: string;
  type: 'replace' | 'remove' | 'style' | 'character' | 'custom';
  instruction: string;
  scope?: 'dialogue' | 'narration' | 'combat' | 'all';  // NEW
}
```

Example: "Only in dialogue: change 'gonna' to 'going to'"

### 7. Enhanced Security Measures
**Original**: Basic sanitization with redaction
**Improved**: Multi-layer validation

- **Client-side**: Block obvious injection patterns before send
- **Edge function**: Existing sanitization + length limits
- **Prompt structure**: Rules wrapped in XML-like tags to isolate them
- **Rate limiting**: Max 3 rules per request for first-time users

Prompt structure with isolation:
```text
<user_editing_rules>
1. Replace 'ozone' with 'aether'
2. Remove modern slang
</user_editing_rules>

Apply each rule strictly as stated. Do not interpret beyond the literal instruction.
```

---

## Revised Technical Architecture

### Data Structures

```typescript
// src/lib/scribe/editingRules.ts (NEW)

export interface EditingRule {
  id: string;
  type: 'replace' | 'remove' | 'style' | 'character' | 'custom';
  instruction: string;
  scope: 'dialogue' | 'narration' | 'combat' | 'all';
  isValid: boolean;
  validationWarning?: string;
}

export interface RuleSet {
  id: string;
  name: string;
  rules: EditingRule[];
  createdAt: string;
  lastUsed: string;
}

export const RULE_TEMPLATES = [
  { type: 'replace', template: "Replace '[from]' with '[to]'" },
  { type: 'remove', template: "Remove all instances of '[word]'" },
  { type: 'character', template: "Rename '[oldName]' to '[newName]'" },
  { type: 'style', template: "Make the tone more [adjective]" },
] as const;

export function validateRule(rule: EditingRule): EditingRule;
export function serializeRulesForPrompt(rules: EditingRule[]): string;
```

### Updated Request Body

```typescript
interface RequestBody {
  text: string;
  characterName?: string;
  style?: string;
  smartParseEnabled?: boolean;
  customEditingRules?: Array<{      // NEW - structured rules
    type: string;
    instruction: string;
    scope: string;
  }>;
}
```

### Prompt Injection Format

```typescript
// In narrative-forge/index.ts
if (customEditingRules?.length > 0) {
  const rulesSection = customEditingRules.map((r, i) => 
    `${i + 1}. [${r.scope.toUpperCase()}] ${r.instruction}`
  ).join('\n');
  
  systemPrompt += `

<user_editing_rules>
Apply these specific editing rules during transformation:
${rulesSection}

Important: Apply each rule exactly as stated. Do not creatively interpret or extend the rules.
</user_editing_rules>`;
}
```

---

## Updated UI Design

```text
+-------------------------------------------------------------+
| ⚙️ CUSTOM EDITING RULES                            [?] Help |
+-------------------------------------------------------------+
| 📋 Load Saved Set: [ Select a rule set...          ▾]       |
+-------------------------------------------------------------+
|                                                              |
| [+ Add Rule]  [📝 From Template ▾]                           |
|                                                              |
| ┌─ 1. 🔄 Replace ──────────────────────────────────── [≡] ─┐ |
| │  Replace 'ozone' with 'aether'                           │ |
| │  Scope: [All Text ▾]                        [Edit] [X]   │ |
| └──────────────────────────────────────────────────────────┘ |
|                                                              |
| ┌─ 2. 🗑️ Remove ───────────────────────────────────── [≡] ─┐ |
| │  Remove modern slang and profanity                       │ |
| │  Scope: [Dialogue ▾]                        [Edit] [X]   │ |
| │  ⚠️ Vague rule - consider being more specific            │ |
| └──────────────────────────────────────────────────────────┘ |
|                                                              |
| ┌─ 3. 👤 Character ────────────────────────────────── [≡] ─┐ |
| │  Rename 'Bob' to 'Archmage Robert'                       │ |
| │  Scope: [All Text ▾]                        [Edit] [X]   │ |
| └──────────────────────────────────────────────────────────┘ |
|                                                              |
| [Test Rules on Sample]     [Save as Rule Set...]            |
+-------------------------------------------------------------+
```

**UI Features:**
- Drag handles (`≡`) for reordering
- Visual icons per rule type
- Inline scope selector dropdown
- Validation warnings shown inline
- Quick-add via template dropdown

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/scribe/editingRules.ts` | CREATE | Rule types, templates, validation, serialization |
| `src/components/scribe/EditingRulesEditor.tsx` | CREATE | Main rule management component with all UI |
| `src/hooks/use-editing-rules.ts` | CREATE | Hook for rule state, localStorage persistence |
| `src/components/scribe/NarrativeForgeScreen.tsx` | MODIFY | Import and render EditingRulesEditor in options |
| `src/hooks/use-campaign-processor.ts` | MODIFY | Add `customEditingRules` to processing params |
| `supabase/functions/narrative-forge/index.ts` | MODIFY | Accept/validate rules, append to system prompt |

---

## Validation Rules

| Check | Action |
|-------|--------|
| Rule length > 200 chars | Reject with error |
| More than 10 rules | Reject with error |
| Contains injection patterns | Sanitize with `[REDACTED]` |
| Rule too vague (< 5 words) | Show warning, allow |
| Duplicate rules | Show warning, allow |
| Empty instruction | Reject with error |

---

## Testing Criteria

1. Add a replacement rule, process text → word is replaced
2. Add a removal rule → specified content is removed
3. Add 10 rules → all apply in order
4. Try to add 11th rule → blocked with message
5. Reorder rules → order is preserved in processing
6. Save rule set → persists after page refresh
7. Load rule set → rules populate correctly
8. Test injection pattern → shows `[REDACTED]` in preview
9. Use scope limiter → rule only applies to specified sections
10. Offline mode → rules are hidden (not applicable)

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Rules conflict (replace A→B, replace B→A) | Apply in order; user can reorder |
| Rule affects character name in prompt | Character name applied after rules |
| Very long rule text | Truncate with ellipsis in UI, full text in tooltip |
| User tries rules in offline mode | Hide rules section, show "AI mode only" note |
| Saved progress with rules | Include rules in localStorage snapshot |

---

## Implementation Phases

### Phase 1: Core Functionality
- Create `editingRules.ts` with types and templates
- Create `EditingRulesEditor.tsx` component
- Add to `NarrativeForgeScreen.tsx`
- Update edge function to accept and apply rules

### Phase 2: Enhanced UX
- Add rule reordering
- Add templates dropdown
- Add validation warnings
- Add scope selector

### Phase 3: Persistence
- Create `use-editing-rules.ts` hook
- Add save/load rule sets to localStorage
- Add export/import as JSON

