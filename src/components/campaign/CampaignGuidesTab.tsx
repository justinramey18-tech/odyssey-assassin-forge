import { useState, useMemo, useCallback } from 'react';
import { Book, Check, Package, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GMGuide } from '@/lib/gm-guides-storage';
import { GuidePreset } from '@/hooks/use-guide-presets';

interface CampaignGuidesTabProps {
  guides: GMGuide[];
  assignedGuideIds: string[];
  presets: GuidePreset[];
  onUpdateGuideIds: (guideIds: string[]) => void;
  onCreatePreset: (name: string, guideIds: string[]) => void;
  onDeletePreset: (id: string) => void;
}

export function CampaignGuidesTab({
  guides,
  assignedGuideIds,
  presets,
  onUpdateGuideIds,
  onCreatePreset,
  onDeletePreset,
}: CampaignGuidesTabProps) {
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);

  const assignedSet = useMemo(() => new Set(assignedGuideIds), [assignedGuideIds]);

  const toggleGuide = useCallback((guideId: string) => {
    const next = assignedSet.has(guideId)
      ? assignedGuideIds.filter(id => id !== guideId)
      : [...assignedGuideIds, guideId];
    onUpdateGuideIds(next);
  }, [assignedGuideIds, assignedSet, onUpdateGuideIds]);

  const applyPreset = useCallback((preset: GuidePreset) => {
    onUpdateGuideIds(preset.guideIds);
  }, [onUpdateGuideIds]);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    onCreatePreset(presetName.trim(), assignedGuideIds);
    setPresetName('');
    setShowSavePreset(false);
  }, [presetName, assignedGuideIds, onCreatePreset]);

  const handleDeletePresetConfirm = useCallback(() => {
    if (deletePresetId) {
      onDeletePreset(deletePresetId);
      setDeletePresetId(null);
    }
  }, [deletePresetId, onDeletePreset]);

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-4 pb-4">
        {/* Presets Section */}
        {(presets.length > 0 || assignedGuideIds.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                Presets
              </h3>
              {assignedGuideIds.length > 0 && !showSavePreset && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowSavePreset(true)}
                >
                  <Plus className="w-3 h-3" />
                  Save as Preset
                </Button>
              )}
            </div>

            {/* Save Preset Input */}
            {showSavePreset && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Preset name..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                  className="h-8 text-sm bg-muted/30"
                  autoFocus
                />
                <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSavePreset} disabled={!presetName.trim()}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setShowSavePreset(false); setPresetName(''); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            {/* Preset Chips */}
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {presets.map(preset => {
                  const isActive = preset.guideIds.length === assignedGuideIds.length &&
                    preset.guideIds.every(id => assignedSet.has(id));
                  return (
                    <div key={preset.id} className="group relative">
                      <Badge
                        variant={isActive ? 'default' : 'secondary'}
                        className="cursor-pointer text-xs pr-6 hover:bg-primary/20 transition-colors"
                        onClick={() => applyPreset(preset)}
                      >
                        {preset.name}
                        <span className="ml-1 text-[10px] opacity-60">({preset.guideIds.length})</span>
                      </Badge>
                      <button
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-destructive/20"
                        onClick={(e) => { e.stopPropagation(); setDeletePresetId(preset.id); }}
                      >
                        <X className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Guide Library Checklist */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Book className="w-3.5 h-3.5" />
            Guide Library
            <span className="text-[10px] font-normal ml-1">
              ({assignedGuideIds.length}/{guides.length} assigned)
            </span>
          </h3>

          {guides.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Book className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No guides in your library yet.</p>
              <p className="text-xs mt-1">Add guides from the AI DM settings to get started.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {guides.map(guide => (
                <label
                  key={guide.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer"
                >
                  <Checkbox
                    checked={assignedSet.has(guide.id)}
                    onCheckedChange={() => toggleGuide(guide.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{guide.name}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                      {guide.content.slice(0, 120)}{guide.content.length > 120 ? '…' : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">
                    {(guide.content.length / 1000).toFixed(1)}k
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Preset Confirmation */}
      <AlertDialog open={!!deletePresetId} onOpenChange={() => setDeletePresetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this preset. Your guides will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePresetConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
