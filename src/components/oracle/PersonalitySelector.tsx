import { useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { cn } from '@/lib/utils';
import { personalities } from './personalities';
import { Personality } from './types';

interface PersonalitySelectorProps {
  selected: Personality;
  onSelect: (personality: Personality) => void;
  disabled?: boolean;
}

export function PersonalitySelector({ selected, onSelect, disabled }: PersonalitySelectorProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    containScroll: false,
    dragFree: true,
  });

  // Scroll to selected personality when it changes
  const selectedIndex = personalities.findIndex(p => p.id === selected);
  
  useEffect(() => {
    if (emblaApi && selectedIndex >= 0) {
      emblaApi.scrollTo(selectedIndex);
    }
  }, [emblaApi, selectedIndex]);

  const handleSelect = useCallback((personality: Personality) => {
    if (!disabled) {
      onSelect(personality);
    }
  }, [disabled, onSelect]);

  return (
    <div className="relative py-3">
      {/* Fade edges to hint at scrollable content */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />
      
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3 px-6">
          {personalities.map((p) => {
            const isSelected = selected === p.id;
            
            return (
              <motion.button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                disabled={disabled}
                className={cn(
                  'relative flex flex-col items-center p-3 rounded-xl transition-all duration-300',
                  'min-w-[80px] shrink-0 backdrop-blur-sm',
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
      </div>
    </div>
  );
}
