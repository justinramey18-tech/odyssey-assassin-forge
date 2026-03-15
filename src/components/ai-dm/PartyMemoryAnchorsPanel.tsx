import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Brain, MapPin, User, Scroll, Shield, Skull, Lock, Lightbulb, MessageCircle } from 'lucide-react';
import type { MemoryAnchor, MemoryAnchorCategory } from '@/hooks/use-dm-game-state';
import { toast } from 'sonner';

const CATEGORY_CONFIG: Record<MemoryAnchorCategory, { label: string; icon: React.ReactNode; color: string }> = {
  npc: { label: 'NPC', icon: <User className="w-3.5 h-3.5" />, color: 'text-blue-400' },
  location: { label: 'Location', icon: <MapPin className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
  quest: { label: 'Quest', icon: <Scroll className="w-3.5 h-3.5" />, color: 'text-amber-400' },
  fact: { label: 'Fact', icon: <Lightbulb className="w-3.5 h-3.5" />, color: 'text-yellow-400' },
  secret: { label: 'Secret', icon: <Lock className="w-3.5 h-3.5" />, color: 'text-purple-400' },
  reputation: { label: 'Reputation', icon: <Shield className="w-3.5 h-3.5" />, color: 'text-cyan-400' },
  debt: { label: 'Debt', icon: <Skull className="w-3.5 h-3.5" />, color: 'text-red-400' },
  injury: { label: 'Injury', icon: <Skull className="w-3.5 h-3.5" />, color: 'text-orange-400' },
  subtext: { label: 'Subtext', icon: <MessageCircle className="w-3.5 h-3.5" />, color: 'text-pink-400' },
};

const ALL_CATEGORIES: MemoryAnchorCategory[] = ['npc', 'location', 'quest', 'fact', 'secret', 'reputation', 'debt', 'injury', 'subtext'];

interface PartyMemoryAnchorsPanelProps {
  anchors: MemoryAnchor[];
  onAdd: (anchor: Omit<MemoryAnchor, 'id' | 'turn' | 'created_at'>) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  isCreator: boolean;
}

export function PartyMemoryAnchorsPanel({ anchors, onAdd, onRemove, onBack, isCreator }: PartyMemoryAnchorsPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState<MemoryAnchorCategory>('npc');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [filterCategory, setFilterCategory] = useState<MemoryAnchorCategory | 'all'>('all');

  const handleAdd = () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error('Name and description are required');
      return;
    }
    onAdd({ category: newCategory, key: newKey.trim(), value: newValue.trim() });
    setNewKey('');
    setNewValue('');
    setShowAdd(false);
    toast.success('Memory anchor added');
  };

  const filtered = filterCategory === 'all'
    ? anchors
    : anchors.filter(a => a.category === filterCategory);

  // Group by category
  const grouped = filtered.reduce((acc, anchor) => {
    if (!acc[anchor.category]) acc[anchor.category] = [];
    acc[anchor.category].push(anchor);
    return acc;
  }, {} as Record<string, MemoryAnchor[]>);

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted/20 transition-colors" style={{ touchAction: 'manipulation' }}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <Brain className="w-5 h-5 text-purple-400" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-cinzel font-bold text-foreground">Memory Anchors</h2>
          <p className="text-[10px] text-muted-foreground">Long-term campaign facts the Oracle remembers</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{anchors.length}/50</span>
      </div>

      {/* Filter bar */}
      <div className="px-3 py-2 flex gap-1.5 overflow-x-auto shrink-0 border-b border-border/50">
        <button
          onClick={() => setFilterCategory('all')}
          className={cn(
            "shrink-0 text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors",
            filterCategory === 'all'
              ? "bg-primary/20 text-primary"
              : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
          )}
          style={{ touchAction: 'manipulation' }}
        >
          All ({anchors.length})
        </button>
        {ALL_CATEGORIES.map(cat => {
          const count = anchors.filter(a => a.category === cat).length;
          if (count === 0) return null;
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "shrink-0 text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1",
                filterCategory === cat
                  ? "bg-primary/20 text-primary"
                  : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <span className={cfg.color}>{cfg.icon}</span>
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Anchors list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No memory anchors yet</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[240px]">
              {isCreator
                ? 'Add NPCs, locations, quests, and other facts the Oracle should remember across sessions.'
                : 'The host can add campaign facts that the Oracle will reference during advice.'}
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([category, catAnchors]) => {
            const cfg = CATEGORY_CONFIG[category as MemoryAnchorCategory];
            return (
              <div key={category}>
                <div className="flex items-center gap-1.5 px-1 py-1.5">
                  <span className={cfg.color}>{cfg.icon}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{cfg.label}</span>
                </div>
                {catAnchors.map(anchor => (
                  <div
                    key={anchor.id}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border/30 mb-1"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{anchor.key}</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{anchor.value}</p>
                    </div>
                    {isCreator && (
                      <button
                        onClick={() => onRemove(anchor.id)}
                        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Add form */}
      {isCreator && (
        <div className="shrink-0 border-t border-border">
          {showAdd ? (
            <div className="px-3 py-3 space-y-2.5">
              <div className="flex gap-2">
                <Select value={newCategory} onValueChange={(v) => setNewCategory(v as MemoryAnchorCategory)}>
                  <SelectTrigger className="w-[110px] h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map(cat => {
                      const cfg = CATEGORY_CONFIG[cat];
                      return (
                        <SelectItem key={cat} value={cat} className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className={cfg.color}>{cfg.icon}</span>
                            {cfg.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Name (e.g. Mira the Innkeeper)"
                  className="flex-1 h-9 text-sm"
                  maxLength={80}
                />
              </div>
              <Textarea
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Description (e.g. Distrusts the party after the tavern incident)"
                className="text-sm min-h-[60px] resize-none"
                maxLength={300}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{newValue.length}/300</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setNewKey(''); setNewValue(''); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={!newKey.trim() || !newValue.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <Plus className="w-4 h-4" />
              Add Memory Anchor
            </button>
          )}
        </div>
      )}
    </div>
  );
}
