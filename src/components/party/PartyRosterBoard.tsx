// Who is playing whom. One row per party member: the person on the left, the
// character on the right. Pictures come from the same ic / ooc avatar slots the
// Live DM Table uses, so what shows here matches what shows on their messages.

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { OnlineInfo } from '@/hooks/use-online-status';
import type { ChatAvatars } from '@/hooks/use-chat-avatars';
import enterStoryEmblem from '@/assets/enter-story-emblem.png';
import bagPanelFrame from '@/assets/bag-stats/bag-panel-frame.png';
import framePlayer from '@/assets/roster/frame-player.png';
import frameCharacter from '@/assets/roster/frame-character.png';
import playingAsConnector from '@/assets/roster/playing-as-connector.png';

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
  /** Live presence (instant). Preferred when ready. */
  presenceIds?: Set<string>;
  presenceReady?: boolean;
  /** Timestamp-based fallback: userId -> OnlineInfo (also provides "Last seen …"). */
  onlineStatus?: Record<string, OnlineInfo>;
  /** Opens the Party DM — shown in place of "playing as" on the user's own row. */
  onOpenPartyDM?: () => void;
  showEmblem?: boolean;
  showFaces?: boolean;
}

/** One framed picture with a caption underneath. Pewter frame = player, gold frame = character. */
function RosterFace({
  url,
  label,
  fallbackTint,
  isSelf,
  kind,
  online,
  onlineLabel,
}: {
  url?: string;
  label: string;
  fallbackTint: string;
  isSelf?: boolean;
  kind: 'player' | 'character';
  online?: boolean;
  onlineLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-[84px] shrink-0">
      <div className="relative w-[84px] h-[84px]">
        <div
          className={cn(
            "absolute overflow-hidden rounded-[10px] bg-black/60",
            kind === 'player' ? "left-[8%] top-[8%] w-[84%] h-[84%]" : "left-[11%] top-[12.5%] w-[78%] h-[73%]",
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
        <img
          src={kind === 'player' ? framePlayer : frameCharacter}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={isSelf ? { filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.75))' } : undefined}
        />
        {online !== undefined && (
          <span
            role="img"
            aria-label={onlineLabel ?? (online ? 'Online' : 'Offline')}
            title={onlineLabel ?? (online ? 'Online' : 'Offline')}
            className={cn(
              'absolute z-[2] h-[13px] w-[13px] rounded-full border-2 border-[#120d06]',
              online ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]' : 'bg-zinc-500',
            )}
            style={{ right: '13%', bottom: '15%' }}
          />
        )}
      </div>
      <span
        className="w-full text-center font-body text-[11px] leading-tight text-white/80 truncate"
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
  presenceIds,
  presenceReady,
  onlineStatus,
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
            const presenceInfo = onlineStatus?.[m.user_id];
            const online: boolean | undefined = presenceReady && presenceIds
              ? presenceIds.has(m.user_id)
              : presenceInfo
                ? presenceInfo.isOnline
                : undefined;
            const onlineLabel = online ? 'Online' : (presenceInfo?.lastSeenLabel ?? 'Offline');

            return (
              <div
                key={m.user_id}
                className="flex items-start gap-1.5 rounded-lg px-1 py-1.5"
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
                    kind="player"
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
                          className="-mt-1 font-cinzel text-[10px] font-bold capitalize tracking-[0.06em] text-amber-50/80 truncate max-w-full text-center"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                        >
                          {className}{level ? ` · Lv ${level}` : ''}
                        </motion.span>
                    )}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                    animate={showFaces ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                    transition={{ duration: 0.35, delay: rowIndex * 0.06 }}
                    className="flex-1 min-w-0 h-[84px] flex flex-col items-center justify-center gap-px"
                  >
                    <span className="font-cinzel text-[8px] font-bold uppercase tracking-[0.22em] text-[#E9C77B]/75 [text-shadow:0_1px_2px_#000]">
                      Playing as
                    </span>
                    <div
                      className="flex h-6 w-full max-w-[150px] items-center justify-center"
                      style={{
                        borderStyle: 'solid',
                        borderWidth: '0 45px 0 34px',
                        borderImage: `url(${playingAsConnector}) 0 226 0 172 fill / 0 45px 0 34px stretch`,
                      }}
                    >
                      {level ? (
                        <span className="whitespace-nowrap font-cinzel text-[9px] font-bold tracking-[0.04em] text-[#FFE4AA] [text-shadow:0_0_4px_rgba(245,158,11,0.6),0_1px_1px_#000]">
                          Lv {String(level)}
                        </span>
                      ) : null}
                    </div>
                    {className && (
                      <span className="max-w-full truncate font-cinzel text-[10.5px] font-bold capitalize text-amber-50/85 [text-shadow:0_1px_3px_#000]">
                        {className}
                      </span>
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
                    kind="character"
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
