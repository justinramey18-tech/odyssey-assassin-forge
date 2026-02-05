import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { NewEnemyInput, ENEMY_PRESETS, EnemyPresetKey } from '@/lib/combat/targetTypes';
import { Target, Heart, Shield, FileText, Zap } from 'lucide-react';

interface AddEnemySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddEnemy: (input: NewEnemyInput) => boolean;
  currentEnemyCount: number;
  maxEnemies: number;
}

export function AddEnemySheet({
  open,
  onOpenChange,
  onAddEnemy,
  currentEnemyCount,
  maxEnemies,
}: AddEnemySheetProps) {
  const [name, setName] = useState('');
  const [maxHP, setMaxHP] = useState(30);
  const [ac, setAC] = useState(13);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    
    const success = onAddEnemy({
      name: name.trim(),
      maxHP,
      ac,
      notes: notes.trim() || undefined,
    });
    
    if (success) {
      // Reset form
      setName('');
      setMaxHP(30);
      setAC(13);
      setNotes('');
      onOpenChange(false);
    }
  };

  const handlePresetSelect = (preset: EnemyPresetKey) => {
    const config = ENEMY_PRESETS[preset];
    setMaxHP(config.hp);
    setAC(config.ac);
  };

  const canAddMore = currentEnemyCount < maxEnemies;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[75vh] rounded-t-3xl">
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
        
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="flex items-center gap-2 text-red-400">
            <Target className="w-5 h-5" />
            Add Enemy
          </SheetTitle>
          <SheetDescription>
            {canAddMore 
              ? `Add an enemy to track (${currentEnemyCount}/${maxEnemies})`
              : `Maximum enemies reached (${maxEnemies})`
            }
          </SheetDescription>
        </SheetHeader>

        {canAddMore ? (
          <div className="space-y-6">
            {/* Quick Presets */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-3 h-3" />
                Quick Presets
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(ENEMY_PRESETS) as EnemyPresetKey[]).map(key => {
                  const preset = ENEMY_PRESETS[key];
                  return (
                    <button
                      key={key}
                      onClick={() => handlePresetSelect(key)}
                      className={cn(
                        "p-2 rounded-lg border transition-all active:scale-95",
                        "bg-muted/20 border-muted/30 hover:border-muted/50"
                      )}
                    >
                      <div className="text-xs font-semibold">{preset.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {preset.hp} HP / AC {preset.ac}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Target className="w-3 h-3" />
                Enemy Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Orc Warlord, Goblin 1"
                className="h-12 text-base bg-black/30"
                autoFocus
              />
            </div>

            {/* HP Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Heart className="w-3 h-3 text-red-400" />
                  Hit Points
                </label>
                <span className="text-lg font-bold text-red-300">{maxHP}</span>
              </div>
              <Slider
                value={[maxHP]}
                onValueChange={([val]) => setMaxHP(val)}
                min={1}
                max={500}
                step={1}
                className="[&_[role=slider]]:bg-red-500 [&_[role=slider]]:border-red-400"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1</span>
                <span>100</span>
                <span>200</span>
                <span>300</span>
                <span>400</span>
                <span>500</span>
              </div>
            </div>

            {/* AC Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-3 h-3 text-cyan-400" />
                  Armor Class
                </label>
                <span className="text-lg font-bold text-cyan-300">{ac}</span>
              </div>
              <Slider
                value={[ac]}
                onValueChange={([val]) => setAC(val)}
                min={5}
                max={25}
                step={1}
                className="[&_[role=slider]]:bg-cyan-500 [&_[role=slider]]:border-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
                <span>25</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Notes (optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Immune to fire, low AC but high HP..."
                className="bg-black/30 resize-none h-20"
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="w-full h-14 text-base font-bold bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
            >
              <Target className="w-5 h-5 mr-2" />
              Add Enemy to Combat
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Maximum of {maxEnemies} enemies reached. Remove some to add more.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
