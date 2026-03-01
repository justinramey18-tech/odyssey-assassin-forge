const STORAGE_KEYS: Record<string, string> = {
  anthropic: 'dnd-anthropic-api-key',
  elevenlabs: 'dnd-elevenlabs-api-key',
  openai: 'dnd-openai-api-key',
  speechify: 'dnd-speechify-api-key',
};

export type ApiKeyProvider = 'anthropic' | 'elevenlabs' | 'openai' | 'speechify';

export function loadApiKey(provider: ApiKeyProvider): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS[provider]) || null;
  } catch {
    return null;
  }
}

export function saveApiKey(provider: ApiKeyProvider, key: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS[provider], key);
  } catch (error) {
    console.error(`[API Keys] Failed to save ${provider} key:`, error);
  }
}

export function clearApiKey(provider: ApiKeyProvider): void {
  try {
    localStorage.removeItem(STORAGE_KEYS[provider]);
  } catch {
    // ignore
  }
}

export function hasApiKey(provider: ApiKeyProvider): boolean {
  return !!loadApiKey(provider);
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 7) + '•••' + key.slice(-4);
}

const CLAUDE_EVERYWHERE_KEY = 'dnd-use-claude-everywhere';

export function isClaudeEverywhereEnabled(): boolean {
  try {
    return localStorage.getItem(CLAUDE_EVERYWHERE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setClaudeEverywhere(enabled: boolean): void {
  try {
    localStorage.setItem(CLAUDE_EVERYWHERE_KEY, enabled ? 'true' : 'false');
    // Disable GPT Everywhere if enabling Claude Everywhere
    if (enabled) localStorage.setItem(GPT_EVERYWHERE_KEY, 'false');
    window.dispatchEvent(new CustomEvent('claude-everywhere-changed', { detail: { enabled } }));
  } catch {
    // ignore
  }
}

/** Returns the user's Anthropic API key if "Claude Everywhere" is enabled, otherwise null */
export function getClaudeEverywhereKey(): string | null {
  if (!isClaudeEverywhereEnabled()) return null;
  return loadApiKey('anthropic');
}

// ── GPT Everywhere ──────────────────────────────────────────────────────────

const GPT_EVERYWHERE_KEY = 'dnd-use-gpt-everywhere';

export function isGPTEverywhereEnabled(): boolean {
  try {
    return localStorage.getItem(GPT_EVERYWHERE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setGPTEverywhere(enabled: boolean): void {
  try {
    localStorage.setItem(GPT_EVERYWHERE_KEY, enabled ? 'true' : 'false');
    // Disable Claude Everywhere if enabling GPT Everywhere
    if (enabled) localStorage.setItem(CLAUDE_EVERYWHERE_KEY, 'false');
    window.dispatchEvent(new CustomEvent('gpt-everywhere-changed', { detail: { enabled } }));
    // Also fire claude event so listeners update
    if (enabled) window.dispatchEvent(new CustomEvent('claude-everywhere-changed', { detail: { enabled: false } }));
  } catch {
    // ignore
  }
}

/** Returns the user's OpenAI API key if "GPT Everywhere" is enabled, otherwise null */
export function getGPTEverywhereKey(): string | null {
  if (!isGPTEverywhereEnabled()) return null;
  return loadApiKey('openai');
}

/** Returns whichever "use everywhere" key is active, or null */
export function getEverywhereKey(): { provider: 'anthropic' | 'openai'; key: string } | null {
  if (isClaudeEverywhereEnabled()) {
    const key = loadApiKey('anthropic');
    if (key) return { provider: 'anthropic', key };
  }
  if (isGPTEverywhereEnabled()) {
    const key = loadApiKey('openai');
    if (key) return { provider: 'openai', key };
  }
  return null;
}
