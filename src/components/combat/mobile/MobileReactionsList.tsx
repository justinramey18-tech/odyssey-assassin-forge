import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Sword,
  Footprints,
  Sparkles,
  Star,
  Plus,
  Copy,
  ChevronDown,
  ChevronRight,
  Search,
  Settings2,
  Zap,
  Check,
  Trash2,
  Edit3,
} from 'lucide-react';
import {
  Reaction,
  ReactionCategory,
  REACTION_CATEGORIES,
  DEFAULT_REACTIONS,
  REACTIONS_STORAGE_KEY,
  getReactionsByCategory,
  countEnabledByCategory,
  generateReactionClipboard,
} from '@/lib/combat/reactions';

// Icon mapping for categories
const CATEGORY_ICONS: Record<ReactionCategory, React.ElementType> = {
  defensive: Shield,
  offensive: Sword,
  movement: Footprints,
  utility: Sparkles,
  class_features: Star,
  custom: Plus,
};

// Color mapping for categories
const CATEGORY_COLORS: Record<ReactionCategory, string> = {
  defensive: 'cyan',
  offensive: 'red',
  movement: 'green',
  utility: 'amber',
  class_features: 'purple',
  custom: 'slate',
};

interface MobileReactionsListProps {
  onUseReaction: (reaction: Reaction) => void;
}

export function MobileReactionsList({ onUseReaction }: MobileReactionsListProps) {
  const { toast } = useToast();
  const [reactions, setReactions] = useState<Reaction[]>(() => {
    try {
      const saved = localStorage.getItem(REACTIONS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_REACTIONS;
    } catch {
      return DEFAULT_REACTIONS;
    }
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ReactionCategory | 'all'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isConfigMode, setIsConfigMode] = useState(false);
  const [editingReaction, setEditingReaction] = useState<Reaction | null>(null);
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // Save reactions to localStorage
  const saveReactions = useCallback((updated: Reaction[]) => {
    setReactions(updated);
    try {
      localStorage.setItem(REACTIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save reactions:', e);
    }
  }, []);

  // Filter reactions
  const filteredReactions = useMemo(() => {
    let filtered = reactions;
    
    // Filter by category
    if (activeCategory !== 'all') {
      filtered = getReactionsByCategory(filtered, activeCategory);
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(query) ||
        r.trigger.toLowerCase().includes(query) ||
        r.effect.toLowerCase().includes(query)
      );
    }
    
    // In normal mode, only show enabled reactions
    if (!isConfigMode) {
      filtered = filtered.filter(r => r.isEnabled);
    }
    
    return filtered;
  }, [reactions, activeCategory, searchQuery, isConfigMode]);

  // Count enabled by category
  const enabledCounts = useMemo(() => countEnabledByCategory(reactions), [reactions]);

  // Toggle reaction enabled state
  const toggleReaction = useCallback((id: string) => {
    const updated = reactions.map(r => 
      r.id === id ? { ...r, isEnabled: !r.isEnabled } : r
    );
    saveReactions(updated);
  }, [reactions, saveReactions]);

  // Toggle expanded state
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Copy reaction prompt to clipboard
  const copyToClipboard = useCallback((reaction: Reaction) => {
    const text = generateReactionClipboard(reaction);
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: `${reaction.name} prompt copied to clipboard`,
        duration: 2000,
      });
    });
  }, [toast]);

  // Use a reaction (mark as used this round)
  const handleUseReaction = useCallback((reaction: Reaction) => {
    onUseReaction(reaction);
    toast({
      title: `⚡ ${reaction.name}`,
      description: "Reaction used! Copy prompt for AI DM.",
      className: "border-cyan-500/50 bg-cyan-500/10",
      duration: 3000,
    });
  }, [onUseReaction, toast]);

  // Add custom reaction
  const handleAddCustom = useCallback((newReaction: Omit<Reaction, 'id' | 'isCustom'>) => {
    const customReaction: Reaction = {
      ...newReaction,
      id: `custom_${Date.now()}`,
      isCustom: true,
    };
    saveReactions([...reactions, customReaction]);
    setIsAddingCustom(false);
    toast({
      title: "Custom Reaction Added",
      description: `${newReaction.name} added to your reactions`,
    });
  }, [reactions, saveReactions, toast]);

  // Delete custom reaction
  const deleteCustomReaction = useCallback((id: string) => {
    const updated = reactions.filter(r => r.id !== id);
    saveReactions(updated);
    toast({
      title: "Reaction Removed",
      description: "Custom reaction deleted",
    });
  }, [reactions, saveReactions, toast]);

  // Update custom reaction
  const updateReaction = useCallback((updated: Reaction) => {
    const newReactions = reactions.map(r => r.id === updated.id ? updated : r);
    saveReactions(newReactions);
    setEditingReaction(null);
    toast({
      title: "Reaction Updated",
      description: `${updated.name} has been saved`,
    });
  }, [reactions, saveReactions, toast]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    saveReactions(DEFAULT_REACTIONS);
    toast({
      title: "Reactions Reset",
      description: "All reactions restored to defaults",
    });
  }, [saveReactions, toast]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and config toggle */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-muted/20 p-3 space-y-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reactions..."
              className="h-10 pl-10 bg-black/30 border-muted/30 rounded-xl"
            />
          </div>
          <Button
            variant={isConfigMode ? "default" : "outline"}
            size="icon"
            onClick={() => setIsConfigMode(!isConfigMode)}
            className={cn(
              "h-10 w-10",
              isConfigMode && "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
            )}
          >
            <Settings2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3">
          <CategoryPill
            label="All"
            count={reactions.filter(r => r.isEnabled).length}
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
            color="slate"
          />
          {(Object.keys(REACTION_CATEGORIES) as ReactionCategory[]).map(cat => (
            <CategoryPill
              key={cat}
              label={REACTION_CATEGORIES[cat].label}
              count={enabledCounts[cat]}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              color={CATEGORY_COLORS[cat]}
              icon={CATEGORY_ICONS[cat]}
            />
          ))}
        </div>

        {/* Config mode actions */}
        {isConfigMode && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingCustom(true)}
              className="flex-1 h-9 border-green-500/30 text-green-400"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Custom
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              className="h-9 border-red-500/30 text-red-400"
            >
              Reset
            </Button>
          </div>
        )}
      </div>

      {/* Reactions list */}
      <div className="flex-1 overflow-auto p-3 pb-24 space-y-2">
        {filteredReactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {isConfigMode 
                ? "No reactions match your search" 
                : "No reactions enabled"}
            </p>
            <p className="text-[11px] text-cyan-400 mt-2 italic">
              {isConfigMode 
                ? "Try a different search term" 
                : "\"Tap the gear to enable reactions, genius.\""}
            </p>
          </div>
        ) : (
          filteredReactions.map(reaction => (
            <ReactionCard
              key={reaction.id}
              reaction={reaction}
              isExpanded={expandedIds.has(reaction.id)}
              isConfigMode={isConfigMode}
              onToggleExpand={() => toggleExpanded(reaction.id)}
              onToggleEnabled={() => toggleReaction(reaction.id)}
              onUse={() => handleUseReaction(reaction)}
              onCopy={() => copyToClipboard(reaction)}
              onEdit={() => setEditingReaction(reaction)}
              onDelete={() => deleteCustomReaction(reaction.id)}
            />
          ))
        )}
      </div>

      {/* Add Custom Reaction Sheet */}
      <Sheet open={isAddingCustom} onOpenChange={setIsAddingCustom}>
        <SheetContent side="bottom" className="h-[80vh]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>Add Custom Reaction</SheetTitle>
          </SheetHeader>
          <CustomReactionForm
            onSubmit={handleAddCustom}
            onCancel={() => setIsAddingCustom(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Edit Reaction Sheet */}
      <Sheet open={!!editingReaction} onOpenChange={(open) => !open && setEditingReaction(null)}>
        <SheetContent side="bottom" className="h-[80vh]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>Edit Reaction</SheetTitle>
          </SheetHeader>
          {editingReaction && (
            <CustomReactionForm
              initialValues={editingReaction}
              onSubmit={updateReaction}
              onCancel={() => setEditingReaction(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Category pill component
function CategoryPill({
  label,
  count,
  active,
  onClick,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color: string;
  icon?: React.ElementType;
}) {
  const colorClasses: Record<string, { active: string; inactive: string }> = {
    slate: { active: 'bg-slate-500/20 border-slate-500/50 text-slate-300', inactive: 'text-slate-400' },
    cyan: { active: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300', inactive: 'text-cyan-400' },
    red: { active: 'bg-red-500/20 border-red-500/50 text-red-300', inactive: 'text-red-400' },
    green: { active: 'bg-green-500/20 border-green-500/50 text-green-300', inactive: 'text-green-400' },
    amber: { active: 'bg-amber-500/20 border-amber-500/50 text-amber-300', inactive: 'text-amber-400' },
    purple: { active: 'bg-purple-500/20 border-purple-500/50 text-purple-300', inactive: 'text-purple-400' },
  };

  const classes = colorClasses[color] || colorClasses.slate;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition-all border",
        active ? classes.active : "bg-muted/10 border-muted/20 text-muted-foreground"
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
      {count > 0 && (
        <span className={cn(
          "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]",
          active ? "bg-white/10" : "bg-muted/30"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

// Reaction card component
function ReactionCard({
  reaction,
  isExpanded,
  isConfigMode,
  onToggleExpand,
  onToggleEnabled,
  onUse,
  onCopy,
  onEdit,
  onDelete,
}: {
  reaction: Reaction;
  isExpanded: boolean;
  isConfigMode: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onUse: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const category = REACTION_CATEGORIES[reaction.category];
  const Icon = CATEGORY_ICONS[reaction.category];
  const color = CATEGORY_COLORS[reaction.category];

  const colorClasses: Record<string, string> = {
    cyan: 'border-l-cyan-500 bg-cyan-500/5',
    red: 'border-l-red-500 bg-red-500/5',
    green: 'border-l-green-500 bg-green-500/5',
    amber: 'border-l-amber-500 bg-amber-500/5',
    purple: 'border-l-purple-500 bg-purple-500/5',
    slate: 'border-l-slate-500 bg-slate-500/5',
  };

  const iconColorClasses: Record<string, string> = {
    cyan: 'text-cyan-400',
    red: 'text-red-400',
    green: 'text-green-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
    slate: 'text-slate-400',
  };

  return (
    <div className={cn(
      "rounded-xl border border-muted/30 border-l-4 overflow-hidden transition-all",
      colorClasses[color],
      !reaction.isEnabled && "opacity-50"
    )}>
      {/* Header row */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 p-4 text-left active:bg-muted/10"
      >
        <div className={cn("p-2 rounded-lg bg-black/20", iconColorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{reaction.name}</span>
            {reaction.isCustom && (
              <Badge variant="outline" className="text-[9px] h-4">Custom</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {reaction.trigger}
          </p>
        </div>

        {isConfigMode ? (
          <Switch
            checked={reaction.isEnabled}
            onCheckedChange={onToggleEnabled}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <ChevronDown className={cn(
            "w-5 h-5 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )} />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-muted/20 pt-3">
          {/* Effect */}
          <div>
            <div className="text-[10px] font-mono text-muted-foreground mb-1">EFFECT</div>
            <p className="text-sm">{reaction.effect}</p>
          </div>

          {/* Prerequisite */}
          {reaction.prerequisite && (
            <div>
              <div className="text-[10px] font-mono text-amber-400 mb-1">REQUIRES</div>
              <p className="text-xs text-muted-foreground">{reaction.prerequisite}</p>
            </div>
          )}

          {/* Source */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">
              {reaction.source}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {category.label}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {!isConfigMode && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onUse}
                  className="flex-1 h-10 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Use Reaction
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onCopy}
                  className="h-10 w-10"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </>
            )}

            {isConfigMode && reaction.isCustom && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  className="flex-1 h-9"
                >
                  <Edit3 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onDelete}
                  className="h-9 w-9 border-red-500/30 text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom reaction form
function CustomReactionForm({
  initialValues,
  onSubmit,
  onCancel,
}: {
  initialValues?: Reaction;
  onSubmit: (reaction: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialValues?.name || '');
  const [category, setCategory] = useState<ReactionCategory>(initialValues?.category || 'custom');
  const [trigger, setTrigger] = useState(initialValues?.trigger || '');
  const [effect, setEffect] = useState(initialValues?.effect || '');
  const [source, setSource] = useState(initialValues?.source || 'Homebrew');
  const [dmPrompt, setDmPrompt] = useState(initialValues?.dmPrompt || '');
  const [prerequisite, setPrerequisite] = useState(initialValues?.prerequisite || '');

  const handleSubmit = () => {
    if (!name.trim() || !trigger.trim() || !effect.trim()) return;
    
    const reaction = {
      ...(initialValues || {}),
      name: name.trim(),
      category,
      trigger: trigger.trim(),
      effect: effect.trim(),
      source: source.trim() || 'Homebrew',
      dmPrompt: dmPrompt.trim() || `## ${name}\n\n**Trigger:** ${trigger}\n\n**Effect:** ${effect}`,
      prerequisite: prerequisite.trim() || undefined,
      isEnabled: initialValues?.isEnabled ?? true,
    };
    
    onSubmit(reaction);
  };

  return (
    <div className="space-y-4 py-4 overflow-auto max-h-[60vh]">
      <div className="space-y-2">
        <label className="text-xs font-mono text-muted-foreground">NAME *</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Reaction name"
          className="bg-black/30"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono text-muted-foreground">CATEGORY</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REACTION_CATEGORIES) as ReactionCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-mono border transition-all",
                category === cat 
                  ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                  : "bg-muted/10 border-muted/30 text-muted-foreground"
              )}
            >
              {REACTION_CATEGORIES[cat].label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono text-muted-foreground">TRIGGER *</label>
        <Textarea
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="When does this reaction trigger?"
          className="bg-black/30 min-h-[60px]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono text-muted-foreground">EFFECT *</label>
        <Textarea
          value={effect}
          onChange={(e) => setEffect(e.target.value)}
          placeholder="What happens when you use this reaction?"
          className="bg-black/30 min-h-[60px]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono text-muted-foreground">SOURCE</label>
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g., PHB, Homebrew, Feat name"
          className="bg-black/30"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono text-muted-foreground">PREREQUISITE (Optional)</label>
        <Input
          value={prerequisite}
          onChange={(e) => setPrerequisite(e.target.value)}
          placeholder="e.g., Sentinel feat, 5th level"
          className="bg-black/30"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono text-muted-foreground">AI DM PROMPT (Optional)</label>
        <Textarea
          value={dmPrompt}
          onChange={(e) => setDmPrompt(e.target.value)}
          placeholder="Custom prompt for AI DM..."
          className="bg-black/30 min-h-[100px]"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!name.trim() || !trigger.trim() || !effect.trim()}
          className="flex-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
        >
          <Check className="w-4 h-4 mr-1" />
          {initialValues ? 'Save Changes' : 'Add Reaction'}
        </Button>
      </div>
    </div>
  );
}
