import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Feather, Copy, Check, ArrowRight, BookOpen, Sparkles, Cpu, Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
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
import { ScribeContextPanel, loadCharacterCards } from '@/components/scribe/ScribeContextPanel';
import { CharacterNamePlaque } from './CharacterNamePlaque';
import { ClockWidget } from './ClockWidget';
import { supabase } from '@/integrations/supabase/client';
import { SCRIBE_MODELS, loadScribeModel, saveScribeModel, getEdgeFunctionForModel, isAnthropicModel } from '@/lib/scribe-models';
import { formatUsage, type TokenUsage } from '@/lib/token-usage';
import { loadApiKey } from '@/lib/api-keys';
import { loadCampaignSummary } from '@/lib/campaign-summary-storage';
import { buildContextBody, stripChoiceBlocks, DEFAULT_CONTEXT_STATE, type ScribeContextState } from '@/lib/scribe-context';

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

const INTENSITY_LABELS: Record<number, { name: string; desc: string }> = {
  1: { name: 'Subtle', desc: 'Light touch' },
  2: { name: 'Moderate', desc: 'Balanced' },
  3: { name: 'Enhanced', desc: 'Noticeable flair' },
  4: { name: 'Dramatic', desc: 'Bold rewrite' },
  5: { name: 'Maximum', desc: 'Full transformation' },
};

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
  const [toneIntensity, setToneIntensity] = useState(3);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState(loadScribeModel);
  const [aiUsage, setAiUsage] = useState<TokenUsage | null>(null);
  const [ctxState, setCtxState] = useState<ScribeContextState>(DEFAULT_CONTEXT_STATE);

  const stories = useSavedStories();

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    saveScribeModel(modelId);
  }, []);

  const handleProcess = useCallback(() => {
    if (!inputText.trim()) {
      toast.error('Paste or type some text first');
      return;
    }
    setIsProcessing(true);
    setAiUsage(null);
    setTimeout(() => {
      let textToProcess = inputText;
      if (ctxState.stripGamePrompts) textToProcess = stripChoiceBlocks(textToProcess);
      const result = processTextOffline(textToProcess, {
        ...defaultProcessingOptions,
        narrativeStyle: style,
        toneIntensity,
      });
      setOutputText(result);
      setIsProcessing(false);
    }, 50);
  }, [inputText, style, toneIntensity, ctxState.stripGamePrompts]);

  const handleAiProcess = useCallback(async () => {
    if (!inputText.trim()) {
      toast.error('Paste or type some text first');
      return;
    }
    setIsAiProcessing(true);
    setAiUsage(null);
    try {
      let textToProcess = inputText;
      if (ctxState.stripGamePrompts) textToProcess = stripChoiceBlocks(textToProcess);

      const edgeFn = getEdgeFunctionForModel(selectedModel);
      const isAnthropic = isAnthropicModel(selectedModel);

      const campaignSummary = loadCampaignSummary();
      const cards = loadCharacterCards();
      const contextExtra = buildContextBody(ctxState, campaignSummary, stories.stories, cards);

      const userKey = loadApiKey('anthropic') || undefined;
      const body = isAnthropic
        ? { text: textToProcess, style, intensity: toneIntensity, model: selectedModel, user_api_key: userKey, ...contextExtra }
        : { text: textToProcess, style, model: selectedModel, ...contextExtra };

      const { data, error } = await supabase.functions.invoke(edgeFn, { body });
      if (error) throw error;

      const narrative = isAnthropic ? data.text : data.narrative;
      if (!narrative) throw new Error(data.error || 'No output returned');

      setOutputText(narrative);
      if (data.usage) setAiUsage(data.usage);

      toast.success('AI processing complete');
    } catch (err) {
      console.error('AI processing error:', err);
      toast.error(err instanceof Error ? err.message : 'AI processing failed');
    } finally {
      setIsAiProcessing(false);
    }
  }, [inputText, style, toneIntensity, selectedModel, ctxState, stories.stories]);

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
    const title = `Novel — ${new Date().toLocaleDateString()}`;
    const newStory = stories.createStory(title, outputText, style);
    toast.success('Saved as story', {
      style: { background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.5)', color: '#fb7185' },
    });
    // Auto-chain: set context to the newly saved story
    if (ctxState.autoChainEnabled) {
      setCtxState(prev => ({ ...prev, contextStoryId: newStory.id }));
    }
  }, [outputText, style, stories, ctxState.autoChainEnabled]);

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
            <h2 className="font-cinzel font-semibold text-lg text-foreground">Novel Builder</h2>
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

          {/* Style + Model selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                AI Model
              </label>
              <Select value={selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="border-rose-500/20 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCRIBE_MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-1.5">
                        {m.label}
                        {m.provider === 'anthropic' && <span className="text-[10px] text-muted-foreground">(key)</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Context Pipeline Panel */}
          <ScribeContextPanel
            state={ctxState}
            onChange={setCtxState}
            stories={stories.stories}
            accent="rose"
          />

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleProcess}
              disabled={!inputText.trim() || isProcessing || isAiProcessing}
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {isProcessing ? 'Processing…' : 'Transform'}
            </Button>
            <Button
              onClick={handleAiProcess}
              disabled={!inputText.trim() || isProcessing || isAiProcessing}
              variant="outline"
              className="flex-1 gap-2 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            >
              {isAiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              {isAiProcessing ? 'AI Working…' : 'AI'}
            </Button>
          </div>

          {/* Tone Intensity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tone
              </label>
              <span className="text-xs text-rose-400 font-medium">
                {INTENSITY_LABELS[toneIntensity]?.name} — {INTENSITY_LABELS[toneIntensity]?.desc}
              </span>
            </div>
            <Slider
              value={[toneIntensity]}
              onValueChange={([v]) => setToneIntensity(v)}
              min={1}
              max={5}
              step={1}
              className="[&_[role=slider]]:border-rose-500 [&_[role=slider]]:bg-rose-500 [&_.range]:bg-rose-500"
            />
          </div>

          {/* Output */}
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

              {/* Usage stats */}
              {aiUsage && (
                <div className="text-[11px] text-muted-foreground bg-muted/30 rounded px-2.5 py-1.5 border border-border/50">
                  {formatUsage(aiUsage, isAnthropicModel(selectedModel) ? selectedModel : undefined)}
                </div>
              )}

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
