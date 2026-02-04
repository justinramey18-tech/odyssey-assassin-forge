import { cn } from '@/lib/utils';
import { OracleMode } from './types';
import { oracleModes, getModeConfig } from './modes';

interface ModeSelectorProps {
  selected: OracleMode;
  onSelect: (mode: OracleMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ selected, onSelect, disabled }: ModeSelectorProps) {
  const selectedConfig = getModeConfig(selected);

  return (
    <div className="px-3 py-2 border-b border-white/10 shrink-0">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Mode</span>
        <span 
          className="text-xs font-medium ml-1"
          style={{ color: selectedConfig.color }}
        >
          {selectedConfig.name}
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {oracleModes.map((mode) => {
          const isSelected = selected === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all',
                'text-xs font-medium whitespace-nowrap',
                'border',
                isSelected
                  ? 'bg-white/10 border-white/30'
                  : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              style={{
                color: isSelected ? mode.color : 'rgba(255,255,255,0.6)',
                boxShadow: isSelected ? `0 0 8px ${mode.color}30` : undefined,
              }}
              title={mode.description}
            >
              <span className="text-sm">{mode.icon}</span>
              <span>{mode.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
