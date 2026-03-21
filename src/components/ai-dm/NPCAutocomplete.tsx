import { memo } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NPCAutocompleteProps {
  names: string[];
  onSelect: (name: string) => void;
  activeIndex: number;
}

export const NPCAutocomplete = memo(function NPCAutocomplete({ names, onSelect, activeIndex }: NPCAutocompleteProps) {
  if (names.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-black/95 border border-amber-900/40 rounded-xl p-1 z-30 shadow-xl max-h-[200px] overflow-y-auto">
      {names.map((name, i) => (
        <button
          key={name}
          onPointerDown={(e) => {
            e.preventDefault(); // Prevent textarea blur
            onSelect(name);
          }}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors",
            i === activeIndex
              ? "bg-amber-900/40 text-amber-300"
              : "text-white/70 hover:bg-amber-900/20 hover:text-amber-300"
          )}
        >
          <MessageCircle className="w-3.5 h-3.5 text-amber-500/60 shrink-0" />
          <span className="font-cinzel text-xs">{name}</span>
        </button>
      ))}
    </div>
  );
});
