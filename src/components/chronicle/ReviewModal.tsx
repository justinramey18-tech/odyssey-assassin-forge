// Chronicle Sync Review Modal
// Detailed review interface with batch operations

import { useState, useMemo } from 'react';
import { X, Check, Filter, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ReviewableChange, ChangeCategory, ConfidenceLevel } from '@/lib/chronicleSync/types';
import { ParseResultCard } from './ParseResultCard';

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: ReviewableChange[];
  onUpdateChanges: (changes: ReviewableChange[]) => void;
  onApplyApproved: () => void;
}

export function ReviewModal({ 
  open, 
  onOpenChange, 
  changes, 
  onUpdateChanges,
  onApplyApproved,
}: ReviewModalProps) {
  const [filterCategory, setFilterCategory] = useState<ChangeCategory | 'all'>('all');
  
  const filteredChanges = useMemo(() => {
    if (filterCategory === 'all') return changes;
    return changes.filter(c => c.category === filterCategory);
  }, [changes, filterCategory]);
  
  const approvedCount = changes.filter(c => c.approved).length;
  const totalCount = changes.length;
  
  const handleToggleApproval = (id: string) => {
    const updated = changes.map(c => 
      c.id === id ? { ...c, approved: !c.approved } : c
    );
    onUpdateChanges(updated);
  };
  
  const handleApproveByConfidence = (confidence: ConfidenceLevel) => {
    const updated = changes.map(c => ({
      ...c,
      approved: c.confidence === confidence ? true : c.approved,
    }));
    onUpdateChanges(updated);
  };
  
  const handleRejectByConfidence = (confidence: ConfidenceLevel) => {
    const updated = changes.map(c => ({
      ...c,
      approved: c.confidence === confidence ? false : c.approved,
    }));
    onUpdateChanges(updated);
  };
  
  const handleApproveAll = () => {
    const updated = changes.map(c => ({ ...c, approved: true }));
    onUpdateChanges(updated);
  };
  
  const handleRejectAll = () => {
    const updated = changes.map(c => ({ ...c, approved: false }));
    onUpdateChanges(updated);
  };
  
  const categoryCounts = useMemo(() => ({
    xp: changes.filter(c => c.category === 'xp').length,
    achievement: changes.filter(c => c.category === 'achievement').length,
    item: changes.filter(c => c.category === 'item').length,
    levelUp: changes.filter(c => c.category === 'levelUp').length,
  }), [changes]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-zinc-900 border-blue-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-blue-400">Review Changes</span>
            <span className="text-sm font-normal text-muted-foreground">
              {approvedCount} / {totalCount} approved
            </span>
          </DialogTitle>
        </DialogHeader>
        
        {/* Batch Operations */}
        <div className="flex flex-wrap gap-2 py-2 border-b border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleApproveByConfidence('high')}
            className="gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <CheckCircle className="w-3 h-3" />
            Approve High
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRejectByConfidence('low')}
            className="gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            <XCircle className="w-3 h-3" />
            Reject Low
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleApproveAll}
            className="gap-1"
          >
            <Check className="w-3 h-3" />
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRejectAll}
            className="gap-1 text-muted-foreground"
          >
            <X className="w-3 h-3" />
            None
          </Button>
        </div>
        
        {/* Category Filter */}
        <Tabs value={filterCategory} onValueChange={(v) => setFilterCategory(v as ChangeCategory | 'all')}>
          <TabsList className="grid grid-cols-5 bg-zinc-800/50">
            <TabsTrigger value="all" className="text-xs">
              All ({totalCount})
            </TabsTrigger>
            <TabsTrigger value="xp" className="text-xs" disabled={categoryCounts.xp === 0}>
              XP ({categoryCounts.xp})
            </TabsTrigger>
            <TabsTrigger value="achievement" className="text-xs" disabled={categoryCounts.achievement === 0}>
              Feats ({categoryCounts.achievement})
            </TabsTrigger>
            <TabsTrigger value="item" className="text-xs" disabled={categoryCounts.item === 0}>
              Items ({categoryCounts.item})
            </TabsTrigger>
            <TabsTrigger value="levelUp" className="text-xs" disabled={categoryCounts.levelUp === 0}>
              Level ({categoryCounts.levelUp})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Changes List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-2 py-2">
            {filteredChanges.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No changes in this category
              </p>
            ) : (
              filteredChanges.map(change => (
                <ParseResultCard
                  key={change.id}
                  change={change}
                  onToggleApproval={handleToggleApproval}
                />
              ))
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={onApplyApproved}
            disabled={approvedCount === 0}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white"
          >
            Apply {approvedCount} Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
