import { useState, useEffect } from 'react';
import { Cloud, Download, Upload, Trash2, Loader2, LogIn, LogOut, Check, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
  onLoadSave: (data: SaveData) => void;
}

export function CloudSaveModal({ open, onOpenChange, currentData, onLoadSave }: CloudSaveModalProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth();
  const { saving, loading, cloudSaves, fetchSaves, saveToCloud, loadFromCloud, deleteCloudSave } = useCloudSave(user?.id);
  
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (open && isAuthenticated) {
      fetchSaves();
    }
  }, [open, isAuthenticated, fetchSaves]);

  const handleSave = async () => {
    const result = await saveToCloud(currentData);
    if (result.error) {
      toast.error('Failed to save to cloud');
    } else {
      toast.success('Saved to cloud!');
    }
  };

  const handleLoad = async (save: CloudSave) => {
    const data = await loadFromCloud(save.id);
    if (data) {
      onLoadSave(data);
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

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
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
              ? 'Sync your character data across devices' 
              : 'Sign in to enable cloud saves'}
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Cloud className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Create an account to save your character to the cloud and access it from any device.
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
                  <p className="text-sm font-medium">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">Signed in</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            {/* Save Button */}
            <Button 
              className="w-full gap-2" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Save Current Character to Cloud
                </>
              )}
            </Button>

            <Separator />

            {/* Saves List */}
            <div>
              <h4 className="text-sm font-medium mb-2">Your Saves</h4>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : cloudSaves.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No cloud saves yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {cloudSaves.map((save) => (
                      <div 
                        key={save.id}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          confirmDelete === save.id 
                            ? "border-destructive/50 bg-destructive/10" 
                            : "border-border/50 bg-muted/20 hover:bg-muted/40"
                        )}
                      >
                        {confirmDelete === save.id ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-destructive">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-sm">Delete this save?</span>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancel
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDelete(save.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{save.save_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(save.updated_at)}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleLoad(save)}
                                disabled={loading}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setConfirmDelete(save.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Auto-save indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="w-3 h-3 text-green-500" />
              Local auto-save is always active
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
