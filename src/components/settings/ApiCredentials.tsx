import { useState, useCallback } from 'react';
import { Key, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { loadApiKey, saveApiKey, clearApiKey, hasApiKey, maskKey } from '@/lib/api-keys';

function ApiKeyInput({ provider, label, placeholder }: { provider: 'anthropic' | 'elevenlabs'; label: string; placeholder: string }) {
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

export function ApiCredentials() {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Keys are stored locally in your browser, never on servers.
      </p>
      <ApiKeyInput provider="anthropic" label="Anthropic API Key" placeholder="sk-ant-..." />
    </div>
  );
}
