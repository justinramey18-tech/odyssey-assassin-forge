import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useHomebrewAssistant } from '@/hooks/use-homebrew-assistant';
import { HomebrewSpell, SPELL_SCHOOL_OPTIONS, SPELL_LEVEL_OPTIONS } from '@/lib/spellCustomization/types';
import { generateHomebrewSpellId } from '@/lib/spellCustomization/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BatchSpellGenerateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSpell: (spell: HomebrewSpell) => void;
}

interface GeneratedSpell {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels?: string;
  damageFormula?: string;
  damageType?: string;
  attackType?: string;
  saveStat?: string;
  healingFormula?: string;
  iconName?: string;
  personalityQuips?: { thunderhead: string; jarvis: string; deadpool: string };
}

export function BatchSpellGenerateSheet({ isOpen, onClose, onAddSpell }: BatchSpellGenerateSheetProps) {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState('3');
  const [results, setResults] = useState<GeneratedSpell[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const { isLoading, generateBatchSpells } = useHomebrewAssistant();

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('Please describe what kind of spells you want');
      return;
    }
    setResults([]);
    setSelected(new Set());
    setExpanded(new Set());

    const items = await generateBatchSpells(prompt.trim(), parseInt(count));
    if (items.length === 0) {
      toast.error('Failed to generate spells. Try again with a different prompt.');
      return;
    }
    // Validate each item
    const valid = (items as unknown as GeneratedSpell[]).filter(
      s => s.name && s.description && typeof s.level === 'number'
    );
    if (valid.length === 0) {
      toast.error('No valid spells generated. Try a different prompt.');
      return;
    }
    setResults(valid);
    setSelected(new Set(valid.map((_, i) => i)));
  }, [prompt, count, generateBatchSpells]);

  const handleAddSelected = useCallback(() => {
    const now = Date.now();
    let added = 0;
    results.forEach((spell, i) => {
      if (!selected.has(i)) return;
      const homebrew: HomebrewSpell = {
        id: generateHomebrewSpellId(),
        name: spell.name,
        level: (spell.level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9) ?? 1,
        school: (spell.school as any) ?? 'evocation',
        castingTime: (spell.castingTime as any) ?? 'action',
        range: spell.range ?? '60 feet',
        components: { verbal: true, somatic: true },
        duration: spell.duration ?? 'Instantaneous',
        concentration: spell.concentration ?? false,
        ritual: spell.ritual ?? false,
        description: spell.description,
        higherLevels: spell.higherLevels || undefined,
        damageFormula: spell.damageFormula || undefined,
        damageType: spell.damageType || undefined,
        attackType: (spell.attackType as any) || undefined,
        saveStat: (spell.saveStat as any) || undefined,
        healingFormula: spell.healingFormula || undefined,
        iconName: spell.iconName ?? 'Sparkles',
        personalityQuips: spell.personalityQuips ?? {
          thunderhead: '', jarvis: '', deadpool: '',
        },
        isHomebrew: true,
        aiGenerated: true,
        createdAt: now,
        updatedAt: now,
      };
      onAddSpell(homebrew);
      added++;
    });
    if (added > 0) {
      toast.success(`Added ${added} spell${added > 1 ? 's' : ''}!`);
      setResults([]);
      setPrompt('');
      onClose();
    }
  }, [results, selected, onAddSpell, onClose]);

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleExpand = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-cinzel text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            AI Generate Multiple Spells
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 mt-4">
          {/* Prompt */}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a theme... e.g. 'frost-themed offensive spells for a wizard'"
            className="min-h-[80px] bg-card/50 border-border/50"
            maxLength={500}
          />

          {/* Controls Row */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Count:</span>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger className="w-16 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="ml-auto gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isLoading ? 'Generating...' : 'Generate'}
            </Button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {results.length} spell{results.length > 1 ? 's' : ''} generated
                </span>
                <span className="text-xs text-muted-foreground">
                  {selected.size} selected
                </span>
              </div>

              {results.map((spell, i) => (
                <Collapsible key={i} open={expanded.has(i)} onOpenChange={() => toggleExpand(i)}>
                  <div className={cn(
                    'rounded-lg border p-3 transition-colors',
                    selected.has(i) ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-border/30 bg-card/30 opacity-60'
                  )}>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selected.has(i)}
                        onCheckedChange={() => toggleSelect(i)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{spell.name}</div>
                        <div className="text-xs text-muted-foreground flex gap-2">
                          <span>{spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}</span>
                          <span>·</span>
                          <span className="capitalize">{spell.school}</span>
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          {expanded.has(i) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="mt-2 pt-2 border-t border-border/20">
                      <p className="text-xs text-muted-foreground leading-relaxed">{spell.description}</p>
                      {spell.damageFormula && (
                        <p className="text-xs mt-1 text-indigo-400">
                          Damage: {spell.damageFormula} {spell.damageType}
                        </p>
                      )}
                      {spell.higherLevels && (
                        <p className="text-xs mt-1 text-muted-foreground italic">
                          At Higher Levels: {spell.higherLevels}
                        </p>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="pt-3 border-t border-border/30">
            <Button
              onClick={handleAddSelected}
              disabled={selected.size === 0}
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Add {selected.size} Selected Spell{selected.size !== 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
