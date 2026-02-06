import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, Cloud, Loader2, LogIn, User, Settings, Trash2, 
  Coins, Wand2, Package, Heart, Swords, Sparkles, Edit3, Check, X
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useCloudSave, CloudSave, CloudSavePreview } from '@/hooks/use-cloud-save';
import { SaveData } from '@/hooks/use-auto-save';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CharacterSavesDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentCharacterName: string;
  currentCharacterLevel: number;
  onLoadSave: (data: SaveData) => void;
  onOpenCloudSettings: () => void;
}

// Preview icons component
function SavePreviewIcons({ preview }: { preview?: CloudSavePreview }) {
  if (!preview) return null;
  
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
      {preview.gold !== undefined && preview.gold > 0 && (
        <span className="flex items-center gap-0.5">
          <Coins className="w-2.5 h-2.5 text-primary" />
          {preview.gold.toLocaleString()}g
        </span>
      )}
      {preview.spellsKnown !== undefined && preview.spellsKnown > 0 && (
        <span className="flex items-center gap-0.5">
          <Wand2 className="w-2.5 h-2.5 text-accent" />
          {preview.spellsKnown}
        </span>
      )}
      {preview.lootItems !== undefined && preview.lootItems > 0 && (
        <span className="flex items-center gap-0.5">
          <Package className="w-2.5 h-2.5 text-secondary-foreground" />
          {preview.lootItems}
        </span>
      )}
      {preview.consumables !== undefined && preview.consumables > 0 && (
        <span className="flex items-center gap-0.5">
          <Heart className="w-2.5 h-2.5 text-destructive" />
          {preview.consumables}
        </span>
      )}
      {preview.conditions !== undefined && preview.conditions > 0 && (
        <span className="flex items-center gap-0.5">
          <Swords className="w-2.5 h-2.5 text-primary/80" />
          {preview.conditions}
        </span>
      )}
      {preview.hasInspiration && (
        <span className="flex items-center gap-0.5 text-primary">
          <Sparkles className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
  );
}

export function CharacterSavesDrawer({
  isOpen,
  onOpenChange,
  currentCharacterName,
  currentCharacterLevel,
  onLoadSave,
  onOpenCloudSettings,
}: CharacterSavesDrawerProps) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { loading, cloudSaves, fetchSaves, loadFromCloud, deleteCloudSave, renameSave } = useCloudSave(user?.id);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Fetch saves when drawer opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchSaves();
    }
  }, [isOpen, isAuthenticated, fetchSaves]);

  const handleLoadCharacter = async (save: CloudSave) => {
    const data = await loadFromCloud(save.id);
    if (data) {
      onLoadSave(data);
      toast.success(`Loaded "${save.character_name || save.save_name}"`);
      onOpenChange(false);
    } else {
      toast.error('Failed to load character');
    }
  };

  const handleStartRename = (save: CloudSave) => {
    setEditingId(save.id);
    setEditName(save.save_name);
  };

  const handleSaveRename = async () => {
    if (!editingId || !editName.trim()) return;
    
    const { error } = await renameSave(editingId, editName.trim());
    if (error) {
      toast.error('Failed to rename save');
    } else {
      toast.success('Save renamed');
    }
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    
    const { error } = await deleteCloudSave(deleteConfirmId);
    if (error) {
      toast.error('Failed to delete save');
    } else {
      toast.success('Save deleted');
    }
    setDeleteConfirmId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent 
          side="left" 
          className="w-[320px] sm:w-[380px] p-0 border-r-primary/30 bg-background/95 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="p-4 border-b border-border/50">
            <SheetTitle className="font-cinzel text-lg flex items-center gap-2">
              <Cloud className="w-5 h-5 text-primary" />
              Saved Characters
            </SheetTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Select a character to load
            </p>
          </div>

          {/* Current Character */}
          <div className="px-4 py-3 bg-primary/5 border-b border-border/50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Currently playing:</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <User className="w-4 h-4 text-primary" />
              <span className="font-medium">{currentCharacterName || 'Unnamed'}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/40">
                Lvl {currentCharacterLevel}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 h-[calc(100vh-200px)]">
            <div className="p-4">
              {!isAuthenticated ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <LogIn className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-cinzel font-bold mb-2">Sign In Required</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-[200px]">
                    Create an account to save and sync characters across devices
                  </p>
                  <Button 
                    onClick={() => {
                      onOpenChange(false);
                      onOpenCloudSettings();
                    }}
                    className="w-full max-w-[200px]"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                </motion.div>
              ) : authLoading || loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : cloudSaves.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <Cloud className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-cinzel font-bold mb-2">No Saved Characters</h3>
                  <p className="text-sm text-muted-foreground max-w-[200px]">
                    Your character will auto-save to the cloud while playing
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {cloudSaves.map((save, index) => (
                      <motion.div
                        key={save.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        onMouseEnter={() => setHoveredId(save.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className={cn(
                          "relative p-3 rounded-lg border bg-card/50 transition-all",
                          "hover:bg-card hover:border-primary/40 cursor-pointer",
                          hoveredId === save.id && "ring-1 ring-primary/30"
                        )}
                        onClick={() => editingId !== save.id && handleLoadCharacter(save)}
                      >
                        {/* Edit mode */}
                        {editingId === save.id ? (
                          <div 
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 shrink-0"
                              onClick={handleSaveRename}
                            >
                              <Check className="w-4 h-4 text-emerald-500" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 shrink-0"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            {/* Normal view */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <User className="w-4 h-4 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm truncate">
                                      {save.character_name || save.save_name}
                                    </p>
                                    {save.character_level && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                                        Lvl {save.character_level}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatDate(save.updated_at)}
                                  </p>
                                  
                                  {/* Preview icons - always visible */}
                                  <SavePreviewIcons preview={save.preview} />
                                </div>
                              </div>

                              {/* Action buttons - shown on hover */}
                              <AnimatePresence>
                                {hoveredId === save.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex items-center gap-1 ml-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => handleStartRename(save)}
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">Rename</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => setDeleteConfirmId(save.id)}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">Delete</TooltipContent>
                                    </Tooltip>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/50 bg-background/90 backdrop-blur-sm">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onOpenCloudSettings();
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage Cloud Saves
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Save?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The saved character data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Hamburger trigger button component
export function CharacterSavesTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border-2 border-primary/40",
        "bg-black/40 backdrop-blur-sm",
        "hover:bg-black/60 hover:border-primary/60",
        "transition-all duration-300",
        "hover:shadow-[0_0_15px_rgba(220,38,38,0.2)]"
      )}
      style={{ touchAction: 'manipulation' }}
      aria-label="Open character saves"
    >
      <Menu className="w-6 h-6 text-primary" />
    </button>
  );
}
