import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCloudSave } from '@/hooks/use-cloud-save';

export default function CharacterRoster() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
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

  // Auto-load single character or redirect to creation
  useEffect(() => {
    if (!initialFetchDone || savesLoading) return;

    if (cloudSaves.length === 0) {
      // No saves — go straight to character creation
      localStorage.removeItem('odyssey-active-cloud-save-id');
      navigate('/', { state: { newCharacter: true }, replace: true });
    } else {
      // Load the first (only) save automatically
      const save = cloudSaves[0];
      loadFromCloud(save.id).then((data) => {
        if (data) {
          localStorage.setItem('odyssey-active-cloud-save-id', save.id);
          navigate('/', { state: { saveData: data, saveId: save.id }, replace: true });
        }
      });
    }
  }, [initialFetchDone, savesLoading, cloudSaves, loadFromCloud, navigate]);

  // Show loading spinner while everything resolves
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <RefreshCw className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}
