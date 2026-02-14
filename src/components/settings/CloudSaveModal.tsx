import { useState, useEffect, useMemo } from 'react';
import { Cloud, Download, Upload, Trash2, Loader2, LogIn, LogOut, Check, AlertCircle, Plus, Edit2, User, Sparkles, Package, Coins, Wand2, Shield, Heart, Swords } from 'lucide-react';
import { AccountSettings } from './AccountSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { useCloudSave, CloudSave } from '@/hooks/use-cloud-save';
import { SaveData } from '@/hooks/use-auto-save';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CloudSaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentData: Omit<SaveData, 'savedAt' | 'version'>;
  onLoadSave: (data: SaveData, saveId?: string) => void;
}

interface SaveSummary {
  level: number;
  gold: number;
  spellsKnown: number;
  activeSpells: number;
  conditions: number;
  lootItems: number;
  consumables: number;
  achievements: number;
  proficiencies: number;
  hasInspiration: boolean;
}

type ModalView = 'list' | 'save-new' | 'rename';

export function CloudSaveModal({ open, onOpenChange, currentData, onLoadSave }: CloudSaveModalProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth();
  const { saving, loading, cloudSaves, fetchSaves, saveToCloud, loadFromCloud, deleteCloudSave, renameSave } = useCloudSave(user?.id);
  
  const [view, setView] = useState<ModalView>('list');
  const [newSaveName, setNewSaveName] = useState('');
  const [editingSave, setEditingSave] = useState<CloudSave | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedSave, setSelectedSave] = useState<string | null>(null);

  useEffect(() => {
    if (open && isAuthenticated) {
      fetchSaves();
      setView('list');
      setNewSaveName('');
      setEditingSave(null);
      setConfirmDelete(null);
      setSelectedSave(null);
    }
  }, [open, isAuthenticated, fetchSaves]);

  // Calculate save summary from currentData
  const saveSummary = useMemo((): SaveSummary => {
    return {
      level: currentData.character?.level ?? 1,
      gold: currentData.shopGold ?? 0,
      spellsKnown: currentData.spellcasting?.knownSpells?.length ?? 0,
      activeSpells: currentData.activeSpells?.length ?? 0,
      conditions: currentData.conditions?.conditions?.length ?? 0,
      lootItems: currentData.loot?.items?.length ?? 0,
      consumables: currentData.consumables?.reduce((sum, c) => sum + c.quantity, 0) ?? 0,
      achievements: currentData.achievements?.filter(a => (a.claimedMilestones?.length ?? 0) > 0)?.length ?? 0,
      proficiencies: (currentData.proficiencies?.skills?.length ?? 0) + (currentData.proficiencies?.saves?.length ?? 0),
      hasInspiration: currentData.inspiration ?? false,
    };
  }, [currentData]);

  const handleSaveNew = async () => {
    const name = newSaveName.trim() || `${currentData.character.name || 'Character'} - ${new Date().toLocaleDateString()}`;
    const result = await saveToCloud(currentData, name);
    if (result.error) {
      toast.error('Failed to save to cloud');
    } else {
      toast.success(`Saved "${name}" to cloud!`);
      setView('list');
      setNewSaveName('');
    }
  };

  const handleOverwrite = async (save: CloudSave) => {
    const result = await saveToCloud(currentData, save.save_name, save.id);
    if (result.error) {
      toast.error('Failed to update save');
    } else {
      toast.success(`Updated "${save.save_name}"`);
    }
  };

  const handleLoad = async (save: CloudSave) => {
    const data = await loadFromCloud(save.id);
    if (data) {
      onLoadSave(data, save.id);
      toast.success(`Loaded "${save.save_name}"`);
      onOpenChange(false);
    } else {
      toast.error('Failed to load save');
    }
  };

  const handleDelete = async (saveId: string) => {
    const result = await deleteCloudSave(saveId);
    if (result.error) {
      toast.error('Failed to delete save');
    } else {
      toast.success('Save deleted');
      setConfirmDelete(null);
    }
  };

  const handleRename = async () => {
    if (!editingSave || !newSaveName.trim()) return;
    const result = await renameSave(editingSave.id, newSaveName.trim());
    if (result.error) {
      toast.error('Failed to rename save');
    } else {
      toast.success('Save renamed');
      setView('list');
      setEditingSave(null);
      setNewSaveName('');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (authLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-cinzel">
            <Cloud className="w-5 h-5 text-primary" />
            Cloud Saves
          </DialogTitle>
          <DialogDescription>
            {isAuthenticated 
              ? 'Manage your characters across all devices' 
              : 'Sign in to sync characters across devices'}
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Cloud className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Create an account to save multiple characters and access them from any device.
              </p>
            </div>
            
            <Button 
              className="w-full gap-2" 
              onClick={() => {
                onOpenChange(false);
                navigate('/auth');
              }}
            >
              <LogIn className="w-4 h-4" />
              Sign In / Sign Up
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* User Info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {user?.email?.[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium truncate max-w-[180px]">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{cloudSaves.length} character{cloudSaves.length !== 1 ? 's' : ''} saved</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            {/* Account Settings */}
            <AccountSettings userEmail={user?.email ?? ''} />

            {/* View: Save New Character */}
            {view === 'save-new' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setView('list')}>
                    ← Back
                  </Button>
                  <span className="text-sm font-medium">Save New Character</span>
                </div>
                
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="font-medium">{currentData.character.name || 'Unnamed'}</span>
                    <Badge variant="outline" className="text-xs">Lvl {currentData.character.level}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">This character will be saved to the cloud</p>
                </div>
                
                <Input
                  placeholder="Save name (optional)"
                  value={newSaveName}
                  onChange={(e) => setNewSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNew()}
                />

                {/* Save Summary */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Package className="w-3 h-3" />
                    Data to be saved:
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <Coins className="w-3 h-3 text-primary" />
                            <span>{saveSummary.gold.toLocaleString()} gold</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">Shop gold balance</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <Wand2 className="w-3 h-3 text-accent" />
                            <span>{saveSummary.spellsKnown} spells</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">Known spells in spellbook</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3 h-3 text-secondary-foreground" />
                            <span>{saveSummary.lootItems} loot items</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">Items in loot inventory</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <Heart className="w-3 h-3 text-destructive" />
                            <span>{saveSummary.consumables} consumables</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">Potions & consumable items</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <Shield className="w-3 h-3 text-muted-foreground" />
                            <span>{saveSummary.proficiencies} proficiencies</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">Skill & save proficiencies</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <Swords className="w-3 h-3 text-primary/80" />
                            <span>{saveSummary.conditions} conditions</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">Active buffs/debuffs</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {saveSummary.hasInspiration && (
                    <div className="flex items-center gap-1.5 text-xs text-primary">
                      <Sparkles className="w-3 h-3" />
                      <span>Has Inspiration</span>
                    </div>
                  )}
                </div>
                
                <Button className="w-full gap-2" onClick={handleSaveNew} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Save to Cloud
                </Button>
              </div>
            )}

            {/* View: Rename */}
            {view === 'rename' && editingSave && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setView('list'); setEditingSave(null); }}>
                    ← Back
                  </Button>
                  <span className="text-sm font-medium">Rename Save</span>
                </div>
                
                <Input
                  placeholder="New name"
                  value={newSaveName}
                  onChange={(e) => setNewSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  autoFocus
                />
                
                <Button className="w-full" onClick={handleRename} disabled={!newSaveName.trim()}>
                  Save Name
                </Button>
              </div>
            )}

            {/* View: List */}
            {view === 'list' && (
              <>
                {/* Action Buttons */}
                <Button 
                  className="w-full gap-2" 
                  onClick={() => setView('save-new')}
                >
                  <Plus className="w-4 h-4" />
                  Save Current Character
                </Button>

                <Separator />

                {/* Saves List */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Your Characters
                  </h4>
                  
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : cloudSaves.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No characters saved yet</p>
                      <p className="text-xs mt-1">Save your current character to get started!</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[240px]">
                      <div className="space-y-2 pr-2">
                        {cloudSaves.map((save) => (
                          <div 
                            key={save.id}
                            className={cn(
                              "p-3 rounded-lg border transition-all",
                              confirmDelete === save.id 
                                ? "border-destructive/50 bg-destructive/10" 
                                : selectedSave === save.id
                                ? "border-primary/50 bg-primary/5"
                                : "border-border/50 bg-muted/20 hover:bg-muted/40"
                            )}
                            onClick={() => setSelectedSave(selectedSave === save.id ? null : save.id)}
                          >
                            {confirmDelete === save.id ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-destructive">
                                  <AlertCircle className="w-4 h-4" />
                                  <span className="text-sm">Delete?</span>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(save.id); }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{save.save_name}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{formatDate(save.updated_at)}</span>
                                </div>
                                
                                <div className="flex items-center gap-2 mb-2">
                                  {save.character_name && (
                                    <Badge variant="secondary" className="text-xs">
                                      {save.character_name}
                                    </Badge>
                                  )}
                                  {save.character_level && (
                                    <Badge variant="outline" className="text-xs">
                                      Lvl {save.character_level}
                                    </Badge>
                                  )}
                                </div>
                                
                                {/* Data preview - show on hover or when selected */}
                                {save.preview && (
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                                    {save.preview.gold !== undefined && save.preview.gold > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Coins className="w-2.5 h-2.5 text-primary" />
                                        {save.preview.gold.toLocaleString()}g
                                      </span>
                                    )}
                                    {save.preview.spellsKnown !== undefined && save.preview.spellsKnown > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Wand2 className="w-2.5 h-2.5 text-accent" />
                                        {save.preview.spellsKnown} spells
                                      </span>
                                    )}
                                    {save.preview.lootItems !== undefined && save.preview.lootItems > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Package className="w-2.5 h-2.5 text-secondary-foreground" />
                                        {save.preview.lootItems} loot
                                      </span>
                                    )}
                                    {save.preview.consumables !== undefined && save.preview.consumables > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Heart className="w-2.5 h-2.5 text-destructive" />
                                        {save.preview.consumables}
                                      </span>
                                    )}
                                    {save.preview.conditions !== undefined && save.preview.conditions > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Swords className="w-2.5 h-2.5 text-primary/80" />
                                        {save.preview.conditions}
                                      </span>
                                    )}
                                    {save.preview.hasInspiration && (
                                      <span className="flex items-center gap-0.5 text-primary">
                                        <Sparkles className="w-2.5 h-2.5" />
                                        Insp
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {selectedSave === save.id && (
                                  <div className="flex gap-1 mt-2 pt-2 border-t border-border/30">
                                    <Button 
                                      variant="default"
                                      size="sm"
                                      className="flex-1 gap-1"
                                      onClick={(e) => { e.stopPropagation(); handleLoad(save); }}
                                      disabled={loading}
                                    >
                                      <Download className="w-3 h-3" />
                                      Load
                                    </Button>
                                    <Button 
                                      variant="secondary"
                                      size="sm"
                                      className="flex-1 gap-1"
                                      onClick={(e) => { e.stopPropagation(); handleOverwrite(save); }}
                                      disabled={saving}
                                    >
                                      <Upload className="w-3 h-3" />
                                      Overwrite
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setEditingSave(save); 
                                        setNewSaveName(save.save_name);
                                        setView('rename'); 
                                      }}
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(save.id); }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Auto-save indicator */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                  <Check className="w-3 h-3 text-secondary-foreground" />
                  Local auto-save is always active
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
