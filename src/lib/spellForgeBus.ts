import type { SpellForgeDraft } from '@/components/magic/SpellForgeChat';

export type InstallResult = { ok: boolean; message: string };

type Installer = (draft: SpellForgeDraft) => Promise<InstallResult>;

let installer: Installer | null = null;

export function registerSpellInstaller(fn: Installer): () => void {
  installer = fn;
  return () => { if (installer === fn) installer = null; };
}

export function hasSpellInstaller(): boolean { return installer !== null; }

export async function installForgedSpell(draft: SpellForgeDraft): Promise<InstallResult> {
  if (!installer) return { ok: false, message: 'Open your character first, then try again.' };
  try { return await installer(draft); } catch (e) { console.error('[spellForge] install failed', e); return { ok: false, message: 'Install failed. Try again.' }; }
}
