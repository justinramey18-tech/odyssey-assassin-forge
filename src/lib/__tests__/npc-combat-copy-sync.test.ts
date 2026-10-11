import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// npc-combat deploys alone, so it carries copies of these npc-reply files. They must stay identical.
describe('npc-combat copies of npc-reply files', () => {
  for (const f of ['handler.ts', 'models.ts', 'repo.ts', 'prompt.ts']) {
    it(`${f} matches npc-reply`, () => {
      const a = readFileSync(`supabase/functions/npc-reply/${f}`, 'utf8');
      const b = readFileSync(`supabase/functions/npc-combat/npc-reply/${f}`, 'utf8');
      expect(b).toBe(a);
    });
  }
});
