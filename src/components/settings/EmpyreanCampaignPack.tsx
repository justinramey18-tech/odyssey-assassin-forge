import { useState, useMemo, useCallback } from 'react';
import { X, Copy, Check, Download, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ALL_EMPYREAN_GUIDES,
  EMPYREAN_LORE_GUIDES,
  EMPYREAN_META_GUIDES,
  EMPYREAN_SESSION_GUIDES,
  EMPYREAN_GUIDE_PREFIX,
  type EmpyreanGuide,
} from '@/lib/empyreanGMGuides';
import { AirWizard } from './AirWizard';
import type { GMGuide } from '@/lib/gm-guides-storage';

interface EmpyreanCampaignPackProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guides: GMGuide[];
  addGuide: (name: string, content: string, customId?: string) => boolean;
  deleteGuide: (id: string) => void;
  updateGuide: (id: string, updates: Partial<Pick<GMGuide, 'name' | 'content' | 'enabled'>>) => boolean;
}

const CATEGORY_META: Record<EmpyreanGuide['category'], { label: string; color: string; desc: string; icon: string }> = {
  lore: { label: 'Lore Guides', color: 'text-cyan-400', desc: 'World-building reference — always stackable', icon: '📜' },
  tone: { label: 'Tone (pick one)', color: 'text-amber-400', desc: 'Sets the campaign mood — mutually exclusive', icon: '🎭' },
  pacing: { label: 'Pacing (pick one)', color: 'text-emerald-400', desc: 'Controls timeline speed — stacks with tone', icon: '⏳' },
  alternate: { label: 'Alternate Premise', color: 'text-purple-400', desc: 'Replaces the default campaign framework', icon: '🔮' },
  session: { label: 'Session Types', color: 'text-rose-400', desc: 'Pre-built session templates — stackable', icon: '🎯' },
};

export function EmpyreanCampaignPack({
  open,
  onOpenChange,
  guides,
  addGuide,
  deleteGuide,
  updateGuide,
}: EmpyreanCampaignPackProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyGuideContent = useCallback(async (eg: EmpyreanGuide) => {
    try {
      await navigator.clipboard.writeText(eg.content);
      setCopiedId(eg.id);
      toast.success(`"${eg.name}" copied!`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const installGuide = useCallback((eg: EmpyreanGuide) => {
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

    if (installedIds.has(eg.id)) {
      updateGuide(eg.id, { enabled: true });
      toast.success(`${eg.name} enabled`);
      return;
    }

    const success = addGuide(eg.name, eg.content, eg.id);
    if (success) toast.success(`${eg.name} installed`);
  }, [installedIds, enabledIds, addGuide, updateGuide]);

  const installAllLore = useCallback(() => {
    let count = 0;
    for (const eg of EMPYREAN_LORE_GUIDES) {
      if (!installedIds.has(eg.id)) {
        const success = addGuide(eg.name, eg.content, eg.id);
        if (success) count++;
      }
    }
    if (count > 0) toast.success(`Installed ${count} lore guide${count !== 1 ? 's' : ''}`);
    else toast.info('All lore guides already installed');
  }, [installedIds, addGuide]);

  const removeAllEmpyrean = useCallback(() => {
    const empyreanGuides = guides.filter(g =>
      g.id.startsWith(EMPYREAN_GUIDE_PREFIX) ||
      ALL_EMPYREAN_GUIDES.some(eg => eg.name === g.name),
    );
    for (const g of empyreanGuides) deleteGuide(g.id);
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
      <div key={category} className="space-y-1">
        <div className="flex items-center gap-2 pt-4 pb-2 px-1">
          <span className="text-lg">{meta.icon}</span>
          <span className={cn('text-sm font-cinzel font-bold uppercase tracking-wider', meta.color)}>
            {meta.label}
          </span>
          <Badge variant="outline" className="text-[10px] h-5 ml-auto">
            {categoryGuides.filter(g => isInstalled(g)).length}/{categoryGuides.length}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground px-1 pb-2">{meta.desc}</p>

        <Accordion type="single" collapsible className="space-y-1.5">
          {categoryGuides.map(eg => {
            const installed = isInstalled(eg);
            const enabled = isEnabled(eg);
            const isCopied = copiedId === eg.id;

            return (
              <AccordionItem
                key={eg.id}
                value={eg.id}
                className={cn(
                  'rounded-lg border px-3 transition-colors',
                  enabled
                    ? 'border-primary/40 bg-primary/5'
                    : installed
                      ? 'border-border/50 bg-muted/20'
                      : 'border-border/30 bg-card/30',
                )}
              >
                <AccordionTrigger className="py-3 hover:no-underline gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <Switch
                      checked={enabled}
                      onCheckedChange={(e) => {
                        e.valueOf(); // prevent accordion toggle
                        toggleGuide(eg);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{eg.name}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{eg.description}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2 pb-3 space-y-3">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed bg-background/40 rounded-lg p-3 max-h-[50vh] overflow-y-auto">
                      {eg.content}
                    </pre>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">
                        {eg.content.length.toLocaleString()} characters
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyGuideContent(eg)}
                        className={cn(
                          'h-9 gap-2 min-w-[44px]',
                          isCopied && 'bg-green-500/20 border-green-500/40 text-green-400',
                        )}
                      >
                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {isCopied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-background via-background to-background/95">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">📖</span>
          <h2 className="text-lg font-cinzel font-bold text-amber-400">Empyrean Pack</h2>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto pb-20">
          {/* Stats & actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-400">
              {installedCount}/{totalCount} installed
            </Badge>
            {installedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={removeAllEmpyrean}
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 ml-auto"
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
            className="w-full gap-2 h-11 border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400"
          >
            <Download className="w-4 h-4" />
            Install All Lore Guides (10)
          </Button>

          {/* Stacking info */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/30">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>Lore</strong> guides stack freely. <strong>Tone</strong> and <strong>Pacing</strong> are
              pick-one each. Enabling one auto-disables others in its category.
            </p>
          </div>

          {/* Categories */}
          {renderCategory('lore', EMPYREAN_LORE_GUIDES)}
          {renderCategory('tone', EMPYREAN_META_GUIDES.filter(g => g.category === 'tone'))}

          {/* Air Wizard — Weekly Tone Schedule */}
          <AirWizard addGuide={addGuide} updateGuide={updateGuide} guides={guides} />

          {renderCategory('pacing', EMPYREAN_META_GUIDES.filter(g => g.category === 'pacing'))}
          {renderCategory('alternate', EMPYREAN_META_GUIDES.filter(g => g.category === 'alternate'))}
          {renderCategory('session', EMPYREAN_SESSION_GUIDES)}

          <p className="text-[10px] text-muted-foreground text-center pt-4 pb-8">
            Total content: ~{Math.round(ALL_EMPYREAN_GUIDES.reduce((s, g) => s + g.content.length, 0) / 1000)}k chars
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
