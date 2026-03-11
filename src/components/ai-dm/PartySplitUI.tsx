import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, GitBranch, X, Check, Eye, Loader2, MessageSquare, Crown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DmSplitState, SplitTeam } from '@/lib/party-split-types';

interface SplitInitiatorProps {
  open: boolean;
  onClose: () => void;
  members: Array<{ user_id: string; character_name: string }>;
  currentUserId?: string;
  onInitiate: (alphaMembers: string[], alphaName: string, betaName: string) => void;
}

export function SplitInitiator({ open, onClose, members, currentUserId, onInitiate }: SplitInitiatorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentUserId ? [currentUserId] : []));
  const [alphaName, setAlphaName] = useState('Team Alpha');
  const [betaName, setBetaName] = useState('Team Beta');

  useEffect(() => {
    if (open) {
      setSelected(new Set(currentUserId ? [currentUserId] : []));
      setAlphaName('Team Alpha');
      setBetaName('Team Beta');
    }
  }, [open, currentUserId]);

  const toggleMember = useCallback((userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const alphaCount = selected.size;
  const betaCount = members.length - alphaCount;
  const isValid = alphaCount >= 2 && betaCount >= 2;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute inset-x-0 bottom-0 z-50 bg-gradient-to-t from-black/95 via-[#0d0d12]/95 to-transparent backdrop-blur-lg border-t border-amber-900/30 rounded-t-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-cinzel text-amber-200">Split Party</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-white/40 mb-3">
          Select members for <span className="text-blue-400">{alphaName}</span>. Everyone else becomes <span className="text-purple-400">{betaName}</span>.
          Each team needs at least 2 members.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {members.map(m => {
            const isSelected = selected.has(m.user_id);
            return (
              <button
                key={m.user_id}
                onClick={() => toggleMember(m.user_id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all",
                  isSelected
                    ? "bg-blue-900/30 border-blue-500/40 text-blue-300"
                    : "bg-purple-900/20 border-purple-500/30 text-purple-300"
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                  isSelected ? "border-blue-400 bg-blue-500/20" : "border-purple-400/50"
                )}>
                  {isSelected && <Check className="w-3 h-3 text-blue-400" />}
                </div>
                <span className="truncate">{m.character_name}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[10px] text-blue-400/70 mb-1 block">Team 1 Name</label>
            <input
              value={alphaName}
              onChange={e => setAlphaName(e.target.value)}
              maxLength={24}
              className="w-full bg-blue-900/20 border border-blue-500/30 rounded-lg px-2.5 py-1.5 text-xs text-blue-300 placeholder:text-blue-400/30 focus:outline-none focus:border-blue-500/50"
              placeholder="Team Alpha"
            />
          </div>
          <div>
            <label className="text-[10px] text-purple-400/70 mb-1 block">Team 2 Name</label>
            <input
              value={betaName}
              onChange={e => setBetaName(e.target.value)}
              maxLength={24}
              className="w-full bg-purple-900/20 border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-purple-300 placeholder:text-purple-400/30 focus:outline-none focus:border-purple-500/50"
              placeholder="Team Beta"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-3 text-[11px]">
            <span className="text-blue-400">{alphaName}: {alphaCount}</span>
            <span className="text-purple-400">{betaName}: {betaCount}</span>
          </div>
          {!isValid && (
            <span className="text-[10px] text-red-400">Min 2 per team</span>
          )}
        </div>

        <Button
          onClick={() => { onInitiate(Array.from(selected), alphaName, betaName); onClose(); }}
          disabled={!isValid}
          className="w-full gap-2 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
        >
          <GitBranch className="w-4 h-4" />
          Split Party
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}

interface SplitBannerProps {
  splitState: DmSplitState;
  myTeam: SplitTeam;
  isCreator: boolean;
  members: Array<{ user_id: string; character_name: string }>;
  onShowPreSplitChat: () => void;
}

export function SplitBanner({ splitState, myTeam, isCreator, members, onShowPreSplitChat }: SplitBannerProps) {
  const alphaLabel = splitState.alphaName || 'Team Alpha';
  const betaLabel = splitState.betaName || 'Team Beta';
  const teamLabel = myTeam === 'alpha' ? alphaLabel : myTeam === 'beta' ? betaLabel : 'Observer';
  const teamColor = myTeam === 'alpha' ? 'blue' : 'purple';

  const teamMembers = myTeam === 'alpha'
    ? members.filter(m => splitState.alphaMembers.includes(m.user_id))
    : myTeam === 'beta'
    ? members.filter(m => splitState.betaMembers.includes(m.user_id))
    : members;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 border-b text-[11px]",
      myTeam === 'alpha' ? "bg-blue-950/40 border-blue-500/20" : "bg-purple-950/40 border-purple-500/20"
    )}>
      <GitBranch className={cn("w-3 h-3", myTeam === 'alpha' ? "text-blue-400" : "text-purple-400")} />
      <span className={cn("font-cinzel font-semibold", myTeam === 'alpha' ? "text-blue-300" : "text-purple-300")}>
        {teamLabel}
      </span>
      <span className="text-white/30">—</span>
      <span className="text-white/50 truncate">
        {teamMembers.map(m => m.character_name).join(', ')}
      </span>
      <button
        onClick={onShowPreSplitChat}
        className="ml-auto p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
        style={{ touchAction: 'manipulation' }}
        title="View pre-split chat"
      >
        <MessageSquare className="w-3.5 h-3.5" />
      </button>
      {isCreator && (
        <span className="text-amber-400/60 text-[10px] whitespace-nowrap">Host view: all teams</span>
      )}
    </div>
  );
}

interface RegroupDialogProps {
  open: boolean;
  onClose: () => void;
  onRegroup: (prompt: string) => void;
  isGenerating: boolean;
}

export function RegroupDialog({ open, onClose, onRegroup, isGenerating }: RegroupDialogProps) {
  const [prompt, setPrompt] = useState('The two groups meet back up and share their stories.');

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md bg-gradient-to-b from-[#1a0e05] to-[#0d0d12] border border-amber-900/30 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-cinzel text-amber-200">Regroup Party</h3>
          </div>
          <p className="text-xs text-white/40 mb-3">
            Describe the reunion scene. The original chat will be restored and a unification scene will be generated.
          </p>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="w-full bg-white/5 border border-amber-900/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[80px] max-h-[200px] mb-3"
            placeholder="How does the party reunite?"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              onClick={onClose}
              variant="ghost"
              className="flex-1 text-white/50"
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={() => { onRegroup(prompt); onClose(); }}
              disabled={!prompt.trim() || isGenerating}
              className="flex-1 gap-2 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Regroup
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface SplitSummariesViewerProps {
  open: boolean;
  onClose: () => void;
  splitState: DmSplitState;
}

export function SplitSummariesViewer({ open, onClose, splitState }: SplitSummariesViewerProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-gradient-to-b from-[#1a0e05] to-[#0d0d12] border border-amber-900/30 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-cinzel text-amber-200">Split Summaries</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-white/30 mb-4">Host-only view. These summaries inform the AI DM's context.</p>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-cinzel text-blue-300 mb-1.5 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                {splitState.alphaName || 'Team Alpha'} Summary
              </h4>
              <div className="bg-blue-950/20 border border-blue-500/10 rounded-xl p-3">
                <p className="text-xs text-white/60 whitespace-pre-wrap">
                  {splitState.alphaSummary || 'No summary yet — will generate after the first round.'}
                </p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-cinzel text-purple-300 mb-1.5 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                {splitState.betaName || 'Team Beta'} Summary
              </h4>
              <div className="bg-purple-950/20 border border-purple-500/10 rounded-xl p-3">
                <p className="text-xs text-white/60 whitespace-pre-wrap">
                  {splitState.betaSummary || 'No summary yet — will generate after the first round.'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
