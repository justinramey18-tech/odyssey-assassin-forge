import { ArrowLeft } from 'lucide-react';
import { EquipmentItem } from '@/lib/inventory/index';
import { ConstellationMap } from './ConstellationMap';

interface ConstellationScreenProps {
  characterName: string;
  equippedItems: EquipmentItem[];
  onBack?: () => void;
}

export function ConstellationScreen({ characterName, equippedItems, onBack }: ConstellationScreenProps) {

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Top Status Bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-amber-900/30 bg-gradient-to-r from-black via-amber-950/10 to-black">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-amber-400" />
        </button>
        <h1 className="font-cinzel font-bold text-amber-400 uppercase tracking-wider">{characterName}</h1>
        <div className="w-9" /> {/* Spacer for alignment */}
      </header>

      {/* Constellation Map */}
      <div className="flex-1 overflow-hidden">
        <ConstellationMap equippedItems={equippedItems} />
      </div>
    </div>
  );
}
