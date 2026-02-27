import { useState, useCallback } from 'react';
import { Key, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { loadApiKey, saveApiKey, clearApiKey, hasApiKey, maskKey } from '@/lib/api-keys';
import { loadNarrationSpeed, saveNarrationSpeed } from '@/lib/tts-utils';
import { ElevenLabsVoicePicker } from './ElevenLabsVoicePicker';
import { VoiceTuningWidget } from './VoiceTuningWidget';
import { SoundEffectsWidget } from './SoundEffectsWidget';
import { SettingsSection } from './SettingsSection';

function ElevenLabsApiKeyInput() {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(() => hasApiKey('elevenlabs'));

  const handleSave = useCallback(() => {
    const trimmed = keyInput.trim();
    if (!trimmed) { toast.error('Please enter an API key'); return; }
    saveApiKey('elevenlabs', trimmed);
    setHasSavedKey(true);
    setKeyInput('');
    setShowKey(false);
    toast.success('ElevenLabs API Key saved');
  }, [keyInput]);

  const handleClear = useCallback(() => {
    clearApiKey('elevenlabs');
    setHasSavedKey(false);
    setKeyInput('');
    toast.success('ElevenLabs API Key removed');
  }, []);

  const savedKey = loadApiKey('elevenlabs');

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Your ElevenLabs API key enables AI narration, voice selection, and sound effects. Stored locally in your browser only.
      </p>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">ElevenLabs API Key</label>
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
                placeholder="sk_..."
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
    </div>
  );
}

function NarrationSpeedSlider() {
  const [speed, setSpeed] = useState(() => loadNarrationSpeed());

  const handleChange = useCallback((value: number[]) => {
    const newSpeed = Math.round(value[0] * 10) / 10;
    setSpeed(newSpeed);
    saveNarrationSpeed(newSpeed);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Narration Speed</label>
        <span className="text-xs font-mono text-foreground">{speed.toFixed(1)}x</span>
      </div>
      <Slider min={0.5} max={2.0} step={0.1} value={[speed]} onValueChange={handleChange} className="w-full" />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0.5x Slow</span>
        <span>1.0x Normal</span>
        <span>2.0x Fast</span>
      </div>
    </div>
  );
}

export function ElevenLabsSettingsTab() {
  const hasKey = hasApiKey('elevenlabs');

  return (
    <div className="flex-1 overflow-y-auto max-h-[70vh]">
      <div className="space-y-3 pb-6">
        <SettingsSection title="API Key" defaultOpen>
          <ElevenLabsApiKeyInput />
        </SettingsSection>

        <SettingsSection title="Narrator Voice">
          {hasKey ? (
            <ElevenLabsVoicePicker />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add your ElevenLabs API key above to select a narrator voice.
            </p>
          )}
        </SettingsSection>

        <SettingsSection title="Narration Speed">
          <NarrationSpeedSlider />
        </SettingsSection>

        <SettingsSection title="Voice Tuning">
          {hasKey ? (
            <VoiceTuningWidget />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add your ElevenLabs API key above to tune voice settings.
            </p>
          )}
        </SettingsSection>

        <SettingsSection title="Sound Effects">
          {hasKey ? (
            <SoundEffectsWidget />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add your ElevenLabs API key above to enable sound effects.
            </p>
          )}
        </SettingsSection>
      </div>
    </div>
  );
}
