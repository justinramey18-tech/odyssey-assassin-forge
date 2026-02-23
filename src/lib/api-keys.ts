const STORAGE_KEYS: Record<string, string> = {
  anthropic: 'dnd-anthropic-api-key',
};

export type ApiKeyProvider = 'anthropic';

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
