import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, ChevronUp, Loader2, Wand2, ScrollText, MessageSquare, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DM_MODELS, DMAIModel } from '@/lib/dm-models';
import { loadApiKey } from '@/lib/api-keys';
import { getAuthToken } from '@/lib/auth-token';
import { useToast } from '@/hooks/use-toast';
import { GMGuide } from '@/lib/gm-guides-storage';

interface AIGuideCreatorProps {
  guides: GMGuide[];
  campaignSummary: string | null;
  chatMessages?: Array<{ role: string; content: string }>;
  onAdd: (name: string, content: string) => boolean;
}

export function AIGuideCreator({ guides, campaignSummary, chatMessages, onAdd }: AIGuideCreatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState('google/gemini-3-flash-preview');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const enabledGuides = useMemo(() => guides.filter(g => g.enabled), [guides]);
  const messageCount = chatMessages?.length ?? 0;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);

    try {
      const model = DM_MODELS.find(m => m.id === selectedModel);
      const isAnthropic = model?.provider === 'anthropic';

      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        model: selectedModel,
      };

      if (campaignSummary) body.campaignSummary = campaignSummary;
      if (chatMessages && chatMessages.length > 0) body.chatHistory = chatMessages.slice(-20);
      if (enabledGuides.length > 0) {
        body.existingGuides = enabledGuides.map(g => ({
          name: g.name,
          snippet: g.content.slice(0, 200),
        }));
      }
      if (isAnthropic) {
        const key = loadApiKey('anthropic');
        if (key) body.user_api_key = key;
      }

      const token = await getAuthToken();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/guide-creator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const data = await response.json();
      const { guide, suggestedName } = data as { guide: string; suggestedName: string };

      if (!guide?.trim()) {
        throw new Error('AI returned an empty guide');
      }

      const saved = onAdd(suggestedName || 'AI Generated Guide', guide);
      if (saved) {
        toast({ title: '✨ Guide Created', description: `"${suggestedName}" saved to your library.` });
        setPrompt('');
        setExpanded(false);
      }
    } catch (err) {
      console.error('Guide generation failed:', err);
      toast({
        title: 'Generation Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating, selectedModel, campaignSummary, chatMessages, enabledGuides, onAdd, toast]);

  return (
    <div className="mx-0 mb-2">
      {/* Collapsed banner */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-900/30 to-amber-900/20 border border-purple-500/20 hover:border-purple-500/40 transition-all"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-cinzel text-purple-200">AI Guide Creator</span>
          </div>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </button>
      )}

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-purple-500/20 bg-purple-900/10 p-3 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-cinzel text-purple-200">AI Guide Creator</span>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <ChevronUp className="w-4 h-4 text-white/40" />
                </button>
              </div>

              {/* Model selector */}
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="w-full bg-white/5 border border-purple-900/30 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-purple-500/40 appearance-none"
              >
                {DM_MODELS.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#1a1520] text-white">
                    {m.label} — {m.description}
                  </option>
                ))}
              </select>

              {/* Context chips */}
              <div className="flex flex-wrap gap-1.5">
                {campaignSummary && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-900/30 border border-purple-500/20 text-[10px] text-purple-300">
                    <ScrollText className="w-3 h-3" /> Summary
                  </span>
                )}
                {messageCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-500/20 text-[10px] text-blue-300">
                    <MessageSquare className="w-3 h-3" /> {messageCount} messages
                  </span>
                )}
                {enabledGuides.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-500/20 text-[10px] text-amber-300">
                    <BookOpen className="w-3 h-3" /> {enabledGuides.length} guides
                  </span>
                )}
              </div>

              {/* Prompt textarea */}
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe the guide you want to create..."
                className="w-full bg-white/5 border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-purple-500/40 resize-none min-h-[80px]"
                rows={3}
                disabled={isGenerating}
              />

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-cinzel transition-all",
                  prompt.trim() && !isGenerating
                    ? "bg-gradient-to-r from-purple-600/60 to-amber-600/40 border border-purple-500/30 text-purple-100 hover:from-purple-600/80 hover:to-amber-600/60"
                    : "bg-white/5 border border-white/10 text-white/30"
                )}
                style={{ touchAction: 'manipulation' }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Guide...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate Guide
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
