import { Blend } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NARRATIVE_STYLES, formatStyleName, BlendConfig } from '@/lib/scribe/processingTemplates';

interface StyleBlendControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  primaryStyle: string;
  blendConfig: BlendConfig | undefined;
  onBlendConfigChange: (config: BlendConfig | undefined) => void;
}

export function StyleBlendControls({
  enabled,
  onEnabledChange,
  primaryStyle,
  blendConfig,
  onBlendConfigChange,
}: StyleBlendControlsProps) {
  const secondaryStyle = blendConfig?.secondaryStyle || 'noir';
  const ratio = blendConfig?.ratio || 30;
  const primaryRatio = 100 - ratio;

  const handleToggle = (checked: boolean) => {
    onEnabledChange(checked);
    if (checked && !blendConfig) {
      // Initialize blend config with defaults
      const defaultSecondary = primaryStyle === 'noir' ? 'fantasy' : 'noir';
      onBlendConfigChange({ secondaryStyle: defaultSecondary, ratio: 30 });
    } else if (!checked) {
      onBlendConfigChange(undefined);
    }
  };

  const handleSecondaryStyleChange = (value: string) => {
    onBlendConfigChange({ secondaryStyle: value, ratio });
  };

  const handleRatioChange = (value: number[]) => {
    onBlendConfigChange({ secondaryStyle, ratio: value[0] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="styleBlend" className="text-sm cursor-pointer flex items-center gap-2">
            <Blend className="w-3.5 h-3.5 text-purple-400" />
            Blend Styles
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {enabled 
              ? `${primaryRatio}% ${formatStyleName(primaryStyle)} + ${ratio}% ${formatStyleName(secondaryStyle)}` 
              : 'Combine two narrative styles for a unique blend'}
          </p>
        </div>
        <Switch 
          id="styleBlend"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {enabled && (
        <div className="pl-5 border-l-2 border-primary/30 space-y-3">
          {/* Secondary Style Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Secondary Style</Label>
            <Select value={secondaryStyle} onValueChange={handleSecondaryStyleChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NARRATIVE_STYLES
                  .filter(s => s.value !== primaryStyle)
                  .map(style => (
                    <SelectItem key={style.value} value={style.value}>
                      <span className="font-medium">{style.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">— {style.description}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Blend Ratio Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatStyleName(primaryStyle)} ({primaryRatio}%)</span>
              <span>{formatStyleName(secondaryStyle)} ({ratio}%)</span>
            </div>
            <Slider
              value={[ratio]}
              onValueChange={handleRatioChange}
              min={10}
              max={50}
              step={5}
              className="py-2"
            />
          </div>
        </div>
      )}
    </div>
  );
}
