import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getThistleBadges, getEllieBadges, getBadgeColorClasses } from '@/lib/easter-eggs';
import { type AlignmentScore, getAlignmentZone } from '@/lib/alignmentSpectrum';
import { useAlignmentDrift } from '@/hooks/useAlignmentDrift';
import { useCharacterIdentity } from '@/hooks/use-character-identity';
import moveHeaderPlaqueAsset from '@/assets/move-flow/move-header-plaque.png.asset.json';

interface CharacterNamePlaqueProps {
  name: string;
  level: number;
  primaryClass?: string;
  dragonName?: string;
  onOpenSettings?: () => void;
  variant?: 'default' | 'ornate';
}

const CLASS_LABELS: Record<string, string> = {
  rogue: 'Rogue',
  wizard: 'Wizard',
  sorcerer: 'Sorcerer',
  warlock: 'Warlock',
  cleric: 'Cleric',
  druid: 'Druid',
  bard: 'Bard',
};

export function CharacterNamePlaque({ name, level, primaryClass, dragonName, onOpenSettings, variant = 'default' }: CharacterNamePlaqueProps) {
  const badges = [...getThistleBadges(name || ''), ...getEllieBadges(dragonName || '')];
  const { driftPosition, historyCount } = useAlignmentDrift();
  const { gender, race } = useCharacterIdentity();

  const classLabel = primaryClass ? (CLASS_LABELS[primaryClass] || primaryClass) : null;
  const alignmentZone = historyCount > 0 ? getAlignmentZone(driftPosition) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="px-4 py-1"
    >
      <div className={variant === 'ornate' ? "relative mx-auto aspect-[900/320] w-[80%] max-w-[340px]" : undefined}>
        {variant === 'ornate' && (
          <img src={moveHeaderPlaqueAsset.url} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full select-none" />
        )}
        <div
          className={variant === 'ornate' ? "absolute flex items-center justify-center gap-2" : "flex items-center justify-center gap-3"}
          style={variant === 'ornate' ? { left: '14%', right: '14%', top: '38%', bottom: '24%' } : undefined}
        >
        <h1 
          className={cn(
            "font-cinzel font-bold uppercase tracking-widest whitespace-nowrap",
            variant === 'ornate' ? "text-sm" : "text-lg",
            "text-foreground text-3d-plaque"
          )}
        >
          {name || 'Mercenary'}
        </h1>
        
        <span className="text-primary/40">•</span>
        
        <span 
          className={cn(
            "text-primary font-cinzel font-semibold uppercase tracking-wider whitespace-nowrap",
            variant === 'ornate' ? "text-xs" : "text-sm"
          )}
        >
          Level {level}
        </span>
        </div>
      </div>

      {/* Class & Alignment subtitle */}
      {(classLabel || alignmentZone) && (
        <div className={cn("flex items-center justify-center gap-1.5 mt-0.5", variant === 'ornate' && "-mt-1.5")}>
          {classLabel && (
            <span className="text-[11px] font-cinzel text-muted-foreground uppercase tracking-wider">
              {classLabel}
            </span>
          )}
          {classLabel && alignmentZone && (
            <span className="text-muted-foreground/40 text-[10px]">·</span>
          )}
          {alignmentZone && (
            <span className="text-[11px] font-cinzel uppercase tracking-wider" style={{ color: alignmentZone.cssColor }}>
              {alignmentZone.emoji} {alignmentZone.label}
            </span>
          )}
        </div>
      )}

      {/* Identity subtitle (race/gender) */}
      {gender || race ? (
        <div className={cn("flex items-center justify-center gap-1.5 mt-0.5", variant === 'ornate' && !classLabel && !alignmentZone && "-mt-1.5")}>
          <span className="text-[11px] font-cinzel text-muted-foreground uppercase tracking-wider">
            {[gender, race].filter(Boolean).join(' ')}
          </span>
        </div>
      ) : (
        <div className={cn("flex items-center justify-center mt-0.5", variant === 'ornate' && !classLabel && !alignmentZone && "-mt-1.5")}>
          <button
            onClick={onOpenSettings}
            className="text-[11px] font-cinzel uppercase tracking-wider text-primary/60 underline hover:text-primary/80 transition-colors"
          >
            Set Identity
          </button>
        </div>
      )}

      {badges.length > 0 && (
        <div className={cn("flex items-center justify-center gap-1.5 mt-1", variant === 'ornate' && !classLabel && !alignmentZone && !gender && !race && "-mt-1.5")}>
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