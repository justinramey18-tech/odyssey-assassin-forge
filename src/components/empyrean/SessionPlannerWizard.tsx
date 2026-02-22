import { useState, useCallback, useMemo } from 'react';
import { X, Copy, Check, Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SessionPlannerWizardProps {
  open: boolean;
  onClose: () => void;
  addGuide: (name: string, content: string, customId?: string) => boolean;
}

const SESSION_TYPES = ['Heist', 'Trial', 'Downtime', 'Custom'] as const;
const COMPLICATIONS = ['Betrayal', 'Time Pressure', 'Moral Dilemma', 'Environmental Hazard', 'Unexpected Ally', 'None'] as const;
const ENDINGS = ['Cliffhanger', 'Resolution', "Player's Choice", 'Bittersweet'] as const;

interface NPC {
  name: string;
  role: string;
}

const WIZARD_GUIDE_ID = 'empyrean-session-plan';

function generateSessionGuide(
  sessionType: string,
  objective: string,
  npcs: NPC[],
  complication: string,
  ending: string,
): string {
  const npcSection = npcs.filter(n => n.name).length > 0
    ? `\n## Key NPCs\n${npcs.filter(n => n.name).map(n => `- **${n.name}** — ${n.role || 'Role TBD'}`).join('\n')}`
    : '';

  const compSection = complication !== 'None'
    ? `\n## Complication: ${complication}\nMid-session, introduce a ${complication.toLowerCase()} that forces the party to adapt their approach. This should not invalidate their preparation but should make the path forward more interesting and challenging.`
    : '';

  const typeDesc: Record<string, string> = {
    Heist: 'Structure: Planning → Execution → Improvisation. One job, high stakes.',
    Trial: 'Structure: Accusation → Defense → Verdict. Character faces judgment.',
    Downtime: 'Structure: Personal Time → Side Quest → Relationships. Breathing room between arcs.',
    Custom: 'Custom session structure — use the objective and complications below as your framework.',
  };

  const endingDesc: Record<string, string> = {
    Cliffhanger: 'End the session at the moment of highest tension — mid-battle, mid-revelation, or at the point of no return. Leave the outcome uncertain.',
    Resolution: "Bring the session's central conflict to a clear conclusion. Loose ends can remain, but the main objective should be resolved.",
    "Player's Choice": 'Present the final decision to the player. End the session at the moment of choice, letting them sit with it until next time — or let them choose and deal with immediate consequences.',
    Bittersweet: 'The objective is achieved, but at a cost. Something is gained and something is lost. The victory is real but tempered by consequence.',
  };

  return `# Session Plan: ${sessionType} Session

## Session Type: ${sessionType}
${typeDesc[sessionType] ?? ''}

## Primary Objective
${objective || 'No objective specified — improvise based on the current arc.'}
${npcSection}
${compSection}

## Desired Ending: ${ending}
${endingDesc[ending] ?? ''}

## DM Notes
- This plan is a framework, not a script — adapt to player actions
- If the session runs long, cut the complication or simplify the ending
- If the session runs short, expand NPC interactions or add environmental detail`;
}

export function SessionPlannerWizard({ open, onClose, addGuide }: SessionPlannerWizardProps) {
  const [sessionType, setSessionType] = useState<string>('Heist');
  const [objective, setObjective] = useState('');
  const [npcs, setNpcs] = useState<NPC[]>([{ name: '', role: '' }]);
  const [complication, setComplication] = useState<string>('None');
  const [ending, setEnding] = useState<string>('Cliffhanger');
  const [copied, setCopied] = useState(false);

  const addNPC = useCallback(() => {
    if (npcs.length >= 3) return;
    setNpcs(prev => [...prev, { name: '', role: '' }]);
  }, [npcs.length]);

  const removeNPC = useCallback((idx: number) => {
    setNpcs(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateNPC = useCallback((idx: number, field: keyof NPC, value: string) => {
    setNpcs(prev => prev.map((n, i) => i === idx ? { ...n, [field]: value } : n));
  }, []);

  const generated = useMemo(() => generateSessionGuide(sessionType, objective, npcs, complication, ending), [sessionType, objective, npcs, complication, ending]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      toast.success('Session plan copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  }, [generated]);

  const handleInstall = useCallback(() => {
    const success = addGuide(`Session: ${sessionType}`, generated, WIZARD_GUIDE_ID);
    if (success) toast.success('Session plan installed as guide!');
  }, [addGuide, generated, sessionType]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[62] flex flex-col bg-gradient-to-b from-background via-background to-background/95">
      <div className="flex items-center justify-between px-4 py-3 border-b border-rose-500/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎯</span>
          <h2 className="text-lg font-cinzel font-bold text-rose-400">Session Planner</h2>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto pb-20">
          {/* Session Type */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Session Type</h3>
            <div className="grid grid-cols-2 gap-2">
              {SESSION_TYPES.map(t => (
                <button key={t} onClick={() => setSessionType(t)} className={cn(
                  "py-2.5 px-3 rounded-lg text-sm font-medium border transition-all min-h-[44px]",
                  sessionType === t ? "bg-rose-500/20 border-rose-500/50 text-rose-400" : "border-border/50 text-muted-foreground",
                )}>{t}</button>
              ))}
            </div>
          </div>

          {/* Objective */}
          <div className="space-y-2">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Primary Objective</h3>
            <textarea
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="What's the main goal of this session?"
              className="w-full h-20 rounded-lg border border-border/50 bg-card/30 px-3 py-2 text-sm resize-none focus:outline-none focus:border-rose-500/50"
            />
          </div>

          {/* NPCs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-cinzel font-semibold text-foreground">Key NPCs</h3>
              {npcs.length < 3 && (
                <Button variant="ghost" size="sm" onClick={addNPC} className="h-8 gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              )}
            </div>
            {npcs.map((npc, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <input value={npc.name} onChange={e => updateNPC(idx, 'name', e.target.value)} placeholder="Name" className="w-full rounded border border-border/40 bg-card/20 px-2 py-1.5 text-sm min-h-[36px]" />
                  <input value={npc.role} onChange={e => updateNPC(idx, 'role', e.target.value)} placeholder="Role (e.g. antagonist, ally)" className="w-full rounded border border-border/40 bg-card/20 px-2 py-1.5 text-xs min-h-[32px]" />
                </div>
                {npcs.length > 1 && (
                  <button onClick={() => removeNPC(idx)} className="p-1.5 hover:bg-muted/50 rounded mt-1"><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                )}
              </div>
            ))}
          </div>

          {/* Complication */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Complication</h3>
            <div className="grid grid-cols-2 gap-2">
              {COMPLICATIONS.map(c => (
                <button key={c} onClick={() => setComplication(c)} className={cn(
                  "py-2 px-3 rounded-lg text-xs font-medium border transition-all min-h-[40px]",
                  complication === c ? "bg-rose-500/20 border-rose-500/50 text-rose-400" : "border-border/50 text-muted-foreground",
                )}>{c}</button>
              ))}
            </div>
          </div>

          {/* Ending */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Desired Ending</h3>
            <div className="grid grid-cols-2 gap-2">
              {ENDINGS.map(e => (
                <button key={e} onClick={() => setEnding(e)} className={cn(
                  "py-2 px-3 rounded-lg text-xs font-medium border transition-all min-h-[40px]",
                  ending === e ? "bg-rose-500/20 border-rose-500/50 text-rose-400" : "border-border/50 text-muted-foreground",
                )}>{e}</button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy} className="flex-1 gap-2 h-11">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button onClick={handleInstall} className="flex-1 gap-2 h-11 bg-rose-600 hover:bg-rose-500 text-white">
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
