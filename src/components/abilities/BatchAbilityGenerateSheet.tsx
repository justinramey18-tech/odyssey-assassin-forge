import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Plus, RefreshCw } from 'lucide-react';
import { useHomebrewAssistant } from '@/hooks/use-homebrew-assistant';
import { HomebrewAbility } from '@/lib/abilityCustomization/types';
import { AbilityTree, ActionType, UsageType } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BatchAbilityGenerateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHomebrew: (homebrew: Omit<HomebrewAbility, 'id' | 'createdAt' | 'updatedAt'>) => string;
}

interface GeneratedAbility {
  name: string;
  actionType: string;
  usageType: string;
  tier1: string;
  tier2: string;
  tier3: string;
  dice?: { tier1?: string; tier2?: string; tier3?: string };
  cooldown?: number;
  notes?: string;
}

function parseDice(diceStr?: string): { count: number; die: number } | undefined {
  if (!diceStr) return undefined;
  const match = diceStr.match(/(\d+)d(\d+)/);
  if (!match) return undefined;
  return { count: parseInt(match[1]), die: parseInt(match[2]) };
}

export function BatchAbilityGenerateSheet({ isOpen, onClose, onAddHomebrew }: BatchAbilityGenerateSheetProps) {
  const [prompt, setPrompt] = useState('');
  const [tree, setTree] = useState<AbilityTree>('hunter');
  const [type, setType] = useState<'active' | 'passive'>('active');
  const [count, setCount] = useState('3');
  const [results, setResults] = useState<GeneratedAbility[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const { isLoading, generateBatchAbilities } = useHomebrewAssistant();

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('Please describe what kind of abilities you want');
      return;
    }
    setResults([]);
    setSelected(new Set());
    setExpanded(new Set());

    const items = await generateBatchAbilities(
      prompt.trim(),
      { tree, type },
      parseInt(count)
    );
    if (items.length === 0) {
      toast.error('Failed to generate abilities. Try again with a different prompt.');
      return;
    }
    const valid = (items as unknown as GeneratedAbility[]).filter(
      a => a.name && a.tier1
    );
    if (valid.length === 0) {
      toast.error('No valid abilities generated. Try a different prompt.');
      return;
    }
    setResults(valid);
    setSelected(new Set(valid.map((_, i) => i)));
  }, [prompt, tree, type, count, generateBatchAbilities]);

  const handleAddSelected = useCallback(() => {
    let added = 0;
    results.forEach((ability, i) => {
      if (!selected.has(i)) return;

      const actionType = (['action', 'bonus_action', 'reaction', 'passive'].includes(ability.actionType)
        ? ability.actionType : (type === 'passive' ? 'passive' : 'action')) as ActionType;

      const usageType = (['at_will', 'short_rest', 'long_rest'].includes(ability.usageType)
        ? ability.usageType : 'at_will') as UsageType;

      const homebrew: Omit<HomebrewAbility, 'id' | 'createdAt' | 'updatedAt'> = {
        name: ability.name,
        tree,
        icon: 'Sparkles',
        type,
        actionType,
        usageType,
        tierEffects: [
          { tier: 1, description: ability.tier1 },
          { tier: 2, description: ability.tier2 || 'Enhanced version.' },
          { tier: 3, description: ability.tier3 || 'Mastered version.' },
        ],
        dice: ability.dice ? {
          tier1: parseDice(ability.dice.tier1),
          tier2: parseDice(ability.dice.tier2),
          tier3: parseDice(ability.dice.tier3),
        } : undefined,
        cooldownMinutes: ability.cooldown ?? 0,
        notes: ability.notes,
      };
      onAddHomebrew(homebrew);
      added++;
    });
    if (added > 0) {
      toast.success(`Added ${added} abilit${added > 1 ? 'ies' : 'y'}!`);
      setResults([]);
      setPrompt('');
      onClose();
    }
  }, [results, selected, tree, type, onAddHomebrew, onClose]);

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

  const handleRegenerateOne = useCallback(async (index: number) => {
    if (!prompt.trim()) return;
    setRegeneratingIndex(index);
    const oldName = results[index]?.name;
    const regenPrompt = `${prompt.trim()}. Generate exactly 1 ability. Make it different from these existing names: ${results.map(a => a.name).join(', ')}`;
    const items = await generateBatchAbilities(regenPrompt, { tree, type }, 1);
    setRegeneratingIndex(null);
    const valid = (items as unknown as GeneratedAbility[]).filter(a => a.name && a.tier1);
    if (valid.length > 0) {
      setResults(prev => prev.map((item, i) => i === index ? valid[0] : item));
      toast.success(`Replaced "${oldName}" with "${valid[0].name}"`);
    } else {
      toast.error('Failed to regenerate. Try again.');
    }
  }, [prompt, results, tree, type, generateBatchAbilities]);

  const treeBadgeColors: Record<string, string> = {
    hunter: 'bg-emerald-500/20 text-emerald-400',
    warrior: 'bg-red-500/20 text-red-400',
    assassin: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-cinzel text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-homebrew" />
            AI Generate Multiple Abilities
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 mt-4">
          {/* Prompt */}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a theme... e.g. 'shadow-themed assassin abilities'"
            className="min-h-[80px] bg-card/50 border-border/50"
            maxLength={500}
          />

          {/* Constraints */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tree:</span>
              <Select value={tree} onValueChange={(v) => setTree(v as AbilityTree)}>
                <SelectTrigger className="w-28 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hunter">🏹 Hunter</SelectItem>
                  <SelectItem value="warrior">⚔️ Warrior</SelectItem>
                  <SelectItem value="assassin">🗡️ Assassin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Type:</span>
              <Select value={type} onValueChange={(v) => setType(v as 'active' | 'passive')}>
                <SelectTrigger className="w-24 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="passive">Passive</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              className="ml-auto gap-2 bg-homebrew/80 hover:bg-homebrew text-homebrew-foreground"
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
                  {results.length} abilit{results.length > 1 ? 'ies' : 'y'} generated
                </span>
                <span className="text-xs text-muted-foreground">
                  {selected.size} selected
                </span>
              </div>

              {results.map((ability, i) => (
                <Collapsible key={i} open={expanded.has(i)} onOpenChange={() => toggleExpand(i)}>
                  <div className={cn(
                    'rounded-lg border p-3 transition-colors',
                    selected.has(i) ? 'border-homebrew/50 bg-homebrew/5' : 'border-border/30 bg-card/30 opacity-60'
                  )}>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selected.has(i)}
                        onCheckedChange={() => toggleSelect(i)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{ability.name}</div>
                        <div className="text-xs text-muted-foreground flex gap-2 items-center">
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', treeBadgeColors[tree])}>
                            {tree}
                          </span>
                          <span className="capitalize">{ability.actionType?.replace('_', ' ')}</span>
                          <span>·</span>
                          <span className="capitalize">{ability.usageType?.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-homebrew"
                          disabled={regeneratingIndex !== null}
                          onClick={(e) => { e.stopPropagation(); handleRegenerateOne(i); }}
                          title="Regenerate this ability"
                        >
                          {regeneratingIndex === i ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            {expanded.has(i) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent className="mt-2 pt-2 border-t border-border/20 space-y-1">
                      <p className="text-xs"><span className="font-medium text-foreground">Tier 1:</span> <span className="text-muted-foreground">{ability.tier1}</span></p>
                      <p className="text-xs"><span className="font-medium text-foreground">Tier 2:</span> <span className="text-muted-foreground">{ability.tier2}</span></p>
                      <p className="text-xs"><span className="font-medium text-foreground">Tier 3:</span> <span className="text-muted-foreground">{ability.tier3}</span></p>
                      {ability.notes && (
                        <p className="text-xs text-muted-foreground/70 italic mt-1">{ability.notes}</p>
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
              className="w-full gap-2 bg-homebrew/80 hover:bg-homebrew text-homebrew-foreground"
            >
              <Plus className="w-4 h-4" />
              Add {selected.size} Selected Abilit{selected.size !== 1 ? 'ies' : 'y'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
