import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useDmPolls } from '@/hooks/use-dm-polls';
import { useDraftPersist } from '@/hooks/use-draft-persist';
import partyChatIcon from '@/assets/party-chat-icon.jpg';
import { isMomoEasterEgg } from '@/lib/easter-eggs';
import { GeraltGameplayWidget } from './GeraltGameplayWidget';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Crown, Send, Users, Check, CheckCheck, Zap, Eye, EyeOff, X, Shield, Loader2, Pencil, Trash2, Copy, RefreshCw, MoreVertical, Film, Image as ImageIcon, Plus, Save, Volume2, VolumeX, GitBranch, Heart, Bird, ChevronDown, Timer, Ghost, Lock, Maximize2, Minimize2, Radio, MessageSquare, Paperclip, Camera, BarChart3 } from 'lucide-react';
import { loadState as loadGeraltState } from '@/components/companion/geralt-data';
import { SplitInitiator, SplitBanner, RegroupDialog, SplitSummariesViewer, PreSplitChatViewer } from './PartySplitUI';
import { InfinityStoneDMDrawer } from './InfinityStoneDMDrawer';
import { WhisperTray } from './WhisperTray';
import { OraclePanel } from '@/components/oracle/OraclePanel';
import { PartyDMSettings } from './PartyDMSettings';
import { DMComposePanel } from './DMComposePanel';
import { DraftReviewPanel } from './DraftReviewPanel';
import { SynthesisReviewPanel } from './SynthesisReviewPanel';
import { DMBottomNav, DMNavTab } from './DMBottomNav';
import { CampaignDropdown } from './CampaignDropdown';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { toast } from 'sonner';
import { useNarrator } from '@/hooks/use-narrator';
import { useSpotify } from '@/hooks/use-spotify';
import { subscribeToPush, unsubscribeFromPush, getPushSubscriptionState, type PushSubscriptionState } from '@/lib/push-subscription';
import { useAuth } from '@/hooks/use-auth';
import { loadSelectedModel, saveSelectedModel } from '@/lib/dm-models';
import { NarrationSpeedPopover } from './NarrationSpeedPopover';
import type { usePartyDm, PartyDmMessage, PartyDmPrompt } from '@/hooks/use-party-dm';
import { DMDiceRoller } from './DMDiceRoller';
import { PartyDMQuickActions } from './PartyDMQuickActions';
import { RoundTimer, TimerSettings } from './RoundTimer';
import { AfkPersonalityGuide } from './AfkPersonalityGuide';
import { ScheduledEventsSheet } from './ScheduledEventsSheet';
import type { CharacterContext } from '@/components/oracle/types';
import type { CampaignSession } from '@/hooks/use-campaign-sessions';
import { useWhisperTrayEnabled } from '@/hooks/use-whisper-tray-enabled';

type PartyDmReturn = ReturnType<typeof usePartyDm>;

interface PartyDMScreenProps {
  onBack: () => void;
  partyId?: string | null;
  partyDm: PartyDmReturn;
  isCreator: boolean;
  isOriginalCreator?: boolean;
  coHostIds?: string[];
  onPromoteCoHost?: (userId: string) => void;
  onDemoteCoHost?: (userId: string) => void;
  currentUserId?: string;
  memberCount: number;
  members: Array<{ user_id: string; character_name: string; character_status?: Record<string, unknown> }>;
  onShowGuides?: () => void;
  onShowMap?: () => void;
  onShowSaves?: () => void;
  onShowChat?: () => void;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  isExtracting?: boolean;
  guidesCount?: number;
  characterContext?: CharacterContext;
  showBattleMap?: boolean;
  battleMapContent?: React.ReactNode;
  // Campaign dropdown props (creator-only)
  campaignSessions?: CampaignSession[];
  campaignSessionsLoading?: boolean;
  campaignSessionsSignedIn?: boolean;
  onNewGame?: () => void;
  onLoadCampaign?: (session: CampaignSession) => void;
  onRefreshCampaigns?: () => void;
}

const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];

function formatAutoSaveTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMemberColor(userId: string, members: Array<{ user_id: string }>): string {
  const idx = members.findIndex(m => m.user_id === userId);
  return MEMBER_COLORS[idx >= 0 ? idx % MEMBER_COLORS.length : 0];
}

const PARTY_VIDEO_REGEX = /^\s*\[video:(https?:\/\/.+)\]\s*$/;
const PARTY_IMAGE_REGEX = /^\s*\[image:(https?:\/\/.+)\]\s*$/;
const AFK_LINE_REGEX = /^(\[.+?\]) \(AFK\): (.+)$/;

function highlightAfkNames(children: React.ReactNode, afkNames: string[]): React.ReactNode {
  if (!afkNames.length) return children;
  const processNode = (node: React.ReactNode, key?: number): React.ReactNode => {
    if (typeof node === 'string') {
      const pattern = new RegExp(`\\b(${afkNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
      const parts = node.split(pattern);
      if (parts.length === 1) return node;
      return parts.map((part, i) =>
        afkNames.some(n => n.toLowerCase() === part.toLowerCase()) ? (
          <span key={i} className="inline-flex items-center gap-0.5">
            <Ghost className="w-3 h-3 text-purple-400 inline" />
            <span className="text-purple-300 font-medium">{part}</span>
          </span>
        ) : part
      );
    }
    if (Array.isArray(node)) return node.map((child, i) => processNode(child, i));
    return node;
  };
  return processNode(children);
}

/** Extract AFK character names from raw content before stripping */
function extractAfkNames(rawContent: string): string[] {
  const names: string[] = [];
  for (const line of rawContent.split('\n')) {
    const match = line.match(AFK_LINE_REGEX);
    if (match) {
      const name = match[1].replace(/^\[|\]$/g, '');
      if (name) names.push(name);
    }
  }
  return names;
}

/** Strip AFK guide text lines, keeping only non-AFK content */
function stripHidden(content: string): string {
  return content
    .split('\n')
    .filter(line => !AFK_LINE_REGEX.test(line))
    .join('\n');
}

function AfkAnnotatedContent({ content, afkNames }: { content: string; afkNames?: string[] }) {
  const strippedContent = stripHidden(content);
  const names = afkNames ?? [];
  return (
    <>
      {names.length > 0 && (
        <span className="flex flex-wrap gap-1 mb-1">
          {names.map((name, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 border border-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300 font-medium">
              <Ghost className="w-3 h-3" />
              {name}
            </span>
          ))}
        </span>
      )}
      {strippedContent.split('\n').map((line, i) => (
        <span key={i} className="block">{line}</span>
      ))}
    </>
  );
}

function PartyDMMessage({ message, currentUserId, members, mode, isCreator, onCopy, onEdit, onDelete, onRegenerate, onRegenerateWhispers, showTeamTag, allMessages, ttsSelectMode, ttsSelected, onTtsToggle, whisperTrayEnabled = true }: {
  message: PartyDmMessage;
  currentUserId?: string;
  members: Array<{ user_id: string; character_name: string }>;
  mode: 'shared' | 'private';
  isCreator?: boolean;
  onCopy?: (content: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onRegenerateWhispers?: (messageId: string) => void;
  showTeamTag?: boolean;
  allMessages?: PartyDmMessage[];
  ttsSelectMode?: boolean;
  ttsSelected?: boolean;
  onTtsToggle?: (id: string) => void;
  whisperTrayEnabled?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [isEditingMsg, setIsEditingMsg] = useState(false);
  const [editContent, setEditContent] = useState('');
  const isAssistant = message.role === 'assistant';
  const isMine = message.sender_user_id === currentUserId;
  const videoMatch = message.content.match(PARTY_VIDEO_REGEX);
  const imageMatch = !videoMatch ? message.content.match(PARTY_IMAGE_REGEX) : null;

  // Extract AFK character names from the preceding user message
  const afkCharNames = useMemo(() => {
    if (!isAssistant || !allMessages) return [];
    const idx = allMessages.findIndex(m => m.id === message.id);
    if (idx <= 0) return [];
    const prev = allMessages[idx - 1];
    if (prev.role !== 'user') return [];
    const names: string[] = [];
    for (const line of prev.content.split('\n')) {
      const match = line.match(AFK_LINE_REGEX);
      if (match) {
        // match[1] is like "[CharName]", extract the name
        const name = match[1].replace(/^\[|\]$/g, '');
        if (name) names.push(name);
      }
    }
    return names;
  }, [isAssistant, allMessages, message.id]);

  // In private mode, hide other players' user messages content
  if (!isAssistant && !isMine && mode === 'private') {
    return (
      <div className="flex gap-1.5 justify-start min-w-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 opacity-50"
          style={{ backgroundColor: getMemberColor(message.sender_user_id || '', members) + '30', border: `1px solid ${getMemberColor(message.sender_user_id || '', members)}40` }}>
          <Shield className="w-3.5 h-3.5" style={{ color: getMemberColor(message.sender_user_id || '', members) }} />
        </div>
        <div className="flex-1 min-w-0 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-white/5 border border-white/10 rounded-bl-sm">
          <p className="text-[11px] font-semibold mb-0.5" style={{ color: getMemberColor(message.sender_user_id || '', members) }}>
            {message.sender_name}
          </p>
          <p className="text-sm text-white/40 italic">Taking action...</p>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    const myCharName = members.find(m => m.user_id === currentUserId)?.character_name;
    const filteredWhispers = (message.whispers || []).filter((w: any) => {
      if (w.type !== 'whisper') return true;
      if (!w.target || !myCharName) return false;
      return w.target.toLowerCase() === myCharName.toLowerCase();
    });

    return (
      <>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5 justify-start group/msg relative min-w-0">
          {/* TTS Select Checkbox */}
          {ttsSelectMode && (
            <button
              onClick={() => onTtsToggle?.(message.id)}
              className="flex items-center justify-center w-6 h-6 shrink-0 self-center"
              style={{ touchAction: 'manipulation' }}
            >
              <div className={cn(
                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                ttsSelected
                  ? "bg-amber-500 border-amber-400"
                  : "border-white/30 hover:border-amber-400/60"
              )}>
                {ttsSelected && <Check className="w-3.5 h-3.5 text-black" />}
              </div>
            </button>
          )}
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-amber-950/50 border border-amber-500/20 rounded-bl-sm overflow-hidden">
            {showTeamTag && message.team && (
              <span className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-cinzel mb-1",
                message.team === 'alpha' ? "bg-blue-900/30 text-blue-300 border border-blue-500/20" : "bg-purple-900/30 text-purple-300 border border-purple-500/20"
              )}>
                <GitBranch className="w-2.5 h-2.5" />
                {message.team === 'alpha' ? 'Alpha' : 'Beta'}
              </span>
            )}
            {isEditingMsg ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[80px] max-h-[300px]"
                  rows={4}
                  autoFocus
                />
                <div className="flex gap-1.5 justify-end">
                  <Button
                    onClick={() => setIsEditingMsg(false)}
                    size="sm"
                    variant="ghost"
                    className="text-white/40 hover:text-white/70 h-7 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (editContent.trim() && onEdit) {
                        onEdit(message.id, editContent.trim());
                      }
                      setIsEditingMsg(false);
                    }}
                    size="sm"
                    className="gap-1 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300 h-7 px-2 text-xs"
                  >
                    <Check className="w-3 h-3" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-xs prose prose-invert prose-xs max-w-none break-words overflow-wrap-anywhere">
                {videoMatch ? (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Film className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-300/70 font-cinzel">Video</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                      <video src={videoMatch[1]} controls playsInline className="w-full rounded-xl" />
                    </div>
                  </div>
                ) : imageMatch ? (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <ImageIcon className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-300/70 font-cinzel">Photo</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                      <img src={imageMatch[1]} alt="Chat photo" className="w-full rounded-xl" loading="lazy" />
                    </div>
                  </div>
                ) : (
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      p: ({ children }) => {
                        if (afkCharNames.length === 0) return <p className="mb-2 last:mb-0">{children}</p>;
                        return <p className="mb-2 last:mb-0">{highlightAfkNames(children, afkCharNames)}</p>;
                      },
                      strong: ({ children }) => <strong className="text-amber-300">{children}</strong>,
                      em: ({ children }) => <em className="text-white/70">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-amber-500/40 pl-3 italic text-white/60 my-2">{children}</blockquote>
                      ),
                    }}
                  >
                    {message.content || '...'}
                  </ReactMarkdown>
                )}
              </div>
            )}

            {/* Host action buttons */}
            {isCreator && !isEditingMsg && (
              <div className="relative mt-1.5">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-1 rounded text-white/20 hover:text-white/60 transition-colors opacity-0 group-hover/msg:opacity-100"
                  style={{ touchAction: 'manipulation' }}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {showActions && (
                  <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-black/90 border border-amber-900/30 rounded-lg p-1 z-10 shadow-lg">
                    <button
                      onClick={() => { onCopy?.(message.content); setShowActions(false); }}
                      className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setEditContent(message.content); setIsEditingMsg(true); setShowActions(false); }}
                      className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { onRegenerate?.(message.id); setShowActions(false); }}
                      className="p-1.5 rounded hover:bg-amber-900/30 text-amber-400/60 hover:text-amber-300 transition-colors"
                      title="Regenerate"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { onRegenerateWhispers?.(message.id); setShowActions(false); }}
                      className="p-1.5 rounded hover:bg-emerald-900/30 text-emerald-400/60 hover:text-emerald-300 transition-colors"
                      title="Regenerate Whisper Tray"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { onDelete?.(message.id); setShowActions(false); }}
                      className="p-1.5 rounded hover:bg-red-900/20 text-red-400/60 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
        {/* Whisper tray below the AI message bubble, filtered to current player */}
        {whisperTrayEnabled && filteredWhispers.length > 0 && (
          <div className="ml-[calc(1.75rem+0.375rem)]">
            <WhisperTray whispers={filteredWhispers} />
          </div>
        )}
      </>
    );
  }

  // User message (combined prompts)
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5 justify-start group/msg relative min-w-0">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary/20 border border-primary/30">
        <Users className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-white/5 border border-white/10 rounded-bl-sm overflow-hidden">
        {showTeamTag && message.team && (
          <span className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-cinzel mb-1",
            message.team === 'alpha' ? "bg-blue-900/30 text-blue-300 border border-blue-500/20" : "bg-purple-900/30 text-purple-300 border border-purple-500/20"
          )}>
            <GitBranch className="w-2.5 h-2.5" />
            {message.team === 'alpha' ? 'Alpha' : 'Beta'}
          </span>
        )}
        <p className="text-[11px] font-semibold text-primary mb-1">Party Actions</p>
        {isEditingMsg ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40 resize-none min-h-[80px] max-h-[300px]"
              rows={4}
              autoFocus
            />
            <div className="flex gap-1.5 justify-end">
              <Button
                onClick={() => setIsEditingMsg(false)}
                size="sm"
                variant="ghost"
                className="text-white/40 hover:text-white/70 h-7 px-2 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editContent.trim() && onEdit) {
                    onEdit(message.id, editContent.trim());
                  }
                  setIsEditingMsg(false);
                }}
                size="sm"
                className="gap-1 bg-primary/20 border border-primary/30 hover:bg-primary/30 text-primary h-7 px-2 text-xs"
              >
                <Check className="w-3 h-3" />
                Save
              </Button>
            </div>
          </div>
        ) : (
        <p className="text-xs whitespace-pre-wrap text-white/90">
          {videoMatch ? (
            <span>
              <span className="flex items-center gap-1 mb-1.5">
                <Film className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-300/70 font-cinzel">Video</span>
              </span>
              <span className="block rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                <video src={videoMatch[1]} controls playsInline className="w-full rounded-xl" />
              </span>
            </span>
          ) : imageMatch ? (
            <span>
              <span className="flex items-center gap-1 mb-1.5">
                <ImageIcon className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-300/70 font-cinzel">Photo</span>
              </span>
              <span className="block rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                <img src={imageMatch[1]} alt="Chat photo" className="w-full rounded-xl" loading="lazy" />
              </span>
            </span>
          ) : (
            <AfkAnnotatedContent content={message.content} afkNames={extractAfkNames(message.content)} />
          )}
        </p>
        )}

        {/* Host action buttons */}
        {isCreator && !isEditingMsg && (
          <div className="relative mt-1.5">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 rounded text-white/20 hover:text-white/60 transition-colors opacity-0 group-hover/msg:opacity-100"
              style={{ touchAction: 'manipulation' }}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showActions && (
              <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-black/90 border border-white/10 rounded-lg p-1 z-10 shadow-lg">
                <button
                  onClick={() => { onCopy?.(message.content); setShowActions(false); }}
                  className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setEditContent(message.content); setIsEditingMsg(true); setShowActions(false); }}
                  className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { onDelete?.(message.id); setShowActions(false); }}
                  className="p-1.5 rounded hover:bg-red-900/20 text-red-400/60 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function PartyDMScreen({ onBack, partyId, partyDm, isCreator, isOriginalCreator: isOriginalCreatorProp, coHostIds, onPromoteCoHost, onDemoteCoHost, currentUserId, memberCount, members, onShowGuides, onShowMap, onShowSaves, onShowChat, autoSyncEnabled, onToggleAutoSync, isExtracting, guidesCount = 0, characterContext, showBattleMap, battleMapContent, campaignSessions, campaignSessionsLoading, campaignSessionsSignedIn, onNewGame, onLoadCampaign, onRefreshCampaigns }: PartyDMScreenProps) {
  const originalCreator = isOriginalCreatorProp ?? isCreator;
  const [input, setInput, clearInput] = useDraftPersist('odyssey-party-dm-draft');
  const [, setTick] = useState(0);
  const narrator = useNarrator();
  const spotify = useSpotify();
  const { whisperTrayEnabled, setWhisperTrayEnabled } = useWhisperTrayEnabled();
  const dmPolls = useDmPolls(partyId || null);
  const [ttsSelectMode, setTtsSelectMode] = useState(false);
  const [ttsSelectedIds, setTtsSelectedIds] = useState<Set<string>>(new Set());
  const lastProcessedMsgIdRef = useRef<string | null>(null);

  // Auto-mood for party DM: detect new assistant messages and trigger mood detection
  useEffect(() => {
    if (!spotify.autoMoodEnabled || !spotify.connected) return;
    const msgs = partyDm.messages;
    if (msgs.length === 0) return;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.role === 'assistant' && lastMsg.id !== lastProcessedMsgIdRef.current && lastMsg.content) {
      lastProcessedMsgIdRef.current = lastMsg.id;
      spotify.playMoodForText(lastMsg.content);
    }
  }, [partyDm.messages, spotify.autoMoodEnabled, spotify.connected, spotify.playMoodForText]);

  useEffect(() => {
    if (!partyDm.lastAutoSaveTime) return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [partyDm.lastAutoSaveTime]);
  
  const [selectedDmModel, setSelectedDmModel] = useState(() => loadSelectedModel());
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  useEffect(() => {
    if (!showAttachMenu) return;
    const dismiss = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-attach-menu]')) return;
      setShowAttachMenu(false);
    };
    const timer = setTimeout(() => document.addEventListener('pointerdown', dismiss), 0);
    return () => { clearTimeout(timer); document.removeEventListener('pointerdown', dismiss); };
  }, [showAttachMenu]);
  const [expandedPillUserId, setExpandedPillUserId] = useState<string | null>(null);
  const [pillEditText, setPillEditText] = useState('');
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [showNewCampaignInput, setShowNewCampaignInput] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);
  const videoCameraRef = useRef<HTMLInputElement>(null);

  // Bottom nav state
  const [activeNavTab, setActiveNavTab] = useState<DMNavTab | null>(null);
  const [navExpanded, setNavExpanded] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [showStoneDrawer, setShowStoneDrawer] = useState(false);

  // Split party state
  const [showSplitInitiator, setShowSplitInitiator] = useState(false);
  const [showRegroupDialog, setShowRegroupDialog] = useState(false);
  const [showSplitSummaries, setShowSplitSummaries] = useState(false);
  const [showPreSplitChat, setShowPreSplitChat] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [showAfkGuide, setShowAfkGuide] = useState(false);
  const [showScheduledEvents, setShowScheduledEvents] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Chat unread badge tracking
  const [chatTotalCount, setChatTotalCount] = useState(0);
  const chatLastSeen = useRef(0);
  useEffect(() => {
    if (!partyId) return;
    try { chatLastSeen.current = parseInt(localStorage.getItem(`odyssey_chat_lastSeen_${partyId}`) || '0', 10) || 0; } catch { chatLastSeen.current = 0; }
    // Fetch current count
    supabase.from('party_messages').select('id', { count: 'exact', head: true }).eq('party_id', partyId).then(({ count }) => {
      setChatTotalCount(count ?? 0);
    });
    // Subscribe to new messages
    const ch = supabase.channel(`chat-badge-${partyId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter: `party_id=eq.${partyId}` }, () => {
      setChatTotalCount(prev => prev + 1);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partyId]);
  const chatUnreadCount = Math.max(0, chatTotalCount - chatLastSeen.current);
  const [myAfkGuide, setMyAfkGuide] = useState<string | null>(() => {
    const me = members.find(m => m.user_id === currentUserId);
    return (me?.character_status?.afkPersonalityGuide as string) || null;
  });
  const [myAfkCascade, setMyAfkCascade] = useState<string[] | null>(() => {
    const me = members.find(m => m.user_id === currentUserId);
    return (me?.character_status?.afkPromptCascade as string[]) || null;
  });
  const [localTimerEnabled, setLocalTimerEnabled] = useState(partyDm.sessionConfig?.timerEnabled ?? false);
  const [localTimerDuration, setLocalTimerDuration] = useState(partyDm.sessionConfig?.timerDurationSeconds ?? 120);

  // Sync local timer state when sessionConfig changes
  useEffect(() => {
    if (partyDm.sessionConfig) {
      setLocalTimerEnabled(partyDm.sessionConfig.timerEnabled ?? false);
      setLocalTimerDuration(partyDm.sessionConfig.timerDurationSeconds ?? 120);
    }
  }, [partyDm.sessionConfig?.timerEnabled, partyDm.sessionConfig?.timerDurationSeconds]);

  // Handle timer expiry — any connected member triggers generation
  // Database-level lock in generateResponse prevents double-generation
  // In human mode, timer expiry doesn't auto-generate — host writes manually
  const handleTimerExpire = useCallback(() => {
    const mode = partyDm.sessionConfig?.dmMode || 'ai';
    if (!partyDm.isGenerating && mode !== 'human') {
      partyDm.generateResponse();
    }
  }, [partyDm.isGenerating, partyDm.generateResponse, partyDm.sessionConfig?.dmMode]);

  const mode = partyDm.sessionConfig?.mode || 'shared';

  const visibleMembers = partyDm.isSplitActive && partyDm.splitState && !isCreator
    ? members.filter(m =>
        partyDm.myTeam === 'alpha'
          ? partyDm.splitState!.alphaMembers.includes(m.user_id)
          : partyDm.splitState!.betaMembers.includes(m.user_id)
      )
    : members;

  // Host broadcast playlist indicator
  const [broadcastPlaylist, setBroadcastPlaylist] = useState<string | null>(null);
  useEffect(() => {
    if (!partyId) return;

    // Fetch initial
    supabase
      .from('party_shared_state')
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', 'spotify_sync')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.state_data && typeof data.state_data === 'object') {
          const sd = data.state_data as any;
          setBroadcastPlaylist(sd.playlistName || null);
        }
      });

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`broadcast-indicator-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_shared_state', filter: `party_id=eq.${partyId}` },
        (payload) => {
          const row = payload.new as any;
          if (row?.state_type !== 'spotify_sync') return;
          const sd = row.state_data;
          setBroadcastPlaylist(sd?.playlistName || null);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  // Push notification state
  const { user } = useAuth();
  const [pushState, setPushState] = useState<PushSubscriptionState>('unsupported');

  // Check push state on mount and after toggle
  const refreshPushState = useCallback(async () => {
    const state = await getPushSubscriptionState();
    setPushState(state);
  }, []);

  useEffect(() => {
    refreshPushState();
  }, [refreshPushState]);

  // Auto-prompt push subscription 1.5s after mount
  useEffect(() => {
    if (!user?.id) return;
    const timer = setTimeout(async () => {
      const state = await getPushSubscriptionState();
      if (state === 'supported' || state === 'unsubscribed') {
        const success = await subscribeToPush(user.id);
        if (success) setPushState('subscribed');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user?.id]);

  const handleTogglePush = useCallback(async () => {
    if (!user?.id) return;
    if (pushState === 'subscribed') {
      await unsubscribeFromPush(user.id);
      setPushState('unsubscribed');
      toast('🔕 Push notifications disabled');
    } else if (pushState === 'unsubscribed' || pushState === 'supported') {
      const success = await subscribeToPush(user.id);
      if (success) {
        setPushState('subscribed');
        toast('🔔 Push notifications enabled');
      } else {
        await refreshPushState();
        if (Notification.permission === 'denied') {
          toast.error('Notifications blocked — enable in browser settings');
        }
      }
    }
  }, [user?.id, pushState, refreshPushState]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [partyDm.messages, partyDm.currentPrompts]);

  useEffect(() => {
    if (partyDm.isGenerating) {
      setExpandedPillUserId(null);
      setQueueDrawerOpen(false);
    }
  }, [partyDm.isGenerating]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    partyDm.submitPrompt(input.trim());
    clearInput();
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, partyDm]);

  const handleKeyDown = useCallback((_e: React.KeyboardEvent) => {
    // Enter inserts newline naturally (textarea default); send via button only
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10MB)'); return; }
        setIsUploadingPhoto(true);
        try {
          const ext = file.type.includes('gif') ? 'gif' : file.type.split('/')[1] || 'png';
          const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from('party-chat-images').upload(path, file);
          if (error) throw error;
          const { data: urlData } = supabase.storage.from('party-chat-images').getPublicUrl(path);
          const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
          await partyDm.addMediaMessage(`[image:${urlData.publicUrl}]`, senderName);
        } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
        finally { setIsUploadingPhoto(false); }
        return;
      }
    }

    const text = e.clipboardData?.getData('text/plain')?.trim();
    if (text && /^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i.test(text)) {
      e.preventDefault();
      const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
      await partyDm.addMediaMessage(`[image:${text}]`, senderName);
      return;
    }
  }, [partyDm, members, currentUserId]);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  }, []);

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    partyDm.editMessage?.(messageId, content);
  }, [partyDm]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    partyDm.deleteMessage?.(messageId);
  }, [partyDm]);

  const handleRegenerateMessage = useCallback((messageId: string) => {
    partyDm.regenerateMessage?.(messageId);
  }, [partyDm]);

  const handleRegenerateWhispers = useCallback((messageId: string) => {
    partyDm.regenerateWhispers?.(messageId);
  }, [partyDm]);

  const handleDiceRoll = useCallback((message: string) => {
    setInput(prev => prev ? `${prev}\n${message}` : message);
  }, []);

  const handleUsePrompt = useCallback((prompt: string) => {
    setInput(prev => prev ? `${prev}\n${prompt}` : prompt);
  }, []);

  // Geralt widget state (momo easter egg)
  const [showGeraltWidget, setShowGeraltWidget] = useState(false);
  const isMomo = useMemo(() => isMomoEasterEgg(characterContext?.name || ''), [characterContext?.name]);
  const geraltCharacterId = useMemo(() => (characterContext?.name || '').toLowerCase().trim() || 'unknown', [characterContext?.name]);

  // Geralt HP for sub-header (momo only) — reactive via callback
  const [geraltHp, setGeraltHp] = useState<{ current: number; max: number } | null>(null);
  useEffect(() => {
    if (isMomo) {
      const s = loadGeraltState(geraltCharacterId);
      setGeraltHp({ current: s.currentHP, max: s.maxHP });
    }
  }, [isMomo, geraltCharacterId]);
  const handleGeraltHpChange = useCallback((currentHP: number, maxHP: number) => {
    setGeraltHp({ current: currentHP, max: maxHP });
  }, []);
  const geraltHpPct = geraltHp ? Math.max(0, Math.min(100, (geraltHp.current / geraltHp.max) * 100)) : 0;

  // Bottom nav tab handler
  const handleNavTabChange = useCallback((tab: DMNavTab) => {
    if (tab === 'prompts') {
      setShowStoneDrawer(true);
      return;
    }
    if (tab === 'actions') {
      setQuickActionsOpen(true);
      return;
    }
    if (tab === 'geralt') {
      setShowGeraltWidget(true);
      return;
    }
    if (tab === 'afk') {
      setShowAfkGuide(true);
      return;
    }
    // Dice and settings tabs toggle
    setActiveNavTab(prev => prev === tab ? null : tab);
  }, []);

  const hasSubmitted = !!partyDm.myPrompt;
  const isReady = partyDm.myPrompt?.is_ready ?? false;
  const showDiceContent = activeNavTab === 'dice' && characterContext && !partyDm.isGenerating;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      {/* Row 1: Main Header */}
      {!isFullscreen && (
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
            <Home className="w-5 h-5 text-white/80" />
          </button>
          <Crown className="w-6 h-6 text-amber-400" />
          {isCreator && campaignSessions && onNewGame && onLoadCampaign && onRefreshCampaigns ? (
            <CampaignDropdown
              sessions={campaignSessions}
              activeCampaignId={partyDm.activeCampaignId}
              isSignedIn={campaignSessionsSignedIn ?? false}
              isLoading={campaignSessionsLoading ?? false}
              onNewGame={onNewGame}
              onLoadCampaign={onLoadCampaign}
              onRefresh={onRefreshCampaigns}
            />
          ) : (
            <h1 className="text-lg font-cinzel text-amber-200 tracking-wide">Dungeon Master</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{memberCount} players</span>
          {partyDm.messages.length > 0 && (
            <button
              onClick={() => {
                const name = partyDm.activeCampaignId ? undefined : `Party Campaign ${new Date().toLocaleDateString()}`;
                partyDm.saveCampaign(name || 'Party Campaign', partyDm.activeCampaignId || undefined);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ touchAction: 'manipulation' }}
              title={partyDm.lastAutoSaveTime ? `Saved ${formatAutoSaveTime(partyDm.lastAutoSaveTime)}` : 'Save now'}
            >
              <Save className="w-4 h-4 text-white/30 hover:text-amber-400/60" />
            </button>
          )}
          
        </div>
      </header>
      )}

      {/* Row 2: Sub-Header Strip (status only) */}
      {!isFullscreen && (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/30 border-b border-amber-900/20">
        {mode === 'shared' ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-300/70 whitespace-nowrap">
            <Eye className="w-3 h-3 text-emerald-400" />Shared
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-purple-300/70 whitespace-nowrap">
            <EyeOff className="w-3 h-3 text-purple-400" />Private
          </span>
        )}
        <span className="text-[11px] text-white/20">•</span>
        <span className="text-[11px] text-white/40 whitespace-nowrap">{partyDm.messages.length} msgs</span>
        {partyDm.isSummarizing && (
          <>
            <span className="text-[11px] text-white/20">•</span>
            <span className="text-[11px] text-purple-400 animate-pulse whitespace-nowrap">Summarizing...</span>
          </>
        )}
        {isMomo && geraltHp && (
          <>
            <span className="text-[11px] text-white/20">•</span>
            <Bird className="w-3 h-3 text-pink-400 shrink-0" />
            <span className={cn(
              "text-[11px] font-mono whitespace-nowrap",
              geraltHpPct > 50 ? "text-emerald-400" : geraltHpPct > 25 ? "text-amber-400" : "text-red-400"
            )}>
              {geraltHp.current}/{geraltHp.max}
            </span>
          </>
        )}
        {broadcastPlaylist && (
          <>
            <span className="text-[11px] text-white/20">•</span>
            <Radio className="w-3 h-3 text-blue-400 shrink-0 animate-pulse" />
            <span className="text-[11px] text-blue-300/70 truncate max-w-[120px]" title={broadcastPlaylist}>
              {broadcastPlaylist}
            </span>
          </>
        )}
      </div>
      )}

      {/* New Campaign Name Input */}
      <AnimatePresence>
        {showNewCampaignInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 bg-black/50 border-b border-amber-900/30 overflow-hidden"
          >
            <p className="text-xs text-amber-300/70 mb-1.5 font-cinzel">New Campaign Name</p>
            <p className="text-[10px] text-white/30 mb-2">This will clear all current messages and prompts.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCampaignName}
                onChange={e => setNewCampaignName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCampaignName.trim()) {
                    partyDm.startNewCampaign(newCampaignName.trim());
                    setShowNewCampaignInput(false);
                    setNewCampaignName('');
                  }
                }}
                placeholder="Enter campaign name..."
                className="flex-1 bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
                maxLength={80}
                autoFocus
              />
              <button
                onClick={() => {
                  if (newCampaignName.trim()) {
                    partyDm.startNewCampaign(newCampaignName.trim());
                    setShowNewCampaignInput(false);
                    setNewCampaignName('');
                  }
                }}
                disabled={!newCampaignName.trim()}
                className="px-3 py-2 rounded-lg bg-amber-900/40 border border-amber-500/30 text-amber-300 text-sm hover:bg-amber-900/60 transition-colors disabled:opacity-50"
                style={{ touchAction: 'manipulation' }}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowNewCampaignInput(false); setNewCampaignName(''); }}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm hover:bg-white/10 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split Banner */}
      {partyDm.isSplitActive && partyDm.splitState && (
        <SplitBanner
          splitState={partyDm.splitState}
          myTeam={partyDm.myTeam}
          isCreator={isCreator}
          members={members}
          onShowPreSplitChat={() => setShowPreSplitChat(true)}
        />
      )}

      {/* Messages OR Inline Battle Map */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
      {showBattleMap && battleMapContent ? (
        battleMapContent
      ) : (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-[2px] py-3 sm:p-4 space-y-3 sm:space-y-4 overscroll-contain pb-[100px]">
          {partyDm.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Users className="w-12 h-12 text-primary/40 mb-4" />
              <h2 className="text-lg font-cinzel text-amber-200 mb-2">Party DM Session</h2>
              <p className="text-sm text-white/40 max-w-[280px]">
                Each player submits their action, then clicks Ready. When everyone is ready, the DM responds to all actions at once.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {partyDm.messages.map(msg => (
                <PartyDMMessage
                  key={msg.id}
                  message={msg}
                  currentUserId={currentUserId}
                  members={members.map(m => ({ user_id: m.user_id, character_name: m.character_name }))}
                  mode={partyDm.isSplitActive ? 'private' : 'shared'}
                  isCreator={isCreator}
                  onCopy={(content) => { navigator.clipboard.writeText(content); }}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onRegenerate={handleRegenerateMessage}
                  onRegenerateWhispers={handleRegenerateWhispers}
                  showTeamTag={isCreator && partyDm.isSplitActive}
                  allMessages={partyDm.messages}
                  ttsSelectMode={ttsSelectMode}
                  ttsSelected={ttsSelectedIds.has(msg.id)}
                  onTtsToggle={(id) => setTtsSelectedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  })}
                  whisperTrayEnabled={whisperTrayEnabled}
                />
              ))}
            </AnimatePresence>
          )}

              {dmPolls.polls.filter(p => !p.closed).map(poll => {
                const totalVotes = poll.options.reduce((sum, o) => sum + o.voters.length, 0);
                const myVote = poll.options.find(o => o.voters.some(v => v.userId === currentUserId));
                const hasVoted = !!myVote;
                const isPollCreator = poll.creatorUserId === currentUserId;
                const charName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
                return (
                  <div key={poll.pollId} className="mx-1 rounded-xl border border-amber-500/20 bg-amber-950/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] text-amber-300/70 font-cinzel uppercase tracking-wider">Poll</span>
                      <span className="text-[10px] text-white/30 ml-auto">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-sm text-white/90 font-medium">{poll.question}</p>
                    <p className="text-[10px] text-white/40">by {poll.creatorName}</p>
                    <div className="space-y-1">
                      {poll.options.map(opt => {
                        const isMyVote = myVote?.label === opt.label;
                        const pct = totalVotes > 0 ? Math.round((opt.voters.length / totalVotes) * 100) : 0;
                        return (
                          <button
                            key={opt.label}
                            onClick={() => !hasVoted && dmPolls.castVote(poll.pollId, opt.label, charName)}
                            disabled={hasVoted}
                            className={cn(
                              "w-full relative px-3 py-2 rounded-lg border text-xs text-left transition-all overflow-hidden",
                              isMyVote ? "border-amber-500/40 bg-amber-900/20" : "border-white/10 bg-white/5",
                              !hasVoted && "hover:bg-white/10 cursor-pointer"
                            )}
                          >
                            {hasVoted && (
                              <div className="absolute inset-y-0 left-0 bg-amber-500/10 transition-all" style={{ width: `${pct}%` }} />
                            )}
                            <div className="relative flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                {isMyVote && <Check className="w-3 h-3 text-amber-400" />}
                                {opt.label}
                              </span>
                              {hasVoted && <span className="text-[10px] text-white/40">{opt.voters.length} ({pct}%)</span>}
                            </div>
                            {hasVoted && opt.voters.length > 0 && (
                              <p className="text-[9px] text-white/30 mt-0.5 relative">{opt.voters.map(v => v.name).join(', ')}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {isPollCreator && (
                      <button onClick={() => dmPolls.closePoll(poll.pollId)} className="w-full text-[10px] text-white/30 hover:text-white/50 py-1 transition-colors">
                        Close Poll
                      </button>
                    )}
                  </div>
                );
              })}

              {dmPolls.polls.filter(p => p.closed).slice(-3).map(poll => {
                const totalVotes = poll.options.reduce((sum, o) => sum + o.voters.length, 0);
                const winner = [...poll.options].sort((a, b) => b.voters.length - a.voters.length)[0];
                return (
                  <div key={poll.pollId} className="mx-1 rounded-lg border border-white/5 bg-white/5 px-3 py-2 flex items-center gap-2">
                    <BarChart3 className="w-3 h-3 text-white/20" />
                    <span className="text-[10px] text-white/30 truncate flex-1">{poll.question}</span>
                    <span className="text-[10px] text-amber-300/50 shrink-0">{winner?.label} ({totalVotes})</span>
                  </div>
                );
              })}

          {/* Loading / status indicator */}
          {partyDm.isGenerating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-1">
              {isCreator && partyDm.synthesisMode && (
                <span className="text-[11px] text-amber-400/70 animate-fade-in pl-9">
                  ✨ Weaving prompts... ({partyDm.synthesisMode})
                </span>
              )}
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
                  <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
                <span className="text-sm text-amber-400/60 italic">
                  {(partyDm.sessionConfig?.dmMode === 'ai-approval' && !isCreator)
                    ? 'The DM is reviewing the AI draft...'
                    : 'The DM weaves the tale...'}
                </span>
                {isCreator && (
                  <button
                    onClick={partyDm.stopGeneration}
                    className="ml-auto p-1.5 rounded-lg border border-red-500/30 bg-red-900/20 hover:bg-red-900/40 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                    title="Stop generation"
                  >
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
          {/* Pending synthesis indicator for non-hosts */}
          {!isCreator && !partyDm.isGenerating && partyDm.pendingSynthesis && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/40 border border-amber-500/30">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-sm text-amber-400/60 italic">Host is reviewing synthesized prompts...</span>
            </motion.div>
          )}
          {/* Pending draft indicator for non-hosts in approval mode */}
          {!isCreator && !partyDm.isGenerating && !partyDm.pendingSynthesis && partyDm.pendingDraft && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-900/40 border border-blue-500/30">
                <Pencil className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-sm text-blue-400/60 italic">DM is crafting a response...</span>
            </motion.div>
          )}
          {/* Human DM mode: waiting indicator for non-hosts when all ready */}
          {!isCreator && !partyDm.isGenerating && !partyDm.pendingDraft && partyDm.allReady && (partyDm.sessionConfig?.dmMode === 'human') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/40 border border-amber-500/30">
                <Pencil className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-sm text-amber-400/60 italic">Waiting for the DM to respond...</span>
            </motion.div>
          )}
          {/* TTS Select Floating Bar */}
          <AnimatePresence>
            {ttsSelectMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="sticky bottom-0 z-10 flex items-center justify-center gap-3 px-4 py-2.5 bg-black/80 backdrop-blur-md border-t border-amber-500/30"
              >
                <button
                  onClick={() => { setTtsSelectMode(false); setTtsSelectedIds(new Set()); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:bg-white/10 transition-colors border border-white/10"
                  style={{ touchAction: 'manipulation' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const selected = partyDm.messages.filter(m => ttsSelectedIds.has(m.id)).map(m => m.content);
                    if (selected.length > 0) {
                      narrator.playMessage(selected.join('\n\n'));
                    }
                    setTtsSelectMode(false);
                    setTtsSelectedIds(new Set());
                  }}
                  disabled={ttsSelectedIds.size === 0}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5",
                    ttsSelectedIds.size > 0
                      ? "bg-amber-600 hover:bg-amber-500 text-black"
                      : "bg-white/10 text-white/30"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Volume2 className="w-4 h-4" />
                  Narrate {ttsSelectedIds.size > 0 ? `(${ttsSelectedIds.size})` : ''}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
        {/* Chat FAB - bottom-left of chat area */}
        {onShowChat && (
          <button
            onClick={() => {
              // Mark messages as seen
              if (partyId) {
                try { localStorage.setItem(`odyssey_chat_lastSeen_${partyId}`, String(chatTotalCount)); } catch {}
              }
              onShowChat();
            }}
            className={`absolute bottom-2 left-2 z-[5] w-[4.5rem] h-[4.5rem] rounded-full overflow-hidden border-2 transition-all shadow-lg ${chatUnreadCount > 0 ? 'border-emerald-400 animate-pulse shadow-emerald-400/40 shadow-xl' : 'border-white/20 hover:border-white/50'}`}
            style={{ touchAction: 'manipulation' }}
            title="Party Chat"
          >
            <img src={partyChatIcon} alt="Party Chat" className="w-full h-full object-contain rounded-xl" />
            {chatUnreadCount > 0 && (
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-[24px] h-[24px] rounded-full bg-emerald-500 text-[11px] font-bold text-white flex items-center justify-center px-1 ring-2 ring-emerald-300 animate-badge-pulse shadow-lg">
                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
              </span>
            )}
          </button>
        )}
        {/* Fullscreen toggle - bottom-right of chat area */}
        <button
          onClick={() => {
            if (!isFullscreen) setNavExpanded(false);
            setIsFullscreen(f => !f);
          }}
          className="absolute bottom-2 right-2 z-[5] w-9 h-9 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60 transition-all"
          style={{ touchAction: 'manipulation' }}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-white/70" />
          ) : (
            <Maximize2 className="w-4 h-4 text-white/40" />
          )}
        </button>
      </div>

      {/* Prompt Queue Status */}
      {partyDm.isActive && (
        <div className="border-t border-amber-900/20 bg-black/30 overflow-hidden">
          {/* Round Timer */}
          <RoundTimer
            sessionConfig={partyDm.sessionConfig}
            isCreator={isCreator}
            currentUserId={currentUserId}
            onStartTimer={partyDm.startTimer}
            onPauseTimer={partyDm.pauseTimer}
            onResumeTimer={partyDm.resumeTimer}
            onCancelTimer={partyDm.cancelTimer}
            onRequestExtension={partyDm.requestExtension}
            onApproveExtension={partyDm.approveExtension}
            onDismissExtensions={partyDm.dismissExtensions}
            onTimerExpire={handleTimerExpire}
          />
          {/* Collapsed status strip with mini dots + chevron toggle */}
          <button
            onClick={() => setQueueDrawerOpen(prev => !prev)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 transition-colors"
            style={{ touchAction: 'manipulation' }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              (e.currentTarget as any)._swipeStartY = touch.clientY;
            }}
            onTouchEnd={(e) => {
              const startY = (e.currentTarget as any)._swipeStartY;
              if (startY == null) return;
              const diffY = e.changedTouches[0].clientY - startY;
              if (diffY < -30 && !queueDrawerOpen) {
                e.preventDefault();
                setQueueDrawerOpen(true);
              }
              (e.currentTarget as any)._swipeStartY = null;
            }}
          >
            <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Round Queue</span>
            <span className="text-[10px] text-white/30">
              {partyDm.currentPrompts.filter(p => p.is_ready && visibleMembers.some(m => m.user_id === p.user_id)).length}/{visibleMembers.length} ready
            </span>
            {/* Mini status dots when collapsed */}
            {!queueDrawerOpen && (
              <div className="flex items-center gap-1 ml-auto mr-1">
                {visibleMembers.map(m => {
                  const prompt = partyDm.currentPrompts.find(p => p.user_id === m.user_id);
                  return (
                    <span
                      key={m.user_id}
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0 transition-colors",
                        !prompt && "bg-white/20",
                        prompt && !prompt.is_ready && "bg-amber-400",
                        prompt?.is_ready && "bg-emerald-400",
                      )}
                    />
                  );
                })}
              </div>
            )}
            <ChevronDown className={cn(
              "w-3.5 h-3.5 text-white/30 shrink-0 transition-transform duration-200",
              queueDrawerOpen && "rotate-180",
              !queueDrawerOpen && "ml-auto",
            )} />
          </button>

          {/* Expandable pill drawer */}
          <AnimatePresence>
            {queueDrawerOpen && (
              <motion.div
                key="queue-drawer"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden touch-pan-x"
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.3}
                dragSnapToOrigin
                onDragEnd={(_e, info) => {
                  if (info.offset.y > 40) {
                    setQueueDrawerOpen(false);
                    setExpandedPillUserId(null);
                  }
                }}
                style={{ touchAction: 'pan-x' }}
              >
                <div className="flex flex-col gap-1.5 mx-1 pb-2">
                  {visibleMembers.map(m => {
                    const prompt = partyDm.currentPrompts.find(p => p.user_id === m.user_id);
                    const isSelf = m.user_id === currentUserId;
                    const hasAction = prompt && prompt.prompt.trim().length > 0;
                    const isExpanded = expandedPillUserId === m.user_id;
                    const memberTeam = partyDm.isSplitActive && partyDm.splitState
                      ? partyDm.splitState.alphaMembers.includes(m.user_id) ? 'alpha' : 'beta'
                      : null;
                    return (
                      <div key={m.user_id} className="flex flex-col">
                        <div
                          title={
                            prompt?.is_ready
                              ? `${m.character_name} — Ready${hasAction ? ' (with action)' : ' (no action)'}`
                              : prompt
                                ? `${m.character_name} — Action submitted, not ready`
                                : `${m.character_name} — Waiting...`
                          }
                          onClick={() => {
                            if (!hasAction) return;
                            // In private mode, only self can expand; in shared mode, anyone can
                            if (!isSelf && mode !== 'shared') return;
                            const toggled = isExpanded ? null : m.user_id;
                            setExpandedPillUserId(toggled);
                            if (toggled && isSelf && prompt) setPillEditText(prompt.prompt);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] border transition-all w-full",
                            !prompt && "bg-white/5 border-white/10 text-white/30",
                            prompt && !prompt.is_ready && "bg-amber-900/20 border-amber-500/30 text-amber-300",
                            prompt?.is_ready && "bg-emerald-900/20 border-emerald-500/30 text-emerald-300 animate-pulse",
                            (isSelf || mode === 'shared') && hasAction && "cursor-pointer hover:brightness-125",
                            isExpanded && "ring-1 ring-white/30",
                          )}
                        >
                          {memberTeam && (
                            <span className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              memberTeam === 'alpha' ? "bg-blue-400" : "bg-purple-400"
                            )} />
                          )}
                          <span className="truncate flex-1">{m.character_name}</span>
                          {coHostIds?.includes(m.user_id) && (
                            <span className="text-[8px] text-amber-400/70 font-bold uppercase tracking-wider shrink-0">Co-DM</span>
                          )}
                          {(m as any).character_status?.afkPersonalityGuide && (
                            <span title="AFK guide configured" className="flex items-center gap-0.5">
                              <Ghost className="w-2.5 h-2.5 text-purple-400/60 shrink-0" />
                              {((m as any).character_status?.afkPromptCascade as string[] | undefined)?.length ? (
                                <span className="text-[8px] font-bold text-purple-400/80 min-w-[10px] text-center">
                                  {((m as any).character_status.afkPromptCascade as string[]).length}
                                </span>
                              ) : null}
                            </span>
                          )}
                          {prompt?.is_ready ? (
                            <CheckCheck className="w-3 h-3 text-emerald-400" />
                          ) : prompt ? (
                            <Check className="w-3 h-3 text-amber-400" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                          )}
                          {mode === 'shared' && hasAction && !isExpanded && (
                            <>
                              <span className="text-[9px] text-white/30 max-w-[60px] truncate">{prompt!.prompt}</span>
                              <Eye className="w-2.5 h-2.5 text-white/20 shrink-0" />
                            </>
                          )}
                          {mode === 'shared' && hasAction && isExpanded && (
                            <Eye className="w-2.5 h-2.5 text-white/50 shrink-0" />
                          )}
                          {mode !== 'shared' && !isSelf && hasAction && (
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Lock className="w-2.5 h-2.5 text-white/20 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Prompt hidden — host has private mode enabled</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {/* Inline expanded prompt content */}
                        <AnimatePresence>
                          {isExpanded && hasAction && prompt && (() => {
                            const canEdit = isSelf && !prompt.is_ready && !partyDm.isGenerating;
                            return (
                              <motion.div
                                key={`expanded-${m.user_id}`}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-1 rounded-lg bg-white/5 border border-white/10 p-2.5">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-semibold text-white/60">{m.character_name}'s Prompt</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setExpandedPillUserId(null); }}
                                      className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                  {canEdit ? (
                                    <div className="space-y-1.5">
                                      <textarea
                                        value={pillEditText}
                                        onChange={(e) => setPillEditText(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[60px] max-h-[120px]"
                                        rows={3}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex justify-end">
                                        <Button
                                          size="sm"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (pillEditText.trim()) {
                                              await partyDm.editPrompt(pillEditText.trim());
                                              toast.success('Prompt updated');
                                              setExpandedPillUserId(null);
                                            }
                                          }}
                                          className="h-6 px-2.5 text-[10px] gap-1 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
                                        >
                                          <Check className="w-2.5 h-2.5" />
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-white/70 whitespace-pre-wrap break-words">{prompt.prompt}</p>
                                   )}
                                  {/* Promote/demote co-host — original creator only, non-self */}
                                  {originalCreator && m.user_id !== currentUserId && (
                                    <div className="mt-2 pt-2 border-t border-white/10">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (coHostIds?.includes(m.user_id)) {
                                            onDemoteCoHost?.(m.user_id);
                                            toast.success(`${m.character_name} removed as co-host`);
                                          } else {
                                            onPromoteCoHost?.(m.user_id);
                                            toast.success(`${m.character_name} promoted to co-host!`);
                                          }
                                        }}
                                        className={cn(
                                          "px-2 py-1 text-[10px] rounded border transition-colors",
                                          coHostIds?.includes(m.user_id)
                                            ? "border-red-500/30 bg-red-900/20 text-red-300 hover:bg-red-900/40"
                                            : "border-amber-500/30 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40"
                                        )}
                                      >
                                        {coHostIds?.includes(m.user_id) ? 'Remove Co-Host' : 'Make Co-Host'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })()}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {/* Timer Settings (host only, inside queue drawer) */}
                  {isCreator && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => setShowTimerSettings(prev => !prev)}
                        className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors w-full"
                      >
                        <Timer className="w-3 h-3" />
                        Timer Settings
                        <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", showTimerSettings && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {showTimerSettings && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2">
                              <TimerSettings
                                enabled={localTimerEnabled}
                                durationSeconds={localTimerDuration}
                                onEnabledChange={(e) => {
                                  setLocalTimerEnabled(e);
                                  partyDm.setTimerConfig(e, localTimerDuration);
                                }}
                                onDurationChange={(s) => {
                                  setLocalTimerDuration(s);
                                  partyDm.setTimerConfig(localTimerEnabled, s);
                                }}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {showPollCreator && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowPollCreator(false)}>
          <div className="w-full max-w-sm bg-gradient-to-b from-[#1a0e05] to-[#0d0d12] border border-amber-900/30 rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-cinzel text-amber-200">Create Poll</h3>
            </div>
            <input
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value.slice(0, 120))}
              placeholder="Ask the party something..."
              className="w-full bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 mb-3"
              autoFocus
            />
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input
                  value={opt}
                  onChange={e => { const next = [...pollOptions]; next[i] = e.target.value.slice(0, 60); setPollOptions(next); }}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
                />
                {pollOptions.length > 2 && (
                  <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="p-1.5 rounded hover:bg-red-900/20 text-white/30 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-3">
              {pollOptions.length < 5 && (
                <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-xs text-amber-300/60 hover:text-amber-300 transition-colors">+ Add Option</button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => { setShowPollCreator(false); setPollQuestion(''); setPollOptions(['', '']); }} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 rounded-lg hover:bg-white/5">Cancel</button>
                <button
                  onClick={async () => {
                    const valid = pollOptions.map(o => o.trim()).filter(Boolean);
                    if (!pollQuestion.trim() || valid.length < 2) return;
                    const name = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
                    await dmPolls.createPoll(pollQuestion.trim(), valid, name);
                    setShowPollCreator(false);
                    setPollQuestion('');
                    setPollOptions(['', '']);
                  }}
                  disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                  className="px-3 py-1.5 text-xs rounded-lg bg-amber-900/40 border border-amber-500/30 text-amber-300 hover:bg-amber-900/60 transition-colors disabled:opacity-40"
                >
                  Post Poll
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 50 * 1024 * 1024) { toast.error('Video too large (max 50MB)'); return; }
          setIsUploadingVideo(true);
          try {
            const ext = file.name.split('.').pop() || 'mp4';
            const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('videos').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);
            const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
            await partyDm.addMediaMessage(`[video:${urlData.publicUrl}]`, senderName);
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
          finally { setIsUploadingVideo(false); if (videoInputRef.current) videoInputRef.current.value = ''; }
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10MB)'); return; }
          setIsUploadingPhoto(true);
          try {
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('party-chat-images').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('party-chat-images').getPublicUrl(path);
            const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
            await partyDm.addMediaMessage(`[image:${urlData.publicUrl}]`, senderName);
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
          finally { setIsUploadingPhoto(false); if (photoInputRef.current) photoInputRef.current.value = ''; }
        }}
      />
      <input
        ref={photoCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10MB)'); return; }
          setIsUploadingPhoto(true);
          try {
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('party-chat-images').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('party-chat-images').getPublicUrl(path);
            const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
            await partyDm.addMediaMessage(`[image:${urlData.publicUrl}]`, senderName);
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
          finally { setIsUploadingPhoto(false); if (photoCameraRef.current) photoCameraRef.current.value = ''; }
        }}
      />
      <input
        ref={videoCameraRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 50 * 1024 * 1024) { toast.error('Video too large (max 50MB)'); return; }
          setIsUploadingVideo(true);
          try {
            const ext = file.name.split('.').pop() || 'mp4';
            const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('videos').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);
            const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
            await partyDm.addMediaMessage(`[video:${urlData.publicUrl}]`, senderName);
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
          finally { setIsUploadingVideo(false); if (videoCameraRef.current) videoCameraRef.current.value = ''; }
        }}
      />

      {/* Input Area */}
      {!isFullscreen && (
      <div className="px-2 py-2 sm:px-3 sm:py-3 border-t border-amber-900/30 bg-black/40 backdrop-blur-sm mb-[48px]">
        {/* Synthesis approval: show to host when synthesis is pending */}
        {isCreator && partyDm.pendingSynthesis ? (
          <SynthesisReviewPanel
            synthesis={partyDm.pendingSynthesis.synthesis}
            rawPrompts={partyDm.pendingSynthesis.rawPrompts}
            onApprove={partyDm.approveSynthesis}
            onDiscard={partyDm.discardSynthesis}
            onRegenerate={partyDm.regenerateSynthesis}
            isRegenerating={partyDm.isGenerating}
          />
        ) : isCreator && partyDm.pendingDraft ? (
          <DraftReviewPanel
            draftContent={partyDm.pendingDraft.content}
            onApprove={partyDm.approveDraft}
            onDiscard={partyDm.discardDraft}
            onRegenerate={partyDm.generateResponse}
            partyMemberNames={members.map(m => m.character_name)}
            isRegenerating={partyDm.isGenerating}
          />
        ) : isCreator && (partyDm.sessionConfig?.dmMode === 'human') ? (
          <DMComposePanel
            onSend={partyDm.sendManualDmMessage}
            partyMemberNames={members.map(m => m.character_name)}
            disabled={partyDm.isGenerating}
          />
        ) : partyDm.isGenerating ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-sm text-amber-400/70">Generating response...</span>
            {isCreator && (
              <button
                onClick={partyDm.stopGeneration}
                className="ml-2 px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-900/20 hover:bg-red-900/40 text-red-300 text-xs transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                Stop
              </button>
            )}
          </div>
        ) : !hasSubmitted ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="What does your character do?"
                rows={1}
                className="flex-1 bg-white/5 border border-amber-900/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[42px] max-h-[200px]"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || !!partyDm.myPrompt}
                className={cn(
                  "p-2.5 rounded-xl border shrink-0 transition-colors",
                  input.trim() ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60" : "bg-white/5 border-white/10 opacity-40"
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <Send className="w-5 h-5 text-amber-400" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={partyDm.setReady}
                className="flex-1 gap-1.5 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300"
                size="sm"
              >
                <Check className="w-4 h-4" />
                Ready (No Action)
              </Button>
              {currentUserId && (
                <div className="flex gap-1 shrink-0">
                  <div className="relative" data-attach-menu>
                    <button
                      onClick={() => setShowAttachMenu(prev => !prev)}
                      disabled={isUploadingPhoto || isUploadingVideo}
                      className="p-2 rounded-xl border border-white/10 hover:border-amber-500/30 bg-white/5 hover:bg-amber-900/20 transition-colors"
                      style={{ touchAction: 'manipulation' }}
                      title="Attach media"
                    >
                      {(isUploadingPhoto || isUploadingVideo) ? (
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                      ) : (
                        <Paperclip className="w-4 h-4 text-white/50" />
                      )}
                    </button>
                    {showAttachMenu && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-black/95 border border-amber-900/30 rounded-xl p-1.5 z-20 shadow-xl space-y-0.5">
                        <button
                          onClick={() => { photoCameraRef.current?.click(); setShowAttachMenu(false); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Camera className="w-4 h-4" />
                          Take Photo
                        </button>
                        <button
                          onClick={() => { videoCameraRef.current?.click(); setShowAttachMenu(false); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Film className="w-4 h-4" />
                          Record Video
                        </button>
                        <div className="border-t border-white/5 my-0.5" />
                        <button
                          onClick={() => { photoInputRef.current?.click(); setShowAttachMenu(false); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <ImageIcon className="w-4 h-4" />
                          Photo from Gallery
                        </button>
                        <button
                          onClick={() => { videoInputRef.current?.click(); setShowAttachMenu(false); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Film className="w-4 h-4" />
                          Video from Gallery
                        </button>
                        <div className="border-t border-white/5 my-0.5" />
                        <button
                          onClick={() => { setShowPollCreator(true); setShowAttachMenu(false); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <BarChart3 className="w-4 h-4" />
                          Create Poll
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Narrator speaker button */}
                   {narrator.hasTTSKey && (
                    <button
                      onClick={() => {
                        if (narrator.isPlaying) {
                          narrator.stop();
                        } else if (!narrator.isLoading) {
                          setTtsSelectMode(prev => !prev);
                          if (ttsSelectMode) setTtsSelectedIds(new Set());
                        }
                      }}
                      disabled={narrator.isLoading}
                      className={cn(
                        "p-2 rounded-xl border shrink-0 transition-colors",
                        narrator.isPlaying || ttsSelectMode
                          ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60"
                          : "bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-900/20"
                      )}
                      style={{ touchAction: 'manipulation' }}
                      title={narrator.isPlaying ? "Stop narration" : ttsSelectMode ? "Cancel selection" : "Select messages to narrate"}
                    >
                      {narrator.isLoading ? (
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                      ) : narrator.isPlaying ? (
                        <VolumeX className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-white/50" />
                      )}
                    </button>
                  )}
                   {narrator.hasTTSKey && (
                    <NarrationSpeedPopover iconSize="w-4 h-4" />
                  )}
                </div>
              )}
            </div>
          </div>
        ) : !isReady ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-amber-900/30 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] text-white/40 mb-0.5">Your action:</p>
                  <p className="text-sm text-white/70 truncate">{partyDm.myPrompt?.prompt || '(no action)'}</p>
                </div>
                <button
                  onClick={() => {
                    const promptText = partyDm.myPrompt?.prompt || '';
                    if (promptText) {
                      setInput(promptText);
                    }
                    partyDm.retractPrompt();
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-amber-900/20 transition-colors text-amber-300/70 hover:text-amber-300 text-xs border border-amber-500/20"
                  style={{ touchAction: 'manipulation' }}
                >
                  Retract
                </button>
              </div>
              <Button
                onClick={partyDm.setReady}
                className="w-full gap-1.5 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300"
                size="sm"
              >
                <Check className="w-4 h-4" />
                Ready
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300/70">
                {(partyDm.sessionConfig?.dmMode === 'human')
                  ? 'Ready! Waiting for the DM...'
                  : (partyDm.sessionConfig?.dmMode === 'ai-approval')
                    ? 'Ready! AI will draft a response for DM review...'
                    : 'Ready! Waiting for others...'}
              </span>
              <button
                onClick={() => {
                  const promptText = partyDm.myPrompt?.prompt || '';
                  if (promptText) {
                    setInput(promptText);
                  }
                  partyDm.retractPrompt();
                }}
                disabled={partyDm.isGenerating}
                className="ml-2 px-2 py-0.5 text-[11px] rounded border border-amber-500/30 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 transition-colors disabled:opacity-40"
              >
                Retract
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Narrator speaker button */}
               {narrator.hasTTSKey && (
                <button
                  onClick={() => {
                    if (narrator.isPlaying) {
                      narrator.stop();
                    } else if (!narrator.isLoading) {
                      setTtsSelectMode(prev => !prev);
                      if (ttsSelectMode) setTtsSelectedIds(new Set());
                    }
                  }}
                  disabled={narrator.isLoading}
                  className={cn(
                    "p-2 rounded-xl border shrink-0 transition-colors",
                    narrator.isPlaying || ttsSelectMode
                      ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60"
                      : "bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-900/20"
                  )}
                  style={{ touchAction: 'manipulation' }}
                  title={narrator.isPlaying ? "Stop narration" : ttsSelectMode ? "Cancel selection" : "Select messages to narrate"}
                >
                  {narrator.isLoading ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : narrator.isPlaying ? (
                    <VolumeX className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white/50" />
                  )}
                </button>
              )}
              {narrator.hasTTSKey && (
                <NarrationSpeedPopover iconSize="w-4 h-4" />
              )}
              {isCreator && (partyDm.sessionConfig?.dmMode || 'ai') !== 'human' && (
                <Button
                  onClick={partyDm.generateResponse}
                  disabled={partyDm.isGenerating || partyDm.currentPrompts.length === 0}
                  className="gap-1.5 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
                  size="sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {(partyDm.sessionConfig?.dmMode === 'ai-approval') ? 'Generate Draft' : 'Generate Now'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Host generate button (always visible for host when prompts exist) — hidden in human mode */}
        {isCreator && !partyDm.isGenerating && hasSubmitted && !isReady && partyDm.currentPrompts.length > 0 && (partyDm.sessionConfig?.dmMode || 'ai') !== 'human' && (
          <div className="mt-2 flex justify-end max-w-2xl mx-auto">
            <Button
              onClick={partyDm.generateResponse}
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-300 border-amber-500/30"
            >
              <Zap className="w-3.5 h-3.5" />
              {(partyDm.sessionConfig?.dmMode === 'ai-approval') ? 'Generate Draft' : 'Generate Now'}
            </Button>
          </div>
        )}
      </div>
      )}

      {/* Bottom Navigation Drawer */}
      {!isFullscreen && (
        <DMBottomNav
          activeTab={activeNavTab}
          onTabChange={handleNavTabChange}
          isExpanded={navExpanded}
          onExpandedChange={setNavExpanded}
          disabled={partyDm.isGenerating}
          showGeralt={isMomo}
          diceContent={showDiceContent ? (
            <DMDiceRoller
              characterContext={characterContext!}
              onRollResult={handleDiceRoll}
              disabled={partyDm.isGenerating}
            />
          ) : undefined}
          settingsContent={activeNavTab === 'settings' ? (
            <PartyDMSettings
              mode={mode}
              onToggleMode={() => {
                const newMode = mode === 'shared' ? 'private' : 'shared';
                if (partyDm.sessionConfig) {
                  const updated = { ...partyDm.sessionConfig, mode: newMode as 'shared' | 'private' };
                  (supabase.from('party_shared_state') as any)
                    .update({ state_data: updated })
                    .eq('party_id', partyId)
                    .eq('state_type', 'dm_session')
                    .then(() => {});
                }
              }}
              isCreator={isCreator}
              isOriginalCreator={originalCreator}
              partyId={partyId}
              autoSyncEnabled={autoSyncEnabled}
              onToggleAutoSync={onToggleAutoSync}
              selectedModel={selectedDmModel}
              onModelChange={(id) => { setSelectedDmModel(id); saveSelectedModel(id); }}
              isExtracting={isExtracting}
              pushState={pushState}
              onTogglePush={handleTogglePush}
              onShowMap={onShowMap}
              onShowSaves={onShowSaves}
              onShowGuides={onShowGuides}
              onShowChat={onShowChat}
              onShowAfkGuide={() => setShowAfkGuide(true)}
              guidesCount={guidesCount}
              myAfkGuide={myAfkGuide}
              myAfkCascadeCount={myAfkCascade?.length ?? 0}
              isSplitActive={partyDm.isSplitActive}
              memberCount={memberCount}
              onShowSplitInitiator={() => setShowSplitInitiator(true)}
              onShowRegroupDialog={() => setShowRegroupDialog(true)}
              onShowSplitSummaries={() => setShowSplitSummaries(true)}
              onShowPreSplitChat={() => setShowPreSplitChat(true)}
              onNewCampaign={() => {
                setShowNewCampaignInput(true);
                setNewCampaignName('');
              }}
              onEndSession={partyDm.endSession}
              timerEnabled={localTimerEnabled}
              timerDurationSeconds={localTimerDuration}
              onTimerEnabledChange={(enabled) => {
                setLocalTimerEnabled(enabled);
                if (partyDm.sessionConfig) {
                  const updated = { ...partyDm.sessionConfig, timerEnabled: enabled };
                  (supabase.from('party_shared_state') as any)
                    .update({ state_data: updated })
                    .eq('party_id', partyId)
                    .eq('state_type', 'dm_session')
                    .then(() => {});
                }
              }}
              onTimerDurationChange={(seconds) => {
                setLocalTimerDuration(seconds);
                if (partyDm.sessionConfig) {
                  const updated = { ...partyDm.sessionConfig, timerDurationSeconds: seconds };
                  (supabase.from('party_shared_state') as any)
                    .update({ state_data: updated })
                    .eq('party_id', partyId)
                    .eq('state_type', 'dm_session')
                    .then(() => {});
                }
              }}
              onShowScheduledEvents={() => setShowScheduledEvents(true)}
              dmMode={partyDm.sessionConfig?.dmMode || 'ai'}
              onDmModeChange={(newMode) => {
                partyDm.updateSessionConfig({ dmMode: newMode });
              }}
              members={members}
              coHostIds={coHostIds}
              currentUserId={currentUserId}
              onPromoteCoHost={onPromoteCoHost}
              onDemoteCoHost={onDemoteCoHost}
              whisperTrayEnabled={whisperTrayEnabled}
              onWhisperTrayEnabledChange={setWhisperTrayEnabled}
            />
          ) : undefined}
          oracleContent={activeNavTab === 'oracle' && characterContext ? (
            <OraclePanel characterContext={{
              ...characterContext,
              campaignSummary: partyDm.sessionConfig?.campaignSummary || undefined,
              recentNarrative: partyDm.messages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .slice(-10)
                .map(m => ({
                  role: m.role,
                  name: m.sender_name,
                  content: m.content,
                })),
              partyMembers: members
                .filter(m => m.user_id !== currentUserId && m.character_name)
                .map(m => ({
                  name: m.character_name,
                  level: (m.character_status as any)?.level,
                  className: (m.character_status as any)?.className,
                  currentHP: (m.character_status as any)?.currentHP,
                  maxHP: (m.character_status as any)?.maxHP,
                  ac: (m.character_status as any)?.ac,
                  conditions: (m.character_status as any)?.conditions,
                })),
            }} />
          ) : undefined}
        />
      )}



      {/* Geralt Gameplay Widget (momo only) */}
      {isMomo && (
        <GeraltGameplayWidget
          open={showGeraltWidget}
          onClose={() => setShowGeraltWidget(false)}
          characterId={geraltCharacterId}
          onHpChange={handleGeraltHpChange}
          onUsePrompt={handleUsePrompt}
        />
      )}

      {/* Quick Actions Drawer */}
      <PartyDMQuickActions
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        characterContext={characterContext}
        characterName={characterContext?.name || 'The Adventurer'}
        onUsePrompt={handleUsePrompt}
      />
      {/* Infinity Stone DM Drawer */}
      <InfinityStoneDMDrawer
        open={showStoneDrawer}
        onOpenChange={setShowStoneDrawer}
        characterName={characterContext?.name || 'The Adventurer'}
        onUsePrompt={handleUsePrompt}
      />

      {/* Split Party Overlays */}
      <SplitInitiator
        open={showSplitInitiator}
        onClose={() => setShowSplitInitiator(false)}
        members={members}
        currentUserId={currentUserId}
        onInitiate={(alphaMembers, alphaName, betaName) => partyDm.initiateSplit(alphaMembers, alphaName, betaName)}
      />
      <RegroupDialog
        open={showRegroupDialog}
        onClose={() => setShowRegroupDialog(false)}
        onRegroup={(prompt) => partyDm.regroupParty(prompt)}
        isGenerating={partyDm.isGenerating}
      />
      {partyDm.splitState && (
        <SplitSummariesViewer
          open={showSplitSummaries}
          onClose={() => setShowSplitSummaries(false)}
          splitState={partyDm.splitState}
        />
      )}
      {partyDm.splitState && (
        <PreSplitChatViewer
          open={showPreSplitChat}
          onClose={() => setShowPreSplitChat(false)}
          splitState={partyDm.splitState}
        />
      )}

      {/* AFK Personality Guide Dialog */}
      {partyDm.sessionConfig && currentUserId && (
        <AfkPersonalityGuide
          open={showAfkGuide}
          onOpenChange={setShowAfkGuide}
          partyId={partyId || ''}
          userId={currentUserId}
          characterName={members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown'}
          currentGuide={myAfkGuide}
          currentCascade={myAfkCascade}
          onSaved={(guide, cascade) => {
            setMyAfkGuide(guide);
            setMyAfkCascade(cascade);
          }}
        />
      )}

      {/* Scheduled Events Sheet (host only) */}
      {isCreator && partyId && (
        <ScheduledEventsSheet
          open={showScheduledEvents}
          onOpenChange={setShowScheduledEvents}
          partyId={partyId}
        />
      )}
    </div>
  );
}
