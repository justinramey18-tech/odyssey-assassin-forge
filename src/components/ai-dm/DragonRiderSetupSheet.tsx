import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PartyDragonConfig } from '@/hooks/use-party-dm';
import { DRAGON_COLORS } from '@/lib/dragonColors';

interface DragonRiderSetupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig: (PartyDragonConfig & { dragonColor?: string }) | null;
  onSave: (config: { dragonName: string; signetType: string; yearAtBasgiath: string; dragonNotes: string; dragonColor: string }) => void;
  characterName: string;
}

const YEARS = [
  { value: 'first-year', label: '1st Year' },
  { value: 'second-year', label: '2nd Year' },
  { value: 'third-year', label: '3rd Year' },
  { value: 'fourth-year', label: '4th Year' },
] as const;

export function DragonRiderSetupSheet({ open, onOpenChange, initialConfig, onSave, characterName }: DragonRiderSetupSheetProps) {
  const [dragonName, setDragonName] = useState('');
  const [signetType, setSignetType] = useState('');
  const [yearAtBasgiath, setYearAtBasgiath] = useState('first-year');
  const [dragonNotes, setDragonNotes] = useState('');
  const [dragonColor, setDragonColor] = useState('deep-red');

  useEffect(() => {
    if (open) {
      setDragonName(initialConfig?.dragonName || '');
      setSignetType(initialConfig?.signetType || '');
      setYearAtBasgiath(initialConfig?.yearAtBasgiath || 'first-year');
      setDragonNotes(initialConfig?.dragonNotes || '');
      setDragonColor(initialConfig?.dragonColor || 'deep-red');
    }
  }, [open, initialConfig]);

  const handleSave = () => {
    if (!dragonName.trim()) return;
    onSave({ dragonName: dragonName.trim(), signetType: signetType.trim(), yearAtBasgiath, dragonNotes: dragonNotes.trim(), dragonColor });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-amber-500/20">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-cinzel text-amber-400 flex items-center gap-2">
            <Flame className="w-5 h-5" />
            Dragon Bond Setup
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-xs">
            Configure {characterName}'s bonded dragon
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-amber-400/80">Dragon Name *</Label>
            <Input
              value={dragonName}
              onChange={e => setDragonName(e.target.value)}
              placeholder="e.g. Tairn, Andarna, Sgaeyl"
              className="bg-background/50 border-border/50 focus:border-amber-500/50"
              maxLength={40}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-amber-400/80">Dragon Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {DRAGON_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDragonColor(c.id)}
                  className={cn(
                    'w-full aspect-square rounded-lg border-2 transition-all relative min-h-[44px]',
                    dragonColor === c.id
                      ? 'border-amber-400 scale-105 shadow-lg'
                      : 'border-transparent hover:border-border/50'
                  )}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                >
                  {dragonColor === c.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white shadow-md" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {DRAGON_COLORS.find(c => c.id === dragonColor)?.label ?? 'Select a color'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-amber-400/80">Signet Ability</Label>
            <Input
              value={signetType}
              onChange={e => setSignetType(e.target.value)}
              placeholder="e.g. lightning manipulation, foresight"
              className="bg-background/50 border-border/50 focus:border-amber-500/50"
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-amber-400/80">Year at Basgiath</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {YEARS.map(y => (
                <button
                  key={y.value}
                  type="button"
                  onClick={() => setYearAtBasgiath(y.value)}
                  className={cn(
                    'py-2 px-1 rounded-md text-xs font-medium transition-colors min-h-[44px]',
                    yearAtBasgiath === y.value
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-background/30 text-muted-foreground border border-border/30 hover:border-border/60'
                  )}
                >
                  {y.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-amber-400/80">Dragon Personality Profile</Label>
            <Textarea
              value={dragonNotes}
              onChange={e => setDragonNotes(e.target.value)}
              placeholder="Define your dragon's complete personality. Include their voice, temperament, speech patterns, opinions, history, quirks, how they feel about your rider, what makes them unique. This is the single source of truth for who your dragon is — the more detail you provide, the more authentic they'll feel. You have 20,000 characters."
              className="bg-background/50 border-border/50 focus:border-amber-500/50 min-h-[200px] resize-y"
              maxLength={20000}
            />
            <p className="text-[10px] text-muted-foreground text-right">{dragonNotes.length.toLocaleString()}/20,000</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={!dragonName.trim()}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-cinzel min-h-[48px]"
          >
            {initialConfig?.dragonName ? 'Update Dragon' : 'Bond Dragon'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}