import { useState, useCallback, useEffect } from 'react';
import { Key, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  loadApiKey, saveApiKey, clearApiKey, hasApiKey, maskKey,
  isClaudeEverywhereEnabled, setClaudeEverywhere,
  isGPTEverywhereEnabled, setGPTEverywhere,
} from '@/lib/api-keys';

function ApiKeyInput({ provider, label, placeholder }: { provider: 'anthropic' | 'elevenlabs' | 'openai' | 'speechify' | 'perplexity' | 'xai'; label: string; placeholder: string }) {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(() => hasApiKey(provider));

  const handleSave = useCallback(() => {
    const trimmed = keyInput.trim();
    if (!trimmed) { toast.error('Please enter an API key'); return; }
    saveApiKey(provider, trimmed);
    setHasSavedKey(true);
    setKeyInput('');
    setShowKey(false);
    toast.success(`${label} saved`);
  }, [keyInput, provider, label]);

  const handleClear = useCallback(() => {
    clearApiKey(provider);
    setHasSavedKey(false);
    setKeyInput('');
    if (provider === 'anthropic' && isClaudeEverywhereEnabled()) {
      setClaudeEverywhere(false);
    }
    if (provider === 'openai' && isGPTEverywhereEnabled()) {
      setGPTEverywhere(false);
    }
    toast.success(`${label} removed`);
  }, [provider, label]);

  const savedKey = loadApiKey(provider);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {hasSavedKey && savedKey ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-1.5 rounded-md border border-green-500/30 bg-green-500/5 text-xs font-mono text-green-400 truncate">
            {maskKey(savedKey)}
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder={placeholder}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="h-8 text-sm pr-8 font-mono"
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(!showKey)} tabIndex={-1}>
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <Button size="sm" className="w-full gap-1.5" onClick={handleSave} disabled={!keyInput.trim()}>
            <Key className="w-3 h-3" />
            Save Key
          </Button>
        </div>
      )}
    </div>
  );
}

function ClaudeEverywhereToggle() {
  const [enabled, setEnabled] = useState(() => isClaudeEverywhereEnabled());
  const hasKey = hasApiKey('anthropic');
  const gptEnabled = isGPTEverywhereEnabled();

  useEffect(() => {
    if (!hasKey && enabled) {
      setEnabled(false);
      setClaudeEverywhere(false);
    }
  }, [hasKey, enabled]);

  // Listen for GPT everywhere changes
  useEffect(() => {
    const handler = () => setEnabled(isClaudeEverywhereEnabled());
    window.addEventListener('claude-everywhere-changed', handler);
    return () => window.removeEventListener('claude-everywhere-changed', handler);
  }, []);

  if (!hasKey) return null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
      <Switch
        checked={enabled}
        disabled={gptEnabled}
        onCheckedChange={(checked) => {
          setEnabled(checked);
          setClaudeEverywhere(checked);
          toast.success(checked ? 'Claude 4.5 Sonnet enabled for all AI features' : 'Reverted to default AI models');
        }}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">Use Claude for all AI features</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
          Routes Oracle, Homebrew, World Builder, Chronicler & more through Claude 4.5 Sonnet using your API key.
          {gptEnabled && <span className="text-amber-400 ml-1">(Disable GPT Everywhere first)</span>}
        </p>
      </div>
    </div>
  );
}

function GPTEverywhereToggle() {
  const [enabled, setEnabled] = useState(() => isGPTEverywhereEnabled());
  const hasKey = hasApiKey('openai');
  const claudeEnabled = isClaudeEverywhereEnabled();

  useEffect(() => {
    if (!hasKey && enabled) {
      setEnabled(false);
      setGPTEverywhere(false);
    }
  }, [hasKey, enabled]);

  // Listen for GPT everywhere changes
  useEffect(() => {
    const handler = () => setEnabled(isGPTEverywhereEnabled());
    window.addEventListener('gpt-everywhere-changed', handler);
    return () => window.removeEventListener('gpt-everywhere-changed', handler);
  }, []);

  if (!hasKey) return null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
      <Switch
        checked={enabled}
        disabled={claudeEnabled}
        onCheckedChange={(checked) => {
          setEnabled(checked);
          setGPTEverywhere(checked);
          toast.success(checked ? 'GPT-5 enabled for all AI features' : 'Reverted to default AI models');
        }}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">Use GPT for all AI features</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
          Routes Oracle, Homebrew, World Builder, Chronicler & more through GPT-5 using your OpenAI key.
          {claudeEnabled && <span className="text-amber-400 ml-1">(Disable Claude Everywhere first)</span>}
        </p>
      </div>
    </div>
  );
}

export function ApiCredentials() {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Keys are stored locally in your browser, never on servers.
      </p>
      <ApiKeyInput provider="anthropic" label="Anthropic API Key" placeholder="sk-ant-..." />
      <ClaudeEverywhereToggle />
      <ApiKeyInput provider="openai" label="OpenAI API Key" placeholder="sk-..." />
      <GPTEverywhereToggle />
      <ApiKeyInput provider="speechify" label="Speechify API Key" placeholder="spfy_..." />
      <ApiKeyInput provider="perplexity" label="Perplexity API Key" placeholder="pplx-..." />
    </div>
  );
}
