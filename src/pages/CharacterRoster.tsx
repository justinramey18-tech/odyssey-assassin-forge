import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCloudSave } from '@/hooks/use-cloud-save';
import { useAppMode } from '@/hooks/use-app-mode';

export default function CharacterRoster() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { cloudSaves, fetchSaves, loadFromCloud, loading: savesLoading } = useCloudSave(user?.id);
  const { effectiveMode } = useAppMode();
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

  // Filter saves by active app mode
  const filteredSaves = useMemo(() => {
    if (effectiveMode === 'fullAccess') return cloudSaves;
    if (effectiveMode === 'empyrean') {
      return cloudSaves.filter(s => s.preview?.campaignType === 'empyrean');
    }
    return cloudSaves.filter(s => s.preview?.campaignType !== 'empyrean');
  }, [cloudSaves, effectiveMode]);

  // Auto-load single character or redirect to creation
  useEffect(() => {
    if (!initialFetchDone || savesLoading) return;

    if (cloudSaves.length === 0) {
      // Truly empty — go straight to character creation
      localStorage.removeItem('odyssey-active-cloud-save-id');
      navigate('/', { state: { newCharacter: true }, replace: true });
      return;
    }

    // Has characters but none in this mode → show empty state (no auto-navigate)
    if (filteredSaves.length === 0) return;

    // Load the first filtered save automatically
    const save = filteredSaves[0];
    loadFromCloud(save.id).then((data) => {
      if (data) {
        localStorage.setItem('odyssey-active-cloud-save-id', save.id);
        navigate('/', { state: { saveData: data, saveId: save.id }, replace: true });
      }
    });
  }, [initialFetchDone, savesLoading, cloudSaves, filteredSaves, loadFromCloud, navigate]);

  const showEmptyForMode =
    initialFetchDone && !savesLoading && cloudSaves.length > 0 && filteredSaves.length === 0;

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

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <RefreshCw className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}
