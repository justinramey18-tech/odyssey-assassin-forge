import { useState, useCallback } from 'react';
import { Key, Eye, EyeOff, ChevronDown, ChevronUp, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { loadApiKey, saveApiKey, clearApiKey, hasApiKey, maskKey } from '@/lib/api-keys';
import { ElevenLabsVoicePicker } from './ElevenLabsVoicePicker';

function ApiKeyInput({ provider, label, placeholder }: { provider: 'anthropic' | 'elevenlabs'; label: string; placeholder: string }) {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(() => hasApiKey(provider));

  const handleSave = useCallback(() => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      toast.error('Please enter an API key');
      return;
    }
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
    toast.success(`${label} removed`);
  }, [provider, label]);

  const savedKey = loadApiKey(provider);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>

      {hasSavedKey && savedKey ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-1.5 rounded-md border border-green-500/30 bg-green-500/5 text-xs font-mono text-green-400 truncate">
            {maskKey(savedKey)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
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
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowKey(!showKey)}
              tabIndex={-1}
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={handleSave}
            disabled={!keyInput.trim()}
          >
            <Key className="w-3 h-3" />
            Save Key
          </Button>
        </div>
      )}
    </div>
  );
}

export function ApiKeySettings() {
  const [expanded, setExpanded] = useState(false);
  const hasAnthropicKey = hasApiKey('anthropic');
  const hasElevenLabsKey = hasApiKey('elevenlabs');
  const hasAnyKey = hasAnthropicKey || hasElevenLabsKey;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20">
      <button
        className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/40 rounded-lg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          API Keys
          {hasAnyKey && <Check className="w-3.5 h-3.5 text-green-500" />}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          <Separator />

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Add your own API keys to use additional features. Keys are stored locally in your browser and never on our servers.
          </p>

          {/* Anthropic key */}
          <ApiKeyInput
            provider="anthropic"
            label="Anthropic API Key"
            placeholder="sk-ant-..."
          />

          <Separator />

          {/* ElevenLabs key */}
          <ApiKeyInput
            provider="elevenlabs"
            label="ElevenLabs API Key"
            placeholder="sk_..."
          />

          {/* Voice picker — only show when ElevenLabs key is saved */}
          {hasApiKey('elevenlabs') && (
            <ElevenLabsVoicePicker />
          )}
        </div>
      )}
    </div>
  );
}
