import { useState, useCallback, useEffect } from 'react';
import { X, User, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { LoadoutSlotCard } from '@/components/empyrean/LoadoutSlotCard';
import {
  loadEmpyreanLoadout,
  loadEmpyreanGold,
  getEquippedItem,
  type EmpyreanLoadoutState,
  type EmpyreanSlot,
} from '@/lib/empyreanLoadout';

interface RiderLoadoutScreenProps {
  open: boolean;
  onClose: () => void;
  characterName: string;
  riderLevel: number;
}

export function RiderLoadoutScreen({ open, onClose, characterName, riderLevel }: RiderLoadoutScreenProps) {
  const [loadout, setLoadout] = useState<EmpyreanLoadoutState>(() => loadEmpyreanLoadout());
  const [gold, setGold] = useState<number>(() => loadEmpyreanGold());

  // Reload state whenever screen opens (catches any changes made elsewhere).
  useEffect(() => {
    if (open) {
      setLoadout(loadEmpyreanLoadout());
      setGold(loadEmpyreanGold());
    }
  }, [open]);

  const handleSlotTap = useCallback((slot: EmpyreanSlot) => {
    // G3 will replace this with a proper slot drawer.
    toast.info(`${slot} slot drawer — coming in G3`, { duration: 1500 });
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-gradient-to-b from-[#0a0512] via-background to-background/95">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-amber-500/15 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-cinzel font-semibold text-foreground truncate">
            {characterName || 'Rider'} Loadout
          </span>
          <span className="text-[10px] text-amber-300/60 font-cinzel uppercase tracking-wider shrink-0">Lv {riderLevel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-cinzel font-bold text-amber-200">{gold}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="relative w-full max-w-md mx-auto px-4 py-6">

          {/* Paper doll area */}
          <div className="relative w-full aspect-[3/4] mx-auto">

            {/* Silhouette in center */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-full flex items-center justify-center">
                <User
                  className="w-40 h-40 text-white/[0.08]"
                  strokeWidth={1.2}
                />
              </div>
            </div>

            {/* Slot cards positioned around silhouette.
                Positions use percentage-based absolute positioning so they scale cleanly. */}

            {/* Head — top center */}
            <div className="absolute" style={{ top: '2%', left: '50%', transform: 'translateX(-50%)' }}>
              <LoadoutSlotCard slot="head" item={getEquippedItem(loadout, 'head')} onClick={() => handleSlotTap('head')} />
            </div>

            {/* Chest — middle left */}
            <div className="absolute" style={{ top: '28%', left: '2%' }}>
              <LoadoutSlotCard slot="chest" item={getEquippedItem(loadout, 'chest')} onClick={() => handleSlotTap('chest')} />
            </div>

            {/* Wings — middle right (dragon gear, counterpart to chest) */}
            <div className="absolute" style={{ top: '28%', right: '2%' }}>
              <LoadoutSlotCard slot="wings" item={getEquippedItem(loadout, 'wings')} onClick={() => handleSlotTap('wings')} />
            </div>

            {/* Weapon — lower left */}
            <div className="absolute" style={{ bottom: '22%', left: '2%' }}>
              <LoadoutSlotCard slot="weapon" item={getEquippedItem(loadout, 'weapon')} onClick={() => handleSlotTap('weapon')} />
            </div>

            {/* Dagger — lower right */}
            <div className="absolute" style={{ bottom: '22%', right: '2%' }}>
              <LoadoutSlotCard slot="dagger" item={getEquippedItem(loadout, 'dagger')} onClick={() => handleSlotTap('dagger')} />
            </div>

            {/* Potions — bottom center */}
            <div className="absolute" style={{ bottom: '1%', left: '50%', transform: 'translateX(-50%)' }}>
              <LoadoutSlotCard slot="potions" item={getEquippedItem(loadout, 'potions')} onClick={() => handleSlotTap('potions')} />
            </div>
          </div>

          {/* Hint footer */}
          <p className="mt-4 text-center text-[11px] text-muted-foreground italic">
            Tap a slot to manage gear. First forge in each slot is free.
          </p>
        </div>
      </div>
    </div>
  );
}
