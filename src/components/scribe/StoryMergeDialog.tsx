import { useState, useMemo, useCallback } from 'react';
import { Combine, GripVertical, ArrowUp, ArrowDown, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { SavedStory } from '@/hooks/use-saved-stories';

export type SeparatorType = '---' | '***' | 'chapter' | 'none';

export interface MergeOptions {
  newTitle: string;
  separator: SeparatorType;
  preserveOriginals: boolean;
  inheritTags: boolean;
}

interface StoryMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stories: SavedStory[];
  selectedIds: string[];
  onMerge: (orderedIds: string[], options: MergeOptions) => void;
}

export function StoryMergeDialog({
  open,
  onOpenChange,
  stories,
  selectedIds,
  onMerge,
}: StoryMergeDialogProps) {
  const [orderedIds, setOrderedIds] = useState<string[]>(selectedIds);
  const [options, setOptions] = useState<MergeOptions>({
    newTitle: 'Merged Chronicle',
    separator: '---',
    preserveOriginals: true,
    inheritTags: true,
  });
  const [showPreview, setShowPreview] = useState(false);

  // Reset order when dialog opens with new selection
  useState(() => {
    setOrderedIds(selectedIds);
  });

  const orderedStories = useMemo(() => {
    return orderedIds
      .map(id => stories.find(s => s.id === id))
      .filter((s): s is SavedStory => s !== undefined);
  }, [orderedIds, stories]);

  const totalWordCount = useMemo(() => {
    return orderedStories.reduce((sum, s) => sum + s.wordCount, 0);
  }, [orderedStories]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    orderedStories.forEach(s => s.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet);
  }, [orderedStories]);

  const previewContent = useMemo(() => {
    const separator = getSeparatorText(options.separator);
    return orderedStories
      .map((story, idx) => {
        let content = story.content;
        if (options.separator === 'chapter') {
          content = `## Chapter ${idx + 1}: ${story.title}\n\n${content}`;
        }
        return content;
      })
      .join(separator);
  }, [orderedStories, options.separator]);

  const moveStory = useCallback((index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderedIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setOrderedIds(newOrder);
  }, [orderedIds]);

  const removeFromMerge = useCallback((id: string) => {
    setOrderedIds(prev => prev.filter(i => i !== id));
  }, []);

  const handleMerge = () => {
    if (orderedIds.length < 2) return;
    onMerge(orderedIds, options);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <Combine className="w-5 h-5" />
            Merge Stories
          </DialogTitle>
          <DialogDescription>
            Combine {orderedIds.length} stories into one. Drag to reorder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Story Order */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Story Order (drag to reorder)</Label>
            <ScrollArea className="h-[180px] rounded-lg border border-border/50 bg-muted/10">
              <div className="p-2 space-y-1">
                {orderedStories.map((story, index) => (
                  <div
                    key={story.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg border transition-all',
                      'border-border/50 bg-card/50 hover:bg-card hover:border-border'
                    )}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{story.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {story.wordCount.toLocaleString()} words
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => moveStory(index, 'up')}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === orderedStories.length - 1}
                        onClick={() => moveStory(index, 'down')}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                      {orderedIds.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeFromMerge(story.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Merge Options */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">New Story Title</Label>
              <Input
                id="title"
                value={options.newTitle}
                onChange={(e) => setOptions(prev => ({ ...prev, newTitle: e.target.value }))}
                placeholder="Enter title..."
              />
            </div>
            
            <div className="space-y-2">
              <Label>Section Separator</Label>
              <Select
                value={options.separator}
                onValueChange={(val: SeparatorType) => 
                  setOptions(prev => ({ ...prev, separator: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="---">Horizontal Rule (---)</SelectItem>
                  <SelectItem value="***">Asterisks (***)</SelectItem>
                  <SelectItem value="chapter">Chapter Headers</SelectItem>
                  <SelectItem value="none">No Separator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="preserve"
                checked={options.preserveOriginals}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, preserveOriginals: checked }))
                }
              />
              <Label htmlFor="preserve" className="text-sm">Keep original stories</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="tags"
                checked={options.inheritTags}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, inheritTags: checked }))
                }
              />
              <Label htmlFor="tags" className="text-sm">Inherit all tags</Label>
            </div>
          </div>

          {/* Stats & Preview Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-sm">
              <span className="text-muted-foreground">Combined:</span>
              <span className="font-medium text-amber-400 ml-2">
                {totalWordCount.toLocaleString()} words
              </span>
              {options.inheritTags && allTags.length > 0 && (
                <span className="text-muted-foreground ml-3">
                  • {allTags.length} tag{allTags.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="w-3 h-3" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          </div>

          {/* Preview */}
          {showPreview && (
            <ScrollArea className="h-[150px] rounded-lg border border-border/50 bg-muted/10 p-3">
              <div className="text-sm font-serif whitespace-pre-wrap leading-relaxed">
                {previewContent.slice(0, 2000)}
                {previewContent.length > 2000 && (
                  <span className="text-muted-foreground">... (truncated)</span>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={orderedIds.length < 2 || !options.newTitle.trim()}
            className="gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600"
          >
            <Combine className="w-4 h-4" />
            Merge {orderedIds.length} Stories
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getSeparatorText(type: SeparatorType): string {
  switch (type) {
    case '---':
      return '\n\n---\n\n';
    case '***':
      return '\n\n***\n\n';
    case 'chapter':
      return '\n\n';
    case 'none':
      return '\n\n';
    default:
      return '\n\n---\n\n';
  }
}
