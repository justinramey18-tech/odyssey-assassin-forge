import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface AssassinZoneProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  style: React.CSSProperties;
  accentColor: string;
}

export function AssassinZone({ label, icon, onClick, style, accentColor }: AssassinZoneProps) {
  return (
    <button
      onClick={onClick}
      className="absolute flex flex-col items-center gap-1 group cursor-pointer transition-all duration-300 hover:scale-105"
      style={style}
    >
      {/* Label with arrow */}
      <div 
        className={cn(
          "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg backdrop-blur-md",
          "bg-black/60 border border-border/40 shadow-lg",
          "group-hover:border-opacity-80 transition-all"
        )}
        style={{ borderColor: accentColor }}
      >
        <div className="flex items-center gap-1.5">
          <span style={{ color: accentColor }}>{icon}</span>
          <span 
            className="text-[10px] font-cinzel uppercase tracking-wider font-bold"
            style={{ color: accentColor }}
          >
            {label}
          </span>
        </div>
        <ChevronDown 
          className="w-3 h-3 animate-bounce" 
          style={{ color: accentColor }}
        />
      </div>

      {/* Invisible hit area for the character silhouette */}
      <div 
        className={cn(
          "w-16 h-28 rounded-full opacity-0 group-hover:opacity-20 transition-opacity",
          "bg-gradient-to-b from-current to-transparent"
        )}
        style={{ color: accentColor }}
      />
    </button>
  );
}
