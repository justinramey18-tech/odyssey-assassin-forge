import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CharacterNamePlaqueProps {
  name: string;
  level: number;
}

export function CharacterNamePlaque({ name, level }: CharacterNamePlaqueProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="px-4"
    >
      {/* Full-width thin plaque */}
      <div 
        className={cn(
          "bg-plaque relative px-4 py-2 rounded-lg w-full",
          "border border-primary/30",
          "flex items-center justify-center gap-3"
        )}
      >
        {/* Decorative Corner Accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary/60 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary/60 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary/60 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary/60 rounded-br-lg" />
        
        {/* Character Name & Level - Single Line */}
        <h1 
          className={cn(
            "font-cinzel font-bold text-lg uppercase tracking-widest",
            "text-foreground text-3d-plaque"
          )}
        >
          {name || 'Mercenary'}
        </h1>
        
        <span className="text-primary/40">•</span>
        
        <span 
          className={cn(
            "text-primary font-cinzel font-semibold text-sm uppercase tracking-wider"
          )}
        >
          Level {level}
        </span>
      </div>
    </motion.div>
  );
}
