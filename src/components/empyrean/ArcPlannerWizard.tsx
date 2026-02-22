import { useState, useCallback, useMemo } from 'react';
import { X, Copy, Check, Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ArcPlannerWizardProps {
  open: boolean;
  onClose: () => void;
  addGuide: (name: string, content: string, customId?: string) => boolean;
}

const ARC_TEMPLATES = [
  { id: 'revenge', name: 'Revenge', icon: '🗡️', desc: 'Track down whoever wronged the character across escalating confrontations' },
  { id: 'redemption', name: 'Redemption', icon: '🕊️', desc: 'Fallen from grace — earn back trust through sacrifice' },
  { id: 'rise', name: 'Rise to Power', icon: '👑', desc: 'From nobody to leader through political maneuvering' },
  { id: 'mystery', name: 'Mystery Unraveled', icon: '🔍', desc: 'Investigate something wrong that nobody else sees' },
  { id: 'hunt', name: 'The Hunt', icon: '🎯', desc: 'A specific target must be found — each session narrows the search' },
  { id: 'war', name: 'War Campaign', icon: '⚔️', desc: 'Large-scale conflict escalating from skirmishes to full war' },
  { id: 'bond', name: 'Bond Tested', icon: '🐉', desc: 'Dragon bond is strained or evolving — each session pushes the relationship' },
] as const;

const SESSION_COUNTS = [3, 5, 8, 12] as const;

interface BranchPoint {
  session: number;
  choice: string;
  pathA: string;
  pathB: string;
}

const WIZARD_GUIDE_ID = 'empyrean-arc-plan';

function generateArcGuide(
  template: string,
  sessionCount: number,
  arcName: string,
  branches: BranchPoint[],
): string {
  const tmpl = ARC_TEMPLATES.find(t => t.id === template);
  const beats = [];
  
  if (sessionCount <= 3) {
    beats.push('Session 1: Setup — Establish the premise and stakes');
    beats.push('Session 2: Escalation — Raise the stakes, introduce the twist');
    beats.push('Session 3: Climax — Confrontation and resolution');
  } else if (sessionCount <= 5) {
    beats.push('Session 1: Hook — Draw the character in');
    beats.push('Session 2: Investigation — Gather information, make allies');
    beats.push('Session 3: Midpoint twist — Everything changes');
    beats.push('Session 4: Escalation — Racing toward the climax');
    beats.push('Session 5: Finale — Resolution and consequences');
  } else if (sessionCount <= 8) {
    beats.push('Sessions 1-2: Setup — World, stakes, and initial hook');
    beats.push('Sessions 3-4: Rising action — Complications compound');
    beats.push('Session 5: Midpoint crisis — Major revelation or setback');
    beats.push('Sessions 6-7: Escalation — Point of no return');
    beats.push('Session 8: Climax and resolution');
  } else {
    beats.push('Sessions 1-3: Act I — Setup, hook, and initial exploration');
    beats.push('Sessions 4-6: Act II-A — Rising action, alliances, and discoveries');
    beats.push('Sessions 7-8: Midpoint — Major twist or crisis');
    beats.push('Sessions 9-10: Act II-B — Consequences, escalation, betrayals');
    beats.push('Sessions 11-12: Act III — Climax, resolution, and aftermath');
  }

  const branchText = branches.length > 0
    ? `\n## Decision Points\n${branches.map((b, i) => `### Branch ${i + 1} (Session ${b.session})\n**Choice:** ${b.choice}\n- **Path A:** ${b.pathA}\n- **Path B:** ${b.pathB}`).join('\n\n')}`
    : '';

  return `# Arc Plan: ${arcName || tmpl?.name || 'Custom Arc'}

## Template: ${tmpl?.name ?? 'Custom'}
${tmpl?.desc ?? ''}

## Arc Length: ${sessionCount} Sessions

## Story Beats
${beats.map(b => `- ${b}`).join('\n')}
${branchText}

## DM Integration Notes
- Reference this arc plan when structuring each session
- Adjust pacing based on player engagement — skip or extend beats as needed
- Branch points are suggestions, not requirements — let player choices drive the narrative
- Each session should end with a hook connecting to the next beat`;
}

export function ArcPlannerWizard({ open, onClose, addGuide }: ArcPlannerWizardProps) {
  const [template, setTemplate] = useState('revenge');
  const [sessionCount, setSessionCount] = useState<number>(5);
  const [arcName, setArcName] = useState('');
  const [branches, setBranches] = useState<BranchPoint[]>([]);
  const [copied, setCopied] = useState(false);

  const addBranch = useCallback(() => {
    if (branches.length >= 3) return;
    setBranches(prev => [...prev, { session: Math.ceil(sessionCount / 2), choice: '', pathA: '', pathB: '' }]);
  }, [branches.length, sessionCount]);

  const removeBranch = useCallback((idx: number) => {
    setBranches(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateBranch = useCallback((idx: number, field: keyof BranchPoint, value: string | number) => {
    setBranches(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  }, []);

  const generated = useMemo(() => generateArcGuide(template, sessionCount, arcName, branches), [template, sessionCount, arcName, branches]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      toast.success('Arc plan copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  }, [generated]);

  const handleInstall = useCallback(() => {
    const name = arcName || ARC_TEMPLATES.find(t => t.id === template)?.name || 'Arc Plan';
    const success = addGuide(`Arc: ${name}`, generated, WIZARD_GUIDE_ID);
    if (success) toast.success('Arc plan installed as guide!');
  }, [addGuide, generated, arcName, template]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[62] flex flex-col bg-gradient-to-b from-background via-background to-background/95">
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-500/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🗺️</span>
          <h2 className="text-lg font-cinzel font-bold text-indigo-400">Arc Planner</h2>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto pb-20">
          {/* Arc Name */}
          <div className="space-y-2">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Arc Name</h3>
            <input
              value={arcName}
              onChange={e => setArcName(e.target.value)}
              placeholder="e.g. The Fall of House Riorson"
              className="w-full rounded-lg border border-border/50 bg-card/30 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 min-h-[44px]"
            />
          </div>

          {/* Template Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Arc Template</h3>
            <div className="space-y-2">
              {ARC_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)} className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left min-h-[44px]",
                  template === t.id ? "bg-indigo-500/20 border-indigo-500/50" : "border-border/40 hover:border-border/60",
                )}>
                  <span className="text-lg">{t.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Session Count */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Session Count</h3>
            <div className="flex gap-2">
              {SESSION_COUNTS.map(n => (
                <button key={n} onClick={() => setSessionCount(n)} className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all min-h-[44px]",
                  sessionCount === n ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400" : "border-border/50 text-muted-foreground",
                )}>{n}</button>
              ))}
            </div>
          </div>

          {/* Branching Points */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-cinzel font-semibold text-foreground">Decision Points</h3>
              {branches.length < 3 && (
                <Button variant="ghost" size="sm" onClick={addBranch} className="h-8 gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              )}
            </div>
            {branches.map((b, idx) => (
              <div key={idx} className="space-y-2 p-3 rounded-lg border border-border/40 bg-card/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Branch {idx + 1}</span>
                  <button onClick={() => removeBranch(idx)} className="p-1 hover:bg-muted/50 rounded"><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
                <input value={`Session ${b.session}`} onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, '')); if (n > 0 && n <= sessionCount) updateBranch(idx, 'session', n); }} placeholder="Session #" className="w-full rounded border border-border/40 bg-card/20 px-2 py-1.5 text-xs" />
                <input value={b.choice} onChange={e => updateBranch(idx, 'choice', e.target.value)} placeholder="The choice..." className="w-full rounded border border-border/40 bg-card/20 px-2 py-1.5 text-xs" />
                <input value={b.pathA} onChange={e => updateBranch(idx, 'pathA', e.target.value)} placeholder="Path A consequence..." className="w-full rounded border border-border/40 bg-card/20 px-2 py-1.5 text-xs" />
                <input value={b.pathB} onChange={e => updateBranch(idx, 'pathB', e.target.value)} placeholder="Path B consequence..." className="w-full rounded border border-border/40 bg-card/20 px-2 py-1.5 text-xs" />
              </div>
            ))}
            {branches.length === 0 && <p className="text-[11px] text-muted-foreground">No decision points — add up to 3</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy} className="flex-1 gap-2 h-11">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button onClick={handleInstall} className="flex-1 gap-2 h-11 bg-indigo-600 hover:bg-indigo-500 text-white">
              <Download className="w-4 h-4" />
              Install Guide
            </Button>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Preview</h3>
            <pre className="text-[11px] font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed bg-background/40 rounded-lg p-3 max-h-[40vh] overflow-y-auto border border-border/30">
              {generated}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
