// Add Item Drawer - Manual shop item entry

import { useState } from 'react';
import { Plus, Package, Wand2, Coins, FileText, Scroll, Tag } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ParsedShopItem } from '@/lib/shop/types';

// Validation schema
const itemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  itemType: z.enum(['consumable', 'equipment', 'miscellaneous']),
  category: z.string().trim().max(50, 'Category too long').optional(),
  costGold: z.number().int().min(0, 'Cost cannot be negative').max(1000000, 'Cost too high'),
  rarity: z.enum(['common', 'uncommon', 'rare', 'very_rare', 'legendary']),
  description: z.string().trim().max(500, 'Description too long').optional(),
  effect: z.string().trim().max(300, 'Effect too long').optional(),
});

interface AddItemDrawerProps {
  onAddItem: (item: ParsedShopItem) => void;
}

const ITEM_TYPES = [
  { value: 'consumable', label: 'Consumable', icon: '🧪' },
  { value: 'equipment', label: 'Equipment', icon: '⚔️' },
  { value: 'miscellaneous', label: 'Miscellaneous', icon: '📦' },
] as const;

const RARITIES = [
  { value: 'common', label: 'Common', color: 'text-zinc-300' },
  { value: 'uncommon', label: 'Uncommon', color: 'text-emerald-400' },
  { value: 'rare', label: 'Rare', color: 'text-blue-400' },
  { value: 'very_rare', label: 'Very Rare', color: 'text-purple-400' },
  { value: 'legendary', label: 'Legendary', color: 'text-amber-400' },
] as const;

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  consumable: ['Potion', 'Scroll', 'Poison', 'Elixir', 'Oil', 'Food'],
  equipment: ['Weapon', 'Armor', 'Shield', 'Ring', 'Amulet', 'Cloak', 'Boots', 'Gloves'],
  miscellaneous: ['Tool', 'Kit', 'Component', 'Trinket', 'Container', 'Map'],
};

export function AddItemDrawer({ onAddItem }: AddItemDrawerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<'consumable' | 'equipment' | 'miscellaneous'>('consumable');
  const [category, setCategory] = useState('');
  const [costGold, setCostGold] = useState('');
  const [rarity, setRarity] = useState<'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary'>('common');
  const [description, setDescription] = useState('');
  const [effect, setEffect] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const resetForm = () => {
    setName('');
    setItemType('consumable');
    setCategory('');
    setCostGold('');
    setRarity('common');
    setDescription('');
    setEffect('');
    setErrors({});
  };

  const handleSubmit = () => {
    // Parse and validate
    const cost = parseInt(costGold, 10) || 0;
    
    const result = itemSchema.safeParse({
      name,
      itemType,
      category: category || undefined,
      costGold: cost,
      rarity,
      description: description || undefined,
      effect: effect || undefined,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as string;
        newErrors[field] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    // Build parsed shop item
    const parsedItem: ParsedShopItem = {
      name: result.data.name,
      itemType: result.data.itemType,
      category: result.data.category,
      costGold: result.data.costGold,
      rarity: result.data.rarity,
      description: result.data.description || `A ${result.data.rarity} ${result.data.itemType}.`,
      mechanics: result.data.effect ? { effect: result.data.effect } : {},
      lore: '',
      sourceText: 'Manually added',
      confidence: 'high',
    };

    onAddItem(parsedItem);
    
    toast({
      title: 'Item Added',
      description: `${parsedItem.name} is now available in the shop.`,
    });

    resetForm();
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Item
        </Button>
      </DrawerTrigger>
      <DrawerContent 
        className="max-h-[90vh]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 font-cinzel">
            <Package className="w-5 h-5 text-amber-400" />
            Add Shop Item
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Item Name */}
          <div className="space-y-2">
            <Label htmlFor="item-name" className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              Item Name *
            </Label>
            <Input
              id="item-name"
              placeholder="e.g., Potion of Healing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Item Type & Category Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                Type *
              </Label>
              <Select value={itemType} onValueChange={(v) => {
                setItemType(v as typeof itemType);
                setCategory(''); // Reset category when type changes
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_SUGGESTIONS[itemType]?.map(cat => (
                    <SelectItem key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cost & Rarity Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-cost" className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                Cost (GP) *
              </Label>
              <Input
                id="item-cost"
                type="number"
                placeholder="50"
                value={costGold}
                onChange={(e) => setCostGold(e.target.value)}
                min={0}
                max={1000000}
                className={errors.costGold ? 'border-destructive' : ''}
              />
              {errors.costGold && (
                <p className="text-xs text-destructive">{errors.costGold}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-muted-foreground" />
                Rarity *
              </Label>
              <Select value={rarity} onValueChange={(v) => setRarity(v as typeof rarity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className={r.color}>{r.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Effect */}
          <div className="space-y-2">
            <Label htmlFor="item-effect" className="flex items-center gap-2">
              <Scroll className="w-4 h-4 text-muted-foreground" />
              Effect / Mechanics
            </Label>
            <Input
              id="item-effect"
              placeholder="e.g., Heals 2d4+2 HP"
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
              maxLength={300}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="item-desc" className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Description
            </Label>
            <Textarea
              id="item-desc"
              placeholder="A brief description of the item..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2">
          <DrawerClose asChild>
            <Button variant="outline" className="flex-1">
              Cancel
            </Button>
          </DrawerClose>
          <Button 
            onClick={handleSubmit}
            disabled={!name.trim() || !costGold}
            className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add to Shop
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}