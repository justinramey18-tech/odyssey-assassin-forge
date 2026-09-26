import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCloudSave } from '@/hooks/use-cloud-save';
import { useAppMode } from '@/hooks/use-app-mode';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export default function CharacterRoster() {
  const navigate = useNavigate();
  const location = useLocation();
  // Only auto-jump into a character right after sign-in. When the player
  // deliberately opens the roster (Switch Character), always show the list.
  const autoLoad = Boolean((location.state as { autoLoad?: boolean } | null)?.autoLoad);
  const { user, loading: authLoading, signOut } = useAuth();
  const { cloudSaves, fetchSaves, loadFromCloud, loading: savesLoading } = useCloudSave(user?.id);
  const { effectiveMode } = useAppMode();
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const signedInAs = user?.email ? user.email.replace('@odyssey.local', '') : '';
  const handleSignOut = async () => { await signOut(); navigate('/auth', { replace: true }); };


  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Fetch saves on mount — retry once automatically if the first attempt fails
  useEffect(() => {
    if (user?.id && !initialFetchDone) {
      fetchSaves().then(async (firstOk) => {
        let ok = firstOk;
        if (!ok) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          ok = await fetchSaves();
        }
        setFetchFailed(!ok);
        setInitialFetchDone(true);
      });
    }
  }, [user?.id, fetchSaves, initialFetchDone]);

  // Filter saves by active app mode
  const filteredSaves = useMemo(() => {
    if (effectiveMode === 'fullAccess') return cloudSaves;
    if (effectiveMode === 'empyrean') {
      return cloudSaves.filter(s => s.preview?.campaignType === 'empyrean');
    }
    return cloudSaves.filter(s => s.preview?.campaignType !== 'empyrean');
  }, [cloudSaves, effectiveMode]);

  const displaySaves = showAll ? cloudSaves : filteredSaves;

  // Auto-load single character or redirect to creation
  useEffect(() => {
    if (!initialFetchDone || savesLoading || showAll) return;
    if (fetchFailed) return; // never treat a failed load as "brand-new player"

    if (cloudSaves.length === 0) {
      // Truly empty — go straight to character creation
      localStorage.removeItem('odyssey-active-cloud-save-id');
      navigate('/', { state: { newCharacter: true }, replace: true });
      return;
    }

    // Has characters but none in this mode → show empty state (no auto-navigate)
    if (filteredSaves.length === 0) return;

    // Only auto-load straight after sign-in, and only with exactly one match.
    if (!autoLoad) return;
    if (filteredSaves.length !== 1) return;

    // Load the first filtered save automatically
    const save = filteredSaves[0];
    loadFromCloud(save.id).then((data) => {
      if (data) {
        localStorage.setItem('odyssey-active-cloud-save-id', save.id);
        navigate('/', { state: { saveData: data, saveId: save.id }, replace: true });
      }
    });
  }, [initialFetchDone, savesLoading, cloudSaves, filteredSaves, loadFromCloud, navigate, showAll, autoLoad]);

  const showEmptyForMode =
    autoLoad && initialFetchDone && !savesLoading && cloudSaves.length > 0 && filteredSaves.length === 0 && !showAll;


  if (showEmptyForMode) {
    const label = effectiveMode === 'empyrean' ? 'Empyrean' : 'D&D';
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-cinzel font-bold text-foreground mb-2">
            No {label} characters yet
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            You have characters, but none in this mode. Create a new one or switch app mode in Settings.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('odyssey-active-cloud-save-id');
              navigate('/', { state: { newCharacter: true }, replace: true });
            }}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold font-cinzel text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
          >
            Create New Hero
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!initialFetchDone || savesLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  // If we got here, show the roster list
  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <h1 className="text-xl font-cinzel font-bold text-foreground mb-1">Character Roster</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {cloudSaves.length} character{cloudSaves.length !== 1 ? 's' : ''} saved
        </p>

        {/* Create is only reachable from the empty states otherwise, which makes a
            second character impossible once the player has one. */}
        <button
          onClick={() => {
            localStorage.removeItem('odyssey-active-cloud-save-id');
            navigate('/', { state: { newCharacter: true }, replace: true });
          }}
          className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-primary/40 text-primary font-cinzel font-bold text-sm hover:bg-primary/10 transition-colors"
          style={{ touchAction: 'manipulation', minHeight: 52 }}
        >
          <Plus className="w-4 h-4" />
          Create New Hero
        </button>

        {/* Show-all toggle */}
        {effectiveMode !== 'fullAccess' && cloudSaves.length > filteredSaves.length && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="text-xs text-muted-foreground underline mb-4 self-start"
            style={{ touchAction: 'manipulation' }}
          >
            {showAll
              ? `Show only ${effectiveMode === 'empyrean' ? 'Empyrean' : "D&D"} characters`
              : 'Show all characters'}
          </button>
        )}

        {displaySaves.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground mb-4">No characters found.</p>
            <button
              onClick={() => {
                localStorage.removeItem('odyssey-active-cloud-save-id');
                navigate('/', { state: { newCharacter: true }, replace: true });
              }}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold font-cinzel text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
            >
              Create New Hero
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displaySaves.map((save) => (
              <button
                key={save.id}
                onClick={() => {
                  loadFromCloud(save.id).then((data) => {
                    if (data) {
                      localStorage.setItem('odyssey-active-cloud-save-id', save.id);
                      navigate('/', { state: { saveData: data, saveId: save.id }, replace: true });
                    }
                  });
                }}
                className="w-full text-left p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card transition-colors active:scale-[0.98]"
                style={{ touchAction: 'manipulation' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-cinzel font-bold text-sm text-foreground truncate">
                      {save.character_name || save.save_name || 'Unnamed Character'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Level {save.character_level || 1}
                    </p>
                  </div>
                  {/* Campaign type flip badge */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const newType = save.preview?.campaignType === 'empyrean' ? 'dnd' : 'empyrean';
                      try {
                        const { data } = await supabase
                          .from('character_saves')
                          .select('extended_data')
                          .eq('id', save.id)
                          .single();
                        if (!data) return;
                        const ext = (data.extended_data as Record<string, unknown> | null) || {};
                        ext.campaignType = newType;
                        const { error } = await supabase
                          .from('character_saves')
                          .update({ extended_data: ext as Json })
                          .eq('id', save.id);
                        if (error) {
                          toast.error('Failed to update character type');
                          return;
                        }
                        await fetchSaves();
                        toast.success(`Marked as ${newType === 'empyrean' ? 'Empyrean' : 'D&D'} character`);
                      } catch (err) {
                        console.error('flip campaignType failed:', err);
                        toast.error('Failed to update character type');
                      }
                    }}
                    className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10"
                    style={{ touchAction: 'manipulation' }}
                    title="Tap to change campaign type"
                  >
                    {save.preview?.campaignType === 'empyrean' ? '🔥 Empyrean' : '⚔️ D&D'}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{save.preview?.gold ?? 0}g</span>
                </div>
                {save.updated_at && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                    Updated {new Date(save.updated_at).toLocaleDateString()}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
