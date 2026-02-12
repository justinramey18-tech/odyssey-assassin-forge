import { useState, useCallback } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { equipmentSlotDefinitions, Rarity, EquipmentSlotType } from '@/lib/inventory/types';
import {
  HomebrewGearFormState,
  DEFAULT_GEAR_FORM,
  formToEquipmentItem,
  HomebrewGearItem,
  SLOT_ICONS,
} from '@/lib/inventory/homebrewGear';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

const RARITY_OPTIONS: { value: Rarity; label: string }[] = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
  { value: 'artifact', label: 'Artifact' },
];

interface HomebrewGearCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: HomebrewGearItem) => void;
}

export function HomebrewGearCreator({ open, onOpenChange, onSave }: HomebrewGearCreatorProps) {
  const [form, setForm] = useState<HomebrewGearFormState>(DEFAULT_GEAR_FORM);

  const updateForm = useCallback(<K extends keyof HomebrewGearFormState>(key: K, value: HomebrewGearFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateStat = useCallback((key: string, value: string) => {
    const numVal = value === '' ? undefined : Number(value);
    setForm(prev => ({
      ...prev,
      stats: { ...prev.stats, [key]: numVal },
    }));
  }, []);

  const handleSlotChange = useCallback((slotType: EquipmentSlotType) => {
    setForm(prev => ({
      ...prev,
      slotType,
      icon: SLOT_ICONS[slotType],
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const item = formToEquipmentItem(form);
    onSave(item);
    setForm(DEFAULT_GEAR_FORM);
    onOpenChange(false);
    toast.success(`${item.name} created!`);
  }, [form, onSave, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[90vw] max-w-[400px] p-0 bg-background">
        <SheetHeader className="p-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 font-cinzel">
            <Plus className="w-5 h-5 text-amber-400" />
            Create Homebrew Gear
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
          <div className="p-4 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Name *</Label>
              <Input
                value={form.name}
                onChange={e => updateForm('name', e.target.value)}
                placeholder="e.g. Blade of the Fallen"
                className="bg-muted/30"
              />
            </div>

            {/* Slot & Rarity Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Slot</Label>
                <Select value={form.slotType} onValueChange={(v) => handleSlotChange(v as EquipmentSlotType)}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentSlotDefinitions.map(s => (
                      <SelectItem key={s.type} value={s.type}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Rarity</Label>
                <Select value={form.rarity} onValueChange={(v) => updateForm('rarity', v as Rarity)}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITY_OPTIONS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Level, Weight, Value */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Level</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={form.level}
                  onChange={e => updateForm('level', Number(e.target.value))}
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Weight</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.weight}
                  onChange={e => updateForm('weight', Number(e.target.value))}
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Value (gp)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.value}
                  onChange={e => updateForm('value', Number(e.target.value))}
                  className="bg-muted/30"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Stats</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-10">AC</span>
                  <Input
                    type="number"
                    value={form.stats.ac ?? ''}
                    onChange={e => updateStat('ac', e.target.value)}
                    placeholder="0"
                    className="bg-muted/30 h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-10">ATK</span>
                  <Input
                    type="number"
                    value={form.stats.attackBonus ?? ''}
                    onChange={e => updateStat('attackBonus', e.target.value)}
                    placeholder="0"
                    className="bg-muted/30 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-10">DMG</span>
                <Input
                  value={form.damage}
                  onChange={e => updateForm('damage', e.target.value)}
                  placeholder="e.g. 2d6+3 slashing"
                  className="bg-muted/30 h-8 text-sm"
                />
              </div>
            </div>

            {/* Properties */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Properties (comma-separated)</Label>
              <Input
                value={form.properties.join(', ')}
                onChange={e => updateForm('properties', e.target.value.split(',').map(s => s.trim()))}
                placeholder="e.g. Finesse, Light, Versatile"
                className="bg-muted/30"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Description</Label>
              <Textarea
                value={form.description}
                onChange={e => updateForm('description', e.target.value)}
                placeholder="Describe this item's effects..."
                rows={2}
                className="bg-muted/30 resize-none"
              />
            </div>

            {/* Lore */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Lore</Label>
              <Textarea
                value={form.lore}
                onChange={e => updateForm('lore', e.target.value)}
                placeholder="Background story or flavor text..."
                rows={2}
                className="bg-muted/30 resize-none"
              />
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Sparkles className="w-4 h-4" />
              Create Item
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
