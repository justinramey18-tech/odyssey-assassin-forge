// Miscellaneous Items Widget - displays and manages misc inventory items

import { useState } from 'react';
import { Package, Plus, Minus, Trash2, StickyNote, ChevronDown, ChevronUp, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MiscItem } from '@/lib/miscItems/types';
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

const CATEGORY_OPTIONS = [
  'Tool', 'Kit', 'Component', 'Trinket', 'Container', 'Map',
  'Key', 'Document', 'Instrument', 'Gemstone', 'Material', 'Other',
];

interface MiscItemsWidgetProps {
  items: MiscItem[];
  onAddItem: (item: Omit<MiscItem, 'id' | 'addedAt'>) => void;
  onRemoveItem: (id: string) => void;
  onAdjustQuantity: (id: string, delta: number) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}

function AddMiscItemDrawer({ onAddItem }: { onAddItem: MiscItemsWidgetProps['onAddItem'] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [goldValue, setGoldValue] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddItem({
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      quantity: parseInt(quantity) || 1,
      goldValue: goldValue ? parseInt(goldValue) : undefined,
    });
    setName('');
    setDescription('');
    setQuantity('1');
    setGoldValue('');
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="font-cinzel">Add Miscellaneous Item</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Item Name</label>
            <Input
              placeholder="Thieves' Tools, Map of Phandalin..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-20">
              <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-muted-foreground mb-1 block">Value (GP)</label>
              <Input
                type="number"
                min="0"
                placeholder="—"
                value={goldValue}
                onChange={(e) => setGoldValue(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
            <Textarea
              placeholder="A worn leather case containing lockpicks..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full"
            />
          </div>
        </div>
        <DrawerFooter>
          <Button onClick={handleAdd} disabled={!name.trim()}>
            Add to Inventory
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function MiscItemCard({ 
  item, 
  onRemove, 
  onAdjustQuantity, 
  onUpdateNotes 
}: { 
  item: MiscItem; 
  onRemove: () => void; 
  onAdjustQuantity: (delta: number) => void;
  onUpdateNotes: (notes: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(item.notes || '');

  return (
    <div className="bg-card/60 border border-border/50 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-9 h-9 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {item.category}
            </Badge>
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAdjustQuantity(-1)}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-sm font-medium w-6 text-center text-foreground">{item.quantity}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAdjustQuantity(1)}
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-border/30 px-3 py-2 space-y-2 bg-muted/20">
          {item.goldValue !== undefined && (
            <div className="text-xs text-muted-foreground">
              Value: <span className="text-amber-400 font-medium">{item.goldValue} GP</span>
              {item.quantity > 1 && (
                <span className="ml-1">({item.goldValue * item.quantity} GP total)</span>
              )}
            </div>
          )}
          <div>
            {editingNotes ? (
              <div className="space-y-1">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add notes..."
                  rows={2}
                  className="text-xs"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                    onUpdateNotes(notesValue);
                    setEditingNotes(false);
                  }}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                    setNotesValue(item.notes || '');
                    setEditingNotes(false);
                  }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setEditingNotes(true)}
              >
                <StickyNote className="w-3 h-3" />
                {item.notes || 'Add notes...'}
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

export function MiscItemsWidget({
  items,
  onAddItem,
  onRemoveItem,
  onAdjustQuantity,
  onUpdateNotes,
}: MiscItemsWidgetProps) {
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-cinzel text-lg text-foreground">Miscellaneous Items</h2>
          {totalItems > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalItems}
            </Badge>
          )}
        </div>
        <AddMiscItemDrawer onAddItem={onAddItem} />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No miscellaneous items</p>
          <p className="text-xs mt-1">Add tools, trinkets, maps, and other items here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <MiscItemCard
              key={item.id}
              item={item}
              onRemove={() => onRemoveItem(item.id)}
              onAdjustQuantity={(delta) => onAdjustQuantity(item.id, delta)}
              onUpdateNotes={(notes) => onUpdateNotes(item.id, notes)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
