import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Feather, Copy, Check, ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { processTextOffline, defaultProcessingOptions, type NarrativeStyle } from '@/lib/narrativeProcessor';
import { useSavedStories } from '@/hooks/use-saved-stories';
import { StoryListSheet } from '@/components/scribe/StoryListSheet';
import { CharacterNamePlaque } from './CharacterNamePlaque';
import { ClockWidget } from './ClockWidget';

const STYLES: { value: NarrativeStyle; label: string }[] = [
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'noir', label: 'Noir' },
  { value: 'literary', label: 'Literary' },
  { value: 'action', label: 'Action' },
  { value: 'salvatore', label: 'Salvatore' },
  { value: 'deadpool', label: 'Deadpool' },
  { value: 'dark_comedy', label: 'Dark Comedy' },
  { value: 'lovecraftian', label: 'Lovecraftian' },
  { value: 'hemingway', label: 'Hemingway' },
  { value: 'gonzo', label: 'Gonzo' },
];

interface ChroniclerHomeViewProps {
  characterName: string;
  onNavigateToTab: (tab: string) => void;
  onOpenSettings?: () => void;
}

export function ChroniclerHomeView({
  characterName,
  onNavigateToTab,
}: ChroniclerHomeViewProps) {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [style, setStyle] = useState<NarrativeStyle>('fantasy');
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const stories = useSavedStories();

  const handleProcess = useCallback(() => {
    if (!inputText.trim()) {
      toast.error('Paste or type some text first');
      return;
    }
    setIsProcessing(true);
    // Use a tiny timeout so the UI shows the processing state
    setTimeout(() => {
      const result = processTextOffline(inputText, {
        ...defaultProcessingOptions,
        narrativeStyle: style,
      });
      setOutputText(result);
      setIsProcessing(false);
    }, 50);
  }, [inputText, style]);

  const handleCopy = useCallback(async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [outputText]);

  const handleSaveAsStory = useCallback(() => {
    if (!outputText.trim()) return;
    const title = `Chronicler — ${new Date().toLocaleDateString()}`;
    stories.createStory(title, outputText, style);
    toast.success('Saved as story', {
      style: { background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.5)', color: '#fb7185' },
    });
  }, [outputText, style, stories]);

  const wordCount = useMemo(() => {
    if (!outputText) return 0;
    return outputText.split(/\s+/).filter(Boolean).length;
  }, [outputText]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <CharacterNamePlaque name={characterName} level={0} />
        <ClockWidget />
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 pb-28">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 pt-2"
          >
            <Feather className="w-5 h-5 text-rose-400" />
            <h2 className="font-cinzel font-semibold text-lg text-foreground">Chronicler</h2>
          </motion.div>

          {/* Input area */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Paste or write
            </label>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your chat log, session notes, or raw text here…"
              className="min-h-[160px] resize-none border-rose-500/20 focus-visible:ring-rose-500/30 bg-muted/30 text-sm"
            />
          </div>

          {/* Style + Process */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Style
              </label>
              <Select value={style} onValueChange={(v) => setStyle(v as NarrativeStyle)}>
                <SelectTrigger className="border-rose-500/20 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleProcess}
              disabled={!inputText.trim() || isProcessing}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {isProcessing ? 'Processing…' : 'Transform'}
            </Button>
          </div>

          {/* Output area */}
          {outputText && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Output
                  {wordCount > 0 && (
                    <span className="ml-2 text-rose-400">{wordCount} words</span>
                  )}
                </label>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs gap-1.5"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveAsStory}
                    className="h-7 text-xs gap-1.5 text-rose-400 hover:text-rose-300"
                  >
                    <BookOpen className="w-3 h-3" />
                    Save
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-muted/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {outputText}
              </div>
            </motion.div>
          )}

          {/* Story list access */}
          {stories.stories.length > 0 && (
            <StoryListSheet
              stories={stories.stories}
              activeStoryId={stories.activeStoryId}
              allTags={stories.getAllTags()}
              onSelectStory={(id) => stories.setActiveStoryId(id)}
              onDeleteStory={stories.deleteStory}
              onRenameStory={stories.renameStory}
              onViewStory={(id) => {
                stories.setActiveStoryId(id);
                onNavigateToTab('scribe');
              }}
              onMergeStories={(ids, opts) => stories.mergeStories(ids, opts)}
              onAddTag={stories.addTagToStory}
              onRemoveTag={stories.removeTagFromStory}
            />
          )}

          {/* Open full Scribe link */}
          <button
            onClick={() => onNavigateToTab('scribe')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-rose-500/30 text-rose-400 text-sm hover:bg-rose-500/5 transition-colors"
          >
            Open Full Scribe
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </ScrollArea>
    </div>
  );
}
