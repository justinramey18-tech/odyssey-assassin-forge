

## Add GM Guides Content to Party DM Oracle

### What changes

The Oracle currently has zero awareness of GM Guides. The host's enabled guides content (`gmGuides.enabledContent`) is already available in `PartyDMScreen.tsx` but is only passed to `usePartyDm` — never to `OraclePanel`. This plan threads it through the full chain.

### Files changed

**1. `src/components/oracle/types.ts`** — Add optional `gmGuidesContent?: string` to `CharacterContext`.

**2. `src/components/oracle/OraclePanel.tsx`** — No changes needed (already passes full `characterContext` to `useOracle`).

**3. `src/hooks/use-oracle.ts`** — Already sends `characterContext` in the request body. No changes needed since we're adding the field to `CharacterContext`.

**4. `src/components/ai-dm/PartyDMScreen.tsx`** — Add `gmGuidesContent` to the `characterContext` spread passed to `OraclePanel` (~line 2008):
```
gmGuidesContent: gmGuides.enabledContent || undefined,
```

**5. `supabase/functions/oracle-assistant/index.ts`** — Two changes:
- Add `gmGuidesContent?: string` to the `CharacterContext` interface
- In `buildContextSummary()`, append a `GM GUIDES` section when `ctx.gmGuidesContent` is present, formatted as:
  ```
  GM GUIDES (use these rules and lore as authoritative context):
  {content}
  ```
  This goes after the existing context sections so the AI treats guide content as world/rules truth when advising the player.

### Data flow
```text
PartyDMScreen
  └─ gmGuides.enabledContent → characterContext.gmGuidesContent
      └─ OraclePanel → useOracle → POST /oracle-assistant
          └─ buildContextSummary() → system prompt includes guides
```

