/**
 * Typed load/save helpers for Scribe & Novel Builder settings.
 * All values are character-scoped via scoped-storage.
 */

import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { DEFAULT_CONTEXT_STATE, type ScribeContextState } from '@/lib/scribe-context';
import type { NarrativeStyle } from '@/lib/narrativeProcessor';

// --- Context pipeline state (JSON) ---

export function saveScribeCtxState(key: string, state: ScribeContextState): void {
  try { setScopedItem(key, JSON.stringify(state)); } catch {}
}

export function loadScribeCtxState(key: string): ScribeContextState {
  try {
    const raw = getScopedItem(key);
    if (raw) return { ...DEFAULT_CONTEXT_STATE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_CONTEXT_STATE };
}

// --- Narrative style ---

export function saveNarrativeStyle(key: string, style: NarrativeStyle): void {
  try { setScopedItem(key, style); } catch {}
}

export function loadNarrativeStyle(key: string, fallback: NarrativeStyle = 'fantasy'): NarrativeStyle {
  try {
    const v = getScopedItem(key);
    if (v) return v as NarrativeStyle;
  } catch {}
  return fallback;
}

// --- Tone intensity ---

export function saveToneIntensity(key: string, val: number): void {
  try { setScopedItem(key, String(val)); } catch {}
}

export function loadToneIntensity(key: string, fallback: number = 3): number {
  try {
    const v = getScopedItem(key);
    if (v) { const n = Number(v); if (!isNaN(n)) return n; }
  } catch {}
  return fallback;
}

// --- Custom style prompt ---

export function saveCustomStylePrompt(val: string): void {
  try { setScopedItem('scribe-custom-style-prompt', val); } catch {}
}

export function loadCustomStylePrompt(): string {
  try { return getScopedItem('scribe-custom-style-prompt') ?? ''; } catch { return ''; }
}

// --- Boolean toggles ---

export function saveToggle(key: string, val: boolean): void {
  try { setScopedItem(key, String(val)); } catch {}
}

export function loadToggle(key: string, fallback: boolean = true): boolean {
  try {
    const v = getScopedItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch {}
  return fallback;
}

// --- Generic string prefs ---

export function saveStringPref(key: string, val: string): void {
  try { setScopedItem(key, val); } catch {}
}

export function loadStringPref(key: string, fallback: string): string {
  try { return getScopedItem(key) ?? fallback; } catch { return fallback; }
}
