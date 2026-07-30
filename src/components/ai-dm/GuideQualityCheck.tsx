import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ChevronDown, ChevronUp, Loader2, CheckCircle2, Wand2, X, Undo2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DM_MODELS } from '@/lib/dm-models';
import { loadApiKey, isClaudeEverywhereEnabled } from '@/lib/api-keys';
import { getAuthToken } from '@/lib/auth-token';
import { useToast } from '@/hooks/use-toast';
import { GMGuide } from '@/lib/gm-guides-storage';

interface GuideQualityCheckProps {
  guides: GMGuide[];
  onUpdate: (id: string, updates: Partial<Pick<GMGuide, 'name' | 'content' | 'enabled'>>) => boolean;
}

interface SurgicalFix {
  guideId: string;
  guideName?: string;
  find: string;
  replace: string;
  reason?: string;
}

interface ScanIssue {
  id: string;
  type: 'contradiction' | 'redundancy' | 'clarity' | 'missing_checklist';
  severity?: 'high' | 'medium' | 'low';
  description: string;
  guideIds?: string[];
  guideNames?: string[];
  fixes: SurgicalFix[];
}

type FixStatus = 'pending' | 'applied' | 'skipped' | 'nomatch';

interface UndoEntry {
  guideId: string;
  guideName: string;
  prevContent: string;
  label: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-900/40 border-red-500/30 text-red-300',
  medium: 'bg-amber-900/40 border-amber-500/30 text-amber-300',
  low: 'bg-zinc-800/60 border-zinc-500/30 text-zinc-300',
};

const TYPE_STYLES: Record<string, string> = {
  contradiction: 'bg-red-900/40 border-red-500/30 text-red-300',
  redundancy: 'bg-blue-900/40 border-blue-500/30 text-blue-300',
  clarity: 'bg-purple-900/40 border-purple-500/30 text-purple-300',
  missing_checklist: 'bg-teal-900/40 border-teal-500/30 text-teal-300',
};

const TYPE_LABELS: Record<string, string> = {
  contradiction: 'contradiction',
  redundancy: 'redundancy',
  clarity: 'clarity',
  missing_checklist: 'missing checklist',
};

interface ScanModes {
  contradictions: boolean;
  redundancy: boolean;
  clarity: boolean;
  checklists: boolean;
}

const DEFAULT_MODES: ScanModes = { contradictions: true, redundancy: false, clarity: false, checklists: false };
const MODES_KEY = 'guide-scan-modes';

const MODE_CHIPS: Array<{ key: keyof ScanModes; label: string }> = [
  { key: 'contradictions', label: 'Contradictions' },
  { key: 'redundancy', label: 'Redundancy' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'checklists', label: 'Checklists' },
];

const fixKey = (issueId: string, index: number) => `${issueId}::${index}`;

export function GuideQualityCheck({ guides, onUpdate }: GuideQualityCheckProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() =>
    isClaudeEverywhereEnabled() ? 'anthropic/claude-sonnet-4-5' : 'google/gemini-3-flash-preview'
  );
  const [isChecking, setIsChecking] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [issues, setIssues] = useState<ScanIssue[]>([]);
  const [fixStatus, setFixStatus] = useState<Record<string, FixStatus>>({});
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [showUndoList, setShowUndoList] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const [modes, setModes] = useState<ScanModes>(DEFAULT_MODES);
  const [adjustOpen, setAdjustOpen] = useState<Record<string, boolean>>({});
  const [adjustText, setAdjustText] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const [rewriteTargetId, setRewriteTargetId] = useState<string | null>(null);
  const [rewriteContradictions, setRewriteContradictions] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenContent, setRewrittenContent] = useState<string | null>(null);

  const { toast } = useToast();
  const enabledGuides = useMemo(() => guides.filter(g => g.enabled), [guides]);
  const rewriteTarget = useMemo(
    () => guides.find(g => g.id === rewriteTargetId) || null,
    [guides, rewriteTargetId]
  );

  // Restore persisted scan modes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ScanModes>;
        const merged = { ...DEFAULT_MODES, ...parsed };
        if (merged.contradictions || merged.redundancy || merged.clarity || merged.checklists) {
          setModes(merged);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const toggleMode = useCallback((key: keyof ScanModes) => {
    setModes(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.contradictions && !next.redundancy && !next.clarity && !next.checklists) return prev;
      try { localStorage.setItem(MODES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const onlyContradictions = modes.contradictions && !modes.redundancy && !modes.clarity && !modes.checklists;
  const minGuides = onlyContradictions ? 2 : 1;
  const canScan = enabledGuides.length >= minGuides;

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

  const parseErrorToast = useCallback(() => {
    toast({
      title: 'Quality Check',
      description: 'The AI response could not be parsed — try again or switch models.',
      variant: 'destructive',
    });
  }, [toast]);

  const guidesForIssue = useCallback((issue: ScanIssue): GMGuide[] => {
    const byId = (issue.guideIds || [])
      .map(id => guides.find(g => g.id === id))
      .filter((g): g is GMGuide => !!g);
    if (byId.length > 0) return byId;
    return (issue.guideNames || [])
      .map(n => guides.find(g => g.name === n))
      .filter((g): g is GMGuide => !!g);
  }, [guides]);

  const resolveGuide = useCallback((fix: SurgicalFix): GMGuide | null => {
    return guides.find(g => g.id === fix.guideId)
      || (fix.guideName ? guides.find(g => g.name === fix.guideName) : undefined)
      || null;
  }, [guides]);

  // ===== SCAN =====
  const handleScan = useCallback(async () => {
    if (isChecking || !canScan) return;
    setIsChecking(true);
    setHint(null);
    try {
      const data = await callFn(buildAuthBody({
        action: 'scan',
        guides: enabledGuides.map(g => ({ id: g.id, name: g.name, content: g.content })),
        scanModes: {
          contradictions: modes.contradictions,
          redundancy: modes.redundancy,
          clarity: modes.clarity,
          checklists: modes.checklists,
        },
      }));

      if (data?.parseError) { parseErrorToast(); return; }

      const raw: ScanIssue[] = Array.isArray(data?.issues) ? data.issues : [];
      const normalized = raw.map((iss, idx) => ({
        ...iss,
        id: iss.id || `i${idx}`,
        fixes: Array.isArray(iss.fixes) ? iss.fixes : [],
      }));
      setIssues(normalized);
      setFixStatus({});
      setAdjustOpen({});
      setHasRun(true);
    } catch (err) {
      console.error('Quality scan failed:', err);
      toast({
        title: 'Scan Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, canScan, callFn, buildAuthBody, enabledGuides, modes, parseErrorToast, toast]);

  // ===== APPLY ONE FIX =====
  const applyFix = useCallback((issue: ScanIssue, fix: SurgicalFix, index: number) => {
    const guide = resolveGuide(fix);
    if (!guide) {
      setFixStatus(prev => ({ ...prev, [fixKey(issue.id, index)]: 'nomatch' }));
      setAdjustOpen(prev => ({ ...prev, [issue.id]: true }));
      return;
    }

    let newContent: string;
    if (fix.find === '') {
      newContent = `${guide.content.replace(/\s+$/, '')}\n\n${fix.replace}`;
    } else {
      const at = guide.content.indexOf(fix.find);
      if (at === -1) {
        setFixStatus(prev => ({ ...prev, [fixKey(issue.id, index)]: 'nomatch' }));
        setAdjustOpen(prev => ({ ...prev, [issue.id]: true }));
        return;
      }
      newContent = guide.content.slice(0, at) + fix.replace + guide.content.slice(at + fix.find.length);
    }

    const entry: UndoEntry = {
      guideId: guide.id,
      guideName: guide.name,
      prevContent: guide.content,
      label: (fix.reason || issue.description || 'Surgical fix').slice(0, 80),
    };
    setUndoStack(prev => [...prev, entry]);

    const ok = onUpdate(guide.id, { content: newContent });
    if (!ok) {
      setUndoStack(prev => prev.filter(e => e !== entry));
      return;
    }
    setFixStatus(prev => ({ ...prev, [fixKey(issue.id, index)]: 'applied' }));
    setHint('Re-scan to verify.');
  }, [resolveGuide, onUpdate]);

  const skipFix = useCallback((issueId: string, index: number) => {
    setFixStatus(prev => ({ ...prev, [fixKey(issueId, index)]: 'skipped' }));
  }, []);

  const restoreFix = useCallback((issueId: string, index: number) => {
    setFixStatus(prev => ({ ...prev, [fixKey(issueId, index)]: 'pending' }));
  }, []);

  // ===== UNDO =====
  const undoEntry = useCallback((entry: UndoEntry) => {
    onUpdate(entry.guideId, { content: entry.prevContent });
    setUndoStack(prev => prev.filter(e => e !== entry));
  }, [onUpdate]);

  const undoFixCard = useCallback((issueId: string, index: number, fix: SurgicalFix) => {
    const entry = [...undoStack].reverse().find(e => e.guideId === fix.guideId || e.guideName === fix.guideName);
    if (entry) undoEntry(entry);
    setFixStatus(prev => ({ ...prev, [fixKey(issueId, index)]: 'pending' }));
  }, [undoStack, undoEntry]);

  const undoAll = useCallback(() => {
    [...undoStack].reverse().forEach(e => onUpdate(e.guideId, { content: e.prevContent }));
    setUndoStack([]);
    setFixStatus(prev => {
      const next: Record<string, FixStatus> = {};
      Object.entries(prev).forEach(([k, v]) => { next[k] = v === 'applied' ? 'pending' : v; });
      return next;
    });
    toast({ title: 'Reverted', description: 'All recent guide changes were undone.' });
  }, [undoStack, onUpdate, toast]);

  // ===== FIX ALL =====
  const pendingCount = useMemo(() => {
    let n = 0;
    issues.forEach(iss => iss.fixes.forEach((_, i) => {
      if ((fixStatus[fixKey(iss.id, i)] || 'pending') === 'pending') n++;
    }));
    return n;
  }, [issues, fixStatus]);

  const totalFixes = useMemo(() => issues.reduce((n, i) => n + i.fixes.length, 0), [issues]);

  const fixAll = useCallback(() => {
    const working = new Map<string, string>();
    const originals = new Map<string, string>();
    const names = new Map<string, string>();
    const statusUpdates: Record<string, FixStatus> = {};
    let applied = 0;
    let failed = 0;

    issues.forEach(issue => {
      issue.fixes.forEach((fix, index) => {
        const key = fixKey(issue.id, index);
        if ((fixStatus[key] || 'pending') !== 'pending') return;
        const guide = resolveGuide(fix);
        if (!guide) { statusUpdates[key] = 'nomatch'; failed++; return; }

        if (!working.has(guide.id)) {
          working.set(guide.id, guide.content);
          originals.set(guide.id, guide.content);
          names.set(guide.id, guide.name);
        }
        const current = working.get(guide.id)!;

        if (fix.find === '') {
          working.set(guide.id, `${current.replace(/\s+$/, '')}\n\n${fix.replace}`);
          statusUpdates[key] = 'applied';
          applied++;
          return;
        }
        const at = current.indexOf(fix.find);
        if (at === -1) { statusUpdates[key] = 'nomatch'; failed++; return; }
        working.set(guide.id, current.slice(0, at) + fix.replace + current.slice(at + fix.find.length));
        statusUpdates[key] = 'applied';
        applied++;
      });
    });

    const newEntries: UndoEntry[] = [];
    let guidesTouched = 0;
    working.forEach((content, guideId) => {
      const prev = originals.get(guideId)!;
      if (content === prev) return;
      const ok = onUpdate(guideId, { content });
      if (!ok) {
        // roll back status for this guide's fixes
        issues.forEach(issue => issue.fixes.forEach((fix, index) => {
          const g = resolveGuide(fix);
          if (g?.id === guideId && statusUpdates[fixKey(issue.id, index)] === 'applied') {
            delete statusUpdates[fixKey(issue.id, index)];
            applied--;
          }
        }));
        return;
      }
      guidesTouched++;
      newEntries.push({ guideId, guideName: names.get(guideId) || 'Guide', prevContent: prev, label: 'Fix All' });
    });

    if (newEntries.length) setUndoStack(prev => [...prev, ...newEntries]);
    setFixStatus(prev => ({ ...prev, ...statusUpdates }));
    if (applied > 0) setHint('Re-scan to verify.');

    toast({
      title: 'Fix All',
      description: `Applied ${applied} fixes across ${guidesTouched} guides${failed > 0 ? `, ${failed} couldn't match` : ''}`,
    });
  }, [issues, fixStatus, resolveGuide, onUpdate, toast]);

  // ===== REGENERATE ONE ISSUE'S FIXES =====
  const regenerateIssue = useCallback(async (issue: ScanIssue) => {
    if (regenerating) return;
    setRegenerating(issue.id);
    try {
      const involved = guidesForIssue(issue);
      const targets = involved.length > 0 ? involved : enabledGuides;
      const data = await callFn(buildAuthBody({
        action: 'fix',
        issue: { type: issue.type, description: issue.description },
        guides: targets.map(g => ({ id: g.id, name: g.name, content: g.content })),
        customInstructions: (adjustText[issue.id] || '').trim() || undefined,
      }));

      if (data?.parseError) { parseErrorToast(); return; }

      const fixes: SurgicalFix[] = Array.isArray(data?.fixes) ? data.fixes : [];
      setIssues(prev => prev.map(i => (i.id === issue.id ? { ...i, fixes } : i)));
      setFixStatus(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { if (k.startsWith(`${issue.id}::`)) delete next[k]; });
        return next;
      });
      if (fixes.length === 0) {
        toast({ title: 'No fixes returned', description: 'Try rephrasing your instructions or switching models.' });
      }
    } catch (err) {
      console.error('Fix regeneration failed:', err);
      toast({
        title: 'Regenerate Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRegenerating(null);
    }
  }, [regenerating, guidesForIssue, enabledGuides, callFn, buildAuthBody, adjustText, parseErrorToast, toast]);

  // ===== FULL REWRITE FALLBACK (unchanged internals) =====
  const openRewrite = useCallback((id: string, related: string[]) => {
    setRewriteTargetId(id);
    setRewriteContradictions(related);
    setCustomInstructions('');
    setRewrittenContent(null);
  }, []);

  const cancelRewrite = useCallback(() => {
    setRewriteTargetId(null);
    setRewriteContradictions([]);
    setCustomInstructions('');
    setRewrittenContent(null);
  }, []);

  const handleRewrite = useCallback(async () => {
    if (!rewriteTarget || isRewriting) return;
    setIsRewriting(true);
    try {
      const data = await callFn(buildAuthBody({
        action: 'rewrite',
        targetGuide: { id: rewriteTarget.id, name: rewriteTarget.name, content: rewriteTarget.content },
        otherGuides: enabledGuides
          .filter(g => g.id !== rewriteTarget.id)
          .map(g => ({ name: g.name, content: g.content })),
        contradictions: rewriteContradictions,
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
  }, [rewriteTarget, isRewriting, callFn, buildAuthBody, enabledGuides, rewriteContradictions, customInstructions, toast]);

  const acceptRewrite = useCallback(() => {
    if (!rewriteTarget || !rewrittenContent) return;
    const entry: UndoEntry = {
      guideId: rewriteTarget.id,
      guideName: rewriteTarget.name,
      prevContent: rewriteTarget.content,
      label: 'Full rewrite',
    };
    setUndoStack(prev => [...prev, entry]);
    const ok = onUpdate(rewriteTarget.id, { content: rewrittenContent });
    if (!ok) {
      setUndoStack(prev => prev.filter(e => e !== entry));
      return;
    }
    toast({ title: '✅ Guide rewritten', description: `"${rewriteTarget.name}" has been updated.` });
    setHint('Re-scan to verify.');
    cancelRewrite();
  }, [rewriteTarget, rewrittenContent, onUpdate, toast, cancelRewrite]);

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
              <div className="text-[10px] text-white/40">Scan your guides and apply surgical fixes</div>
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

              {/* Scan modes */}
              <div className="flex flex-wrap gap-1.5">
                {MODE_CHIPS.map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => toggleMode(chip.key)}
                    className={cn(
                      'px-3 py-2 rounded-full text-[11px] border transition-all',
                      modes[chip.key]
                        ? 'bg-emerald-600/30 border-emerald-500/40 text-emerald-100'
                        : 'bg-white/5 border-white/10 text-white/40'
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-white/40">
                {enabledGuides.length} enabled guide{enabledGuides.length === 1 ? '' : 's'} will be scanned.
              </p>

              <button
                onClick={handleScan}
                disabled={isChecking || !canScan}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-cinzel transition-all',
                  canScan && !isChecking
                    ? 'bg-gradient-to-r from-emerald-600/60 to-teal-600/40 border border-emerald-500/30 text-emerald-100 hover:from-emerald-600/80 hover:to-teal-600/60'
                    : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                )}
                style={{ touchAction: 'manipulation' }}
              >
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {isChecking ? 'Scanning…' : 'Scan & Fix'}
              </button>

              {!canScan && (
                <p className="text-[11px] text-amber-300/70">
                  {onlyContradictions
                    ? 'Enable at least 2 guides to run a check.'
                    : 'Enable at least 1 guide to run a check.'}
                </p>
              )}

              {hint && <p className="text-[11px] text-emerald-300/70">{hint}</p>}

              {/* No issues */}
              {hasRun && issues.length === 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-900/20 px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-emerald-200">
                    No issues found across {enabledGuides.length} guides
                  </span>
                </div>
              )}

              {/* Summary row */}
              {issues.length > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-[11px] text-white/60">
                    {issues.length} issue{issues.length === 1 ? '' : 's'} · {totalFixes} proposed fix{totalFixes === 1 ? '' : 'es'}
                  </span>
                  <button
                    onClick={fixAll}
                    disabled={pendingCount === 0}
                    className={cn(
                      'px-3 py-2 rounded-lg text-[11px] font-cinzel border transition-all',
                      pendingCount > 0
                        ? 'bg-emerald-600/40 border-emerald-500/30 text-emerald-100'
                        : 'bg-white/5 border-white/10 text-white/30'
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    Fix All ({pendingCount})
                  </button>
                </div>
              )}

              {/* Undo stack */}
              {undoStack.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setShowUndoList(v => !v)}
                      className="flex items-center gap-1.5 text-[11px] text-white/60 py-1"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Recent changes ({undoStack.length})
                      {showUndoList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={undoAll}
                      className="px-3 py-2 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white/60"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Undo all
                    </button>
                  </div>
                  {showUndoList && (
                    <div className="space-y-1.5">
                      {undoStack.map((e, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-2">
                          <span className="text-[10px] text-white/50 truncate">
                            <span className="text-white/70">{e.guideName}</span> — {e.label}
                          </span>
                          <button
                            onClick={() => undoEntry(e)}
                            className="shrink-0 px-2.5 py-1.5 rounded text-[10px] text-emerald-300 bg-emerald-900/30 border border-emerald-500/20"
                            style={{ touchAction: 'manipulation' }}
                          >
                            Undo
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Issue cards */}
              {issues.length > 0 && (
                <div className="space-y-2">
                  {issues.map(issue => {
                    const involved = guidesForIssue(issue);
                    const names = issue.guideNames && issue.guideNames.length > 0
                      ? issue.guideNames
                      : involved.map(g => g.name);
                    const isRegen = regenerating === issue.id;
                    const showAdjust = !!adjustOpen[issue.id];

                    return (
                      <div key={issue.id} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide',
                            TYPE_STYLES[issue.type] || TYPE_STYLES.contradiction
                          )}>
                            {TYPE_LABELS[issue.type] || issue.type}
                          </span>
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide',
                            SEVERITY_STYLES[issue.severity || 'low'] || SEVERITY_STYLES.low
                          )}>
                            {issue.severity || 'low'}
                          </span>
                        </div>

                        <p className="text-xs text-white/70 leading-relaxed">{issue.description}</p>

                        <div className="flex flex-wrap gap-1.5">
                          {names.map((n, j) => (
                            <span key={j} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/50">
                              {n}
                            </span>
                          ))}
                        </div>

                        {/* Fixes */}
                        <div className="space-y-2">
                          {issue.fixes.map((fix, index) => {
                            const status = fixStatus[fixKey(issue.id, index)] || 'pending';
                            const guideName = fix.guideName
                              || guides.find(g => g.id === fix.guideId)?.name
                              || 'Guide';

                            if (status === 'applied') {
                              return (
                                <div key={index} className="flex items-center justify-between gap-2 rounded-lg bg-emerald-900/25 border border-emerald-500/25 px-2.5 py-2">
                                  <span className="text-[11px] text-emerald-200 truncate">Applied to {guideName}</span>
                                  <button
                                    onClick={() => undoFixCard(issue.id, index, fix)}
                                    className="shrink-0 text-[11px] text-emerald-300 underline px-2 py-1"
                                    style={{ touchAction: 'manipulation' }}
                                  >
                                    Undo
                                  </button>
                                </div>
                              );
                            }

                            if (status === 'skipped') {
                              return (
                                <div key={index} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2.5 py-2">
                                  <span className="text-[11px] text-white/40 truncate">Skipped — {guideName}</span>
                                  <button
                                    onClick={() => restoreFix(issue.id, index)}
                                    className="shrink-0 text-[11px] text-white/60 underline px-2 py-1"
                                    style={{ touchAction: 'manipulation' }}
                                  >
                                    Restore
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div key={index} className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-1.5">
                                <div className="text-[11px] text-white/70">{guideName}</div>
                                {fix.reason && <div className="text-[10px] text-white/40 leading-relaxed">{fix.reason}</div>}

                                {fix.find !== '' && (
                                  <div className="rounded-lg border border-red-500/25 bg-red-950/30 p-2">
                                    <div className="text-[10px] text-red-300/80 mb-1">− REMOVE</div>
                                    <pre className="font-mono text-xs text-red-100/80 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{fix.find}</pre>
                                  </div>
                                )}
                                <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/30 p-2">
                                  <div className="text-[10px] text-emerald-300/80 mb-1">
                                    {fix.find === '' ? '+ APPEND TO END' : '+ ADD'}
                                  </div>
                                  <pre className="font-mono text-xs text-emerald-100/80 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{fix.replace}</pre>
                                </div>

                                {status === 'nomatch' && (
                                  <p className="text-[11px] text-amber-300/80">
                                    Couldn't match the original text — regenerate this fix below
                                  </p>
                                )}

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => applyFix(issue, fix, index)}
                                    className="flex-1 py-2.5 rounded-lg text-[11px] font-cinzel bg-gradient-to-r from-emerald-600/60 to-teal-600/40 border border-emerald-500/30 text-emerald-100"
                                    style={{ touchAction: 'manipulation' }}
                                  >
                                    Apply
                                  </button>
                                  <button
                                    onClick={() => skipFix(issue.id, index)}
                                    className="px-4 py-2.5 rounded-lg text-[11px] font-cinzel bg-white/5 border border-white/10 text-white/60"
                                    style={{ touchAction: 'manipulation' }}
                                  >
                                    Skip
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Adjust this fix */}
                        <button
                          onClick={() => setAdjustOpen(prev => ({ ...prev, [issue.id]: !prev[issue.id] }))}
                          className="flex items-center gap-1.5 text-[11px] text-white/50 py-2"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          Adjust this fix
                          {showAdjust ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {showAdjust && (
                          <div className="space-y-2">
                            <textarea
                              value={adjustText[issue.id] || ''}
                              onChange={e => setAdjustText(prev => ({ ...prev, [issue.id]: e.target.value }))}
                              placeholder="Tell the AI how you want this resolved..."
                              rows={3}
                              disabled={isRegen}
                              className="w-full bg-white/5 border border-emerald-900/30 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40 resize-none min-h-[70px]"
                            />
                            <button
                              onClick={() => regenerateIssue(issue)}
                              disabled={isRegen}
                              className={cn(
                                'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-cinzel transition-all',
                                isRegen
                                  ? 'bg-white/5 border border-white/10 text-white/30'
                                  : 'bg-emerald-900/40 border border-emerald-500/25 text-emerald-100'
                              )}
                              style={{ touchAction: 'manipulation' }}
                            >
                              {isRegen ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                              {isRegen ? 'Regenerating…' : 'Regenerate fix'}
                            </button>
                          </div>
                        )}

                        {/* Full rewrite fallback */}
                        {involved.length > 0 && (
                          <div className="flex flex-col gap-1 pt-1">
                            {involved.map(g => (
                              <button
                                key={g.id}
                                onClick={() => openRewrite(g.id, [issue.description])}
                                className="text-left text-[11px] text-white/40 underline py-2"
                                style={{ touchAction: 'manipulation' }}
                              >
                                Full rewrite of {g.name} instead…
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rewrite panel (fallback path) */}
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
