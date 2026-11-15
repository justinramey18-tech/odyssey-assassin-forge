// Solo Empyrean loot review: items the DM awards in the story, and Quest Hub item rewards,
// wait here (pendingDmItems, per character) until the rider accepts or discards them.
// Accept hands the item to the app's normal bag intake (gear goes to the Gear tab).
import { useCallback, useEffect, useState } from 'react';
import { PackageCheck, PackageX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  PENDING_DM_ITEMS_EVENT,
  loadPendingDmItems,
  removePendingDmItem,
  type PendingDmItem,
} from '@/lib/pendingDmItems';

export type AcceptDmItem = (
  name: string,
  quantity: number,
  details?: { goldValue?: number; description?: string; rarity?: string; category?: string; effect?: string; dice?: string },
) => void;

/** Live list of items waiting for review (updates on add, accept, discard and character switch). */
export function usePendingDmItems(): PendingDmItem[] {
  const [pending, setPending] = useState<PendingDmItem[]>(() => loadPendingDmItems());
  useEffect(() => {
    const refresh = () => setPending(loadPendingDmItems());
    refresh();
    window.addEventListener(PENDING_DM_ITEMS_EVENT, refresh);
    window.addEventListener('odyssey-character-loaded', refresh);
    return () => {
      window.removeEventListener(PENDING_DM_ITEMS_EVENT, refresh);
      window.removeEventListener('odyssey-character-loaded', refresh);
    };
  }, []);
  return pending;
}

interface EmpyreanLootReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The app's bag intake. Without it, Accept is disabled (never drops an item silently). */
  onAccept?: AcceptDmItem;
}

export function EmpyreanLootReview({ open, onOpenChange, onAccept }: EmpyreanLootReviewProps) {
  const pending = usePendingDmItems();

  const accept = useCallback((item: PendingDmItem) => {
    if (!onAccept) {
      toast.error('Your bag is not available here. The item is still waiting.');
      return;
    }
    onAccept(item.name, item.quantity, {
      goldValue: item.goldValue,
      description: item.description,
      rarity: item.rarity,
      category: item.category,
      effect: item.effect,
      dice: item.dice,
    });
    removePendingDmItem(item.id);
    toast.success(`${item.name} added to your bag`);
  }, [onAccept]);

  const discard = useCallback((item: PendingDmItem) => {
    removePendingDmItem(item.id);
    toast(`${item.name} left behind`);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="z-[66] border-primary/20 bg-background max-h-[75vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-cinzel text-primary">Loot to review ({pending.length})</SheetTitle>
        </SheetHeader>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nothing waiting. Items the DM or a quest gives you land here.</p>
        ) : (
          <div className="space-y-2 mt-3 pb-4">
            {pending.map(item => (
              <div key={item.id} className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
                <p className="text-sm text-foreground">
                  {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                  {item.rarity ? <span className="text-xs text-muted-foreground"> · {item.rarity}</span> : null}
                </p>
                {item.description ? <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p> : null}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="flex-1 min-h-[48px] gap-1" style={{ touchAction: 'manipulation' }} onClick={() => accept(item)}>
                    <PackageCheck className="w-4 h-4" /> Accept
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 min-h-[48px] gap-1" style={{ touchAction: 'manipulation' }} onClick={() => discard(item)}>
                    <PackageX className="w-4 h-4" /> Discard
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
