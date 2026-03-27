import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Play, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DmSessionConfig, PartyDmMessage } from '@/hooks/use-party-dm';

interface NpcSceneDialogProps {
  open: boolean;
  onClose: () => void;
  onStart: (npcs: string[], scenePrompt: string, maxMessages: number) => void;
  sessionConfig: DmSessionConfig | null;
  messages: PartyDmMessage[];
}

const EMPYREAN_PRESETS = [
  'Professor Kaori', 'Professor Markham', 'Commandant Panchek', 'Colonel Aetos',
  'Scribe Jesinia', 'Dain Aetos', 'Xaden Riorson', 'Violet Sorrengail', 'Liam Mairi', 'Imogen',
];

export function NpcSceneDialog({ open, onClose, onStart, sessionConfig, messages }: NpcSceneDialogProps) {
  const [npcs, setNpcs] = useState<string[]>(['', '']);
  const [scenePrompt, setScenePrompt] = useState('');
  const [maxMessages, setMaxMessages] = useState(12);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract NPC names from chat history
  const historySuggestions = useMemo(() => {
    const names = new Set<string>();
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      const sName = (msg as any).senderName || (msg as any).sender_name;
      if (sName && sName !== 'DM' && sName !== 'System' && typeof sName === 'string') {
        for (const part of sName.split(/\s*&\s*/)) {
          const t = part.trim();
          if (t.length >= 2) names.add(t);
        }
      }
      const pat = /\*\*([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)\*\*:/g;
      let m;
      while ((m = pat.exec(msg.content)) !== null) {
        const t = m[1].trim();
        if (t.length >= 2) names.add(t);
      }
    }
    return Array.from(names);
  }, [messages]);

  if (!open) return null;

  const isEmpyrean = sessionConfig?.campaignType === 'empyrean';
    const names = new Set<string>();
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      // sender_name check
      const sName = (msg as any).senderName || (msg as any).sender_name;
      if (sName && sName !== 'DM' && sName !== 'System' && typeof sName === 'string') {
        for (const part of sName.split(/\s*&\s*/)) {
          const t = part.trim();
          if (t.length >= 2) names.add(t);
        }
      }
      // Regex voicing pattern
      const pat = /\*\*([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)\*\*:/g;
      let m;
      while ((m = pat.exec(msg.content)) !== null) {
        const t = m[1].trim();
        if (t.length >= 2) names.add(t);
      }
    }
    return Array.from(names);
  }, [messages]);

  const filledCount = npcs.filter(n => n.trim()).length;
  const filledNpcCount = filledCount || 1;
  const canStart = filledCount >= 2 && scenePrompt.trim().length > 0;

  const getSuggestions = (index: number) => {
    const currentText = npcs[index]?.toLowerCase() || '';
    const addedNames = new Set(npcs.filter((n, i) => i !== index && n.trim()).map(n => n.trim().toLowerCase()));
    const all = [...(isEmpyrean ? EMPYREAN_PRESETS : []), ...historySuggestions];
    const unique = Array.from(new Set(all));
    return unique
      .filter(name => !addedNames.has(name.toLowerCase()))
      .filter(name => !currentText || name.toLowerCase().includes(currentText))
      .slice(0, 6)
      .map(name => ({ name, isPreset: isEmpyrean && EMPYREAN_PRESETS.includes(name) }));
  };

  const updateNpc = (index: number, value: string) => {
    setNpcs(prev => prev.map((n, i) => i === index ? value : n));
  };

  const removeNpc = (index: number) => {
    if (npcs.length <= 2) return;
    setNpcs(prev => prev.filter((_, i) => i !== index));
  };

  const addNpc = () => {
    if (npcs.length >= 6) return;
    setNpcs(prev => [...prev, '']);
  };

  const handleStart = () => {
    const filled = npcs.map(n => n.trim()).filter(Boolean);
    onStart(filled, scenePrompt.trim(), maxMessages);
    setNpcs(['', '']);
    setScenePrompt('');
    setMaxMessages(12);
    setFocusedIndex(null);
    onClose();
  };

  const suggestions = focusedIndex !== null ? getSuggestions(focusedIndex) : [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm"
      >
        {/* Header */}
        <div className={cn('flex items-center justify-between px-4 py-3 border-b', accentHeaderBg, accentHeaderBorder)}>
          <div className="flex items-center gap-2">
            <Users className={cn('w-5 h-5', accentText)} />
            <span className="font-cinzel text-base text-white/90">NPC Scene</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Section 1: NPC Names */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Users className="w-4 h-4" />
              <span>NPCs ({filledCount}/{npcs.length})</span>
            </div>

            <div className="space-y-2">
              {npcs.map((npc, index) => (
                <div key={index} className="relative">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={npc}
                      onChange={e => updateNpc(index, e.target.value)}
                      onFocus={() => {
                        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                        setFocusedIndex(index);
                      }}
                      onBlur={() => {
                        blurTimeoutRef.current = setTimeout(() => setFocusedIndex(null), 150);
                      }}
                      placeholder="NPC name..."
                      className={cn(
                        'flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/90',
                        'placeholder:text-zinc-500 outline-none transition-all',
                        `focus:${accentBorder} focus:ring-1 focus:${accentRing}`,
                      )}
                      style={{ touchAction: 'manipulation' }}
                    />
                    {npcs.length > 2 && (
                      <button
                        onClick={() => removeNpc(index)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Minus className="w-4 h-4 text-white/40" />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete dropdown */}
                  {focusedIndex === index && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-zinc-900 border border-white/10 shadow-xl z-10 overflow-hidden">
                      {suggestions.map(s => (
                        <div
                          key={s.name}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 cursor-pointer"
                          onPointerDown={e => {
                            e.preventDefault();
                            updateNpc(index, s.name);
                            setFocusedIndex(null);
                          }}
                        >
                          <Sparkles className={cn('w-3 h-3', accentText)} />
                          <span className="font-cinzel text-xs text-white/80">{s.name}</span>
                          {s.isPreset && (
                            <span className={cn('text-[10px] ml-auto', accentTextMuted)}>preset</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addNpc}
              disabled={npcs.length >= 6}
              className={cn('text-xs flex items-center gap-1 transition-colors', accentText, npcs.length >= 6 && 'opacity-30 cursor-not-allowed')}
              style={{ touchAction: 'manipulation' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add NPC
            </button>
          </div>

          {/* Section 2: Scene Setup */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-white/80">Scene Setup</div>
            <textarea
              value={scenePrompt}
              onChange={e => setScenePrompt(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="A merchant and a guard argue about missing shipments at the docks..."
              className={cn(
                'w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/90',
                'placeholder:text-zinc-500 outline-none resize-none transition-all',
                `focus:${accentBorder} focus:ring-1 focus:${accentRing}`,
              )}
            />
            <div className="text-[11px] text-zinc-500 text-right">{scenePrompt.length}/500</div>
          </div>

          {/* Section 3: Message Cap */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-white/80">
              Message Cap <span className={cn('ml-1', accentText)}>{maxMessages}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMaxMessages(prev => Math.max(4, prev - 2))}
                disabled={maxMessages <= 4}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30"
                style={{ touchAction: 'manipulation' }}
              >
                <Minus className="w-4 h-4 text-white/60" />
              </button>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', accentGradient)}
                  style={{ width: `${((maxMessages - 4) / 20) * 100}%` }}
                />
              </div>
              <button
                onClick={() => setMaxMessages(prev => Math.min(24, prev + 2))}
                disabled={maxMessages >= 24}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30"
                style={{ touchAction: 'manipulation' }}
              >
                <Plus className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="text-[11px] text-zinc-500">
              {maxMessages} total NPC lines (~{Math.ceil(maxMessages / filledNpcCount)} rounds each)
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-cinzel text-sm transition-all',
              canStart
                ? cn(accentGradient, 'text-white shadow-lg')
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <Play className="w-4 h-4" />
            Start Scene
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
