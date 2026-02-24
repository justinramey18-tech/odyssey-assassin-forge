import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, BookOpen, ScrollText, Link2, Scissors, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CharacterCardEditor } from './CharacterCardEditor';
import { ProtagonistCardEditor } from './ProtagonistCardEditor';
import { loadCharacterCards, saveCharacterCards, addCharacterCard, removeCharacterCard, updateCharacterCard, type CharacterCard } from '@/lib/character-cards';
import { loadProtagonistCards, saveProtagonistCards, addProtagonistCard, removeProtagonistCard, updateProtagonistCard, type ProtagonistCard } from '@/lib/protagonist-cards';
import { loadCampaignSummary, loadNovelBuilderSummary, saveNovelBuilderSummary, SUMMARY_MAX_CHARS } from '@/lib/campaign-summary-storage';
import { loadToggle, saveToggle } from '@/lib/scribe-settings-storage';
import type { SavedStory } from '@/hooks/use-saved-stories';
import type { ScribeContextState, ScribeProcessingMode, TargetMultiplier } from '@/lib/scribe-context';

interface ScribeContextPanelProps {
  state: ScribeContextState;
  onChange: (state: ScribeContextState) => void;
  stories: SavedStory[];
  accent?: 'amber' | 'rose' | 'purple';
  novelBuilderMode?: boolean;
}

const MULTIPLIER_LABELS: Record<number, string> = {
  1.5: '1.5× — Light expansion',
  2: '2× — Moderate expansion',
  3: '3× — Heavy expansion',
};

export function ScribeContextPanel({ state, onChange, stories, accent = 'amber', novelBuilderMode = false }: ScribeContextPanelProps) {
  const [contextOpen, setContextOpen] = useState(false);
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [protagonists, setProtagonists] = useState<ProtagonistCard[]>([]);
  const [hasSummary, setHasSummary] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summarySaved, setSummarySaved] = useState(false);
  const [npcMasterEnabled, setNpcMasterEnabled] = useState(() => loadToggle('novel-npc-master-enabled'));
  const [protagonistMasterEnabled, setProtagonistMasterEnabled] = useState(() => loadToggle('novel-protagonist-master-enabled'));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCards(loadCharacterCards());
    if (novelBuilderMode) {
      setProtagonists(loadProtagonistCards());
    }
    if (novelBuilderMode) {
      const loaded = loadNovelBuilderSummary() ?? '';
      setSummaryText(loaded);
      setHasSummary(loaded.length > 0);
    } else {
      setHasSummary(!!loadCampaignSummary());
    }
  }, [novelBuilderMode]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleSummaryChange = useCallback((text: string) => {
    const trimmed = text.slice(0, SUMMARY_MAX_CHARS);
    setSummaryText(trimmed);
    setHasSummary(trimmed.length > 0);
    setSummarySaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNovelBuilderSummary(trimmed);
      setSummarySaved(true);
      setTimeout(() => setSummarySaved(false), 2000);
    }, 1000);
  }, []);

  const update = useCallback((patch: Partial<ScribeContextState>) => {
    onChange({ ...state, ...patch });
  }, [state, onChange]);

  // NPC card handlers
  const handleAddCard = useCallback((card: Omit<CharacterCard, 'id'>) => {
    const newCard = addCharacterCard(card);
    setCards(prev => [...prev, newCard]);
  }, []);

  const handleRemoveCard = useCallback((id: string) => {
    removeCharacterCard(id);
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleUpdateCard = useCallback((id: string, updates: Partial<Omit<CharacterCard, 'id'>>) => {
    updateCharacterCard(id, updates);
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  // Protagonist card handlers
  const handleAddProtagonist = useCallback((card: Omit<ProtagonistCard, 'id'>) => {
    const newCard = addProtagonistCard(card);
    if (newCard) {
      setProtagonists(prev => [...prev, newCard]);
    }
  }, []);

  const handleRemoveProtagonist = useCallback((id: string) => {
    removeProtagonistCard(id);
    setProtagonists(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleUpdateProtagonist = useCallback((id: string, updates: Partial<Omit<ProtagonistCard, 'id'>>) => {
    updateProtagonistCard(id, updates);
    setProtagonists(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const accentBorder = accent === 'rose' ? 'border-rose-500/30' : accent === 'purple' ? 'border-purple-500/30' : 'border-amber-500/30';
  const accentText = accent === 'rose' ? 'text-rose-400' : accent === 'purple' ? 'text-purple-400' : 'text-amber-400';

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Processing Mode
        </label>
        <ToggleGroup
          type="single"
          value={state.processingMode}
          onValueChange={(v) => {
            if (v) {
              const mode = v as ScribeProcessingMode;
              update({
                processingMode: mode,
                stripGamePrompts: mode === 'enhance' ? true : state.stripGamePrompts,
              });
            }
          }}
          className="w-full"
        >
          <ToggleGroupItem value="transform" className="flex-1 text-xs gap-1">Transform</ToggleGroupItem>
          <ToggleGroupItem value="enhance" className="flex-1 text-xs gap-1">Enhance</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-[10px] text-muted-foreground">
          {state.processingMode === 'enhance'
            ? 'Preserves original text verbatim, adds descriptive prose around it'
            : 'Rewrites text into new narrative prose'}
        </p>
      </div>

      {/* Multiplier */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Length</label>
          <span className={`text-xs font-medium ${accentText}`}>{MULTIPLIER_LABELS[state.targetMultiplier]}</span>
        </div>
        <ToggleGroup
          type="single"
          value={String(state.targetMultiplier)}
          onValueChange={(v) => v && update({ targetMultiplier: parseFloat(v) as TargetMultiplier })}
          className="w-full"
        >
          <ToggleGroupItem value="1.5" className="flex-1 text-xs">1.5×</ToggleGroupItem>
          <ToggleGroupItem value="2" className="flex-1 text-xs">2×</ToggleGroupItem>
          <ToggleGroupItem value="3" className="flex-1 text-xs">3×</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Context Section (collapsible) */}
      <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
        <CollapsibleTrigger className={`flex items-center gap-2 w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:${accentText} transition-colors py-1`}>
          {contextOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Context Pipeline
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Campaign Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ScrollText className="w-3 h-3 text-muted-foreground" />
                <Label className="text-xs cursor-pointer" htmlFor="campaign-summary-toggle">Campaign Summary</Label>
              </div>
              <Switch
                id="campaign-summary-toggle"
                checked={state.includeCampaignSummary}
                onCheckedChange={(v) => update({ includeCampaignSummary: v })}
                disabled={!novelBuilderMode && !hasSummary}
              />
            </div>

            {novelBuilderMode && state.includeCampaignSummary && (
              <div className="space-y-1">
                <Textarea
                  value={summaryText}
                  onChange={(e) => handleSummaryChange(e.target.value)}
                  placeholder="Describe your campaign world, characters, relationships, locations, and rules..."
                  className={`resize-none min-h-[120px] text-xs ${accentBorder} bg-background/50`}
                  maxLength={SUMMARY_MAX_CHARS}
                />
                <div className="flex items-center justify-between">
                  {summarySaved ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 transition-opacity">
                      <Check className="w-3 h-3" /> Saved
                    </span>
                  ) : <span />}
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {summaryText.length.toLocaleString()} / {SUMMARY_MAX_CHARS.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {!novelBuilderMode && !hasSummary && (
              <p className="text-[9px] text-muted-foreground/60 pl-4">
                No campaign summary saved — create one in the AI DM
              </p>
            )}
          </div>

          {/* Story Context */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3 h-3 text-muted-foreground" />
              <Label className="text-xs">Story Context</Label>
            </div>
            <Select
              value={state.contextStoryId ?? 'none'}
              onValueChange={(v) => update({ contextStoryId: v === 'none' ? null : v })}
            >
              <SelectTrigger className={`h-8 text-xs ${accentBorder}`}>
                <SelectValue placeholder="No story context" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {stories.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title} ({s.wordCount.toLocaleString()}w)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground/70 pl-4">
              {stories.length === 0
                ? 'Save a story from your output to use as voice and plot context here'
                : state.contextStoryId
                  ? 'The last section of this story provides voice, tone, and plot continuity'
                  : 'Select a saved story — its last section provides voice and plot continuity'}
            </p>
          </div>

          {/* Context word count slider */}
          {state.contextStoryId && (
            <div className="space-y-1.5 pl-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Context size</Label>
                <span className={`text-[10px] font-mono ${accentText}`}>
                  {state.contextWordCount.toLocaleString()} words
                </span>
              </div>
              <Slider
                value={[state.contextWordCount]}
                onValueChange={([v]) => update({ contextWordCount: v })}
                min={1000}
                max={10000}
                step={500}
              />
            </div>
          )}

          {/* Auto-chain */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Link2 className="w-3 h-3 text-muted-foreground" />
              <Label className="text-xs cursor-pointer" htmlFor="auto-chain-toggle">Auto-Chain</Label>
            </div>
            <Switch
              id="auto-chain-toggle"
              checked={state.autoChainEnabled}
              onCheckedChange={(v) => update({ autoChainEnabled: v })}
            />
          </div>
          <p className="text-[10px] text-muted-foreground pl-4 -mt-1.5">
            Saving output auto-selects that story as context for next run
          </p>

          {/* Strip game prompts */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Scissors className="w-3 h-3 text-muted-foreground" />
              <Label className="text-xs cursor-pointer" htmlFor="strip-prompts-toggle">Strip Game Prompts</Label>
            </div>
            <Switch
              id="strip-prompts-toggle"
              checked={state.stripGamePrompts}
              onCheckedChange={(v) => update({ stripGamePrompts: v })}
            />
          </div>

          {/* Protagonist Cards (novel builder only) */}
          {novelBuilderMode && (
            <ProtagonistCardEditor
              cards={protagonists}
              onAdd={handleAddProtagonist}
              onRemove={handleRemoveProtagonist}
              onUpdate={handleUpdateProtagonist}
              masterEnabled={protagonistMasterEnabled}
              onMasterToggle={(v) => { setProtagonistMasterEnabled(v); saveToggle('novel-protagonist-master-enabled', v); }}
            />
          )}

          {/* NPC Character Cards */}
          <CharacterCardEditor
            cards={cards}
            onAdd={handleAddCard}
            onRemove={handleRemoveCard}
            onUpdate={handleUpdateCard}
            masterEnabled={npcMasterEnabled}
            onMasterToggle={(v) => { setNpcMasterEnabled(v); saveToggle('novel-npc-master-enabled', v); }}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** Expose card loaders for parent components that need them for the request body */
export { loadCharacterCards } from '@/lib/character-cards';
export { loadProtagonistCards } from '@/lib/protagonist-cards';
