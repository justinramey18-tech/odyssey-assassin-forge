// Prestige Connection Lines - SVG Lines Between Nodes

import { PrestigeAbility, PrestigeBranch } from '@/lib/prestigeTree/types';
import { BRANCH_VISUAL_CONFIG } from '@/lib/prestigeTree/branchConfig';
import { NodePosition } from '@/lib/prestigeTree/layout';
import { cn } from '@/lib/utils';

interface PrestigeConnectionLinesProps {
  abilities: PrestigeAbility[];
  positions: Map<string, NodePosition>;
  unlockedSet: Set<string>;
  isMobile: boolean;
  isTier2Accessible: boolean;
  isTier3Accessible: boolean;
  className?: string;
}

interface ConnectionLine {
  fromId: string;
  toId: string;
  fromPos: NodePosition;
  toPos: NodePosition;
  isActive: boolean;
  branch: PrestigeBranch;
  targetTier: 1 | 2 | 3;  // Tier of the destination node
}

export function PrestigeConnectionLines({
  abilities,
  positions,
  unlockedSet,
  isMobile,
  isTier2Accessible,
  isTier3Accessible,
  className,
}: PrestigeConnectionLinesProps) {
  // Calculate all connection lines
  const lines: ConnectionLine[] = [];

  for (const ability of abilities) {
    const toPos = positions.get(ability.id);
    if (!toPos) continue;

    for (const prereqId of ability.prerequisites) {
      const fromPos = positions.get(prereqId);
      if (!fromPos) continue;

      // Line is active if both ends are unlocked
      const isActive = unlockedSet.has(ability.id) && unlockedSet.has(prereqId);

      lines.push({
        fromId: prereqId,
        toId: ability.id,
        fromPos,
        toPos,
        isActive,
        branch: ability.branch,
        targetTier: ability.tier,
      });
    }
  }

  if (lines.length === 0) return null;

  return (
    <svg
      className={cn(
        "absolute inset-0 w-full h-full pointer-events-none",
        className
      )}
      style={{ 
        zIndex: 0,
        willChange: 'opacity',
      }}
    >
      <defs>
        {/* Define gradients for each branch */}
        {Object.values(BRANCH_VISUAL_CONFIG).map((config) => (
          <linearGradient
            key={config.id}
            id={`gradient-${config.id}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={config.glowColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={config.glowColor} stopOpacity="0.3" />
          </linearGradient>
        ))}
        
        {/* Animated flow pattern */}
        <pattern
          id="flow-pattern"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="5" cy="5" r="1" fill="currentColor" opacity="0.5">
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </pattern>
      </defs>

      {lines.map((line, index) => {
        const config = BRANCH_VISUAL_CONFIG[line.branch];
        
        // Determine if target tier is accessible
        const isTierAccessible = 
          line.targetTier === 1 ? true :
          line.targetTier === 2 ? isTier2Accessible :
          isTier3Accessible;
        
        // Line is dimmed if tier is locked
        const isTierLocked = !isTierAccessible;
        
        return (
          <g key={`${line.fromId}-${line.toId}-${index}`}>
            {/* Base line */}
            <line
              x1={`${line.fromPos.x}%`}
              y1={`${line.fromPos.y}%`}
              x2={`${line.toPos.x}%`}
              y2={`${line.toPos.y}%`}
              stroke={
                isTierLocked ? '#1f2937' :  // Very dim for locked tiers
                line.isActive ? config.glowColor : '#374151'
              }
              strokeWidth={isTierLocked ? 1 : line.isActive ? 2 : 1}
              strokeDasharray={isTierLocked ? '2 4' : line.isActive ? undefined : '4 4'}
              opacity={isTierLocked ? 0.15 : line.isActive ? 0.8 : 0.3}
              style={{
                transition: 'stroke 0.3s, opacity 0.3s',
              }}
            />
            
            {/* Glow effect for active lines (desktop only, not for locked tiers) */}
            {line.isActive && !isMobile && !isTierLocked && (
              <line
                x1={`${line.fromPos.x}%`}
                y1={`${line.fromPos.y}%`}
                x2={`${line.toPos.x}%`}
                y2={`${line.toPos.y}%`}
                stroke={config.glowColor}
                strokeWidth={4}
                opacity={0.3}
                filter="blur(4px)"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
