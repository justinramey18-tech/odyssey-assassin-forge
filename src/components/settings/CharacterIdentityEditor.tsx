import { useState } from 'react';
import { useCharacterIdentity, CharacterRelationship } from '@/hooks/use-character-identity';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DND_RACES = [
  'Human', 'Elf', 'Half-Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Orc',
  'Tiefling', 'Dragonborn', 'Aasimar', 'Goliath', 'Tabaxi', 'Firbolg',
  'Kenku', 'Genasi', 'Changeling', 'Warforged', 'Tortle', 'Harengon',
];

const DISPOSITIONS = [
  { value: 'ally', label: 'Ally', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'rival', label: 'Rival', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'neutral', label: 'Neutral', color: 'bg-muted text-muted-foreground border-border' },
  { value: 'enemy', label: 'Enemy', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { value: 'romantic', label: 'Romantic', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  { value: 'mentor', label: 'Mentor', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'patron', label: 'Patron', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
];

function getDispositionStyle(disposition: string) {
  return DISPOSITIONS.find(d => d.value === disposition) ?? DISPOSITIONS[2];
}

const MAX_RELATIONSHIPS = 10;

export function CharacterIdentityEditor() {
  const {
    gender, race, backstory, relationships,
    setGender, setRace, setBackstory,
    addRelationship, updateRelationship, removeRelationship,
  } = useCharacterIdentity();

  const [customGender, setCustomGender] = useState(() =>
    gender && !['Male', 'Female', 'Non-binary'].includes(gender) ? gender : ''
  );
  const genderOption = ['Male', 'Female', 'Non-binary'].includes(gender) ? gender : gender ? 'custom' : '';

  const [newRelName, setNewRelName] = useState('');
  const [newRelDisposition, setNewRelDisposition] = useState('ally');
  const [newRelNotes, setNewRelNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleGenderChange = (value: string) => {
    if (value === 'custom') {
      setGender(customGender || '');
    } else {
      setGender(value);
    }
  };

  const handleCustomGenderChange = (value: string) => {
    setCustomGender(value);
    setGender(value);
  };

  const handleAddRelationship = () => {
    if (!newRelName.trim()) return;
    const added = addRelationship(newRelName.trim(), newRelDisposition, newRelNotes.trim() || undefined);
    if (added) {
      setNewRelName('');
      setNewRelNotes('');
      setNewRelDisposition('ally');
      setShowAddForm(false);
      toast.success('Relationship added');
    } else {
      toast.error(`Maximum ${MAX_RELATIONSHIPS} relationships reached`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Gender */}
      <div className="space-y-2">
        <Label className="text-sm font-cinzel font-semibold text-foreground">Gender</Label>
        <RadioGroup
          value={genderOption}
          onValueChange={handleGenderChange}
          className="grid grid-cols-2 gap-2"
        >
          {['Male', 'Female', 'Non-binary', 'custom'].map(opt => (
            <div key={opt} className="flex items-center gap-2">
              <RadioGroupItem value={opt} id={`gender-${opt}`} />
              <Label htmlFor={`gender-${opt}`} className="text-sm cursor-pointer">
                {opt === 'custom' ? 'Custom' : opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {genderOption === 'custom' && (
          <Input
            placeholder="Enter gender…"
            value={customGender}
            onChange={e => handleCustomGenderChange(e.target.value)}
            className="w-full mt-1"
            maxLength={50}
          />
        )}
      </div>

      {/* Race */}
      <div className="space-y-2">
        <Label className="text-sm font-cinzel font-semibold text-foreground">Race</Label>
        <Input
          list="dnd-race-suggestions"
          placeholder="e.g. Half-Elf, Tiefling…"
          value={race}
          onChange={e => setRace(e.target.value)}
          className="w-full"
          maxLength={100}
        />
        <datalist id="dnd-race-suggestions">
          {DND_RACES.map(r => <option key={r} value={r} />)}
        </datalist>
      </div>

      {/* Backstory */}
      <div className="space-y-2">
        <Label className="text-sm font-cinzel font-semibold text-foreground">Backstory</Label>
        <Textarea
          placeholder="Tell the AI DM about your character's history, motivations, and personality…"
          value={backstory}
          onChange={e => setBackstory(e.target.value)}
          maxLength={2000}
          rows={4}
          className="w-full resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">
          {backstory.length} / 2,000
        </p>
      </div>

      {/* Relationships */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-cinzel font-semibold text-foreground">
            NPC Relationships
          </Label>
          <span className="text-xs text-muted-foreground">
            {relationships.length}/{MAX_RELATIONSHIPS}
          </span>
        </div>

        {relationships.length === 0 && !showAddForm && (
          <p className="text-xs text-muted-foreground italic py-2">
            No relationships tracked yet. The AI DM will reference these NPCs in narration.
          </p>
        )}

        {/* Relationship cards */}
        <div className="space-y-2">
          {relationships.map(rel => (
            <RelationshipCard
              key={rel.id}
              relationship={rel}
              onUpdate={updateRelationship}
              onRemove={removeRelationship}
            />
          ))}
        </div>

        {/* Add form */}
        {showAddForm ? (
          <div className="p-3 rounded-lg border border-border/50 bg-card/30 space-y-3">
            <Input
              placeholder="NPC name…"
              value={newRelName}
              onChange={e => setNewRelName(e.target.value)}
              className="w-full"
              maxLength={60}
              autoFocus
            />
            <Select value={newRelDisposition} onValueChange={setNewRelDisposition}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPOSITIONS.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Notes (optional)…"
              value={newRelNotes}
              onChange={e => setNewRelNotes(e.target.value)}
              className="w-full"
              maxLength={120}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddRelationship}
                disabled={!newRelName.trim()}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowAddForm(false); setNewRelName(''); setNewRelNotes(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={relationships.length >= MAX_RELATIONSHIPS}
            onClick={() => setShowAddForm(true)}
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add Relationship
          </Button>
        )}
      </div>
    </div>
  );
}

function RelationshipCard({
  relationship,
  onUpdate,
  onRemove,
}: {
  relationship: CharacterRelationship;
  onUpdate: (id: string, updates: Partial<Omit<CharacterRelationship, 'id'>>) => void;
  onRemove: (id: string) => void;
}) {
  const style = getDispositionStyle(relationship.disposition);

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-card/30">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-cinzel font-semibold text-sm text-foreground truncate">
            {relationship.name}
          </span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', style.color)}>
            {style.label}
          </Badge>
        </div>
        {relationship.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{relationship.notes}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(relationship.id)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center"
        aria-label={`Remove ${relationship.name}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
