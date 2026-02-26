import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Crown, Send, Users, Check, CheckCheck, Zap, Eye, EyeOff, X, Shield, Loader2, Pencil, Trash2, Map, FolderOpen, BookOpen, Copy, RefreshCw, MoreVertical, Film, Image as ImageIcon, MessageSquare, Plus, Save, Volume2, VolumeX, GitBranch } from 'lucide-react';
import { SplitInitiator, SplitBanner, RegroupDialog, SplitSummariesViewer } from './PartySplitUI';
import { InfinityStoneDMDrawer } from './InfinityStoneDMDrawer';
import { DMBottomNav, DMNavTab } from './DMBottomNav';
import { CampaignDropdown } from './CampaignDropdown';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { useNarrator } from '@/hooks/use-narrator';
import { requestPartyNotificationPermission } from '@/lib/party-notifications';
import { usePushSubscription } from '@/hooks/use-push-subscription';
import { NarrationSpeedPopover } from './NarrationSpeedPopover';
import type { usePartyDm, PartyDmMessage, PartyDmPrompt } from '@/hooks/use-party-dm';
import { DMDiceRoller } from './DMDiceRoller';
import { PartyDMQuickActions } from './PartyDMQuickActions';
import type { CharacterContext } from '@/components/oracle/types';
import type { CampaignSession } from '@/hooks/use-campaign-sessions';

type PartyDmReturn = ReturnType<typeof usePartyDm>;

interface PartyDMScreenProps {
  onBack: () => void;
  partyDm: PartyDmReturn;
  isCreator: boolean;
  currentUserId?: string;
  memberCount: number;
  members: Array<{ user_id: string; character_name: string }>;
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

function PartyDMMessage({ message, currentUserId, members, mode, isCreator, onCopy, onEdit, onDelete, onRegenerate, showTeamTag }: {
  message: PartyDmMessage;
  currentUserId?: string;
  members: Array<{ user_id: string; character_name: string }>;
  mode: 'shared' | 'private';
  isCreator?: boolean;
  onCopy?: (content: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  showTeamTag?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [isEditingMsg, setIsEditingMsg] = useState(false);
  const [editContent, setEditContent] = useState('');
  const isAssistant = message.role === 'assistant';
  const isMine = message.sender_user_id === currentUserId;
  const videoMatch = message.content.match(PARTY_VIDEO_REGEX);
  const imageMatch = !videoMatch ? message.content.match(PARTY_IMAGE_REGEX) : null;

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
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5 justify-start group/msg relative min-w-0">
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
            <div className="text-sm prose prose-invert prose-sm max-w-none break-words overflow-wrap-anywhere">
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
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
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
        <p className="text-sm whitespace-pre-wrap text-white/90">
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
            message.content
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

export function PartyDMScreen({ onBack, partyDm, isCreator, currentUserId, memberCount, members, onShowGuides, onShowMap, onShowSaves, onShowChat, autoSyncEnabled, onToggleAutoSync, isExtracting, guidesCount = 0, characterContext, showBattleMap, battleMapContent, campaignSessions, campaignSessionsLoading, campaignSessionsSignedIn, onNewGame, onLoadCampaign, onRefreshCampaigns }: PartyDMScreenProps) {
  const [input, setInput] = useState('');
  const [, setTick] = useState(0);
  const narrator = useNarrator();
  const { subscribe: subscribePush } = usePushSubscription();

  useEffect(() => {
    if (!partyDm.lastAutoSaveTime) return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [partyDm.lastAutoSaveTime]);
  
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [expandedPillUserId, setExpandedPillUserId] = useState<string | null>(null);
  const [pillEditText, setPillEditText] = useState('');
  const [showNewCampaignInput, setShowNewCampaignInput] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Bottom nav state
  const [activeNavTab, setActiveNavTab] = useState<DMNavTab | null>(null);
  const [navExpanded, setNavExpanded] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [showStoneDrawer, setShowStoneDrawer] = useState(false);

  // Split party state
  const [showSplitInitiator, setShowSplitInitiator] = useState(false);
  const [showRegroupDialog, setShowRegroupDialog] = useState(false);
  const [showSplitSummaries, setShowSplitSummaries] = useState(false);

  const mode = partyDm.sessionConfig?.mode || 'shared';

  // Request browser notification permission and register push subscription
  useEffect(() => {
    requestPartyNotificationPermission().then((result) => {
      if (result === 'granted') {
        subscribePush();
      }
    });
  }, [subscribePush]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [partyDm.messages, partyDm.currentPrompts]);

  useEffect(() => {
    if (partyDm.isGenerating) setExpandedPillUserId(null);
  }, [partyDm.isGenerating]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    partyDm.submitPrompt(input.trim());
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, partyDm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

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

  const handleDiceRoll = useCallback((message: string) => {
    setInput(prev => prev ? `${prev}\n${message}` : message);
  }, []);

  const handleUsePrompt = useCallback((prompt: string) => {
    setInput(prev => prev ? `${prev}\n${prompt}` : prompt);
  }, []);

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
    // Dice tab toggles
    setActiveNavTab(prev => prev === tab ? null : tab);
  }, []);

  const hasSubmitted = !!partyDm.myPrompt;
  const isReady = partyDm.myPrompt?.is_ready ?? false;
  const showDiceContent = activeNavTab === 'dice' && characterContext && !partyDm.isGenerating;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      {/* Row 1: Main Header */}
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
            <ArrowLeft className="w-5 h-5 text-white/80" />
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

      {/* Row 2: Sub-Header Strip */}
      <div className="flex items-center gap-1 px-2 py-1 bg-black/30 border-b border-amber-900/20 overflow-x-auto scrollbar-hide">
        {/* Mode indicator */}
        {mode === 'shared' ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-300/70 whitespace-nowrap px-1">
            <Eye className="w-3 h-3 text-emerald-400" />Shared
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-purple-300/70 whitespace-nowrap px-1">
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
        <span className="text-[11px] text-white/20">•</span>

        {onToggleAutoSync && (
          <button
            onClick={() => onToggleAutoSync(!autoSyncEnabled)}
            className={cn(
              "px-2 py-1 rounded-lg text-[11px] font-cinzel transition-colors whitespace-nowrap",
              autoSyncEnabled ? "text-amber-300 bg-amber-900/30" : "text-white/50 hover:bg-white/10"
            )}
            style={{ touchAction: 'manipulation' }}
            title={autoSyncEnabled ? 'Auto-Sync enabled' : 'Enable Auto-Sync'}
          >
            <Zap className={cn("w-3 h-3 inline mr-0.5", isExtracting && "animate-pulse")} />
            Sync
          </button>
        )}
        {onShowMap && (
          <button
            onClick={onShowMap}
            className="px-2 py-1 rounded-lg text-[11px] font-cinzel text-white/50 hover:bg-white/10 transition-colors whitespace-nowrap"
            style={{ touchAction: 'manipulation' }}
          >
            <Map className="w-3 h-3 inline mr-0.5" />Map
          </button>
        )}
        {onShowSaves && (
          <button
            onClick={onShowSaves}
            className="px-2 py-1 rounded-lg text-[11px] font-cinzel text-white/50 hover:bg-white/10 transition-colors whitespace-nowrap"
            style={{ touchAction: 'manipulation' }}
          >
            <FolderOpen className="w-3 h-3 inline mr-0.5" />Saves
          </button>
        )}
        {onShowChat && (
          <button
            onClick={onShowChat}
            className="px-2 py-1 rounded-lg text-[11px] font-cinzel text-white/50 hover:bg-white/10 transition-colors whitespace-nowrap"
            style={{ touchAction: 'manipulation' }}
          >
            <MessageSquare className="w-3 h-3 inline mr-0.5" />Chat
          </button>
        )}
        {onShowGuides && (
          <button
            onClick={onShowGuides}
            className={cn(
              "px-2 py-1 rounded-lg text-[11px] font-cinzel transition-colors relative whitespace-nowrap",
              guidesCount > 0 ? "text-amber-300/80 hover:bg-amber-900/30" : "text-white/50 hover:bg-white/10"
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <BookOpen className="w-3 h-3 inline mr-0.5" />Guides
            {guidesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-600 text-[8px] flex items-center justify-center text-white">
                {guidesCount}
              </span>
            )}
          </button>
        )}
        {isCreator && (
          <>
            {/* Split / Regroup buttons */}
            {partyDm.isSplitActive ? (
              <>
                <button
                  onClick={() => setShowSplitSummaries(true)}
                  className="px-2 py-1 rounded-lg text-[11px] font-cinzel text-amber-300/80 hover:bg-amber-900/30 transition-colors whitespace-nowrap"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Eye className="w-3 h-3 inline mr-0.5" />Summaries
                </button>
                <button
                  onClick={() => setShowRegroupDialog(true)}
                  className="px-2 py-1 rounded-lg text-[11px] font-cinzel text-emerald-300/80 hover:bg-emerald-900/30 transition-colors whitespace-nowrap"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Users className="w-3 h-3 inline mr-0.5" />Regroup
                </button>
              </>
            ) : memberCount >= 4 && (
              <button
                onClick={() => setShowSplitInitiator(true)}
                className="px-2 py-1 rounded-lg text-[11px] font-cinzel text-white/50 hover:bg-white/10 transition-colors whitespace-nowrap"
                style={{ touchAction: 'manipulation' }}
              >
                <GitBranch className="w-3 h-3 inline mr-0.5" />Split
              </button>
            )}
            <button
              onClick={() => {
                const newMode = mode === 'shared' ? 'private' : 'shared';
                if (partyDm.sessionConfig) {
                  const updated = { ...partyDm.sessionConfig, mode: newMode as 'shared' | 'private' };
                  (supabase.from('party_shared_state') as any)
                    .update({ state_data: updated })
                    .eq('state_type', 'dm_session')
                    .then(() => {});
                }
              }}
              className={cn(
                "p-1 rounded-lg text-[11px] transition-colors",
                mode === 'shared' ? "bg-emerald-900/30 text-emerald-400" : "bg-purple-900/30 text-purple-400"
              )}
              title={mode === 'shared' ? 'Switch to private' : 'Switch to shared'}
              style={{ touchAction: 'manipulation' }}
            >
              {mode === 'shared' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => {
                setShowNewCampaignInput(true);
                setNewCampaignName('');
              }}
              className="p-1 rounded-lg text-[11px] text-amber-400 hover:bg-amber-900/20 transition-colors"
              title="Start new campaign"
              style={{ touchAction: 'manipulation' }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={partyDm.endSession}
              className="p-1 rounded-lg text-[11px] text-red-400 hover:bg-red-900/20 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

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
        />
      )}

      {/* Messages OR Inline Battle Map */}
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
                  members={members}
                  mode={mode}
                  isCreator={isCreator}
                  onCopy={handleCopyMessage}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onRegenerate={handleRegenerateMessage}
                  showTeamTag={isCreator && partyDm.isSplitActive}
                />
              ))}
            </AnimatePresence>
          )}

          {/* Loading indicator */}
          {partyDm.isGenerating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-sm text-amber-400/60 italic">The DM weaves the tale...</span>
            </motion.div>
          )}
        </div>
      )}

      {/* Prompt Queue Status */}
      {partyDm.isActive && (
        <div className="px-3 py-2 border-t border-amber-900/20 bg-black/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Round Queue</span>
            <span className="text-[10px] text-white/30">
              {partyDm.currentPrompts.filter(p => p.is_ready).length}/{memberCount} ready
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {members.map(m => {
              const prompt = partyDm.currentPrompts.find(p => p.user_id === m.user_id);
              const isSelf = m.user_id === currentUserId;
              const hasAction = prompt && prompt.prompt.trim().length > 0;
              const isExpanded = expandedPillUserId === m.user_id;
              const memberTeam = partyDm.isSplitActive && partyDm.splitState
                ? partyDm.splitState.alphaMembers.includes(m.user_id) ? 'alpha' : 'beta'
                : null;
              return (
                <div
                  key={m.user_id}
                  title={
                    prompt?.is_ready
                      ? `${m.character_name} — Ready${hasAction ? ' (with action)' : ' (no action)'}`
                      : prompt
                        ? `${m.character_name} — Action submitted, not ready`
                        : `${m.character_name} — Waiting...`
                  }
                  onClick={() => {
                    if (mode !== 'shared' || !hasAction) return;
                    const toggled = isExpanded ? null : m.user_id;
                    setExpandedPillUserId(toggled);
                    if (toggled && isSelf && prompt) setPillEditText(prompt.prompt);
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border transition-all",
                    !prompt && "bg-white/5 border-white/10 text-white/30",
                    prompt && !prompt.is_ready && "bg-amber-900/20 border-amber-500/30 text-amber-300",
                    prompt?.is_ready && "bg-emerald-900/20 border-emerald-500/30 text-emerald-300 animate-pulse",
                    mode === 'shared' && hasAction && "cursor-pointer hover:brightness-125",
                    isExpanded && "ring-1 ring-white/30",
                  )}
                >
                  {memberTeam && (
                    <span className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      memberTeam === 'alpha' ? "bg-blue-400" : "bg-purple-400"
                    )} />
                  )}
                  <span className="max-w-[80px] truncate">{m.character_name}</span>
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
                </div>
              );
            })}
          </div>

          {/* Expanded pill content */}
          <AnimatePresence>
            {expandedPillUserId && (() => {
              const m = members.find(mem => mem.user_id === expandedPillUserId);
              const prompt = partyDm.currentPrompts.find(p => p.user_id === expandedPillUserId);
              if (!m || !prompt || !prompt.prompt.trim()) return null;
              const isSelf = expandedPillUserId === currentUserId;
              const canEdit = isSelf && !prompt.is_ready && !partyDm.isGenerating;
              return (
                <motion.div
                  key="expanded-pill"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-lg bg-white/5 border border-white/10 p-2.5">
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
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm"
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

      {/* Input Area */}
      <div className="px-2 py-2 sm:px-3 sm:py-3 border-t border-amber-900/30 bg-black/40 backdrop-blur-sm mb-[48px]">
        {partyDm.isGenerating ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-sm text-amber-400/70">Generating response...</span>
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
                disabled={!input.trim()}
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
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="p-2 rounded-xl border border-white/10 hover:border-amber-500/30 bg-white/5 hover:bg-amber-900/20 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                    title="Attach photo"
                  >
                    {isUploadingPhoto ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin" /> : <ImageIcon className="w-4 h-4 text-white/50" />}
                  </button>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploadingVideo}
                    className="p-2 rounded-xl border border-white/10 hover:border-amber-500/30 bg-white/5 hover:bg-amber-900/20 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                    title="Attach video"
                  >
                    {isUploadingVideo ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin" /> : <Film className="w-4 h-4 text-white/50" />}
                  </button>
                  {/* Narrator speaker button */}
                  {narrator.hasElevenLabsKey && (
                    <button
                      onClick={() => {
                        if (narrator.isPlaying) {
                          narrator.stop();
                        } else {
                          const lastAssistant = [...partyDm.messages].reverse().find(m => m.role === 'assistant');
                          if (lastAssistant) narrator.playMessage(lastAssistant.content);
                        }
                      }}
                      disabled={narrator.isLoading}
                      className={cn(
                        "p-2 rounded-xl border shrink-0 transition-colors",
                        narrator.isPlaying
                          ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60"
                          : "bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-900/20"
                      )}
                      style={{ touchAction: 'manipulation' }}
                      title={narrator.isPlaying ? "Stop narration" : "Narrate last message"}
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
                  {narrator.hasElevenLabsKey && (
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
                {mode === 'shared' && (
                  <button
                    onClick={() => {
                      const myUserId = currentUserId;
                      if (!myUserId) return;
                      setExpandedPillUserId(prev => prev === myUserId ? null : myUserId);
                      setPillEditText(partyDm.myPrompt?.prompt || '');
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
                    title="Edit prompt via pill"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => partyDm.retractPrompt()}
                  className="p-2 rounded-lg hover:bg-red-900/20 transition-colors text-white/40 hover:text-red-400"
                  title="Retract prompt"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Trash2 className="w-4 h-4" />
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
              <span className="text-sm text-emerald-300/70">Ready! Waiting for others...</span>
              <button
                onClick={partyDm.unready}
                disabled={partyDm.isGenerating}
                className="ml-2 px-2 py-0.5 text-[11px] rounded border border-amber-500/30 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 transition-colors disabled:opacity-40"
              >
                Undo
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Narrator speaker button */}
              {narrator.hasElevenLabsKey && (
                <button
                  onClick={() => {
                    if (narrator.isPlaying) {
                      narrator.stop();
                    } else {
                      const lastAssistant = [...partyDm.messages].reverse().find(m => m.role === 'assistant');
                      if (lastAssistant) narrator.playMessage(lastAssistant.content);
                    }
                  }}
                  disabled={narrator.isLoading}
                  className={cn(
                    "p-2 rounded-xl border shrink-0 transition-colors",
                    narrator.isPlaying
                      ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60"
                      : "bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-900/20"
                  )}
                  style={{ touchAction: 'manipulation' }}
                  title={narrator.isPlaying ? "Stop narration" : "Narrate last message"}
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
              {narrator.hasElevenLabsKey && (
                <NarrationSpeedPopover iconSize="w-4 h-4" />
              )}
              {isCreator && (
                <Button
                  onClick={partyDm.generateResponse}
                  disabled={partyDm.isGenerating || partyDm.currentPrompts.length === 0}
                  className="gap-1.5 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
                  size="sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Generate Now
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Host generate button (always visible for host when prompts exist) */}
        {isCreator && !partyDm.isGenerating && hasSubmitted && !isReady && partyDm.currentPrompts.length > 0 && (
          <div className="mt-2 flex justify-end max-w-2xl mx-auto">
            <Button
              onClick={partyDm.generateResponse}
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-300 border-amber-500/30"
            >
              <Zap className="w-3.5 h-3.5" />
              Generate Now
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Navigation Drawer */}
      <DMBottomNav
        activeTab={activeNavTab}
        onTabChange={handleNavTabChange}
        isExpanded={navExpanded}
        onExpandedChange={setNavExpanded}
        disabled={partyDm.isGenerating}
        diceContent={showDiceContent ? (
          <DMDiceRoller
            characterContext={characterContext!}
            onRollResult={handleDiceRoll}
            disabled={partyDm.isGenerating}
          />
        ) : undefined}
      />

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
    </div>
  );
}
