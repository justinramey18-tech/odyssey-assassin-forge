import { cn } from '@/lib/utils';
import './TacticalHUDStyles.css';

interface TacticalHUDOverlayProps {
  className?: string;
  showScanlines?: boolean;
  showBrackets?: boolean;
}

/**
 * Tactical HUD visual overlay with Iron Man helmet-style effects.
 * Includes scanlines, corner brackets, and ambient glow.
 */
export function TacticalHUDOverlay({
  className,
  showScanlines = true,
  showBrackets = true,
}: TacticalHUDOverlayProps) {
  return (
    <div className={cn("fixed inset-0 pointer-events-none z-30", className)}>
      {/* Scanline effect */}
      {showScanlines && <div className="tactical-scanlines" />}
      
      {/* Corner brackets */}
      {showBrackets && (
        <>
          <div className="tactical-bracket tactical-bracket--tl absolute top-2 left-2" />
          <div className="tactical-bracket tactical-bracket--tr absolute top-2 right-2" />
          <div className="tactical-bracket tactical-bracket--bl absolute bottom-2 left-2" />
          <div className="tactical-bracket tactical-bracket--br absolute bottom-2 right-2" />
        </>
      )}
      
      {/* Ambient vignette glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.3) 100%),
            linear-gradient(180deg, rgba(220,38,38,0.03) 0%, transparent 20%, transparent 80%, rgba(220,38,38,0.02) 100%)
          `,
        }}
      />
    </div>
  );
}
