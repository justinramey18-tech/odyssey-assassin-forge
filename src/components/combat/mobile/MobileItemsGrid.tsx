import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  FlaskConical,
  Wrench,
  Heart,
  Bomb,
  Plus,
  Minus,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface Item {
  id: string;
  name: string;
  icon: React.ReactNode;
  quantity: number;
  description: string;
  actionType: 'action' | 'bonus';
  effect: string;
}

const DEFAULT_ITEMS: Item[] = [
  {
    id: 'poison',
    name: 'Poison Vial',
    icon: <FlaskConical className="w-6 h-6" />,
    quantity: 3,
    description: 'Coat weapon with poison (bonus action). +2d6 poison damage for 1 minute.',
    actionType: 'bonus',
    effect: 'Apply poison to weapon',
  },
  {
    id: 'thieves_tools',
    name: "Thieves' Tools",
    icon: <Wrench className="w-6 h-6" />,
    quantity: 1,
    description: 'Proficiency: +5. Use to pick locks and disarm traps.',
    actionType: 'action',
    effect: "Use thieves' tools",
  },
  {
    id: 'healing_potion',
    name: 'Healing Potion',
    icon: <Heart className="w-6 h-6" />,
    quantity: 2,
    description: 'Drink to restore 2d4+2 HP. Bonus action to consume.',
    actionType: 'bonus',
    effect: 'Drink healing potion (2d4+2)',
  },
  {
    id: 'smoke_bomb',
    name: 'Smoke Bomb',
    icon: <Bomb className="w-6 h-6" />,
    quantity: 2,
    description: 'Create 10ft heavily obscured area. Hide as part of same action.',
    actionType: 'action',
    effect: 'Throw smoke bomb',
  },
];

interface MobileItemsGridProps {
  onAddToTurn: (actionType: 'action' | 'bonus' | 'reaction', description: string, roll?: string) => void;
}

export function MobileItemsGrid({ onAddToTurn }: MobileItemsGridProps) {
  const [items, setItems] = useState<Item[]>(DEFAULT_ITEMS);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const updateQuantity = (itemId: string, delta: number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item
    ));
  };

  const handleUseItem = (item: Item) => {
    onAddToTurn(item.actionType, item.effect);
    updateQuantity(item.id, -1);
    setSelectedItem(null);
  };

  return (
    <>
      <div className="p-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              disabled={item.quantity === 0}
              className={cn(
                "flex flex-col items-center p-4 bg-card border border-muted/30 rounded-xl transition-all active:scale-[0.98]",
                item.quantity === 0 && "opacity-40"
              )}
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                {item.icon}
              </div>
              <span className="text-sm font-semibold text-center">{item.name}</span>
              
              {/* Quantity controls */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateQuantity(item.id, -1);
                  }}
                  disabled={item.quantity === 0}
                  className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center active:scale-95"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-mono font-bold">
                  {item.quantity}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateQuantity(item.id, 1);
                  }}
                  className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Item Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          
          {selectedItem && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                    {selectedItem.icon}
                  </div>
                  <div>
                    <SheetTitle className="text-xl">{selectedItem.name}</SheetTitle>
                    <SheetDescription className="text-sm">
                      Quantity: {selectedItem.quantity}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  {selectedItem.description}
                </p>

                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-mono",
                    selectedItem.actionType === 'action'
                      ? "bg-red-500/20 text-red-300"
                      : "bg-amber-500/20 text-amber-300"
                  )}>
                    {selectedItem.actionType.toUpperCase()}
                  </span>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-center gap-4 py-4">
                  <button
                    onClick={() => updateQuantity(selectedItem.id, -1)}
                    disabled={selectedItem.quantity === 0}
                    className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center active:scale-95 disabled:opacity-40"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <span className="text-4xl font-mono font-bold w-16 text-center">
                    {items.find(i => i.id === selectedItem.id)?.quantity || 0}
                  </span>
                  <button
                    onClick={() => updateQuantity(selectedItem.id, 1)}
                    className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center active:scale-95"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>

                {/* Use Button */}
                <Button
                  onClick={() => handleUseItem(selectedItem)}
                  disabled={items.find(i => i.id === selectedItem.id)?.quantity === 0}
                  className="w-full h-14 text-lg bg-cyan-600 hover:bg-cyan-500"
                >
                  Use {selectedItem.name}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
