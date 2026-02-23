import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, BookOpen, ScrollText, Link2, Scissors } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CharacterCardEditor } from './CharacterCardEditor';
import { loadCharacterCards, saveCharacterCards, addCharacterCard, removeCharacterCard, type CharacterCard } from '@/lib/character-cards';
import { loadCampaignSummary } from '@/lib/campaign-summary-storage';
import type { SavedStory } from '@/hooks/use-saved-stories';
import type { ScribeContextState, ScribeProcessingMode, TargetMultiplier } from '@/lib/scribe-context';

interface ScribeContextPanelProps {
  state: ScribeContextState;
  onChange: (state: ScribeContextState) => void;
  stories: SavedStory[];
  /** Accent color for the mode toggle — adapts to parent theme */
  accent?: 'amber' | 'rose' | 'purple';
}

const MULTIPLIER_LABELS: Record<number, string> = {
  1.5: '1.5× — Light expansion',
  2: '2× — Moderate expansion',
  3: '3× — Heavy expansion',
};

export function ScribeContextPanel({ state, onChange, stories, accent = 'amber' }: ScribeContextPanelProps) {
  const [contextOpen, setContextOpen] = useState(false);
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [hasSummary, setHasSummary] = useState(false);

  // Load character cards + check campaign summary on mount
  useEffect(() => {
    setCards(loadCharacterCards());
    setHasSummary(!!loadCampaignSummary());
  }, []);

  const update = useCallback((patch: Partial<ScribeContextState>) => {
    onChange({ ...state, ...patch });
  }, [state, onChange]);

  const handleAddCard = useCallback((card: Omit<CharacterCard, 'id'>) => {
    const newCard = addCharacterCard(card);
    setCards(prev => [...prev, newCard]);
  }, []);

  const handleRemoveCard = useCallback((id: string) => {
    removeCharacterCard(id);
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleUpdateCard = useCallback((id: string, updates: Partial<Omit<CharacterCard, 'id'>>) => {
    const updated = cards.map(c => c.id === id ? { ...c, ...updates } : c);
    saveCharacterCards(updated);
    setCards(updated);
  }, [cards]);

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
          <ToggleGroupItem value="transform" className="flex-1 text-xs gap-1">
            Transform
          </ToggleGroupItem>
          <ToggleGroupItem value="enhance" className="flex-1 text-xs gap-1">
            Enhance
          </ToggleGroupItem>
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
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Target Length
          </label>
          <span className={`text-xs font-medium ${accentText}`}>
            {MULTIPLIER_LABELS[state.targetMultiplier]}
          </span>
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ScrollText className="w-3 h-3 text-muted-foreground" />
              <Label className="text-xs cursor-pointer" htmlFor="campaign-summary-toggle">
                Campaign Summary
              </Label>
              {!hasSummary && (
                <span className="text-[9px] text-muted-foreground/60">(none saved)</span>
              )}
            </div>
            <Switch
              id="campaign-summary-toggle"
              checked={state.includeCampaignSummary}
              onCheckedChange={(v) => update({ includeCampaignSummary: v })}
              disabled={!hasSummary}
            />
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

          {/* Character Cards */}
          <CharacterCardEditor
            cards={cards}
            onAdd={handleAddCard}
            onRemove={handleRemoveCard}
            onUpdate={handleUpdateCard}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** Expose cards for parent components that need them for the request body */
export { loadCharacterCards } from '@/lib/character-cards';
