import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, ChevronUp, Wand2, ScrollText, MessageSquare, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DM_MODELS } from '@/lib/dm-models';
import { loadApiKey, isClaudeEverywhereEnabled } from '@/lib/api-keys';
import { getAuthToken } from '@/lib/auth-token';
import { useToast } from '@/hooks/use-toast';
import { GMGuide } from '@/lib/gm-guides-storage';
import { GuideGenerationDialog } from './GuideGenerationDialog';

interface AIGuideCreatorProps {
  guides: GMGuide[];
  campaignSummary: string | null;
  chatMessages?: Array<{ role: string; content: string }>;
  onAdd: (name: string, content: string) => boolean;
}

export function AIGuideCreator({ guides, campaignSummary, chatMessages, onAdd }: AIGuideCreatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => 
    isClaudeEverywhereEnabled() ? 'anthropic/claude-sonnet-4-5' : 'google/gemini-3-flash-preview'
  );
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [suggestedName, setSuggestedName] = useState('');
  const { toast } = useToast();

  const enabledGuides = useMemo(() => guides.filter(g => g.enabled), [guides]);
  const messageCount = chatMessages?.length ?? 0;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setStreamedContent('');
    setSuggestedName('');
    setShowDialog(true);

    try {
      const model = DM_MODELS.find(m => m.id === selectedModel);
      const isAnthropic = model?.provider === 'anthropic';

      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        model: selectedModel,
        stream: true,
      };

      if (campaignSummary) body.campaignSummary = campaignSummary;
      if (chatMessages && chatMessages.length > 0) body.chatHistory = chatMessages.slice(-20);
      if (enabledGuides.length > 0) {
        body.existingGuides = enabledGuides.map(g => ({
          name: g.name,
          content: g.content,
        }));
      }
      if (isAnthropic) {
        const key = loadApiKey('anthropic');
        if (key) body.user_api_key = key;
      }
      const openaiKey = loadApiKey('openai');
      if (openaiKey) body.user_openai_key = openaiKey;

      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guide-creator`,
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

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              setStreamedContent(fullContent);
            }
          } catch { /* skip */ }
        }
      }

      // Extract suggested name from first heading
      const headingMatch = fullContent.match(/^#\s+(.+)/m);
      setSuggestedName(headingMatch?.[1]?.trim().slice(0, 100) || prompt.slice(0, 60).trim());

      if (!fullContent.trim()) {
        throw new Error('AI returned an empty guide');
      }
    } catch (err) {
      console.error('Guide generation failed:', err);
      toast({
        title: 'Generation Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      setShowDialog(false);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating, selectedModel, campaignSummary, chatMessages, enabledGuides, toast]);

  const handleAccept = useCallback(() => {
    const name = suggestedName || 'AI Generated Guide';
    const saved = onAdd(name, streamedContent);
    if (saved) {
      toast({ title: '✨ Guide Created', description: `"${name}" saved to your library.` });
      setPrompt('');
      setExpanded(false);
    }
    setShowDialog(false);
    setStreamedContent('');
    setSuggestedName('');
  }, [suggestedName, streamedContent, onAdd, toast]);

  const handleReject = useCallback(() => {
    setShowDialog(false);
    setStreamedContent('');
    setSuggestedName('');
  }, []);

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
                <Wand2 className="w-4 h-4" />
                Generate Guide
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streaming generation dialog */}
      <GuideGenerationDialog
        open={showDialog}
        streamedContent={streamedContent}
        isStreaming={isGenerating}
        suggestedName={suggestedName}
        onAccept={handleAccept}
        onReject={handleReject}
      />
    </div>
  );
}
