import { Package, Check, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PartyLootItem } from '@/hooks/use-party-sync';

interface PartyLootQueueProps {
  loot: PartyLootItem[];
  currentUserId?: string;
  characterName: string;
  onClaim: (lootId: string, claimerName: string) => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: 'border-zinc-500/30 text-zinc-300',
  uncommon: 'border-emerald-500/30 text-emerald-300',
  rare: 'border-sky-500/30 text-sky-300',
  'very rare': 'border-purple-500/30 text-purple-300',
  legendary: 'border-amber-500/30 text-amber-300',
  artifact: 'border-red-500/30 text-red-300',
};

export function PartyLootQueue({ loot, currentUserId, characterName, onClaim }: PartyLootQueueProps) {
  if (loot.length === 0) {
    return (
      <div className="text-center py-3">
        <Package className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
        <p className="text-[10px] text-muted-foreground">No shared loot yet</p>
      </div>
    );
  }

  const unclaimed = loot.filter(l => !l.claimed_by_user_id);
  const claimed = loot.filter(l => l.claimed_by_user_id);

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
      {/* Unclaimed */}
      {unclaimed.map(item => (
        <LootCard
          key={item.id}
          item={item}
          currentUserId={currentUserId}
          characterName={characterName}
          onClaim={onClaim}
        />
      ))}

      {/* Claimed */}
      {claimed.length > 0 && (
        <div className="pt-1 border-t border-border/20">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Claimed</span>
          {claimed.slice(0, 5).map(item => (
            <LootCard
              key={item.id}
              item={item}
              currentUserId={currentUserId}
              characterName={characterName}
              onClaim={onClaim}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LootCard({
  item,
  currentUserId,
  characterName,
  onClaim,
}: {
  item: PartyLootItem;
  currentUserId?: string;
  characterName: string;
  onClaim: (lootId: string, claimerName: string) => void;
}) {
  const isClaimed = !!item.claimed_by_user_id;
  const isClaimedByMe = item.claimed_by_user_id === currentUserId;
  const rarityClass = RARITY_COLORS[item.rarity.toLowerCase()] || RARITY_COLORS.common;

  return (
    <div className={cn(
      "flex items-center justify-between px-2 py-1.5 rounded-md border text-xs",
      isClaimed ? "opacity-60 bg-muted/10 border-border/20" : "bg-card/40 border-border/30"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <Package className="w-3 h-3 text-amber-400 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium truncate max-w-[100px]">{item.item_name}</span>
            <span className={cn("text-[9px] px-1 py-0.5 rounded border capitalize", rarityClass)}>
              {item.rarity}
            </span>
          </div>
          {item.gold_value > 0 && (
            <div className="flex items-center gap-0.5 text-[10px] text-amber-400">
              <Coins className="w-2.5 h-2.5" />
              {item.gold_value} gp
            </div>
          )}
        </div>
      </div>

      {isClaimed ? (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <Check className="w-3 h-3 text-emerald-400" />
          {isClaimedByMe ? 'You' : item.claimed_by_name}
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2 text-primary hover:text-primary"
          onClick={() => onClaim(item.id, characterName)}
        >
          Claim
        </Button>
      )}
    </div>
  );
}
