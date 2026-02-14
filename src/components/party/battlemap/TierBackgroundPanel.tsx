import { useRef, useState } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  type ScaleTier, type TierBackground, type DistanceUnit,
  DISTANCE_UNITS, DISTANCE_PER_SQUARE_PRESETS, getDistanceUnitAbbr,
} from './types';

/** Combo: preset dropdown + custom number input for distance per square */
function DistancePerSquareInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState(String(value));
  const isPreset = DISTANCE_PER_SQUARE_PRESETS.includes(value as any);

  if (customMode || !isPreset) {
    return (
      <input
        type="number"
        min={0.1}
        max={9999}
        step="any"
        value={customValue}
        onChange={(e) => {
          setCustomValue(e.target.value);
          const n = parseFloat(e.target.value);
          if (n > 0 && n <= 9999) onChange(n);
        }}
        onBlur={() => {
          const n = parseFloat(customValue);
          if (!n || n < 0.1) { setCustomValue(String(value)); }
          if (DISTANCE_PER_SQUARE_PRESETS.includes(n as any)) setCustomMode(false);
        }}
        className="h-5 w-[3.5rem] text-[9px] rounded-md border border-border/30 bg-background/50 px-1 text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
        autoFocus={customMode}
      />
    );
  }

  return (
    <Select
      value={String(value)}
      onValueChange={(v) => {
        if (v === '__custom__') { setCustomMode(true); setCustomValue(String(value)); }
        else onChange(Number(v));
      }}
    >
      <SelectTrigger className="h-5 w-[3.5rem] text-[9px] border-border/30 bg-background/50">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[200] bg-popover">
        {DISTANCE_PER_SQUARE_PRESETS.map(d => (
          <SelectItem key={d} value={String(d)} className="text-[11px]">{d}</SelectItem>
        ))}
        <SelectItem value="__custom__" className="text-[11px] text-muted-foreground italic">Custom…</SelectItem>
      </SelectContent>
    </Select>
  );
}

interface TierBackgroundPanelProps {
  tiers: ScaleTier[];
  tierBackgrounds: TierBackground[];
  autoScale: boolean;
  masterOpacity: number;
  uploading: boolean;
  onToggleAutoScale: () => void;
  onUpload: (tierId: string, file: File) => void;
  onRemove: (tierId: string) => void;
  onMasterOpacityChange: (opacity: number) => void;
  onTierConfigChange?: (tierId: string, updates: Partial<Pick<ScaleTier, 'distancePerSquare' | 'distanceUnit'>>) => void;
}

export function TierBackgroundPanel({
  tiers, tierBackgrounds, autoScale, masterOpacity, uploading,
  onToggleAutoScale, onUpload, onRemove, onMasterOpacityChange, onTierConfigChange,
}: TierBackgroundPanelProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getBgForTier = (tierId: string) => tierBackgrounds.find(b => b.tierId === tierId);
  const hasAnyBackground = tierBackgrounds.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={hasAnyBackground ? 'default' : 'outline'}
          className="text-[10px] h-6 gap-1"
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
          Layers
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 z-[100]" align="start" side="top">
        <div className="space-y-3">
          {/* Auto-scale toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">Auto-Scale</span>
            <Switch checked={autoScale} onCheckedChange={onToggleAutoScale} className="scale-75" />
          </div>

          {/* Tier rows */}
          <div className="space-y-3">
            {tiers.map(tier => {
              const bg = getBgForTier(tier.id);
              return (
                <div key={tier.id} className="space-y-1.5 p-2 rounded-md border border-border/20 bg-muted/20">
                  {/* Tier header with image controls */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={el => { fileInputRefs.current[tier.id] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUpload(tier.id, file);
                        e.target.value = '';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium truncate">{tier.label}</div>
                    </div>
                    {bg ? (
                      <div className="flex items-center gap-1">
                        <img src={bg.imageUrl} alt="" className="w-7 h-7 rounded object-cover border border-border/30" />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => fileInputRefs.current[tier.id]?.click()}
                          disabled={uploading}
                        >
                          <Upload className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-destructive"
                          onClick={() => onRemove(tier.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[9px] h-6 gap-1"
                        onClick={() => fileInputRefs.current[tier.id]?.click()}
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        Upload
                      </Button>
                    )}
                  </div>

                  {/* Per-tier distance/unit config */}
                  <div className="flex items-center gap-1.5">
                    <DistancePerSquareInput
                      value={tier.distancePerSquare}
                      onChange={(v) => onTierConfigChange?.(tier.id, { distancePerSquare: v })}
                    />
                    <Select
                      value={tier.distanceUnit}
                      onValueChange={(v) => onTierConfigChange?.(tier.id, { distanceUnit: v as DistanceUnit })}
                    >
                      <SelectTrigger className="h-5 w-[4.5rem] text-[9px] border-border/30 bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {DISTANCE_UNITS.map(u => (
                          <SelectItem key={u.id} value={u.id} className="text-[11px]">{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-[9px] text-muted-foreground">/sq</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Master opacity slider */}
          {hasAnyBackground && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/20">
              <span className="text-[9px] text-muted-foreground whitespace-nowrap">Opacity {Math.round(masterOpacity * 100)}%</span>
              <input
                type="range"
                min="5"
                max="100"
                value={Math.round(masterOpacity * 100)}
                onChange={(e) => onMasterOpacityChange(Number(e.target.value) / 100)}
                className="flex-1 h-4 accent-primary cursor-pointer"
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
