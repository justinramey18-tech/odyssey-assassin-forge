import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCloudSave } from '@/hooks/use-cloud-save';
import { RosterCharacterCard, CreateNewCharacterCard } from '@/components/roster/RosterCharacterCard';
import { RosterEmptyState } from '@/components/roster/RosterEmptyState';
import { useToast } from '@/hooks/use-toast';

export default function CharacterRoster() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const { cloudSaves, fetchSaves, loadFromCloud, loading: savesLoading } = useCloudSave(user?.id);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Fetch saves on mount
  useEffect(() => {
    if (user?.id && !initialFetchDone) {
      fetchSaves().then(() => setInitialFetchDone(true));
    }
  }, [user?.id, fetchSaves, initialFetchDone]);

  const handleSelectCharacter = useCallback(async (saveId: string) => {
    try {
      const data = await loadFromCloud(saveId);
      if (!data) {
        toast({ title: 'Load Failed', description: 'Could not load that character.', variant: 'destructive' });
        return;
      }
      // Set active save ID
      localStorage.setItem('odyssey-active-cloud-save-id', saveId);
      // Navigate to main app with loaded data
      navigate('/', { state: { saveData: data, saveId }, replace: true });
    } catch (err) {
      console.error('[Roster] Load failed:', err);
      toast({ title: 'Error', description: 'Failed to load character.', variant: 'destructive' });
    }
  }, [loadFromCloud, navigate, toast]);

  const handleCreateNew = useCallback(() => {
    // Clear active save ID for fresh character
    localStorage.removeItem('odyssey-active-cloud-save-id');
    navigate('/', { state: { newCharacter: true }, replace: true });
  }, [navigate]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/auth', { replace: true });
  }, [signOut, navigate]);

  // Show nothing while checking auth
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const isLoading = savesLoading && !initialFetchDone;

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/40">
          <div className="flex items-center justify-between px-5 py-4 max-w-lg mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-xl font-bold text-foreground font-cinzel">Your Heroes</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cloudSaves.length > 0 ? `${cloudSaves.length} character${cloudSaves.length !== 1 ? 's' : ''}` : 'Choose your champion'}
              </p>
            </motion.div>
            <div className="flex items-center gap-2">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={() => {
                  setInitialFetchDone(false);
                  fetchSaves().then(() => setInitialFetchDone(true));
                }}
                disabled={savesLoading}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${savesLoading ? 'animate-spin' : ''}`} />
              </motion.button>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                onClick={handleSignOut}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-6 h-6 text-primary/60 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading your characters...</p>
            </div>
          ) : cloudSaves.length === 0 ? (
            <RosterEmptyState onCreateNew={handleCreateNew} />
          ) : (
            <div className="space-y-3">
              {cloudSaves.map((save, i) => (
                <RosterCharacterCard
                  key={save.id}
                  save={save}
                  onSelect={handleSelectCharacter}
                  index={i}
                />
              ))}
              <CreateNewCharacterCard onCreateNew={handleCreateNew} index={cloudSaves.length} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
