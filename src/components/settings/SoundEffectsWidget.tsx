import { useState, useCallback, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, Trash2, Music, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  loadSfxMode, saveSfxMode, SfxMode,
  loadCustomSfxUrl, uploadCustomSfx, deleteCustomSfx,
} from '@/lib/custom-sfx';

const SFX_ENABLED_KEY = 'dnd-elevenlabs-sfx-enabled';
const SFX_STYLE_KEY = 'dnd-elevenlabs-sfx-style';
const DEFAULT_SFX_STYLE = 'dark fantasy dungeon ambiance';

function loadSfxEnabled(): boolean {
  try { return localStorage.getItem(SFX_ENABLED_KEY) === 'true'; } catch { return false; }
}
function saveSfxEnabled(enabled: boolean): void {
  try { localStorage.setItem(SFX_ENABLED_KEY, String(enabled)); } catch {}
}

export function loadSfxStyle(): string {
  try { return localStorage.getItem(SFX_STYLE_KEY) || DEFAULT_SFX_STYLE; } catch { return DEFAULT_SFX_STYLE; }
}
function saveSfxStyle(style: string): void {
  try { localStorage.setItem(SFX_STYLE_KEY, style); } catch {}
}

export function isSfxEnabled(): boolean { return loadSfxEnabled(); }

export function isContextSfxEnabled(): boolean {
  return loadSfxMode() === 'context';
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
  const [mode, setMode] = useState<SfxMode>(() => loadSfxMode());
  const [style, setStyle] = useState(() => loadSfxStyle());
  const [hasCustomFile, setHasCustomFile] = useState(() => !!loadCustomSfxUrl());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggle = useCallback((checked: boolean) => {
    setEnabled(checked);
    saveSfxEnabled(checked);
    toast.success(checked ? 'Ambient SFX enabled' : 'Ambient SFX disabled');
  }, []);

  const handleModeChange = useCallback((newMode: SfxMode) => {
    setMode(newMode);
    saveSfxMode(newMode);
    // Sync old context toggle for backward compat
    try { localStorage.setItem('dnd-elevenlabs-context-sfx-enabled', String(newMode === 'context')); } catch {}
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

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadCustomSfx(file);
      setHasCustomFile(true);
      toast.success('Custom SFX uploaded!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const handleDeleteCustom = useCallback(async () => {
    await deleteCustomSfx();
    setHasCustomFile(false);
    if (mode === 'custom') {
      handleModeChange('static');
    }
    toast.success('Custom SFX removed');
  }, [mode, handleModeChange]);

  const modeOptions: { value: SfxMode; label: string; desc: string }[] = [
    { value: 'static', label: 'Style Preset', desc: 'Use a text prompt to generate SFX' },
    { value: 'context', label: 'Context-Aware', desc: 'AI analyzes narrative for scene sounds' },
    { value: 'custom', label: 'Custom Upload', desc: 'Play your own audio file' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Generate or play ambient sound effects during narration. Effects play alongside the narrator voice.
      </p>

      {/* Master Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20">
        <div>
          <p className="text-xs font-medium text-foreground">Enable Ambient SFX</p>
          <p className="text-[10px] text-muted-foreground">Sound effects during narration</p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      {enabled && (
        <>
          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">SFX Mode</label>
            <div className="grid grid-cols-3 gap-1.5">
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (opt.value === 'custom' && !hasCustomFile) {
                      fileInputRef.current?.click();
                      return;
                    }
                    handleModeChange(opt.value);
                  }}
                  className={cn(
                    'px-2 py-2 rounded-lg text-center border transition-colors',
                    mode === opt.value
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <p className="text-[11px] font-medium">{opt.label}</p>
                  <p className="text-[9px] opacity-70 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Upload Section */}
          {mode === 'custom' && (
            <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,.mp3"
                onChange={handleFileUpload}
                className="hidden"
              />
              {hasCustomFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-primary" />
                    <span className="text-xs text-foreground">Custom SFX loaded</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="text-[10px] px-2 py-1 rounded border border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Replace'}
                    </button>
                    <button
                      onClick={handleDeleteCustom}
                      className="text-[10px] px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-primary/30 text-primary/70 hover:bg-primary/10 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span className="text-xs">Upload MP3 (max 2MB)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Hidden file input for custom mode initial click */}
          {mode !== 'custom' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,.mp3"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setIsUploading(true);
                try {
                  await uploadCustomSfx(file);
                  setHasCustomFile(true);
                  handleModeChange('custom');
                  toast.success('Custom SFX uploaded!');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Upload failed');
                } finally {
                  setIsUploading(false);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }
              }}
              className="hidden"
            />
          )}

          {/* Static Style Prompt */}
          {(mode === 'static' || mode === 'context') && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {mode === 'context' ? 'Fallback SFX Style' : 'SFX Style Prompt'}
                </label>
                {mode === 'context' && (
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

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Quick Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handlePresetClick(preset)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors',
                        style === preset
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
