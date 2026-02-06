import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { 
  NewEnemyInput, 
  ENEMY_PRESETS, 
  EnemyPresetKey,
  DamageType,
} from '@/lib/combat/targetTypes';
import {
  CREATURE_TYPES,
  CREATURE_SIZES,
  CREATURE_TYPE_LABELS,
  CREATURE_SIZE_LABELS,
  CREATURE_TYPE_ICONS,
  DAMAGE_TYPES,
  DAMAGE_TYPE_LABELS,
  CreatureType,
  CreatureSize,
} from '@/lib/combat/creatureTypes';
import { Target, Heart, Shield, FileText, Zap, Flame, Snowflake } from 'lucide-react';

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
  const [creatureType, setCreatureType] = useState<CreatureType | undefined>(undefined);
  const [size, setSize] = useState<CreatureSize>('medium');
  const [resistances, setResistances] = useState<DamageType[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<DamageType[]>([]);
  const [immunities, setImmunities] = useState<DamageType[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetForm = () => {
    setName('');
    setMaxHP(30);
    setAC(13);
    setNotes('');
    setCreatureType(undefined);
    setSize('medium');
    setResistances([]);
    setVulnerabilities([]);
    setImmunities([]);
    setShowAdvanced(false);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    
    const success = onAddEnemy({
      name: name.trim(),
      maxHP,
      ac,
      notes: notes.trim() || undefined,
      creatureType,
      size,
      resistances: resistances.length > 0 ? resistances : undefined,
      vulnerabilities: vulnerabilities.length > 0 ? vulnerabilities : undefined,
      immunities: immunities.length > 0 ? immunities : undefined,
    });
    
    if (success) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handlePresetSelect = (preset: EnemyPresetKey) => {
    const config = ENEMY_PRESETS[preset];
    setMaxHP(config.hp);
    setAC(config.ac);
    setSize(config.size);
    setCreatureType(config.type);
  };

  const toggleDamageModifier = (
    type: DamageType,
    list: DamageType[],
    setList: React.Dispatch<React.SetStateAction<DamageType[]>>,
    otherLists: DamageType[][]
  ) => {
    // Remove from other lists first
    otherLists.forEach((_, i) => {
      if (i === 0 && resistances.includes(type)) setResistances(r => r.filter(x => x !== type));
      if (i === 1 && vulnerabilities.includes(type)) setVulnerabilities(v => v.filter(x => x !== type));
      if (i === 2 && immunities.includes(type)) setImmunities(im => im.filter(x => x !== type));
    });
    
    // Toggle in current list
    if (list.includes(type)) {
      setList(list.filter(x => x !== type));
    } else {
      setList([...list, type]);
    }
  };

  const canAddMore = currentEnemyCount < maxEnemies;

  // All damage types for selection
  const ALL_DAMAGE_TYPES = DAMAGE_TYPES;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
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
          <ScrollArea className="h-[calc(85vh-180px)] pr-4">
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

              {/* Type & Size Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Creature Type */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Type
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {CREATURE_TYPES.slice(0, 8).map(type => (
                      <button
                        key={type}
                        onClick={() => setCreatureType(creatureType === type ? undefined : type)}
                        className={cn(
                          "p-2 rounded-lg border text-center transition-all",
                          creatureType === type
                            ? "bg-primary/20 border-primary/50"
                            : "bg-muted/20 border-muted/30 hover:border-muted/50"
                        )}
                        title={CREATURE_TYPE_LABELS[type]}
                      >
                        <span className="text-lg">{CREATURE_TYPE_ICONS[type]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Size
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {CREATURE_SIZES.map(s => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={cn(
                          "p-1.5 rounded-lg border text-[10px] font-medium transition-all",
                          size === s
                            ? "bg-primary/20 border-primary/50"
                            : "bg-muted/20 border-muted/30 hover:border-muted/50"
                        )}
                      >
                        {CREATURE_SIZE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
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

              {/* Advanced Toggle */}
              <Button
                variant="ghost"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full text-xs text-muted-foreground"
              >
                {showAdvanced ? '− Hide Advanced Options' : '+ Show Advanced Options'}
              </Button>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="space-y-4 p-3 bg-muted/10 rounded-lg border border-muted/20">
                  {/* Resistances */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Snowflake className="w-3 h-3 text-blue-400" />
                      Resistances
                    </label>
                    <div className="flex flex-wrap gap-1">
                    {ALL_DAMAGE_TYPES.map(type => {
                        const isActive = resistances.includes(type);
                        const info = DAMAGE_TYPE_LABELS[type];
                        return (
                          <button
                            key={type}
                            onClick={() => toggleDamageModifier(type, resistances, setResistances, [resistances, vulnerabilities, immunities])}
                            className={cn(
                              "text-[10px] px-2 py-1 rounded-full border transition-all",
                              isActive
                                ? "bg-blue-500/30 border-blue-500/50 text-blue-200"
                                : "bg-muted/20 border-muted/30 text-muted-foreground"
                            )}
                          >
                            {info.emoji} {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Vulnerabilities */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Flame className="w-3 h-3 text-red-400" />
                      Vulnerabilities
                    </label>
                    <div className="flex flex-wrap gap-1">
                    {ALL_DAMAGE_TYPES.map(type => {
                        const isActive = vulnerabilities.includes(type);
                        const info = DAMAGE_TYPE_LABELS[type];
                        return (
                          <button
                            key={type}
                            onClick={() => toggleDamageModifier(type, vulnerabilities, setVulnerabilities, [resistances, vulnerabilities, immunities])}
                            className={cn(
                              "text-[10px] px-2 py-1 rounded-full border transition-all",
                              isActive
                                ? "bg-red-500/30 border-red-500/50 text-red-200"
                                : "bg-muted/20 border-muted/30 text-muted-foreground"
                            )}
                          >
                            {info.emoji} {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Immunities */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Immunities
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {ALL_DAMAGE_TYPES.map(type => {
                        const isActive = immunities.includes(type);
                        const info = DAMAGE_TYPE_LABELS[type];
                        return (
                          <button
                            key={type}
                            onClick={() => toggleDamageModifier(type, immunities, setImmunities, [resistances, vulnerabilities, immunities])}
                            className={cn(
                              "text-[10px] px-2 py-1 rounded-full border transition-all",
                              isActive
                                ? "bg-slate-500/30 border-slate-500/50 text-slate-200"
                                : "bg-muted/20 border-muted/30 text-muted-foreground"
                            )}
                          >
                            {info.emoji} {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  Notes (optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Pack tactics, spellcaster..."
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

              {/* Spacer for bottom safe area */}
              <div className="h-4" />
            </div>
          </ScrollArea>
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
