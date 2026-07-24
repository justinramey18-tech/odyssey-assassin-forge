const STORAGE_KEYS: Record<string, string> = {
  anthropic: 'dnd-anthropic-api-key',
  elevenlabs: 'dnd-elevenlabs-api-key',
  openai: 'dnd-openai-api-key',
  speechify: 'dnd-speechify-api-key',
  perplexity: 'dnd-perplexity-api-key',
  xai: 'dnd-xai-api-key',
};

export type ApiKeyProvider = 'anthropic' | 'elevenlabs' | 'openai' | 'speechify' | 'perplexity' | 'xai';

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
    window.dispatchEvent(new CustomEvent('api-key-changed', { detail: { provider } }));
  } catch (error) {
    console.error(`[API Keys] Failed to save ${provider} key:`, error);
  }
}

export function clearApiKey(provider: ApiKeyProvider): void {
  try {
    localStorage.removeItem(STORAGE_KEYS[provider]);
    window.dispatchEvent(new CustomEvent('api-key-changed', { detail: { provider } }));
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

// ── Local-Only Supporting Features ──────────────────────────────────────────
// When enabled, background "supporting" AI features (memory extraction, story
// summaries, situation/mood detection, cinematic tagging, context SFX) are
// skipped whenever they would otherwise hit the Lovable AI Gateway. This lets
// players who bring their own API keys avoid burning Lovable credits on
// background chores that don't currently accept user-supplied keys.

const SUPPORTING_LOCAL_ONLY_KEY = 'dnd-supporting-local-only';

export function isSupportingLocalOnlyEnabled(): boolean {
  try {
    return localStorage.getItem(SUPPORTING_LOCAL_ONLY_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSupportingLocalOnly(enabled: boolean): void {
  try {
    localStorage.setItem(SUPPORTING_LOCAL_ONLY_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('supporting-local-only-changed', { detail: { enabled } }));
  } catch {
    // ignore
  }
}

// ── Per-Feature Skip Toggles ────────────────────────────────────────────────
// Individual overrides so users can pick which background helpers to skip.
// The master "supporting local only" toggle above still forces-skip everything
// when on; these per-feature toggles let users skip selectively when it's off.

export type SkippableFeature = 'memory' | 'summaries' | 'situation' | 'cinematic' | 'sfx';

const FEATURE_SKIP_KEYS: Record<SkippableFeature, string> = {
  memory:    'dnd-skip-feature-memory',
  summaries: 'dnd-skip-feature-summaries',
  situation: 'dnd-skip-feature-situation',
  cinematic: 'dnd-skip-feature-cinematic',
  sfx:       'dnd-skip-feature-sfx',
};

export function isFeatureSkipEnabled(feature: SkippableFeature): boolean {
  try {
    return localStorage.getItem(FEATURE_SKIP_KEYS[feature]) === 'true';
  } catch {
    return false;
  }
}

export function setFeatureSkipEnabled(feature: SkippableFeature, enabled: boolean): void {
  try {
    localStorage.setItem(FEATURE_SKIP_KEYS[feature], enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('feature-skip-changed', { detail: { feature, enabled } }));
  } catch {
    // ignore
  }
}

/** True if the given background feature should be skipped (master OR per-feature). */
export function isFeatureSkipped(feature: SkippableFeature): boolean {
  return isSupportingLocalOnlyEnabled() || isFeatureSkipEnabled(feature);
}

