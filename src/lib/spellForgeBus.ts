import type { SpellForgeDraft } from '@/components/magic/SpellForgeChat';
import type { HomebrewSpell } from '@/lib/spellCustomization/types';

export type InstallResult = { ok: boolean; message: string };
export type InstallOptions = { replaceId?: string };

type Installer = (draft: SpellForgeDraft, options?: InstallOptions) => Promise<InstallResult>;

let installer: Installer | null = null;

export function registerSpellInstaller(fn: Installer): () => void {
  installer = fn;
  return () => { if (installer === fn) installer = null; };
}

export function hasSpellInstaller(): boolean { return installer !== null; }

export async function installForgedSpell(draft: SpellForgeDraft, options?: InstallOptions): Promise<InstallResult> {
  if (!installer) return { ok: false, message: 'Open your character first, then try again.' };
  try { return await installer(draft, options); } catch (e) { console.error('[spellForge] install failed', e); return { ok: false, message: 'Install failed. Try again.' }; }
}

// Registry that exposes the active character's homebrew spells so the Forge
// can offer "rework one of my spells" on already-installed ones.
let lister: (() => HomebrewSpell[]) | null = null;

export function registerReworkableSpellLister(fn: () => HomebrewSpell[]): () => void {
  lister = fn;
  return () => { if (lister === fn) lister = null; };
}

export function listReworkableSpells(): HomebrewSpell[] {
  try { return lister ? lister() : []; } catch { return []; }
}
