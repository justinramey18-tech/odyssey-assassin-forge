import { useState, useCallback } from 'react';
import { Sparkles, Loader2, RefreshCw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { EquipmentSlotType, Rarity } from '@/lib/inventory/types';
import { HomebrewGearItem, SLOT_ICONS } from '@/lib/inventory/homebrewGear';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

interface AIGearResult {
  name: string;
  slotType: EquipmentSlotType;
  rarity: Rarity;
  level: number;
  icon: string;
  ac?: number;
  damage?: string;
  attackBonus?: number;
  weight: number;
  value: number;
  description: string;
  properties: string[];
}

interface HomebrewGearAIProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (items: HomebrewGearItem[]) => void;
}

export function HomebrewGearAI({ open, onOpenChange, onSave }: HomebrewGearAIProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AIGearResult[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResults([]);
    setSelected(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('homebrew-assistant', {
        body: {
          prompt: prompt.trim(),
          context: { tree: 'warrior', type: 'active' },
          mode: 'batch_gear',
          count: 4,
        },
      });

      if (error) throw error;
      const content = data?.result || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Could not parse AI response');

      const parsed: AIGearResult[] = JSON.parse(jsonMatch[0]);
      setResults(parsed);
      setSelected(new Set(parsed.map((_: AIGearResult, i: number) => i)));
    } catch (err) {
      console.error('AI gear generation error:', err);
      toast.error('Failed to generate gear. Try again.');
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const regenerateOne = useCallback(async (idx: number) => {
    setRegeneratingIdx(idx);
    try {
      const existingNames = results.map(r => r.name).filter((_, i) => i !== idx);
      const { data, error } = await supabase.functions.invoke('homebrew-assistant', {
        body: {
          prompt: `${prompt.trim()}\n\nAvoid these names: ${existingNames.join(', ')}`,
          context: { tree: 'warrior', type: 'active' },
          mode: 'gear_concept',
        },
      });

      if (error) throw error;
      const content = data?.result || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse AI response');

      const parsed: AIGearResult = JSON.parse(jsonMatch[0]);
      setResults(prev => prev.map((r, i) => (i === idx ? parsed : r)));
    } catch (err) {
      console.error('Regeneration error:', err);
      toast.error('Failed to regenerate item');
    } finally {
      setRegeneratingIdx(null);
    }
  }, [prompt, results]);

  const handleToggle = useCallback((idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    const items: HomebrewGearItem[] = Array.from(selected).map(idx => {
      const r = results[idx];
      return {
        id: `homebrew-gear-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: r.name,
        slotType: r.slotType || 'primary_weapon',
        rarity: r.rarity || 'common',
        level: r.level || 1,
        icon: r.icon || SLOT_ICONS[r.slotType || 'primary_weapon'],
        stats: {
          ac: r.ac,
          damage: r.damage,
          attackBonus: r.attackBonus,
        },
        properties: r.properties || [],
        weight: r.weight || 1,
        value: r.value || 0,
        description: r.description,
        enchantments: [],
        isHomebrew: true as const,
        createdAt: new Date().toISOString(),
      };
    });

    onSave(items);
    setResults([]);
    setPrompt('');
    onOpenChange(false);
    toast.success(`${items.length} item(s) added!`);
  }, [selected, results, onSave, onOpenChange]);

  const rarityColor: Record<string, string> = {
    common: 'text-muted-foreground',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-amber-400',
    artifact: 'text-orange-500',
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[90vw] max-w-[400px] p-0 bg-background">
        <SheetHeader className="p-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 font-cinzel">
            <Sparkles className="w-5 h-5 text-amber-400" />
            AI Gear Forge
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Describe the gear you want</Label>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g. Shadow-themed assassin daggers, or Greek warrior armor set..."
                rows={3}
                className="bg-muted/30 resize-none"
                maxLength={30000}
              />
            </div>

            <Button
              onClick={generate}
              disabled={loading || !prompt.trim()}
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Generating...' : 'Generate Gear'}
            </Button>

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {selected.size}/{results.length} selected
                </p>
                {results.map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "border rounded-lg p-3 space-y-1 transition-colors",
                      selected.has(idx) ? "border-amber-500/50 bg-amber-500/5" : "border-border/50 bg-muted/10"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selected.has(idx)}
                        onCheckedChange={() => handleToggle(idx)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className={cn("font-bold text-sm truncate", rarityColor[item.rarity] || 'text-foreground')}>
                          {item.name}
                        </h4>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {item.slotType?.replace('_', ' ')} · {item.rarity} · Lv {item.level}
                        </p>
                        {item.damage && <p className="text-xs">⚔️ {item.damage}</p>}
                        {item.ac && <p className="text-xs">🛡️ +{item.ac} AC</p>}
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        disabled={regeneratingIdx === idx}
                        onClick={() => regenerateOne(idx)}
                      >
                        {regeneratingIdx === idx ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  onClick={handleSave}
                  disabled={selected.size === 0}
                  className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="w-4 h-4" />
                  Save {selected.size} Item(s)
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
