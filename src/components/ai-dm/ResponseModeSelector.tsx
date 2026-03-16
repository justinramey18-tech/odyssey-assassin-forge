import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import {
  presetModes,
  RESPONSE_LENGTHS,
  CONTENT_TYPES,
  lengthSpecs,
  contentSpecs,
  getModeName,
  type ResponseLength,
  type ContentType,
} from '@/lib/dm-response-modes';

interface ResponseModeSelectorProps {
  selectedMode: string | undefined;
  onModeChange: (modeId: string | null) => void;
}

export function ResponseModeSelector({ selectedMode, onModeChange }: ResponseModeSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Parse custom mode for advanced panel
  const isCustom = selectedMode?.startsWith('custom:') ?? false;
  const customParts = isCustom ? selectedMode!.split(':') : null;
  const [customLength, setCustomLength] = useState<ResponseLength>(
    (customParts?.[1] as ResponseLength) || 'standard'
  );
  const [customContent, setCustomContent] = useState<ContentType>(
    (customParts?.[2] as ContentType) || 'balanced'
  );

  const handlePresetSelect = (id: string) => {
    if (selectedMode === id) {
      onModeChange(null); // Deselect = default immersive
    } else {
      onModeChange(id);
    }
  };

  const handleCustomChange = (length: ResponseLength, content: ContentType) => {
    setCustomLength(length);
    setCustomContent(content);
    onModeChange(`custom:${length}:${content}`);
  };

  return (
    <div className="space-y-3">
      {/* None / Default option */}
      <button
        onClick={() => onModeChange(null)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all border min-h-[44px]",
          !selectedMode
            ? "border-primary bg-primary/10 text-primary"
            : "border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20"
        )}
        style={{ touchAction: 'manipulation' }}
      >
        <span className="text-sm">🎭</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold">Default (Immersive)</span>
          <p className="text-[10px] text-muted-foreground">No word limits — AI adapts naturally</p>
        </div>
        {!selectedMode && <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
      </button>

      {/* Preset Grid */}
      {!showAdvanced && (
        <div className="grid grid-cols-2 gap-1.5">
          {presetModes.map(mode => {
            const isSelected = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => handlePresetSelect(mode.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg text-center transition-all border min-h-[64px]",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20"
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <div className="relative">
                  <span className="text-base">{mode.icon}</span>
                  {isSelected && (
                    <div className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>
                <span className="text-[11px] font-semibold leading-tight">{mode.name}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{mode.wordRange}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Advanced Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[11px] text-muted-foreground hover:text-foreground underline transition-colors min-h-[32px] px-1"
        style={{ touchAction: 'manipulation' }}
      >
        {showAdvanced ? '← Back to Presets' : 'Advanced: Custom Mode →'}
      </button>

      {/* Advanced Custom Builder */}
      {showAdvanced && (
        <div className="space-y-4 p-3 rounded-lg border border-border/40 bg-muted/5">
          {/* Length Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground">Length</span>
              <span className="text-[10px] text-muted-foreground">
                {lengthSpecs[customLength].range}
              </span>
            </div>
            <Slider
              value={[RESPONSE_LENGTHS.indexOf(customLength)]}
              min={0}
              max={4}
              step={1}
              onValueChange={([v]) => handleCustomChange(RESPONSE_LENGTHS[v], customContent)}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              {RESPONSE_LENGTHS.map(l => (
                <span key={l} className={cn(
                  "text-[9px]",
                  l === customLength ? "text-primary font-semibold" : "text-muted-foreground"
                )}>
                  {lengthSpecs[l].label}
                </span>
              ))}
            </div>
          </div>

          {/* Content Type Chips */}
          <div>
            <span className="text-xs font-medium text-foreground block mb-2">Content Type</span>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => handleCustomChange(customLength, type)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-all min-h-[32px]",
                    customContent === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  {contentSpecs[type].label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div className="text-center pt-1 border-t border-border/20">
            <span className="text-[10px] text-muted-foreground">Active: </span>
            <span className="text-xs font-semibold text-primary">
              {getModeName(customLength, customContent)}
            </span>
            <span className="text-[10px] text-muted-foreground ml-1">
              ({lengthSpecs[customLength].range})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
