import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ChevronDown, ChevronUp, Loader2, CheckCircle2, Wand2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DM_MODELS } from '@/lib/dm-models';
import { loadApiKey, isClaudeEverywhereEnabled } from '@/lib/api-keys';
import { getAuthToken } from '@/lib/auth-token';
import { useToast } from '@/hooks/use-toast';
import { GMGuide } from '@/lib/gm-guides-storage';

interface Contradiction {
  guideIds?: string[];
  guideNames?: string[];
  description: string;
  severity?: 'high' | 'medium' | 'low';
}

interface GuideQualityCheckProps {
  guides: GMGuide[];
  onUpdate: (id: string, updates: Partial<Pick<GMGuide, 'name' | 'content' | 'enabled'>>) => boolean;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-900/40 border-red-500/30 text-red-300',
  medium: 'bg-amber-900/40 border-amber-500/30 text-amber-300',
  low: 'bg-zinc-800/60 border-zinc-500/30 text-zinc-300',
};

export function GuideQualityCheck({ guides, onUpdate }: GuideQualityCheckProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() =>
    isClaudeEverywhereEnabled() ? 'anthropic/claude-sonnet-4-5' : 'google/gemini-3-flash-preview'
  );
  const [isChecking, setIsChecking] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const [rewriteTargetId, setRewriteTargetId] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenContent, setRewrittenContent] = useState<string | null>(null);

  const { toast } = useToast();
  const enabledGuides = useMemo(() => guides.filter(g => g.enabled), [guides]);
  const rewriteTarget = useMemo(
    () => guides.find(g => g.id === rewriteTargetId) || null,
    [guides, rewriteTargetId]
  );

  const buildAuthBody = useCallback((extra: Record<string, unknown>) => {
    const model = DM_MODELS.find(m => m.id === selectedModel);
    const body: Record<string, unknown> = { ...extra, model: selectedModel };
    if (model?.provider === 'anthropic') {
      const key = loadApiKey('anthropic');
      if (key) body.user_api_key = key;
    }
    return body;
  }, [selectedModel]);

  const callFn = useCallback(async (body: Record<string, unknown>) => {
    const token = await getAuthToken();
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guide-quality-check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Error ${response.status}`);
    }
    return response.json();
  }, []);

  const guidesInContradiction = useCallback((c: Contradiction): GMGuide[] => {
    const byId = (c.guideIds || [])
      .map(id => guides.find(g => g.id === id))
      .filter((g): g is GMGuide => !!g);
    if (byId.length > 0) return byId;
    return (c.guideNames || [])
      .map(n => guides.find(g => g.name === n))
      .filter((g): g is GMGuide => !!g);
  }, [guides]);

  const handleRunCheck = useCallback(async () => {
    if (isChecking || enabledGuides.length < 2) return;
    setIsChecking(true);
    setHint(null);
    try {
      const data = await callFn(buildAuthBody({
        action: 'audit',
        guides: enabledGuides.map(g => ({ id: g.id, name: g.name, content: g.content })),
      }));

      if (data?.parseError) {
        toast({
          title: 'Quality Check',
          description: 'The AI response could not be parsed — try again or switch models.',
          variant: 'destructive',
        });
        return;
      }

      setContradictions(Array.isArray(data?.contradictions) ? data.contradictions : []);
      setHasRun(true);
    } catch (err) {
      console.error('Quality check failed:', err);
      toast({
        title: 'Quality Check Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, enabledGuides, callFn, buildAuthBody, toast]);

  const openRewrite = useCallback((id: string) => {
    setRewriteTargetId(id);
    setCustomInstructions('');
    setRewrittenContent(null);
  }, []);

  const cancelRewrite = useCallback(() => {
    setRewriteTargetId(null);
    setCustomInstructions('');
    setRewrittenContent(null);
  }, []);

  const handleRewrite = useCallback(async () => {
    if (!rewriteTarget || isRewriting) return;
    setIsRewriting(true);
    try {
      const related = contradictions
        .filter(c => guidesInContradiction(c).some(g => g.id === rewriteTarget.id))
        .map(c => c.description);

      const data = await callFn(buildAuthBody({
        action: 'rewrite',
        targetGuide: { id: rewriteTarget.id, name: rewriteTarget.name, content: rewriteTarget.content },
        otherGuides: enabledGuides
          .filter(g => g.id !== rewriteTarget.id)
          .map(g => ({ name: g.name, content: g.content })),
        contradictions: related,
        customInstructions: customInstructions.trim() || undefined,
      }));

      if (!data?.rewrittenContent) throw new Error('AI returned an empty rewrite');
      setRewrittenContent(data.rewrittenContent as string);
    } catch (err) {
      console.error('Guide rewrite failed:', err);
      toast({
        title: 'Rewrite Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRewriting(false);
    }
  }, [rewriteTarget, isRewriting, contradictions, guidesInContradiction, callFn, buildAuthBody, enabledGuides, customInstructions, toast]);

  const acceptRewrite = useCallback(() => {
    if (!rewriteTarget || !rewrittenContent) return;
    const ok = onUpdate(rewriteTarget.id, { content: rewrittenContent });
    if (!ok) return;
    toast({ title: '✅ Guide rewritten', description: `"${rewriteTarget.name}" has been updated.` });
    setContradictions(prev => prev.filter(c => !guidesInContradiction(c).some(g => g.id === rewriteTarget.id)));
    setHint('Re-run the check to verify.');
    cancelRewrite();
  }, [rewriteTarget, rewrittenContent, onUpdate, toast, guidesInContradiction, cancelRewrite]);

  return (
    <div className="mx-0 mb-2">
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-900/30 to-teal-900/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <div className="text-sm font-cinzel text-emerald-200">AI Quality Check</div>
              <div className="text-[10px] text-white/40">Scan all guides for contradictions</div>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </button>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-cinzel text-emerald-200">AI Quality Check</span>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <ChevronUp className="w-4 h-4 text-white/40" />
                </button>
              </div>

              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="w-full bg-white/5 border border-emerald-900/30 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-emerald-500/40 appearance-none"
              >
                {DM_MODELS.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#101a18] text-white">
                    {m.label} — {m.description}
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-white/40">
                {enabledGuides.length} enabled guide{enabledGuides.length === 1 ? '' : 's'} will be scanned.
              </p>

              <button
                onClick={handleRunCheck}
                disabled={isChecking || enabledGuides.length < 2}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-cinzel transition-all',
                  enabledGuides.length >= 2 && !isChecking
                    ? 'bg-gradient-to-r from-emerald-600/60 to-teal-600/40 border border-emerald-500/30 text-emerald-100 hover:from-emerald-600/80 hover:to-teal-600/60'
                    : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                )}
                style={{ touchAction: 'manipulation' }}
              >
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {isChecking ? 'Checking…' : 'Run Quality Check'}
              </button>

              {enabledGuides.length < 2 && (
                <p className="text-[11px] text-amber-300/70">Enable at least 2 guides to run a check.</p>
              )}

              {hint && <p className="text-[11px] text-emerald-300/70">{hint}</p>}

              {/* Results */}
              {hasRun && contradictions.length === 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-900/20 px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-emerald-200">
                    No contradictions found across {enabledGuides.length} guides
                  </span>
                </div>
              )}

              {contradictions.length > 0 && (
                <div className="space-y-2">
                  {contradictions.map((c, i) => {
                    const involved = guidesInContradiction(c);
                    const names = c.guideNames && c.guideNames.length > 0
                      ? c.guideNames
                      : involved.map(g => g.name);
                    return (
                      <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide',
                          SEVERITY_STYLES[c.severity || 'low'] || SEVERITY_STYLES.low
                        )}>
                          {c.severity || 'low'}
                        </span>
                        <p className="text-xs text-white/70 leading-relaxed">{c.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {names.map((n, j) => (
                            <span key={j} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/50">
                              {n}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {involved.map(g => (
                            <button
                              key={g.id}
                              onClick={() => openRewrite(g.id)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-cinzel bg-emerald-900/30 border border-emerald-500/20 text-emerald-200 hover:bg-emerald-900/50 transition-all"
                              style={{ touchAction: 'manipulation' }}
                            >
                              <Wand2 className="w-3.5 h-3.5" />
                              Rewrite: {g.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rewrite panel */}
              {rewriteTarget && (
                <div className="rounded-xl border border-emerald-500/30 bg-black/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-cinzel text-emerald-200">Rewrite: {rewriteTarget.name}</span>
                    <button
                      onClick={cancelRewrite}
                      className="p-1 rounded hover:bg-white/10"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <X className="w-4 h-4 text-white/40" />
                    </button>
                  </div>

                  {!rewrittenContent && (
                    <>
                      <label className="block text-[11px] text-white/50">Custom rewrite instructions (optional)</label>
                      <textarea
                        value={customInstructions}
                        onChange={e => setCustomInstructions(e.target.value)}
                        placeholder="Tell the AI how you want this guide rewritten..."
                        rows={3}
                        disabled={isRewriting}
                        className="w-full bg-white/5 border border-emerald-900/30 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40 resize-none min-h-[70px]"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleRewrite}
                          disabled={isRewriting}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-cinzel transition-all',
                            isRewriting
                              ? 'bg-white/5 border border-white/10 text-white/30'
                              : 'bg-gradient-to-r from-emerald-600/60 to-teal-600/40 border border-emerald-500/30 text-emerald-100'
                          )}
                          style={{ touchAction: 'manipulation' }}
                        >
                          {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                          {isRewriting ? 'Rewriting…' : 'Rewrite with AI'}
                        </button>
                        <button
                          onClick={cancelRewrite}
                          className="px-4 py-2.5 rounded-lg text-xs font-cinzel bg-white/5 border border-white/10 text-white/60"
                          style={{ touchAction: 'manipulation' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {rewrittenContent && (
                    <>
                      <div className="max-h-[50vh] overflow-y-auto rounded-lg bg-black/50 border border-white/10 p-2">
                        <pre className="font-mono text-xs text-white/70 whitespace-pre-wrap break-words">{rewrittenContent}</pre>
                      </div>
                      <p className="text-[10px] text-white/40">{rewrittenContent.length} characters</p>
                      <div className="flex gap-2">
                        <button
                          onClick={acceptRewrite}
                          className="flex-1 py-2.5 rounded-lg text-xs font-cinzel bg-gradient-to-r from-emerald-600/60 to-teal-600/40 border border-emerald-500/30 text-emerald-100"
                          style={{ touchAction: 'manipulation' }}
                        >
                          Accept Rewrite
                        </button>
                        <button
                          onClick={() => setRewrittenContent(null)}
                          className="px-4 py-2.5 rounded-lg text-xs font-cinzel bg-white/5 border border-white/10 text-white/60"
                          style={{ touchAction: 'manipulation' }}
                        >
                          Discard
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
