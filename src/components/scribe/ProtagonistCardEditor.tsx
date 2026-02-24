import { useState, useCallback } from 'react';
import { Crown, Plus, Trash2, ChevronDown, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ProtagonistCard, POVStyle } from '@/lib/protagonist-cards';

interface ProtagonistCardEditorProps {
  cards: ProtagonistCard[];
  onAdd: (card: Omit<ProtagonistCard, 'id'>) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<ProtagonistCard, 'id'>>) => void;
  masterEnabled: boolean;
  onMasterToggle: (enabled: boolean) => void;
}

const POV_LABELS: Record<POVStyle, string> = {
  first: '1st Person',
  third: '3rd Person',
  rotating: 'Rotating',
};

const DETAIL_FIELDS: { key: keyof ProtagonistCard; label: string; placeholder: string }[] = [
  { key: 'backstory', label: 'Backstory', placeholder: 'Character history and origin...' },
  { key: 'goalsConflicts', label: 'Goals & Conflicts', placeholder: 'Current goals and internal/external conflicts...' },
  { key: 'relationships', label: 'Relationships', placeholder: 'Key relationships with other characters...' },
  { key: 'appearanceMannerisms', label: 'Appearance & Mannerisms', placeholder: 'Physical appearance and habitual mannerisms...' },
  { key: 'flawsWeaknesses', label: 'Flaws & Weaknesses', placeholder: 'Character flaws and vulnerabilities...' },
  { key: 'skillsAbilities', label: 'Skills & Abilities', placeholder: 'Notable skills, abilities, or powers...' },
  { key: 'characterArc', label: 'Character Arc', placeholder: 'Expected character development or arc...' },
];

export function ProtagonistCardEditor({
  cards, onAdd, onRemove, onUpdate, masterEnabled, onMasterToggle,
}: ProtagonistCardEditorProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<'choose' | 'manual' | 'parse'>('choose');
  const [draft, setDraft] = useState({ name: '', raceClass: '', personality: '', speechStyle: '', povStyle: 'third' as POVStyle });
  const [parseText, setParseText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const resetAddState = useCallback(() => {
    setAddMode('choose');
    setDraft({ name: '', raceClass: '', personality: '', speechStyle: '', povStyle: 'third' });
    setParseText('');
  }, []);

  const handleManualAdd = useCallback(() => {
    if (!draft.name.trim() || !draft.personality.trim() || !draft.speechStyle.trim()) return;
    onAdd({
      enabled: true,
      name: draft.name.trim(),
      raceClass: draft.raceClass.trim() || undefined,
      personality: draft.personality.trim(),
      speechStyle: draft.speechStyle.trim(),
      povStyle: draft.povStyle,
    });
    resetAddState();
    setAddOpen(false);
  }, [draft, onAdd, resetAddState]);

  const handleParse = useCallback(async () => {
    if (!parseText.trim() || parseText.trim().length < 10) {
      toast.error('Provide at least 10 characters of description');
      return;
    }
    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-protagonist', {
        body: { text: parseText.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const p = data.protagonist;
      setDraft({
        name: p.name || '',
        raceClass: p.raceClass || '',
        personality: p.personality || '',
        speechStyle: p.speechStyle || '',
        povStyle: p.povStyle || 'third',
      });

      // Build the full card with detail fields
      const newCard: Omit<ProtagonistCard, 'id'> = {
        enabled: true,
        name: p.name || 'Unnamed',
        raceClass: p.raceClass || undefined,
        personality: p.personality || '',
        speechStyle: p.speechStyle || '',
        povStyle: p.povStyle || 'third',
        backstory: p.backstory || undefined,
        goalsConflicts: p.goalsConflicts || undefined,
        relationships: p.relationships || undefined,
        appearanceMannerisms: p.appearanceMannerisms || undefined,
        flawsWeaknesses: p.flawsWeaknesses || undefined,
        skillsAbilities: p.skillsAbilities || undefined,
        characterArc: p.characterArc || undefined,
      };
      onAdd(newCard);
      resetAddState();
      setAddOpen(false);
      toast.success(`Parsed "${p.name}" successfully`);
    } catch (err) {
      console.error('Parse error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to parse character');
    } finally {
      setIsParsing(false);
    }
  }, [parseText, onAdd, resetAddState]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const canAdd = cards.length < 3;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Crown className="w-3 h-3 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Protagonists ({cards.filter(c => c.enabled).length}/{cards.length})
          </span>
          <Switch
            checked={masterEnabled}
            onCheckedChange={onMasterToggle}
            className="ml-1 scale-75"
          />
        </div>
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetAddState(); }}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 text-amber-400 hover:text-amber-300"
              disabled={!canAdd}
            >
              <Plus className="w-3 h-3" /> Add{!canAdd && ' (3 max)'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                Add Protagonist
              </DialogTitle>
            </DialogHeader>

            {addMode === 'choose' && (
              <div className="grid grid-cols-2 gap-3 py-4">
                <button
                  onClick={() => setAddMode('parse')}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
                >
                  <Sparkles className="w-6 h-6 text-amber-400" />
                  <span className="text-sm font-medium">Paste Description</span>
                  <span className="text-[10px] text-muted-foreground text-center">AI extracts fields automatically</span>
                </button>
                <button
                  onClick={() => setAddMode('manual')}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <Plus className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Manual Entry</span>
                  <span className="text-[10px] text-muted-foreground text-center">Fill in fields yourself</span>
                </button>
              </div>
            )}

            {addMode === 'parse' && (
              <div className="space-y-3 py-2">
                <Textarea
                  value={parseText}
                  onChange={(e) => setParseText(e.target.value)}
                  placeholder="Paste a character description, backstory, or bio here. The AI will extract name, personality, speech style, backstory, and more..."
                  className="min-h-[180px] text-sm resize-none border-amber-500/30"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleParse}
                    disabled={isParsing || parseText.trim().length < 10}
                    className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isParsing ? 'Parsing…' : 'Parse & Add'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAddMode('choose')}>Back</Button>
                </div>
              </div>
            )}

            {addMode === 'manual' && (
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Name *</Label>
                    <Input className="h-7 text-xs" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Aelindra" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Race/Class</Label>
                    <Input className="h-7 text-xs" value={draft.raceClass} onChange={e => setDraft(d => ({ ...d, raceClass: e.target.value }))} placeholder="Half-Elf Warlock" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Personality *</Label>
                  <Input className="h-7 text-xs" value={draft.personality} onChange={e => setDraft(d => ({ ...d, personality: e.target.value }))} placeholder="Cunning, charismatic, haunted by past" />
                </div>
                <div>
                  <Label className="text-[10px]">Speech Style *</Label>
                  <Input className="h-7 text-xs" value={draft.speechStyle} onChange={e => setDraft(d => ({ ...d, speechStyle: e.target.value }))} placeholder="Sardonic wit, avoids direct answers" />
                </div>
                <div>
                  <Label className="text-[10px]">POV Style</Label>
                  <Select value={draft.povStyle} onValueChange={(v) => setDraft(d => ({ ...d, povStyle: v as POVStyle }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first">1st Person</SelectItem>
                      <SelectItem value="third">3rd Person Close</SelectItem>
                      <SelectItem value="rotating">Rotating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={handleManualAdd}
                    disabled={!draft.name.trim() || !draft.personality.trim() || !draft.speechStyle.trim()}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddMode('choose')}>Back</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Card list */}
      {cards.map(card => (
        <Collapsible key={card.id} open={expandedCards.has(card.id)} onOpenChange={() => toggleExpanded(card.id)}>
          <div className={`flex items-center gap-2 rounded-lg border bg-card/50 px-2 py-1.5 transition-opacity ${
            card.enabled && masterEnabled ? 'border-amber-500/30' : 'border-border/30 opacity-50'
          }`}>
            {/* Toggle dot */}
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(card.id, { enabled: !card.enabled }); }}
              className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                card.enabled ? 'bg-emerald-400' : 'bg-muted-foreground/40'
              }`}
              title={card.enabled ? 'Disable' : 'Enable'}
            />
            <CollapsibleTrigger className="flex-1 text-left text-sm font-medium truncate flex items-center gap-1.5">
              {expandedCards.has(card.id) ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
              <span className={card.enabled ? '' : 'line-through'}>{card.name}</span>
              {card.raceClass && <span className="text-[10px] text-muted-foreground">({card.raceClass})</span>}
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 ml-auto shrink-0">
                {POV_LABELS[card.povStyle]}
              </span>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onRemove(card.id)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
          <CollapsibleContent className="pl-5 pt-1 space-y-2">
            {/* Quick fields (inline editable) */}
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground"><strong>Personality:</strong> {card.personality}</div>
              <div className="text-[11px] text-muted-foreground"><strong>Speech:</strong> {card.speechStyle}</div>
            </div>
            {/* Detail fields */}
            <div className="space-y-1.5">
              {DETAIL_FIELDS.map(field => (
                <div key={field.key}>
                  <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                  <Textarea
                    value={(card[field.key] as string) || ''}
                    onChange={(e) => onUpdate(card.id, { [field.key]: e.target.value || undefined })}
                    placeholder={field.placeholder}
                    className="min-h-[48px] text-[11px] resize-none border-amber-500/20 bg-background/50"
                  />
                </div>
              ))}
            </div>
            {/* POV selector */}
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground">POV</Label>
              <Select value={card.povStyle} onValueChange={(v) => onUpdate(card.id, { povStyle: v as POVStyle })}>
                <SelectTrigger className="h-6 text-[10px] w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">1st Person</SelectItem>
                  <SelectItem value="third">3rd Person Close</SelectItem>
                  <SelectItem value="rotating">Rotating</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
