// Who is playing whom. One row per party member: the person on the left, the
// character on the right. Pictures come from the same ic / ooc avatar slots the
// Live DM Table uses, so what shows here matches what shows on their messages.

import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ChatAvatars } from '@/hooks/use-chat-avatars';
import enterStoryEmblem from '@/assets/enter-story-emblem.png';
import bagPanelFrame from '@/assets/bag-stats/bag-panel-frame.png';

interface RosterMember {
  user_id: string;
  character_name: string;
  character_status?: Record<string, unknown>;
}

interface PartyRosterBoardProps {
  members: RosterMember[];
  /** userId -> { ic, ooc } picture urls. */
  avatars?: Record<string, ChatAvatars>;
  /** userId -> the player's own table name. */
  oocNames?: Record<string, string>;
  currentUserId?: string;
  /** Opens the Party DM — shown in place of "playing as" on the user's own row. */
  onOpenPartyDM?: () => void;
  showEmblem?: boolean;
  showFaces?: boolean;
}

/** One picture tile with a caption underneath. */
function RosterFace({
  url,
  label,
  fallbackTint,
  isSelf,
}: {
  url?: string;
  label: string;
  fallbackTint: string;
  isSelf?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 w-[72px] shrink-0">
      <div
        className={cn(
          "relative w-[72px] h-[72px] rounded-xl overflow-hidden border",
          isSelf ? "border-amber-400/50" : "border-white/10",
        )}
      >
        {url ? (
          <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className={cn("absolute inset-0 flex items-center justify-center text-2xl font-semibold", fallbackTint)}>
            {label.charAt(0).toUpperCase() || '?'}
          </span>
        )}
      </div>
      <span
        className="w-full text-center font-body text-[11px] leading-tight text-white/70 truncate"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
      >
        {label}
      </span>
    </div>
  );
}

export function PartyRosterBoard({
  members,
  avatars,
  oocNames,
  currentUserId,
  onOpenPartyDM,
  showEmblem = true,
  showFaces = true,
}: PartyRosterBoardProps) {
  const prefersReducedMotion = useReducedMotion();
  if (!members || members.length === 0) return null;

  return (
    <div className="px-4">
      <div
        className="px-1 py-0.5"
        style={{
          borderStyle: 'solid',
          borderWidth: '14px',
          borderImageSource: `url(${bagPanelFrame})`,
          borderImageSlice: '90 fill',
          borderImageWidth: '36px',
          borderImageRepeat: 'stretch',
        }}
      >
        <div
          className="text-[9px] uppercase tracking-wider text-white/40 font-cinzel mb-2"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          The table
        </div>

        <div className="space-y-2">
          {members.map((m, rowIndex) => {
            const isSelf = m.user_id === currentUserId;
            const playerName = (oocNames?.[m.user_id] || '').trim() || 'Player';
            const charName = (m.character_name || 'Character').trim();
            const status = m.character_status as Record<string, unknown> | undefined;
            const className = typeof status?.className === 'string' ? status.className : '';
            const level = status?.level;

            return (
              <div
                key={m.user_id}
                className="flex items-start gap-2 rounded-lg p-2"
              >
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                  animate={showFaces ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                  transition={{ duration: 0.35, delay: rowIndex * 0.06 }}
                >
                  <RosterFace
                    url={avatars?.[m.user_id]?.ooc}
                    label={playerName}
                    fallbackTint="bg-sky-500/20 text-sky-200"
                    isSelf={isSelf}
                  />
                </motion.div>

                {isSelf && onOpenPartyDM ? (
                  <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1">
                    <motion.div
                      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.92 }}
                      animate={showEmblem ? { opacity: 1, scale: 1 } : { opacity: 0, scale: prefersReducedMotion ? 1 : 0.92 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full flex justify-center"
                    >
                    <button
                      onClick={onOpenPartyDM}
                      className="w-full max-w-[160px] aspect-square mx-auto min-h-[44px] active:scale-[0.97] transition-transform"
                      style={{ touchAction: 'manipulation' }}
                      aria-label="Enter the story"
                    >
                      <img
                        src={enterStoryEmblem}
                        alt=""
                        className="w-full h-full object-contain enter-story-glow"
                        fetchPriority="high"
                        decoding="async"
                      />
                    </button>
                    </motion.div>
                    {(className || level) && (
                      <motion.span
                        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                        animate={showFaces ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                        transition={{ duration: 0.35, delay: rowIndex * 0.06 }}
                        className="font-body text-[9px] text-white/25 truncate max-w-full text-center"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                      >
                        {className}{level ? ` · Lv.${level}` : ''}
                      </motion.span>
                    )}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                    animate={showFaces ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                    transition={{ duration: 0.35, delay: rowIndex * 0.06 }}
                    className="flex-1 min-w-0 flex flex-col items-center justify-center pt-5"
                  >
                    <ArrowRight className="w-4 h-4 text-white/30" />
                    <span
                      className="font-body text-[10px] text-white/40 whitespace-nowrap"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                    >
                      playing as
                    </span>
                    {(className || level) && (
                      <motion.span
                        className="font-body text-[9px] text-white/25 truncate max-w-full text-center"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                      >
                        {className}{level ? ` · Lv.${level}` : ''}
                      </motion.span>
                    )}
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                  animate={showFaces ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                  transition={{ duration: 0.35, delay: rowIndex * 0.06 }}
                >
                  <RosterFace
                    url={avatars?.[m.user_id]?.ic}
                    label={charName}
                    fallbackTint="bg-amber-500/20 text-amber-200"
                    isSelf={isSelf}
                  />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
