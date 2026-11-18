// Solo Empyrean round room: what hangs on each wall. Every button opens a screen that already
// exists; nothing here holds game state.
import { BookOpen, Backpack, Flame, HeartHandshake, Map as MapIcon, PackageOpen, ScrollText, Tent, User, Users } from 'lucide-react';
import { RoomButton } from '@/components/empyrean/SoloRoom';

export interface SoloWorldWallProps {
  /** The rules engine's clock; null while the engine is off (no Camp button then). */
  camp: { clock: string; alert: boolean } | null;
  mapReady: boolean;
  offeredQuests: number;
  pendingLoot: number;
  onCamp: () => void;
  onMap: () => void;
  onPeople: () => void;
  onQuests: () => void;
  onLoot: () => void;
}

/** Left wall: the world around the rider. */
export function SoloWorldWall({ camp, mapReady, offeredQuests, pendingLoot, onCamp, onMap, onPeople, onQuests, onLoot }: SoloWorldWallProps) {
  return (
    <>
      {camp && <RoomButton label="Camp" detail={camp.clock.replace(', ', ' · ')} alert={camp.alert} icon={<Tent />} onClick={onCamp} />}
      {camp && mapReady && <RoomButton label="Map" icon={<MapIcon />} onClick={onMap} />}
      <RoomButton label="People" icon={<Users />} onClick={onPeople} />
      <RoomButton label="Quests" detail={offeredQuests > 0 ? 'New offers waiting' : undefined} badge={offeredQuests} icon={<ScrollText />} onClick={onQuests} />
      {pendingLoot > 0 && <RoomButton label="Loot" detail="Waiting for review" badge={pendingLoot} icon={<PackageOpen />} onClick={onLoot} />}
    </>
  );
}

export interface SoloRiderWallProps {
  /** The dragon's name; empty for an unbonded rider. */
  dragonName: string;
  bonded: boolean;
  /** Signet Strain and the armed intensity; null or missing hides the Signet button (an unbonded rider has no signet). */
  signet?: { armed: number | null; strain: number; max: number } | null;
  /** A warning dot on Tools (an unbonded rider whose Threshing is not authorized yet). */
  toolsAlert?: boolean;
  /** Tap Signet: choose an intensity, or lower an armed signet. */
  onSignet?: () => void;
  onDragon: () => void;
  onBond: () => void;
  onBag: () => void;
  onSheet: () => void;
  onTools: () => void;
}

/** Right wall: the rider's own things. */
export function SoloRiderWall({ dragonName, bonded, signet, toolsAlert, onSignet, onDragon, onBond, onBag, onSheet, onTools }: SoloRiderWallProps) {
  const burnedOut = !!signet && signet.armed == null && signet.strain >= signet.max;
  return (
    <>
      <RoomButton label={bonded && dragonName ? dragonName : 'Dragon'} detail={bonded ? 'Speak mind to mind' : 'Unbonded'}
        icon={<span aria-hidden="true" className="text-4xl leading-none">🐉</span>} onClick={onDragon} />
      {signet && onSignet && (
        <RoomButton label="Signet" icon={<Flame />} disabled={burnedOut} onClick={onSignet}
          detail={signet.armed != null ? `Armed at ${signet.armed} · tap to lower` : burnedOut ? 'Burned out' : `Strain ${signet.strain}/${signet.max}`} />
      )}
      <RoomButton label="Bond" icon={<HeartHandshake />} onClick={onBond} />
      <RoomButton label="Bag" detail="Items and actions" icon={<Backpack />} onClick={onBag} />
      <RoomButton label="Sheet" icon={<User />} onClick={onSheet} />
      <RoomButton label="Tools" detail="Saves, notes, world" alert={toolsAlert} icon={<BookOpen />} onClick={onTools} />
    </>
  );
}
