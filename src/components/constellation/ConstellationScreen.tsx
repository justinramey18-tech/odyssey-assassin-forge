import { EquipmentItem } from '@/lib/inventory/index';
import { Achievement } from '@/lib/achievements';
import { ConstellationMap } from './ConstellationMap';

interface ConstellationScreenProps {
  characterName: string;
  equippedItems: EquipmentItem[];
  achievements: Achievement[];
}

export function ConstellationScreen({ characterName, equippedItems, achievements }: ConstellationScreenProps) {
  return (
    <div className="min-h-[calc(100vh-10vh)] relative flex flex-col bg-background">
      {/* Title Header Row */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-amber-900/30 bg-gradient-to-r from-black via-amber-950/10 to-black">
        <h1 className="font-cinzel text-2xl font-bold text-amber-400 uppercase tracking-wider">
          Star Constellations
        </h1>
        <span className="text-sm text-muted-foreground">{characterName}</span>
      </div>

      {/* Constellation Map */}
      <div className="flex-1 overflow-hidden">
        <ConstellationMap equippedItems={equippedItems} achievements={achievements} />
      </div>
    </div>
  );
}
