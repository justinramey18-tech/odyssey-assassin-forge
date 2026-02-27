import { useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { loadVoiceSettings, saveVoiceSettings, DEFAULT_VOICE_SETTINGS, type VoiceSettings } from '@/lib/tts-utils';
import { toast } from 'sonner';

export function VoiceTuningWidget() {
  const [settings, setSettings] = useState<VoiceSettings>(() => loadVoiceSettings());

  const update = useCallback((partial: Partial<VoiceSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      saveVoiceSettings(next);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setSettings(DEFAULT_VOICE_SETTINGS);
    saveVoiceSettings(DEFAULT_VOICE_SETTINGS);
    toast.success('Voice settings reset to defaults');
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Fine-tune how the narrator voice sounds. Changes apply to the next narration.
      </p>

      {/* Stability */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Stability</label>
          <span className="text-xs font-mono text-foreground">{settings.stability.toFixed(2)}</span>
        </div>
        <Slider
          min={0} max={1} step={0.05}
          value={[settings.stability]}
          onValueChange={([v]) => update({ stability: v })}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>More Variable</span>
          <span>More Stable</span>
        </div>
      </div>

      {/* Similarity Boost */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Similarity Boost</label>
          <span className="text-xs font-mono text-foreground">{settings.similarity_boost.toFixed(2)}</span>
        </div>
        <Slider
          min={0} max={1} step={0.05}
          value={[settings.similarity_boost]}
          onValueChange={([v]) => update({ similarity_boost: v })}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Less Similar</span>
          <span>More Similar</span>
        </div>
      </div>

      {/* Style */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Style Exaggeration</label>
          <span className="text-xs font-mono text-foreground">{settings.style.toFixed(2)}</span>
        </div>
        <Slider
          min={0} max={1} step={0.05}
          value={[settings.style]}
          onValueChange={([v]) => update({ style: v })}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Neutral</span>
          <span>Expressive</span>
        </div>
      </div>

      {/* Speaker Boost */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20">
        <div>
          <p className="text-xs font-medium text-foreground">Speaker Boost</p>
          <p className="text-[10px] text-muted-foreground">Enhances clarity and voice fidelity</p>
        </div>
        <Switch
          checked={settings.use_speaker_boost}
          onCheckedChange={(v) => update({ use_speaker_boost: v })}
        />
      </div>

      {/* Reset */}
      <Button variant="ghost" size="sm" onClick={handleReset} className="w-full gap-2 text-muted-foreground hover:text-foreground">
        <RotateCcw className="w-3 h-3" />
        Reset to Defaults
      </Button>
    </div>
  );
}
