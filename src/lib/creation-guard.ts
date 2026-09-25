export const PENDING_AI_CHARACTER_KEY = 'odyssey-pending-ai-character';
export const AI_CREATION_DRAFT_KEY = 'odyssey-ai-creation-draft';

const WIZARD_OPEN_KEY = 'odyssey-wizard-open';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingAiCharacter { wizardState: unknown; createdAt: number }

export function savePendingAiCharacter(wizardState: unknown): void {
  try { localStorage.setItem(PENDING_AI_CHARACTER_KEY, JSON.stringify({ wizardState, createdAt: Date.now() })); } catch { /* storage full or blocked */ }
}

export function readPendingAiCharacter(): PendingAiCharacter | null {
  try {
    const raw = localStorage.getItem(PENDING_AI_CHARACTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAiCharacter;
    if (!parsed?.wizardState || typeof parsed.createdAt !== 'number' || Date.now() - parsed.createdAt > MAX_AGE_MS) {
      localStorage.removeItem(PENDING_AI_CHARACTER_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function clearPendingAiCharacter(): void {
  try { localStorage.removeItem(PENDING_AI_CHARACTER_KEY); localStorage.removeItem(AI_CREATION_DRAFT_KEY); } catch { /* ignore */ }
}

export function setWizardOpen(open: boolean): void {
  try { if (open) sessionStorage.setItem(WIZARD_OPEN_KEY, '1'); else sessionStorage.removeItem(WIZARD_OPEN_KEY); } catch { /* ignore */ }
}

/** True while a player is creating a character. The app must not reload itself then. */
export function isCreationInProgress(): boolean {
  try {
    if (window.location.pathname.startsWith('/ai-create')) return true;
    if (sessionStorage.getItem(WIZARD_OPEN_KEY) === '1') return true;
    return !!localStorage.getItem(PENDING_AI_CHARACTER_KEY) || !!localStorage.getItem(AI_CREATION_DRAFT_KEY);
  } catch { return false; }
}
