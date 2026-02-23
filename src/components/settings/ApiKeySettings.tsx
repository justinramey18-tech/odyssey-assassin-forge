import { useState, useCallback } from 'react';
import { Key, Eye, EyeOff, ChevronDown, ChevronUp, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { loadApiKey, saveApiKey, clearApiKey, hasApiKey, maskKey } from '@/lib/api-keys';

export function ApiKeySettings() {
  const [expanded, setExpanded] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(() => hasApiKey('anthropic'));

  const handleSave = useCallback(() => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      toast.error('Please enter an API key');
      return;
    }
    saveApiKey('anthropic', trimmed);
    setHasSavedKey(true);
    setKeyInput('');
    setShowKey(false);
    toast.success('Anthropic API key saved');
  }, [keyInput]);

  const handleClear = useCallback(() => {
    clearApiKey('anthropic');
    setHasSavedKey(false);
    setKeyInput('');
    toast.success('Anthropic API key removed');
  }, []);

  const savedKey = loadApiKey('anthropic');

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20">
      <button
        className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/40 rounded-lg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          API Keys
          {hasSavedKey && <Check className="w-3.5 h-3.5 text-green-500" />}
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
            Add your own API key to use Claude models directly. Your key is stored locally in your browser and sent to the API at request time. It is never stored on our servers.
          </p>

          {/* Anthropic key */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Anthropic API Key
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
                    placeholder="sk-ant-..."
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
        </div>
      )}
    </div>
  );
}
