import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Check, Crown, Sparkles, Sword, BookOpen, Users, Wand2, Feather, Flame, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AppMode,
  APP_MODE_CONFIGS,
  APP_MODES_ORDERED,
  getAllFeatureIds,
  CustomOverrides,
} from '@/lib/app-modes';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, Sword, BookOpen, Users, Crown, Wand2, Feather, Flame,
};

const COLOR_MAP: Record<string, string> = {
  amber: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
  red: 'border-red-500/50 bg-red-500/10 text-red-400',
  cyan: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400',
  violet: 'border-violet-500/50 bg-violet-500/10 text-violet-400',
  blue: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
  emerald: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
  rose: 'border-rose-500/50 bg-rose-500/10 text-rose-400',
  purple: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
};

const INACTIVE_COLOR = 'border-border/50 bg-muted/20 text-muted-foreground';

const TOAST_COLORS: Record<string, { background: string; border: string; color: string }> = {
  amber:   { background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.5)', color: '#fbbf24' },
  red:     { background: 'rgba(239, 68, 68, 0.15)',  border: '1px solid rgba(239, 68, 68, 0.5)',  color: '#f87171' },
  cyan:    { background: 'rgba(6, 182, 212, 0.15)',   border: '1px solid rgba(6, 182, 212, 0.5)',  color: '#22d3ee' },
  violet:  { background: 'rgba(139, 92, 246, 0.15)',  border: '1px solid rgba(139, 92, 246, 0.5)', color: '#a78bfa' },
  blue:    { background: 'rgba(59, 130, 246, 0.15)',   border: '1px solid rgba(59, 130, 246, 0.5)', color: '#60a5fa' },
  emerald: { background: 'rgba(16, 185, 129, 0.15)',  border: '1px solid rgba(16, 185, 129, 0.5)', color: '#34d399' },
  rose:    { background: 'rgba(244, 63, 94, 0.15)',   border: '1px solid rgba(244, 63, 94, 0.5)',  color: '#fb7185' },
  purple:  { background: 'rgba(168, 85, 247, 0.15)',  border: '1px solid rgba(168, 85, 247, 0.5)', color: '#c084fc' },
};

interface AppModeSettingsProps {
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  customOverrides: CustomOverrides;
  onCustomOverride: (featureId: string, visible: boolean) => void;
  onResetCustomizations: () => void;
  isFeatureVisible: (id: string) => boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  tabs: 'Navigation Tabs',
  home: 'Home Screen',
  quickAccess: 'Quick Access Menu',
  dm: 'DM Drawer',
};

export function AppModeSettings({
  appMode,
  onModeChange,
  customOverrides,
  onCustomOverride,
  onResetCustomizations,
  isFeatureVisible,
}: AppModeSettingsProps) {
  const allFeatures = useMemo(() => getAllFeatureIds(), []);
  const hasOverrides = Object.keys(customOverrides).length > 0;

  const handleReset = useCallback(() => {
    onResetCustomizations();
    toast.success('Customizations reset to mode defaults');
  }, [onResetCustomizations]);

  return (
    <div className="space-y-6 pb-6">
      {/* Mode Selector */}
      <div>
        <h3 className="font-cinzel font-semibold text-sm mb-3">Active Mode</h3>
        <div className="grid gap-2">
          {APP_MODES_ORDERED.map((mode) => {
            const config = APP_MODE_CONFIGS[mode];
            const Icon = ICON_MAP[config.icon] ?? Sparkles;
            const isActive = appMode === mode;
            const colorClass = isActive ? COLOR_MAP[config.color] ?? INACTIVE_COLOR : INACTIVE_COLOR;

            return (
              <button
                key={mode}
                onClick={() => {
                  onModeChange(mode);
                  const ts = TOAST_COLORS[config.color] ?? TOAST_COLORS.emerald;
                  toast.success(`${config.label} mode applied`, {
                    description: config.description,
                    style: { ...ts, backdropFilter: 'blur(12px)' },
                  });
                }}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                  colorClass,
                  isActive && 'ring-1 ring-current',
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{config.label}</p>
                  <p className="text-[11px] opacity-70 truncate">{config.description}</p>
                </div>
                {isActive && <Check className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <Separator className="bg-border/30" />

      {/* Feature Customization */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel font-semibold text-sm">Feature Visibility</h3>
          {hasOverrides && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs gap-1.5">
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Toggle individual features on or off. Changes are saved per mode.
        </p>

        <Accordion type="multiple" className="space-y-1">
          {Object.entries(allFeatures).map(([category, features]) => (
            <AccordionItem key={category} value={category} className="border-border/30">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{CATEGORY_LABELS[category] ?? category}</span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {features.filter(f => isFeatureVisible(f.id)).length}/{features.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 py-1">
                  {features.map((feature) => {
                    const visible = isFeatureVisible(feature.id);
                    const isOverridden = feature.id in customOverrides;
                    return (
                      <div
                        key={feature.id}
                        className="flex items-center justify-between gap-2 px-1"
                      >
                        <Label
                          htmlFor={`feature-${feature.id}`}
                          className={cn(
                            'text-sm cursor-pointer',
                            !visible && 'text-muted-foreground line-through',
                            isOverridden && 'italic',
                          )}
                        >
                          {feature.label}
                          {isOverridden && (
                            <span className="text-[10px] text-primary ml-1.5">(custom)</span>
                          )}
                        </Label>
                        <Switch
                          id={`feature-${feature.id}`}
                          checked={visible}
                          onCheckedChange={(checked) => onCustomOverride(feature.id, checked)}
                        />
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Your data is never deleted when switching modes — only visibility changes.
      </p>
    </div>
  );
}
