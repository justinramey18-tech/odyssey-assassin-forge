import { useState } from 'react';
import { Blend, Sparkles, Plus, X, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  NARRATIVE_STYLES, 
  formatStyleName, 
  BlendConfig,
  BLEND_PRESETS,
  getBlendDescription,
} from '@/lib/scribe/processingTemplates';
import { cn } from '@/lib/utils';

interface StyleBlendControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  primaryStyle: string;
  blendConfig: BlendConfig | undefined;
  onBlendConfigChange: (config: BlendConfig | undefined) => void;
}

// Get color for each style (for gradient visualization)
function getStyleColor(style: string): string {
  const colors: Record<string, string> = {
    fantasy: 'hsl(280, 70%, 50%)',      // Purple
    noir: 'hsl(220, 15%, 30%)',         // Dark gray-blue
    literary: 'hsl(45, 60%, 50%)',      // Gold
    action: 'hsl(0, 70%, 50%)',         // Red
    salvatore: 'hsl(200, 70%, 45%)',    // Steel blue
    deadpool: 'hsl(350, 80%, 55%)',     // Crimson
    dark_comedy: 'hsl(270, 50%, 40%)',  // Dark purple
    subtle_absurdity: 'hsl(180, 40%, 45%)', // Teal
    lovecraftian: 'hsl(260, 60%, 25%)', // Deep purple
    gonzo: 'hsl(30, 80%, 50%)',         // Orange
    hemingway: 'hsl(40, 30%, 45%)',     // Khaki
  };
  return colors[style] || 'hsl(0, 0%, 50%)';
}

export function StyleBlendControls({
  enabled,
  onEnabledChange,
  primaryStyle,
  blendConfig,
  onBlendConfigChange,
}: StyleBlendControlsProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [showTertiary, setShowTertiary] = useState(!!blendConfig?.tertiaryStyle);

  const secondaryStyle = blendConfig?.secondaryStyle || 'noir';
  const ratio = blendConfig?.ratio || 30;
  const tertiaryStyle = blendConfig?.tertiaryStyle;
  const tertiaryRatio = blendConfig?.tertiaryRatio || 10;
  
  // Calculate primary ratio accounting for tertiary
  const primaryRatio = tertiaryStyle 
    ? 100 - ratio - tertiaryRatio 
    : 100 - ratio;

  const handleToggle = (checked: boolean) => {
    onEnabledChange(checked);
    if (checked && !blendConfig) {
      const defaultSecondary = primaryStyle === 'noir' ? 'fantasy' : 'noir';
      onBlendConfigChange({ secondaryStyle: defaultSecondary, ratio: 30 });
    } else if (!checked) {
      onBlendConfigChange(undefined);
      setShowTertiary(false);
    }
  };

  const handleSecondaryStyleChange = (value: string) => {
    onBlendConfigChange({ 
      ...blendConfig,
      secondaryStyle: value, 
      ratio,
      tertiaryStyle: tertiaryStyle === value ? undefined : tertiaryStyle,
      tertiaryRatio: tertiaryStyle === value ? undefined : tertiaryRatio,
    });
  };

  const handleRatioChange = (value: number[]) => {
    const newRatio = value[0];
    // Ensure primary doesn't go below 20%
    const maxSecondary = tertiaryStyle ? 80 - tertiaryRatio : 80;
    const clampedRatio = Math.min(newRatio, maxSecondary);
    onBlendConfigChange({ 
      ...blendConfig,
      secondaryStyle, 
      ratio: clampedRatio,
      tertiaryStyle,
      tertiaryRatio,
    });
  };

  const handleTertiaryStyleChange = (value: string) => {
    onBlendConfigChange({
      ...blendConfig,
      secondaryStyle,
      ratio,
      tertiaryStyle: value,
      tertiaryRatio: tertiaryRatio || 10,
    });
  };

  const handleTertiaryRatioChange = (value: number[]) => {
    const newTertiaryRatio = value[0];
    // Ensure primary doesn't go below 20%
    const maxTertiary = 80 - ratio;
    const clampedTertiary = Math.min(newTertiaryRatio, maxTertiary);
    onBlendConfigChange({
      ...blendConfig,
      secondaryStyle,
      ratio,
      tertiaryStyle,
      tertiaryRatio: clampedTertiary,
    });
  };

  const handleAddTertiary = () => {
    setShowTertiary(true);
    const usedStyles = [primaryStyle, secondaryStyle];
    const availableStyle = NARRATIVE_STYLES.find(s => !usedStyles.includes(s.value))?.value || 'action';
    onBlendConfigChange({
      ...blendConfig,
      secondaryStyle,
      ratio: Math.min(ratio, 60), // Cap secondary to leave room
      tertiaryStyle: availableStyle,
      tertiaryRatio: 10,
    });
  };

  const handleRemoveTertiary = () => {
    setShowTertiary(false);
    onBlendConfigChange({
      secondaryStyle,
      ratio,
    });
  };

  const handlePresetSelect = (preset: typeof BLEND_PRESETS[0]) => {
    // Apply preset - this changes the primary style too, so we need to handle that upstream
    onBlendConfigChange({
      secondaryStyle: preset.secondaryStyle,
      ratio: preset.ratio,
      tertiaryStyle: preset.tertiaryStyle,
      tertiaryRatio: preset.tertiaryRatio,
    });
    setShowTertiary(!!preset.tertiaryStyle);
    setShowPresets(false);
  };

  // Generate gradient for visual indicator
  const generateGradient = () => {
    const primary = getStyleColor(primaryStyle);
    const secondary = getStyleColor(secondaryStyle);
    
    if (tertiaryStyle) {
      const tertiary = getStyleColor(tertiaryStyle);
      return `linear-gradient(90deg, ${primary} 0%, ${primary} ${primaryRatio}%, ${secondary} ${primaryRatio}%, ${secondary} ${primaryRatio + ratio}%, ${tertiary} ${primaryRatio + ratio}%, ${tertiary} 100%)`;
    }
    
    return `linear-gradient(90deg, ${primary} 0%, ${primary} ${primaryRatio}%, ${secondary} ${primaryRatio}%, ${secondary} 100%)`;
  };

  // Get blend description
  const blendDescription = enabled ? getBlendDescription(primaryStyle, blendConfig) : '';

  // Filter presets relevant to current primary style
  const relevantPresets = BLEND_PRESETS.filter(
    p => p.primaryStyle === primaryStyle || p.secondaryStyle === primaryStyle
  );

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
              ? `${primaryRatio}% ${formatStyleName(primaryStyle)}${tertiaryStyle ? ` + ${ratio}% ${formatStyleName(secondaryStyle)} + ${tertiaryRatio}% ${formatStyleName(tertiaryStyle)}` : ` + ${ratio}% ${formatStyleName(secondaryStyle)}`}` 
              : 'Combine narrative styles for unique blends'}
          </p>
        </div>
        <Switch 
          id="styleBlend"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {enabled && (
        <div className="pl-5 border-l-2 border-primary/30 space-y-4">
          {/* Visual Gradient Indicator */}
          <div className="space-y-1.5">
            <div 
              className="h-2 rounded-full w-full"
              style={{ background: generateGradient() }}
            />
            <p className="text-[10px] text-muted-foreground italic text-center">
              {blendDescription}
            </p>
          </div>

          {/* Presets Dropdown */}
          {relevantPresets.length > 0 && (
            <Collapsible open={showPresets} onOpenChange={setShowPresets}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-between h-7 text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    Quick Presets
                  </span>
                  <ChevronDown className={cn(
                    "w-3 h-3 transition-transform",
                    showPresets && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid gap-1.5">
                  {relevantPresets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className="text-left p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="text-xs font-medium">{preset.name}</div>
                      <div className="text-[10px] text-muted-foreground">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Secondary Style Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Secondary Style</Label>
            <Select value={secondaryStyle} onValueChange={handleSecondaryStyleChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NARRATIVE_STYLES
                  .filter(s => s.value !== primaryStyle && s.value !== tertiaryStyle)
                  .map(style => (
                    <SelectItem key={style.value} value={style.value}>
                      <span className="font-medium">{style.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">— {style.description}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Secondary Blend Ratio Slider (10-90 range) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatStyleName(primaryStyle)} ({primaryRatio}%)</span>
              <span>{formatStyleName(secondaryStyle)} ({ratio}%)</span>
            </div>
            <Slider
              value={[ratio]}
              onValueChange={handleRatioChange}
              min={10}
              max={tertiaryStyle ? 80 - tertiaryRatio : 80}
              step={5}
              className="py-2"
            />
          </div>

          {/* Tertiary Style (Three-Way Blending) */}
          {showTertiary && tertiaryStyle ? (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tertiary Style</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 w-5 p-0"
                  onClick={handleRemoveTertiary}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <Select value={tertiaryStyle} onValueChange={handleTertiaryStyleChange}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NARRATIVE_STYLES
                    .filter(s => s.value !== primaryStyle && s.value !== secondaryStyle)
                    .map(style => (
                      <SelectItem key={style.value} value={style.value}>
                        <span className="font-medium">{style.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">— {style.description}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Accent amount</span>
                  <span>{tertiaryRatio}%</span>
                </div>
                <Slider
                  value={[tertiaryRatio]}
                  onValueChange={handleTertiaryRatioChange}
                  min={5}
                  max={Math.min(30, 80 - ratio)}
                  step={5}
                  className="py-2"
                />
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-muted-foreground"
              onClick={handleAddTertiary}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add third style accent
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
