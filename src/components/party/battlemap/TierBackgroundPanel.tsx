import { useRef } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { type ScaleTier, type TierBackground, DEFAULT_SCALE_TIERS, getDistanceUnitAbbr } from './types';

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
}

export function TierBackgroundPanel({
  tiers, tierBackgrounds, autoScale, masterOpacity, uploading,
  onToggleAutoScale, onUpload, onRemove, onMasterOpacityChange,
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
      <PopoverContent className="w-64 p-3" align="start" side="top">
        <div className="space-y-3">
          {/* Auto-scale toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">Auto-Scale</span>
            <Switch checked={autoScale} onCheckedChange={onToggleAutoScale} className="scale-75" />
          </div>

          {/* Tier rows */}
          <div className="space-y-2">
            {tiers.map(tier => {
              const bg = getBgForTier(tier.id);
              const unitAbbr = getDistanceUnitAbbr(tier.distanceUnit);
              return (
                <div key={tier.id} className="flex items-center gap-2">
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
                    <div className="text-[9px] text-muted-foreground">{tier.distancePerSquare} {unitAbbr}/sq</div>
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
