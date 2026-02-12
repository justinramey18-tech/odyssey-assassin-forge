import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Edit2, Trash2, BookOpen, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { GMGuide, MAX_GUIDE_CHARS, MAX_TOTAL_CHARS } from '@/lib/gm-guides-storage';

interface GMGuidesManagerProps {
  onBack: () => void;
  guides: GMGuide[];
  totalChars: number;
  onAdd: (name: string, content: string) => boolean;
  onUpdate: (id: string, updates: Partial<Pick<GMGuide, 'name' | 'content' | 'enabled'>>) => boolean;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

function CharCounter({ current, max, className }: { current: number; max: number; className?: string }) {
  const pct = (current / max) * 100;
  return (
    <span className={cn(
      "text-[11px] font-mono",
      pct > 95 ? "text-red-400" : pct > 80 ? "text-amber-400" : "text-white/40",
      className,
    )}>
      {current.toLocaleString()}/{max.toLocaleString()}
    </span>
  );
}

export function GMGuidesManager({ onBack, guides, totalChars, onAdd, onUpdate, onDelete, onToggle }: GMGuidesManagerProps) {
  const [editingGuide, setEditingGuide] = useState<GMGuide | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editorName, setEditorName] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openNewEditor = useCallback(() => {
    setEditingGuide(null);
    setIsNew(true);
    setEditorName('');
    setEditorContent('');
  }, []);

  const openEditEditor = useCallback((guide: GMGuide) => {
    setEditingGuide(guide);
    setIsNew(false);
    setEditorName(guide.name);
    setEditorContent(guide.content);
  }, []);

  const handleSave = useCallback(() => {
    if (isNew) {
      if (onAdd(editorName, editorContent)) {
        setIsNew(false);
        setEditingGuide(null);
      }
    } else if (editingGuide) {
      if (onUpdate(editingGuide.id, { name: editorName.trim() || 'Untitled Guide', content: editorContent })) {
        setEditingGuide(null);
      }
    }
  }, [isNew, editingGuide, editorName, editorContent, onAdd, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditingGuide(null);
    setIsNew(false);
  }, []);

  const budgetPct = (totalChars / MAX_TOTAL_CHARS) * 100;
  const showEditor = isNew || editingGuide !== null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h1 className="text-base font-cinzel text-amber-200 tracking-wide">GM Guides</h1>
        </div>
        {!showEditor && (
          <button
            onClick={openNewEditor}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-cinzel text-amber-300/80 hover:bg-amber-900/30 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        )}
      </header>

      {/* Budget bar */}
      <div className="px-3 py-2 bg-black/30 border-b border-amber-900/20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-white/50">Total Character Budget</span>
          <CharCounter current={totalChars} max={MAX_TOTAL_CHARS} />
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              budgetPct > 90 ? "bg-red-500" : budgetPct > 70 ? "bg-amber-500" : "bg-emerald-500"
            )}
            style={{ width: `${Math.min(budgetPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence mode="wait">
          {showEditor ? (
            <motion.div key="editor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-3 h-full">
              <input
                type="text"
                value={editorName}
                onChange={e => setEditorName(e.target.value)}
                placeholder="Guide name (e.g. Curse of Strahd Setting)"
                className="w-full bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
                maxLength={100}
              />
              <div className="flex-1 relative min-h-0">
                <textarea
                  value={editorContent}
                  onChange={e => {
                    if (e.target.value.length <= MAX_GUIDE_CHARS) setEditorContent(e.target.value);
                  }}
                  placeholder="Paste or type your GM guide content here..."
                  className="w-full h-full min-h-[300px] bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none font-mono leading-relaxed"
                />
                <div className="absolute bottom-2 right-2">
                  <CharCounter current={editorContent.length} max={MAX_GUIDE_CHARS} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCancel} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!editorContent.trim()}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-colors",
                    editorContent.trim()
                      ? "bg-amber-900/40 border border-amber-500/30 text-amber-300 hover:bg-amber-900/60"
                      : "bg-white/5 border border-white/10 text-white/30"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Check className="w-4 h-4" /> Save
                </button>
              </div>
            </motion.div>
          ) : guides.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <BookOpen className="w-10 h-10 text-amber-500/40 mb-3" />
              <h2 className="text-base font-cinzel text-amber-200 mb-1">No GM Guides</h2>
              <p className="text-xs text-white/40 max-w-[260px] mb-4">
                Add custom guides to shape the DM's behavior — homebrew rules, campaign settings, NPC backstories, and more.
              </p>
              <button
                onClick={openNewEditor}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-900/40 border border-amber-500/30 text-amber-300 text-sm hover:bg-amber-900/60 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <Plus className="w-4 h-4" /> Create First Guide
              </button>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {guides.map(guide => (
                <div key={guide.id} className="bg-white/5 border border-amber-900/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-cinzel text-amber-200 truncate flex-1 mr-2">{guide.name}</h3>
                    <Switch
                      checked={guide.enabled}
                      onCheckedChange={() => onToggle(guide.id)}
                      className="data-[state=checked]:bg-amber-600 scale-75"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30 font-mono">{guide.content.length.toLocaleString()} chars</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditEditor(guide)} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
                        <Edit2 className="w-3.5 h-3.5 text-white/50" />
                      </button>
                      {deleteConfirmId === guide.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { onDelete(guide.id); setDeleteConfirmId(null); }} className="px-2 py-0.5 rounded bg-red-900/40 text-red-400 text-[10px] hover:bg-red-900/60 transition-colors" style={{ touchAction: 'manipulation' }}>
                            Delete
                          </button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-0.5 rounded bg-white/5 text-white/40 text-[10px] hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(guide.id)} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
                          <Trash2 className="w-3.5 h-3.5 text-white/50" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
