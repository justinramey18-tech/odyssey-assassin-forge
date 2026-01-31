import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { personalities } from './personalities';
import { Personality } from './types';

interface PersonalitySelectorProps {
  selected: Personality;
  onSelect: (personality: Personality) => void;
  disabled?: boolean;
}

export function PersonalitySelector({ selected, onSelect, disabled }: PersonalitySelectorProps) {
  return (
    <div className="flex justify-center gap-3 p-3">
      {personalities.map((p) => {
        const isSelected = selected === p.id;
        
        return (
          <motion.button
            key={p.id}
            onClick={() => !disabled && onSelect(p.id)}
            disabled={disabled}
            className={cn(
              'relative flex flex-col items-center p-3 rounded-xl transition-all duration-300',
              'min-w-[80px] backdrop-blur-sm',
              isSelected
                ? `bg-gradient-to-br ${p.bgGradient} ${p.borderColor} border-2 shadow-lg`
                : 'bg-black/30 border border-white/10 hover:border-white/30',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            whileHover={!disabled ? { scale: 1.05 } : undefined}
            whileTap={!disabled ? { scale: 0.95 } : undefined}
            style={isSelected ? { boxShadow: `0 0 20px ${p.color}40` } : undefined}
          >
            {/* Icon */}
            <span className="text-2xl mb-1">{p.icon}</span>
            
            {/* Name */}
            <span 
              className={cn(
                'text-xs font-medium truncate w-full text-center',
                isSelected ? 'text-white' : 'text-white/70'
              )}
              style={isSelected ? { color: p.color } : undefined}
            >
              {p.name}
            </span>
            
            {/* Selection indicator */}
            {isSelected && (
              <motion.div
                layoutId="personality-indicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                style={{ backgroundColor: p.color }}
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
