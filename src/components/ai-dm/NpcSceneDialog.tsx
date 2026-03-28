import { useState, useMemo } from 'react';
import { X, Plus, Minus, Trash2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const EMPYREAN_PRESETS = [
  'Professor Kaori', 'Professor Markham', 'Commandant Panchek', 'Colonel Aetos',
  'Scribe Jesinia', 'Dain Aetos', 'Xaden Riorson', 'Violet Sorrengail',
  'Liam Mairi', 'Imogen',
];

interface NpcSceneDialogProps {
  open: boolean;
  onClose: () => void;
  onStart: (npcs: string[], scenePrompt: string, lineCount: number) => void;
  sessionConfig: { campaignType?: string } | null;
  messages: Array<{ role: string; content: string; senderName?: string; sender_name?: string }>;
}

export function NpcSceneDialog({ open, onClose, onStart, sessionConfig, messages }: NpcSceneDialogProps) {
  const [npcNames, setNpcNames] = useState<string[]>(['', '']);
  const [scenePrompt, setScenePrompt] = useState('');
  const [lineCount, setLineCount] = useState(12);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  const isEmpyrean = sessionConfig?.campaignType === 'empyrean';
  const accent = isEmpyrean ? 'cyan' : 'amber';

  // Extract NPC names from chat history
  const chatNpcs = useMemo(() => {
    const names = new Set<string>();
    for (const m of messages) {
      if (m.role === 'assistant') {
        const sn = m.senderName || m.sender_name;
        if (sn && sn !== 'DM' && sn !== 'System') names.add(sn);
        // Also parse **Name:** patterns
        const matches = m.content.matchAll(/\*\*([^*]+)\*\*:/g);
        for (const match of matches) {
          const n = match[1].trim();
          if (n && n !== 'DM') names.add(n);
        }
      }
    }
    return Array.from(names).sort();
  }, [messages]);

  const allSuggestions = useMemo(() => {
    const set = new Set<string>(chatNpcs);
    if (isEmpyrean) EMPYREAN_PRESETS.forEach(n => set.add(n));
    return Array.from(set).sort();
  }, [chatNpcs, isEmpyrean]);

  const getFilteredSuggestions = (idx: number) => {
    const val = npcNames[idx]?.toLowerCase() || '';
    const used = new Set(npcNames.filter((n, i) => i !== idx && n.trim()).map(n => n.toLowerCase()));
    return allSuggestions.filter(s => !used.has(s.toLowerCase()) && (val === '' || s.toLowerCase().includes(val)));
  };

  const canStart = npcNames.filter(n => n.trim()).length >= 2 && scenePrompt.trim().length > 0;

  const handleStart = () => {
    const npcs = npcNames.map(n => n.trim()).filter(Boolean);
    onStart(npcs, scenePrompt.trim(), lineCount);
    // Reset
    setNpcNames(['', '']);
    setScenePrompt('');
    setLineCount(12);
    onClose();
  };

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <h2 className={cn("font-cinzel font-bold text-lg", isEmpyrean ? "text-cyan-300" : "text-amber-300")}>
          NPC Scene
        </h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/20 transition-colors" style={{ touchAction: 'manipulation' }}>
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* NPC Names */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">NPCs (2-6)</label>
          {npcNames.map((name, idx) => (
            <div key={idx} className="relative">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={e => {
                    const updated = [...npcNames];
                    updated[idx] = e.target.value;
                    setNpcNames(updated);
                  }}
                  onFocus={() => setFocusedIdx(idx)}
                  onBlur={() => setTimeout(() => setFocusedIdx(null), 150)}
                  placeholder={`NPC ${idx + 1}`}
                  className={cn(
                    "flex-1 bg-muted/10 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40",
                    "border focus:outline-none focus:ring-1 transition-colors",
                    isEmpyrean ? "border-cyan-900/30 focus:ring-cyan-500/30" : "border-amber-900/30 focus:ring-amber-500/30"
                  )}
                />
                {npcNames.length > 2 && (
                  <button
                    onClick={() => setNpcNames(npcNames.filter((_, i) => i !== idx))}
                    className="p-2 rounded-lg hover:bg-red-900/20 text-red-400/60 hover:text-red-400 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {/* Autocomplete dropdown */}
              {focusedIdx === idx && getFilteredSuggestions(idx).length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border/40 rounded-lg shadow-lg max-h-[160px] overflow-y-auto">
                  {getFilteredSuggestions(idx).slice(0, 8).map(suggestion => (
                    <button
                      key={suggestion}
                      onMouseDown={e => {
                        e.preventDefault();
                        const updated = [...npcNames];
                        updated[idx] = suggestion;
                        setNpcNames(updated);
                        setFocusedIdx(null);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/20 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {npcNames.length < 6 && (
            <button
              onClick={() => setNpcNames([...npcNames, ''])}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                isEmpyrean ? "text-cyan-400/70 hover:bg-cyan-900/20" : "text-amber-400/70 hover:bg-amber-900/20"
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <Plus className="w-3.5 h-3.5" /> Add NPC
            </button>
          )}
        </div>

        {/* Scene Prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Scene Prompt</label>
            <span className={cn("text-xs", scenePrompt.length > 450 ? "text-red-400" : "text-muted-foreground/50")}>
              {scenePrompt.length}/500
            </span>
          </div>
          <textarea
            value={scenePrompt}
            onChange={e => setScenePrompt(e.target.value.slice(0, 500))}
            placeholder="Two merchants argue over a stolen shipment while a third tries to calm them down..."
            rows={3}
            className={cn(
              "w-full bg-muted/10 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none",
              "border focus:outline-none focus:ring-1 transition-colors",
              isEmpyrean ? "border-cyan-900/30 focus:ring-cyan-500/30" : "border-amber-900/30 focus:ring-amber-500/30"
            )}
          />
        </div>

        {/* Line Count */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Lines</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLineCount(Math.max(6, lineCount - 2))}
              disabled={lineCount <= 6}
              className="p-2 rounded-lg bg-muted/10 border border-border/30 hover:bg-muted/20 disabled:opacity-30 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <Minus className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className={cn("text-lg font-bold min-w-[2ch] text-center", isEmpyrean ? "text-cyan-300" : "text-amber-300")}>
              {lineCount}
            </span>
            <button
              onClick={() => setLineCount(Math.min(20, lineCount + 2))}
              disabled={lineCount >= 20}
              className="p-2 rounded-lg bg-muted/10 border border-border/30 hover:bg-muted/20 disabled:opacity-30 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/30">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            isEmpyrean
              ? "bg-cyan-600/80 hover:bg-cyan-600 text-white"
              : "bg-amber-600/80 hover:bg-amber-600 text-white"
          )}
          style={{ touchAction: 'manipulation' }}
        >
          <Play className="w-4 h-4" />
          Start Scene
        </button>
      </div>
    </motion.div>
  );
}
