import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCombatPerks } from '@/hooks/use-combat-perks';
import { COMBAT_PERKS, EXTRA_PERK_SLOT_COST } from '@/lib/combat-perks';

interface Props {
  characterName: string;
  currentGold: number;
  onSpendGold: (amount: number) => void;
}

const tap = { touchAction: 'manipulation' as const };

export function CombatPerksPanel({ characterName, currentGold, onSpendGold }: Props) {
  const perks = useCombatPerks(characterName);
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-3 mb-3 rounded-xl border border-border bg-card/60">
      <button
        style={tap}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          <span className="font-cinzel text-sm text-foreground">Combat Perks</span>
        </span>
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Equipped {perks.equipped.length}/{perks.slots}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="space-y-2 px-3 pb-3">
          {perks.loading ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : perks.signedOut ? (
            <p className="text-[12px] text-muted-foreground">Sign in to buy combat perks.</p>
          ) : (
            <>
              {COMBAT_PERKS.map(p => {
                const owned = perks.owned.includes(p.id);
                const equipped = perks.equipped.includes(p.id);
                return (
                  <div key={p.id} className={cn('rounded-lg border p-2.5', equipped ? 'border-primary/50 bg-primary/5' : 'border-border bg-background/40')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{p.name}</p>
                        <p className="text-[12px] text-muted-foreground">{p.text}</p>
                      </div>
                      {owned ? (
                        <Button
                          size="sm"
                          variant={equipped ? 'secondary' : 'outline'}
                          className="min-h-[44px] shrink-0"
                          style={tap}
                          disabled={perks.busy}
                          onClick={() => { void perks.toggleEquip(p.id); }}
                        >
                          {equipped ? 'Unequip' : 'Equip'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="min-h-[44px] shrink-0"
                          style={tap}
                          disabled={perks.busy || currentGold < p.cost}
                          onClick={() => { void perks.buy(p.id, currentGold, onSpendGold); }}
                        >
                          Buy {p.cost.toLocaleString()} gp
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {perks.slots === 2 && (
                <Button
                  variant="outline"
                  className="w-full min-h-[44px]"
                  style={tap}
                  disabled={perks.busy || currentGold < EXTRA_PERK_SLOT_COST}
                  onClick={() => { void perks.buy('slot', currentGold, onSpendGold); }}
                >
                  Buy 3rd slot {EXTRA_PERK_SLOT_COST.toLocaleString()} gp
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">Changes apply from your next fight.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
