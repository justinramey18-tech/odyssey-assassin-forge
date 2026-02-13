import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getThistleBadges, getBadgeColorClasses } from '@/lib/easter-eggs';

interface CharacterNamePlaqueProps {
  name: string;
  level: number;
}

export function CharacterNamePlaque({ name, level }: CharacterNamePlaqueProps) {
  const badges = getThistleBadges(name || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="px-4 py-1"
    >
      <div className="flex items-center justify-center gap-3">
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

      {badges.length > 0 && (
        <div className="flex items-center justify-center gap-1.5 mt-1">
          {badges.map(b => (
            <span
              key={b.label}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border",
                getBadgeColorClasses(b.color)
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}