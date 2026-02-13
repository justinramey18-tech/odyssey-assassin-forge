import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Film, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { TutorialCard } from '@/components/tutorials/TutorialCard';
import { TutorialUploadDialog } from '@/components/tutorials/TutorialUploadDialog';

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  category: string;
  sort_order: number;
  created_at: string;
  created_by: string | null;
}

export default function Tutorials() {
  const navigate = useNavigate();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const fetchTutorials = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from('tutorials') as any)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTutorials(data as Tutorial[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTutorials();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Group by category
  const grouped = tutorials.reduce<Record<string, Tutorial[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-amber-900/30 bg-black/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <Film className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-cinzel text-amber-200">Tutorials</h1>
        </div>
        {userId && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/30 border border-amber-500/30 text-amber-300 text-xs font-cinzel hover:bg-amber-900/50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Upload
          </button>
        )}
      </header>

      {/* Content */}
      <main className="px-4 py-6 max-w-4xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : tutorials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Film className="w-16 h-16 text-amber-500/30 mb-4" />
            <h2 className="text-lg font-cinzel text-amber-200 mb-2">No Tutorials Yet</h2>
            <p className="text-sm text-white/40 max-w-xs">
              {userId ? 'Be the first to upload a tutorial!' : 'Sign in to upload tutorials.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, items]) => (
              <motion.section
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-sm font-cinzel text-amber-400/80 mb-3 uppercase tracking-wider">
                  {category}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((tutorial) => (
                    <TutorialCard
                      key={tutorial.id}
                      id={tutorial.id}
                      title={tutorial.title}
                      description={tutorial.description}
                      videoUrl={tutorial.video_url}
                      category={tutorial.category}
                      isOwner={userId === (tutorial as any).created_by}
                      onDeleted={fetchTutorials}
                    />
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        )}
      </main>

      {userId && (
        <TutorialUploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          onUploaded={fetchTutorials}
          userId={userId}
        />
      )}
    </div>
  );
}
