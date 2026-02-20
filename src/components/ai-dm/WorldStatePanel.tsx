import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, ChevronDown, ChevronUp, BookOpen, ScrollText, MapPin, Star, Coins, Swords, Lock, FileText, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DMGameState, MemoryAnchor, MemoryAnchorCategory, QuestFlag } from '@/hooks/use-dm-game-state';

interface WorldStatePanelProps {
  gameState: DMGameState;
  onAddAnchor: (anchor: Omit<MemoryAnchor, 'id' | 'turn' | 'created_at'>) => void;
  onRemoveAnchor: (id: string) => void;
  onSetQuestFlag: (key: string, status: QuestFlag['status'], notes?: string) => void;
  onClose: () => void;
}

const CATEGORY_CONFIG: Record<MemoryAnchorCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  npc: { label: 'NPCs', icon: BookOpen },
  quest: { label: 'Quests', icon: ScrollText },
  location: { label: 'Locations', icon: MapPin },
  reputation: { label: 'Reputation', icon: Star },
  debt: { label: 'Debts', icon: Coins },
  injury: { label: 'Injuries', icon: Swords },
  secret: { label: 'Secrets', icon: Lock },
  fact: { label: 'World Facts', icon: FileText },
};

const CATEGORIES = Object.entries(CATEGORY_CONFIG) as [MemoryAnchorCategory, typeof CATEGORY_CONFIG[MemoryAnchorCategory]][];

function AnchorCard({ anchor, onRemove }: { anchor: MemoryAnchor; onRemove: () => void }) {
  const cfg = CATEGORY_CONFIG[anchor.category];
  const Icon = cfg?.icon ?? FileText;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 group"
    >
      <Icon className="w-3.5 h-3.5 text-amber-400/70 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-amber-200 truncate">{anchor.key}</p>
        <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{anchor.value}</p>
        <p className="text-[10px] text-white/30 mt-1">Turn {anchor.turn}</p>
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-900/30 text-white/30 hover:text-red-400 transition-all shrink-0"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

interface AddAnchorFormProps {
  onAdd: (anchor: Omit<MemoryAnchor, 'id' | 'turn' | 'created_at'>) => void;
  onClose: () => void;
}

function AddAnchorForm({ onAdd, onClose }: AddAnchorFormProps) {
  const [category, setCategory] = useState<MemoryAnchorCategory>('npc');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(() => {
    if (!key.trim() || !value.trim()) return;
    onAdd({ category, key: key.trim(), value: value.trim() });
    setKey('');
    setValue('');
    onClose();
  }, [category, key, value, onAdd, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 space-y-3 mt-2">
        <p className="text-xs font-medium text-amber-300">Add Memory Anchor</p>

        {/* Category */}
        <div className="grid grid-cols-4 gap-1">
          {CATEGORIES.map(([cat, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] transition-colors',
                  category === cat
                    ? 'bg-amber-600/40 text-amber-200 border border-amber-500/40'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70 border border-white/5'
                )}
              >
                <Icon className="w-3 h-3" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Key */}
        <input
          type="text"
          placeholder="Short label (e.g. Mira the Innkeeper)"
          value={key}
          onChange={e => setKey(e.target.value)}
          className="w-full text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/40"
        />

        {/* Value */}
        <textarea
          placeholder="Fact / description (e.g. Distrusts you after the tavern incident)"
          value={value}
          onChange={e => setValue(e.target.value)}
          rows={2}
          className="w-full text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/40 resize-none"
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors rounded-lg hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!key.trim() || !value.trim()}
            className="px-3 py-1.5 text-xs bg-amber-700/60 hover:bg-amber-700/80 text-amber-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add Anchor
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function WorldStatePanel({ gameState, onAddAnchor, onRemoveAnchor, onSetQuestFlag, onClose }: WorldStatePanelProps) {
  const [expandedCat, setExpandedCat] = useState<MemoryAnchorCategory | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'anchors' | 'quests' | 'inventory'>('anchors');

  const anchorsByCategory = gameState.memory_anchors.reduce<Partial<Record<MemoryAnchorCategory, MemoryAnchor[]>>>(
    (acc, a) => { (acc[a.category] = acc[a.category] || []).push(a); return acc; },
    {}
  );

  const activeQuests = Object.entries(gameState.quest_flags).filter(([, q]) => q.status === 'active');
  const completedQuests = Object.entries(gameState.quest_flags).filter(([, q]) => q.status === 'completed');
  const failedQuests = Object.entries(gameState.quest_flags).filter(([, q]) => q.status === 'failed');

  const totalAnchors = gameState.memory_anchors.length;
  const totalQuests = Object.keys(gameState.quest_flags).length;
  const totalInventory = gameState.inventory.length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-[#0d0a12] border-l border-amber-500/20 flex flex-col z-30 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 shrink-0">
        <div>
          <h3 className="font-cinzel text-sm text-amber-300">World State</h3>
          <p className="text-[10px] text-white/40">Persists across sessions</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Vitals strip */}
      <div className="grid grid-cols-3 gap-px bg-amber-500/10 shrink-0">
        <div className="bg-[#0d0a12] px-3 py-2 text-center">
          <p className="text-[10px] text-white/40">HP</p>
          <p className="text-sm font-bold text-red-400">{gameState.current_hp}<span className="text-white/30">/{gameState.max_hp}</span></p>
        </div>
        <div className="bg-[#0d0a12] px-3 py-2 text-center">
          <p className="text-[10px] text-white/40">Gold</p>
          <p className="text-sm font-bold text-amber-400">{gameState.gold}gp</p>
        </div>
        <div className="bg-[#0d0a12] px-3 py-2 text-center">
          <p className="text-[10px] text-white/40">Turn</p>
          <p className="text-sm font-bold text-white/70">{gameState.session_turn}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-amber-500/20 shrink-0">
        {([
          { id: 'anchors', label: `Memory (${totalAnchors})` },
          { id: 'quests', label: `Quests (${totalQuests})` },
          { id: 'inventory', label: `Items (${totalInventory})` },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 py-2.5 text-xs transition-colors font-medium',
              activeTab === tab.id
                ? 'text-amber-300 border-b-2 border-amber-400 bg-amber-950/20'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">

        {/* ── Memory Anchors ── */}
        {activeTab === 'anchors' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Persistent World Facts</p>
              <button
                onClick={() => setShowAddForm(prev => !prev)}
                className="flex items-center gap-1 text-[10px] text-amber-400/70 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            <AnimatePresence>
              {showAddForm && (
                <AddAnchorForm
                  onAdd={onAddAnchor}
                  onClose={() => setShowAddForm(false)}
                />
              )}
            </AnimatePresence>

            {totalAnchors === 0 && !showAddForm && (
              <div className="text-center py-8 text-white/30">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No memory anchors yet.</p>
                <p className="text-[10px] mt-1">The AI auto-populates these as your story unfolds, or add them manually.</p>
              </div>
            )}

            {CATEGORIES.map(([cat, cfg]) => {
              const anchors = anchorsByCategory[cat];
              if (!anchors || anchors.length === 0) return null;
              const Icon = cfg.icon;
              const isExpanded = expandedCat === cat;
              return (
                <div key={cat} className="space-y-1">
                  <button
                    onClick={() => setExpandedCat(isExpanded ? null : cat)}
                    className="w-full flex items-center gap-2 text-xs text-white/60 hover:text-white/90 transition-colors py-1"
                  >
                    <Icon className="w-3.5 h-3.5 text-amber-400/60" />
                    <span className="font-medium">{cfg.label}</span>
                    <span className="text-white/30 ml-auto">({anchors.length})</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-1 pl-2"
                      >
                        {anchors.map(anchor => (
                          <AnchorCard
                            key={anchor.id}
                            anchor={anchor}
                            onRemove={() => onRemoveAnchor(anchor.id)}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </>
        )}

        {/* ── Quests ── */}
        {activeTab === 'quests' && (
          <>
            {totalQuests === 0 && (
              <div className="text-center py-8 text-white/30">
                <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No quests tracked yet.</p>
                <p className="text-[10px] mt-1">Quest flags appear here as the DM narrates them.</p>
              </div>
            )}

            {activeQuests.length > 0 && (
              <div>
                <p className="text-[10px] text-amber-400/60 uppercase tracking-wider mb-2">Active</p>
                <div className="space-y-1.5">
                  {activeQuests.map(([key, q]) => (
                    <div key={key} className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/20">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-amber-200 flex-1">{key}</p>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => onSetQuestFlag(key, 'completed')}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-green-800/40 text-green-300 hover:bg-green-700/50 transition-colors"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => onSetQuestFlag(key, 'failed')}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 hover:bg-red-800/50 transition-colors"
                          >
                            Fail
                          </button>
                        </div>
                      </div>
                      {q.notes && <p className="text-[10px] text-white/50 mt-1">{q.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completedQuests.length > 0 && (
              <div>
                <p className="text-[10px] text-green-400/60 uppercase tracking-wider mb-2">Completed</p>
                <div className="space-y-1">
                  {completedQuests.map(([key]) => (
                    <div key={key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-950/20 border border-green-500/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400/60 shrink-0" />
                      <p className="text-xs text-white/40 line-through">{key}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {failedQuests.length > 0 && (
              <div>
                <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-2">Failed</p>
                <div className="space-y-1">
                  {failedQuests.map(([key]) => (
                    <div key={key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-950/20 border border-red-500/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                      <p className="text-xs text-white/40">{key}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Inventory ── */}
        {activeTab === 'inventory' && (
          <>
            {totalInventory === 0 && (
              <div className="text-center py-8 text-white/30">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No campaign items yet.</p>
                <p className="text-[10px] mt-1">Items acquired during your adventure appear here.</p>
              </div>
            )}
            <div className="space-y-1.5">
              {gameState.inventory.map(item => (
                <div key={item.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10">
                  <Package className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80">{item.name}</p>
                    <p className="text-[10px] text-white/30">{item.category} · Acquired turn {item.acquired_turn}</p>
                  </div>
                  <span className="text-xs text-amber-300/80 font-mono">×{item.quantity}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
