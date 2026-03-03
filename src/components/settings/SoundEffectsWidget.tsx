import { useState, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const SFX_ENABLED_KEY = 'dnd-elevenlabs-sfx-enabled';
const SFX_STYLE_KEY = 'dnd-elevenlabs-sfx-style';
const CONTEXT_SFX_ENABLED_KEY = 'dnd-elevenlabs-context-sfx-enabled';
const DEFAULT_SFX_STYLE = 'dark fantasy dungeon ambiance';

function loadSfxEnabled(): boolean {
  try {
    return localStorage.getItem(SFX_ENABLED_KEY) === 'true';
  } catch { return false; }
}

function saveSfxEnabled(enabled: boolean): void {
  try { localStorage.setItem(SFX_ENABLED_KEY, String(enabled)); } catch {}
}

export function loadSfxStyle(): string {
  try {
    return localStorage.getItem(SFX_STYLE_KEY) || DEFAULT_SFX_STYLE;
  } catch { return DEFAULT_SFX_STYLE; }
}

function saveSfxStyle(style: string): void {
  try { localStorage.setItem(SFX_STYLE_KEY, style); } catch {}
}

export function isSfxEnabled(): boolean {
  return loadSfxEnabled();
}

function loadContextSfxEnabled(): boolean {
  try {
    return localStorage.getItem(CONTEXT_SFX_ENABLED_KEY) === 'true';
  } catch { return false; }
}

function saveContextSfxEnabled(enabled: boolean): void {
  try { localStorage.setItem(CONTEXT_SFX_ENABLED_KEY, String(enabled)); } catch {}
}

export function isContextSfxEnabled(): boolean {
  return loadContextSfxEnabled();
}

const STYLE_PRESETS = [
  'dark fantasy dungeon ambiance',
  'tavern with crackling fireplace',
  'enchanted forest with wind',
  'epic battle horns and drums',
  'mystical cave with water drips',
  'stormy sea with thunder',
];

export function SoundEffectsWidget() {
  const [enabled, setEnabled] = useState(() => loadSfxEnabled());
  const [contextEnabled, setContextEnabled] = useState(() => loadContextSfxEnabled());
  const [style, setStyle] = useState(() => loadSfxStyle());

  const handleToggle = useCallback((checked: boolean) => {
    setEnabled(checked);
    saveSfxEnabled(checked);
    toast.success(checked ? 'Ambient SFX enabled' : 'Ambient SFX disabled');
  }, []);

  const handleContextToggle = useCallback((checked: boolean) => {
    setContextEnabled(checked);
    saveContextSfxEnabled(checked);
    toast.success(checked ? 'Context-aware SFX enabled' : 'Context-aware SFX disabled');
  }, []);

  const handleStyleChange = useCallback((value: string) => {
    setStyle(value);
    saveSfxStyle(value);
  }, []);

  const handlePresetClick = useCallback((preset: string) => {
    setStyle(preset);
    saveSfxStyle(preset);
    toast.success('Style preset applied');
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Generate ambient sound effects during narration using ElevenLabs SFX. Effects play alongside the narrator voice.
      </p>

      {/* Master Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20">
        <div>
          <p className="text-xs font-medium text-foreground">Enable Ambient SFX</p>
          <p className="text-[10px] text-muted-foreground">Auto-generate sound effects during narration</p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      {enabled && (
        <>
          {/* Context-Aware Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div>
              <p className="text-xs font-medium text-foreground">Context-Aware SFX</p>
              <p className="text-[10px] text-muted-foreground">AI analyzes narrative to generate scene-appropriate sounds</p>
            </div>
            <Switch checked={contextEnabled} onCheckedChange={handleContextToggle} />
          </div>

          {/* Custom Style Prompt — fallback when context-aware is off */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {contextEnabled ? 'Fallback SFX Style' : 'SFX Style Prompt'}
            </label>
            {contextEnabled && (
              <p className="text-[10px] text-muted-foreground/70 italic">
                Used only when context analysis is unavailable
              </p>
            )}
            <Input
              value={style}
              onChange={(e) => handleStyleChange(e.target.value)}
              placeholder="Describe the ambient sound style..."
              className="h-8 text-sm"
            />
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Quick Presets</label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                    style === preset
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
