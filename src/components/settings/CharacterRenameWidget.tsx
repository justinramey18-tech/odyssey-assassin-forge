import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CharacterRenameWidgetProps {
  currentName: string;
  onRename: (newName: string) => void;
}

export function CharacterRenameWidget({ currentName, onRename }: CharacterRenameWidgetProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      setEditing(false);
      setName(currentName);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') { setEditing(false); setName(currentName); }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <p className="font-cinzel font-bold text-lg truncate flex-1">{currentName || 'Unnamed'}</p>
        <Button variant="ghost" size="sm" onClick={() => { setName(currentName); setEditing(true); }} className="h-7 w-7 p-0 shrink-0">
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-8 text-sm font-cinzel"
        maxLength={50}
      />
      <Button size="sm" onClick={handleSubmit} className="h-8 shrink-0">Save</Button>
      <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(currentName); }} className="h-8 shrink-0">Cancel</Button>
    </div>
  );
}
