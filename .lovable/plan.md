

## Fix: Pass Druid Circle (Subclass) to Oracle

### Problem
The Oracle's `CharacterContext` has no field for subclass/druid circle. When the Oracle builds its system prompt, it only knows the character is a "druid" but not which circle they belong to. So it can't give Circle of the Moon-specific advice.

### Changes

**1. `src/components/oracle/types.ts`**
- Add `subclass?: string` field to `CharacterContext` (generic enough for all classes — druid circles, cleric domains, warlock patrons, etc.)

**2. `src/components/oracle/OracleDrawer.tsx`**
- Accept a new `subclass?: string` prop
- Pass it into the built `CharacterContext` as `subclass`

**3. `src/pages/Index.tsx`**
- Read the druid circle (already in reactive `druidCircle` state) and cleric domain from scoped storage
- Map to a human-readable subclass string (e.g. `'moon'` → `'Circle of the Moon'`)
- Pass as `subclass` prop to `OracleDrawer`

**4. `supabase/functions/oracle-assistant/index.ts`**
- In the system prompt builder, include the subclass when present (e.g. "Level 8 Circle of the Moon Druid")

This is a small data-plumbing fix — the Oracle already handles class context dynamically, it just needs the subclass field threaded through.

