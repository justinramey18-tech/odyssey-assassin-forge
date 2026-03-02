import { getPromptAlignment, getAlignmentZone } from '@/lib/alignmentSpectrum';

interface AlignmentBadgeProps {
  promptId: string;
  className?: string;
}

/**
 * Tiny colored pill showing a prompt's alignment zone.
 * e.g. "🌿 CG" in emerald, "💀 CE" in red.
 * Returns null if the prompt has no alignment data.
 */
export function AlignmentBadge({ promptId, className }: AlignmentBadgeProps) {
  const score = getPromptAlignment(promptId);
  if (!score) return null;

  const zone = getAlignmentZone(score);

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none shrink-0 ${className ?? ''}`}
      style={{
        backgroundColor: `${zone.cssColor}22`,
        color: zone.cssColor,
        border: `1px solid ${zone.cssColor}33`,
      }}
    >
      <span>{zone.emoji}</span>
      <span>{zone.shortLabel}</span>
    </span>
  );
}
