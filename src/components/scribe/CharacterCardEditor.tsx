import { useState } from 'react';
import { Plus, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CharacterCard } from '@/lib/character-cards';

interface CharacterCardEditorProps {
  cards: CharacterCard[];
  onAdd: (card: Omit<CharacterCard, 'id'>) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<CharacterCard, 'id'>>) => void;
  masterEnabled?: boolean;
  onMasterToggle?: (enabled: boolean) => void;
}

export function CharacterCardEditor({ cards, onAdd, onRemove, onUpdate, masterEnabled = true, onMasterToggle }: CharacterCardEditorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', raceClass: '', personality: '', speechStyle: '' });

  const handleAdd = () => {
    if (!draft.name.trim() || !draft.personality.trim() || !draft.speechStyle.trim()) return;
    onAdd({
      name: draft.name.trim(),
      raceClass: draft.raceClass.trim() || undefined,
      personality: draft.personality.trim(),
      speechStyle: draft.speechStyle.trim(),
      enabled: true,
    });
    setDraft({ name: '', raceClass: '', personality: '', speechStyle: '' });
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <UserRound className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            NPCs ({cards.filter(c => c.enabled !== false).length}/{cards.length})
          </span>
          {onMasterToggle && (
            <Switch
              checked={masterEnabled}
              onCheckedChange={onMasterToggle}
              className="ml-1 scale-75"
            />
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setAdding(!adding)}>
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>

      {/* Existing cards */}
      {cards.map(card => (
        <Collapsible key={card.id}>
          <div className={`flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-2 py-1.5 transition-opacity ${
            (card.enabled !== false) && masterEnabled ? '' : 'opacity-50'
          }`}>
            {/* Toggle dot */}
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(card.id, { enabled: card.enabled === false ? true : false }); }}
              className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                card.enabled !== false ? 'bg-emerald-400' : 'bg-muted-foreground/40'
              }`}
              title={card.enabled !== false ? 'Disable' : 'Enable'}
            />
            <CollapsibleTrigger className="flex-1 text-left text-sm font-medium truncate">
              <span className={card.enabled === false ? 'line-through' : ''}>{card.name}</span>
              {card.raceClass && <span className="ml-1.5 text-[10px] text-muted-foreground">({card.raceClass})</span>}
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onRemove(card.id)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
          <CollapsibleContent className="pl-2 pt-1 space-y-1">
            <div className="text-[11px] text-muted-foreground"><strong>Personality:</strong> {card.personality}</div>
            <div className="text-[11px] text-muted-foreground"><strong>Speech:</strong> {card.speechStyle}</div>
          </CollapsibleContent>
        </Collapsible>
      ))}

      {/* Add form */}
      {adding && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-card/50 p-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Name *</Label>
              <Input className="h-7 text-xs" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Drizzt" />
            </div>
            <div>
              <Label className="text-[10px]">Race/Class</Label>
              <Input className="h-7 text-xs" value={draft.raceClass} onChange={e => setDraft(d => ({ ...d, raceClass: e.target.value }))} placeholder="Drow Ranger" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Personality *</Label>
            <Input className="h-7 text-xs" value={draft.personality} onChange={e => setDraft(d => ({ ...d, personality: e.target.value }))} placeholder="Brooding, honorable, fiercely loyal" />
          </div>
          <div>
            <Label className="text-[10px]">Speech Style *</Label>
            <Input className="h-7 text-xs" value={draft.speechStyle} onChange={e => setDraft(d => ({ ...d, speechStyle: e.target.value }))} placeholder="Formal, poetic, archaic vocabulary" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleAdd} disabled={!draft.name.trim() || !draft.personality.trim() || !draft.speechStyle.trim()}>
              Save Card
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
