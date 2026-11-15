// Runs once at app start, right after the account switch and BEFORE the Supabase client and
// React (imported second in main.tsx). See fresh-start.ts.
import { runFreshStart } from './fresh-start';

try {
  const result = runFreshStart(localStorage, typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  if (result.ran) console.log(`[FreshStart] cleared ${result.removed} saved items, kept ${result.kept} (login and keys)`);
} catch (e) {
  console.error('[FreshStart] failed', e);
}
