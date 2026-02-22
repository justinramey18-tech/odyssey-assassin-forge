import { useState, useMemo, useCallback } from 'react';
import { BookOpen, Check, Download, Trash2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EdgeDrawer } from '@/components/drawers/EdgeDrawer';
import {
  ALL_EMPYREAN_GUIDES,
  EMPYREAN_LORE_GUIDES,
  EMPYREAN_META_GUIDES,
  EMPYREAN_GUIDE_PREFIX,
  type EmpyreanGuide,
} from '@/lib/empyreanGMGuides';
import type { GMGuide } from '@/lib/gm-guides-storage';

interface EmpyreanCampaignPackProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guides: GMGuide[];
  addGuide: (name: string, content: string, customId?: string) => boolean;
  deleteGuide: (id: string) => void;
  updateGuide: (id: string, updates: Partial<Pick<GMGuide, 'name' | 'content' | 'enabled'>>) => boolean;
}

const CATEGORY_META: Record<EmpyreanGuide['category'], { label: string; color: string; desc: string }> = {
  lore: { label: 'LORE', color: 'text-cyan-400', desc: 'World-building reference — always stackable' },
  tone: { label: 'TONE (pick one)', color: 'text-amber-400', desc: 'Sets the campaign mood — mutually exclusive' },
  pacing: { label: 'PACING (pick one)', color: 'text-emerald-400', desc: 'Controls timeline speed — stacks with tone' },
  alternate: { label: 'ALTERNATE PREMISE', color: 'text-purple-400', desc: 'Replaces the default campaign framework' },
};

export function EmpyreanCampaignPack({
  open,
  onOpenChange,
  guides,
  addGuide,
  deleteGuide,
  updateGuide,
}: EmpyreanCampaignPackProps) {
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);

  const installedIds = useMemo(
    () => new Set(guides.filter(g => g.id.startsWith(EMPYREAN_GUIDE_PREFIX)).map(g => g.id)),
    [guides],
  );

  const enabledIds = useMemo(
    () => new Set(guides.filter(g => g.id.startsWith(EMPYREAN_GUIDE_PREFIX) && g.enabled).map(g => g.id)),
    [guides],
  );

  const installedCount = installedIds.size;
  const totalCount = ALL_EMPYREAN_GUIDES.length;

  const installGuide = useCallback((eg: EmpyreanGuide) => {
    // Use the empyrean ID directly so we can track it
    const guide: GMGuide = {
      id: eg.id,
      name: eg.name,
      content: eg.content,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // For non-stackable guides, disable others in same category
    if (!eg.stackable) {
      const sameCategory = ALL_EMPYREAN_GUIDES.filter(
        g => g.category === eg.category && g.id !== eg.id,
      );
      for (const other of sameCategory) {
        if (enabledIds.has(other.id)) {
          updateGuide(other.id, { enabled: false });
        }
      }
    }

    // We need to add via the raw mechanism since addGuide generates a new ID
    // Instead, check if already installed
    if (installedIds.has(eg.id)) {
      updateGuide(eg.id, { enabled: true });
      toast.success(`${eg.name} enabled`);
      return;
    }

    const success = addGuide(eg.name, eg.content, eg.id);
    if (success) {
      toast.success(`${eg.name} installed`);
    }
  }, [installedIds, enabledIds, addGuide, updateGuide]);

  const installAllLore = useCallback(() => {
    let count = 0;
    for (const eg of EMPYREAN_LORE_GUIDES) {
      if (!installedIds.has(eg.id)) {
        const success = addGuide(eg.name, eg.content, eg.id);
        if (success) count++;
      }
    }
    if (count > 0) {
      toast.success(`Installed ${count} lore guide${count !== 1 ? 's' : ''}`);
    } else {
      toast.info('All lore guides already installed');
    }
  }, [installedIds, addGuide]);

  const removeAllEmpyrean = useCallback(() => {
    const empyreanGuides = guides.filter(g =>
      g.id.startsWith(EMPYREAN_GUIDE_PREFIX) ||
      ALL_EMPYREAN_GUIDES.some(eg => eg.name === g.name),
    );
    for (const g of empyreanGuides) {
      deleteGuide(g.id);
    }
    toast.success(`Removed ${empyreanGuides.length} Empyrean guide${empyreanGuides.length !== 1 ? 's' : ''}`);
  }, [guides, deleteGuide]);

  const isInstalled = useCallback((eg: EmpyreanGuide) => {
    return installedIds.has(eg.id) || guides.some(g => g.name === eg.name);
  }, [installedIds, guides]);

  const isEnabled = useCallback((eg: EmpyreanGuide) => {
    const found = guides.find(g => g.id === eg.id || g.name === eg.name);
    return found?.enabled ?? false;
  }, [guides]);

  const toggleGuide = useCallback((eg: EmpyreanGuide) => {
    const found = guides.find(g => g.id === eg.id || g.name === eg.name);
    if (!found) {
      installGuide(eg);
      return;
    }

    const newEnabled = !found.enabled;

    // If enabling a non-stackable guide, disable others in same category
    if (newEnabled && !eg.stackable) {
      const sameCategory = ALL_EMPYREAN_GUIDES.filter(
        g => g.category === eg.category && g.id !== eg.id,
      );
      for (const other of sameCategory) {
        const otherGuide = guides.find(g => g.id === other.id || g.name === other.name);
        if (otherGuide?.enabled) {
          updateGuide(otherGuide.id, { enabled: false });
          toast.info(`Disabled "${other.name}" — only one ${eg.category} guide at a time`);
        }
      }
    }

    updateGuide(found.id, { enabled: newEnabled });
  }, [guides, installGuide, updateGuide]);

  const renderCategory = (category: EmpyreanGuide['category'], categoryGuides: EmpyreanGuide[]) => {
    const meta = CATEGORY_META[category];
    return (
      <div key={category} className="space-y-2">
        <div className="flex items-center gap-2 pt-3 pb-1">
          <span className={cn('text-xs font-cinzel font-bold uppercase tracking-wider', meta.color)}>
            {meta.label}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">{meta.desc}</p>

        {categoryGuides.map(eg => {
          const installed = isInstalled(eg);
          const enabled = isEnabled(eg);
          const expanded = expandedGuide === eg.id;

          return (
            <div
              key={eg.id}
              className={cn(
                'rounded-lg border p-3 transition-colors',
                enabled
                  ? 'border-primary/40 bg-primary/5'
                  : installed
                    ? 'border-border/50 bg-muted/20'
                    : 'border-border/30 bg-card/30',
              )}
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleGuide(eg)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{eg.name}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{eg.description}</p>
                </div>
                <button
                  onClick={() => setExpandedGuide(expanded ? null : eg.id)}
                  className="shrink-0 p-1 rounded hover:bg-muted/50 transition-colors"
                >
                  {expanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  <pre className="text-[11px] font-mono whitespace-pre-wrap text-muted-foreground max-h-[30vh] overflow-y-auto leading-relaxed">
                    {eg.content.slice(0, 500)}
                    {eg.content.length > 500 && '...'}
                  </pre>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {eg.content.length.toLocaleString()} characters
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <EdgeDrawer
      side="right"
      open={open}
      onOpenChange={onOpenChange}
      title="Empyrean Pack"
      icon={<BookOpen className="w-5 h-5" />}
      accentColor="#f59e0b"
    >
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-3 pr-2">
          {/* Header stats */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-400">
              {installedCount}/{totalCount} installed
            </Badge>
            {installedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={removeAllEmpyrean}
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Remove All
              </Button>
            )}
          </div>

          {/* Install All Lore */}
          <Button
            variant="outline"
            size="sm"
            onClick={installAllLore}
            className="w-full gap-2 border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400"
          >
            <Download className="w-4 h-4" />
            Install All Lore Guides (10)
          </Button>

          {/* Stacking info */}
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <strong>Lore</strong> guides stack freely. <strong>Tone</strong> and <strong>Pacing</strong> are
              pick-one each. Enabling one auto-disables others in its category.
            </p>
          </div>

          {/* Categories */}
          {renderCategory('lore', EMPYREAN_LORE_GUIDES)}
          {renderCategory('tone', EMPYREAN_META_GUIDES.filter(g => g.category === 'tone'))}
          {renderCategory('pacing', EMPYREAN_META_GUIDES.filter(g => g.category === 'pacing'))}
          {renderCategory('alternate', EMPYREAN_META_GUIDES.filter(g => g.category === 'alternate'))}

          <p className="text-[10px] text-muted-foreground text-center pt-4 pb-8">
            Total content: ~{Math.round(ALL_EMPYREAN_GUIDES.reduce((s, g) => s + g.content.length, 0) / 1000)}k chars
          </p>
        </div>
      </ScrollArea>
    </EdgeDrawer>
  );
}
