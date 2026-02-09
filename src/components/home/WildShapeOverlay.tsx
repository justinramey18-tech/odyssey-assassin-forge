import { motion } from 'framer-motion';
import { Timer, Footprints, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { generateWildShapeAbilityPrompt } from '@/lib/wildShapePrompts';

interface WildShapeOverlayProps {
  formName: string;
  speed: string;
  specialAbilities: string[];
  usesRemaining: number;
  maxUses: number;
  /** Epoch ms when transformation started */
  transformedAt?: number;
  /** Total duration in minutes */
  durationMinutes?: number;
  onDismiss: () => void;
  /** Character name for prompt generation */
  characterName?: string;
  /** Form CR for prompt generation */
  formCR?: number;
  /** Form current HP */
  formHP?: number;
  /** Form max HP */
  formMaxHP?: number;
  /** Form AC */
  formAC?: number;
}

export function WildShapeOverlay({
  formName,
  speed,
  specialAbilities,
  usesRemaining,
  maxUses,
  transformedAt,
  durationMinutes,
  onDismiss,
  characterName,
  formCR,
  formHP,
  formMaxHP,
  formAC,
}: WildShapeOverlayProps) {
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);

  // Tick remaining duration every 15s
  useEffect(() => {
    if (!transformedAt || !durationMinutes) {
      setRemainingMinutes(null);
      return;
    }

    const calc = () => {
      const elapsed = (Date.now() - transformedAt) / 1000 / 60;
      setRemainingMinutes(Math.max(0, durationMinutes - elapsed));
    };

    calc();
    const interval = setInterval(calc, 15000);
    return () => clearInterval(interval);
  }, [transformedAt, durationMinutes]);

  const formatDuration = (mins: number): string => {
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const m = Math.round(mins % 60);
      return m > 0 ? `${hours}h ${m}m` : `${hours}h`;
    }
    return `${Math.round(mins)}m`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className="mx-4"
    >
      <div className={cn(
        "relative rounded-xl overflow-hidden",
        "bg-green-950/60 border border-green-500/30 backdrop-blur-md",
        "shadow-lg shadow-green-900/20"
      )}>
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className={cn(
            "absolute top-2 right-2 z-10 p-1.5 rounded-full",
            "bg-green-900/50 hover:bg-red-900/60 border border-green-500/30 hover:border-red-500/40",
            "transition-colors duration-200"
          )}
          style={{ touchAction: 'manipulation' }}
          aria-label="Dismiss Wild Shape"
        >
          <X className="w-3.5 h-3.5 text-green-300 hover:text-red-300" />
        </button>

        <div className="p-3 space-y-2">
          {/* Top row: Speed + Duration + Uses */}
          <div className="flex items-center gap-3 flex-wrap pr-8">
            {/* Speed */}
            <div className="flex items-center gap-1.5">
              <Footprints className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-300 font-medium">{speed}</span>
            </div>

            {/* Duration */}
            {remainingMinutes !== null && (
              <div className="flex items-center gap-1.5">
                <Timer className={cn(
                  "w-3.5 h-3.5",
                  remainingMinutes <= 10 ? "text-amber-400" : "text-green-400"
                )} />
                <span className={cn(
                  "text-xs font-medium",
                  remainingMinutes <= 10 ? "text-amber-300" : "text-green-300"
                )}>
                  {formatDuration(remainingMinutes)}
                </span>
              </div>
            )}

            {/* Uses remaining */}
            <div className="flex items-center gap-1 ml-auto pr-4">
              {Array.from({ length: maxUses }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full border",
                    i < usesRemaining
                      ? "bg-green-400 border-green-300"
                      : "bg-green-900/50 border-green-700/50"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Special abilities - tappable for AI prompts */}
          {specialAbilities.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1">
                {specialAbilities.map((ability, i) => (
                  <button
                    key={i}
                    onClick={async () => {
                      if (characterName && formCR !== undefined && formHP !== undefined && formMaxHP !== undefined && formAC !== undefined) {
                        const prompt = generateWildShapeAbilityPrompt({
                          abilityName: ability,
                          characterName,
                          formName,
                          formCR,
                          formHP,
                          formMaxHP,
                          formAC,
                          formSpeed: speed,
                        });
                        try {
                          await navigator.clipboard.writeText(prompt);
                          toast.success(`${ability} prompt copied!`);
                        } catch { toast.error('Failed to copy'); }
                      }
                    }}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md",
                      "bg-green-900/40 border border-green-600/20",
                      "text-green-300/90",
                      characterName ? "hover:bg-green-800/50 hover:border-green-500/40 active:scale-95 cursor-pointer transition-all" : ""
                    )}
                    style={{ touchAction: 'manipulation' }}
                    disabled={!characterName}
                  >
                    {ability}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
