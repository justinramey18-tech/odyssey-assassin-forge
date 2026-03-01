import { useState, useCallback } from 'react';
import { Key, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { loadApiKey, saveApiKey, clearApiKey, hasApiKey, maskKey } from '@/lib/api-keys';
import { loadNarrationSpeed, saveNarrationSpeed, loadTTSProvider, saveTTSProvider, loadSpeechifyVoiceId, saveSpeechifyVoiceId, type TTSProvider } from '@/lib/tts-utils';
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

const SPEECHIFY_VOICES = [
  { id: 'george', name: 'George', description: 'Warm male narrator' },
  { id: 'henry', name: 'Henry', description: 'British male' },
  { id: 'mrbeast', name: 'MrBeast', description: 'Energetic male' },
  { id: 'snoop', name: 'Snoop Dogg', description: 'Smooth male' },
  { id: 'gwyneth', name: 'Gwyneth', description: 'Warm female' },
  { id: 'simba', name: 'Simba', description: 'Young male' },
  { id: 'lisa', name: 'Lisa', description: 'Professional female' },
  { id: 'oliver', name: 'Oliver', description: 'Clear male' },
];

function TTSProviderSelector() {
  const [provider, setProvider] = useState<TTSProvider>(() => loadTTSProvider());
  const hasEL = hasApiKey('elevenlabs');
  const hasSP = hasApiKey('speechify');

  const handleSelect = useCallback((p: TTSProvider) => {
    setProvider(p);
    saveTTSProvider(p);
    toast.success(`TTS engine switched to ${p === 'elevenlabs' ? 'ElevenLabs' : 'Speechify'}`);
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Choose which TTS engine powers narration. You need an API key for the selected engine.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleSelect('elevenlabs')}
          className={`p-3 rounded-lg border text-left transition-colors ${
            provider === 'elevenlabs'
              ? 'border-primary/50 bg-primary/10'
              : 'border-border/50 bg-muted/20 hover:border-border'
          }`}
        >
          <p className="text-xs font-medium text-foreground">ElevenLabs</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">High-quality voices</p>
          {!hasEL && <p className="text-[10px] text-amber-400 mt-1">No key set</p>}
        </button>
        <button
          onClick={() => handleSelect('speechify')}
          className={`p-3 rounded-lg border text-left transition-colors ${
            provider === 'speechify'
              ? 'border-primary/50 bg-primary/10'
              : 'border-border/50 bg-muted/20 hover:border-border'
          }`}
        >
          <p className="text-xs font-medium text-foreground">Speechify</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Fast & natural</p>
          {!hasSP && <p className="text-[10px] text-amber-400 mt-1">No key set</p>}
        </button>
      </div>
    </div>
  );
}

function SpeechifyVoicePicker() {
  const [selected, setSelected] = useState(() => loadSpeechifyVoiceId());

  const handleSelect = useCallback((id: string) => {
    setSelected(id);
    saveSpeechifyVoiceId(id);
    toast.success('Speechify voice updated');
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Select a Speechify narrator voice. You can also use custom voice IDs from your Speechify account.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {SPEECHIFY_VOICES.map((v) => (
          <button
            key={v.id}
            onClick={() => handleSelect(v.id)}
            className={`p-2 rounded-md border text-left transition-colors ${
              selected === v.id
                ? 'border-primary/50 bg-primary/10'
                : 'border-border/30 bg-muted/10 hover:border-border/50'
            }`}
          >
            <p className="text-xs font-medium text-foreground">{v.name}</p>
            <p className="text-[10px] text-muted-foreground">{v.description}</p>
          </button>
        ))}
      </div>
      <div className="pt-1">
        <label className="text-[10px] text-muted-foreground">Custom Voice ID</label>
        <Input
          placeholder="Enter Speechify voice ID..."
          className="h-7 text-xs font-mono mt-1"
          defaultValue={!SPEECHIFY_VOICES.some(v => v.id === selected) ? selected : ''}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val) handleSelect(val);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val) handleSelect(val);
            }
          }}
        />
      </div>
    </div>
  );
}

export function ElevenLabsSettingsTab() {
  const hasElKey = hasApiKey('elevenlabs');
  const hasSpKey = hasApiKey('speechify');
  const provider = loadTTSProvider();

  return (
    <div className="flex-1 overflow-y-auto max-h-[70vh]">
      <div className="space-y-3 pb-6">
        <SettingsSection title="TTS Engine" defaultOpen>
          <TTSProviderSelector />
        </SettingsSection>

        {provider === 'elevenlabs' && (
          <>
            <SettingsSection title="ElevenLabs API Key" defaultOpen>
              <ElevenLabsApiKeyInput />
            </SettingsSection>

            <SettingsSection title="Narrator Voice">
              {hasElKey ? (
                <ElevenLabsVoicePicker />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add your ElevenLabs API key above to select a narrator voice.
                </p>
              )}
            </SettingsSection>

            <SettingsSection title="Voice Tuning">
              {hasElKey ? (
                <VoiceTuningWidget />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add your ElevenLabs API key above to tune voice settings.
                </p>
              )}
            </SettingsSection>

            <SettingsSection title="Sound Effects">
              {hasElKey ? (
                <SoundEffectsWidget />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add your ElevenLabs API key above to enable sound effects.
                </p>
              )}
            </SettingsSection>
          </>
        )}

        {provider === 'speechify' && (
          <>
            <SettingsSection title="Speechify Voice" defaultOpen>
              {hasSpKey ? (
                <SpeechifyVoicePicker />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add your Speechify API key in Settings → API Keys to select a voice.
                </p>
              )}
            </SettingsSection>
          </>
        )}

        <SettingsSection title="Narration Speed">
          <NarrationSpeedSlider />
        </SettingsSection>
      </div>
    </div>
  );
}
