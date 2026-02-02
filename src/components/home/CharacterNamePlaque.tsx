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
      className="flex flex-col items-center"
    >
      {/* 3D Plaque Container */}
      <div 
        className={cn(
          "bg-plaque relative px-8 py-4 rounded-lg",
          "border-2 border-primary/30"
        )}
      >
        {/* Decorative Corner Accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary/60 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary/60 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary/60 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary/60 rounded-br-lg" />
        
        {/* Character Name */}
        <h1 
          className={cn(
            "font-cinzel font-bold text-xl uppercase tracking-widest text-center",
            "text-foreground text-3d-plaque"
          )}
        >
          {name || 'Mercenary'}
        </h1>
        
        {/* Level Badge */}
        <div className="flex justify-center mt-2">
          <div 
            className={cn(
              "px-4 py-1 rounded-full",
              "bg-primary/20 border border-primary/40",
              "text-primary font-cinzel font-semibold text-sm uppercase tracking-wider"
            )}
          >
            Level {level}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
