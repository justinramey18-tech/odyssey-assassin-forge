import { useState, useCallback } from 'react';
import { X, Copy, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SessionZeroWizardProps {
  open: boolean;
  onClose: () => void;
  addGuide: (name: string, content: string, customId?: string) => boolean;
}

const CONTENT_BOUNDARIES = [
  { id: 'romance', label: 'Romance', icon: '💕' },
  { id: 'graphic-violence', label: 'Graphic Violence', icon: '⚔️' },
  { id: 'horror', label: 'Horror', icon: '👻' },
  { id: 'character-death', label: 'Character Death', icon: '💀' },
  { id: 'pvp', label: 'PvP Conflict', icon: '🤺' },
  { id: 'psychological', label: 'Psychological Themes', icon: '🧠' },
];

const BACKSTORY_OPTIONS = ['Light', 'Medium', 'Deep'] as const;
const SESSION_LENGTH_OPTIONS = ['Short (30 min)', 'Standard (1 hr)', 'Long (2+ hrs)'] as const;
const PLAYER_STYLE_OPTIONS = ['Combat-focused', 'RP-focused', 'Exploration-focused', 'Balanced'] as const;

const WIZARD_GUIDE_ID = 'empyrean-session-zero';

function generateGuide(
  boundaries: Set<string>,
  backstory: string,
  sessionLength: string,
  playerStyle: string,
  hooks: string,
): string {
  const allowedContent = CONTENT_BOUNDARIES
    .map(b => `- ${b.label}: ${boundaries.has(b.id) ? '✅ Allowed' : '❌ Off-limits'}`)
    .join('\n');

  const backstoryText: Record<string, string> = {
    Light: 'Keep backstory references minimal. The character exists in the present. Past events are mentioned only when directly relevant to current situations. No elaborate flashbacks.',
    Medium: 'Weave backstory into the narrative periodically. Reference past events, relationships, and motivations when they connect to current situations. Include occasional flashback scenes when dramatically appropriate.',
    Deep: "Deeply integrate the character's history into every major arc. Past choices have present consequences. NPCs from the backstory appear. Flashback scenes are regular features. The past is never truly past.",
  };

  const pacingText: Record<string, string> = {
    'Short (30 min)': 'Sessions are brief. Cut to the action quickly. Limit social scenes to 1-2 exchanges. One combat encounter maximum. End each session with a clear hook for next time.',
    'Standard (1 hr)': 'Standard pacing. Balance 2-3 scenes per session: typically one social/exploration scene, one combat or challenge, and one narrative development moment. End with a cliffhanger or revelation.',
    'Long (2+ hrs)': "Extended sessions allow for full narrative arcs within a single sitting. Include multiple combat encounters, extended social scenes, and deep roleplay moments. Allow scenes to breathe — don't rush transitions.",
  };

  const styleText: Record<string, string> = {
    'Combat-focused': 'Prioritize tactical encounters, combat scenarios, and physical challenges. Social scenes should serve to set up the next fight. Include environmental hazards, multi-phase encounters, and strategic choices in every session.',
    'RP-focused': 'Prioritize dialogue, character development, and social dynamics. Combat is meaningful and character-driven, not random encounters. NPCs have depth and agendas. Every interaction should reveal something about the world or characters.',
    'Exploration-focused': 'Prioritize discovery, world-building, and environmental storytelling. Include hidden locations, ancient mysteries, and the unknown. Combat arises from exploration, not the other way around. Reward curiosity and investigation.',
    Balanced: 'Maintain equal emphasis on combat, roleplay, and exploration. Rotate focus between sessions to keep variety high. Each session should include elements of at least two of the three pillars.',
  };

  const hooksSection = hooks ? `\n## Character Hooks\n${hooks}` : '';

  return `# Session Zero Configuration

## Content Boundaries
${allowedContent}

When content marked "Off-limits" would naturally occur in the narrative, fade to black, skip ahead, or redirect the scene. Never surprise the player with excluded content.

## Backstory Integration — ${backstory}
${backstoryText[backstory] ?? ''}

## Session Pacing — ${sessionLength}
${pacingText[sessionLength] ?? ''}

## Player Style — ${playerStyle}
${styleText[playerStyle] ?? ''}
${hooksSection}`;
}

export function SessionZeroWizard({ open, onClose, addGuide }: SessionZeroWizardProps) {
  const [boundaries, setBoundaries] = useState<Set<string>>(new Set(['romance', 'character-death']));
  const [backstory, setBackstory] = useState<string>('Medium');
  const [sessionLength, setSessionLength] = useState<string>('Standard (1 hr)');
  const [playerStyle, setPlayerStyle] = useState<string>('Balanced');
  const [hooks, setHooks] = useState('');
  const [copied, setCopied] = useState(false);

  const toggleBoundary = useCallback((id: string) => {
    setBoundaries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const generated = generateGuide(boundaries, backstory, sessionLength, playerStyle, hooks);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      toast.success('Session Zero guide copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [generated]);

  const handleInstall = useCallback(() => {
    const success = addGuide('Session Zero Config', generated, WIZARD_GUIDE_ID);
    if (success) toast.success('Session Zero guide installed!');
  }, [addGuide, generated]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[62] flex flex-col bg-gradient-to-b from-background via-background to-background/95">
      <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">📋</span>
          <h2 className="text-lg font-cinzel font-bold text-emerald-400">Session Zero</h2>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto pb-20">
          {/* Content Boundaries */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Content Boundaries</h3>
            <div className="space-y-2">
              {CONTENT_BOUNDARIES.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/30">
                  <div className="flex items-center gap-2">
                    <span>{b.icon}</span>
                    <span className="text-sm">{b.label}</span>
                  </div>
                  <Switch checked={boundaries.has(b.id)} onCheckedChange={() => toggleBoundary(b.id)} />
                </div>
              ))}
            </div>
          </div>

          {/* Backstory Depth */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Backstory Depth</h3>
            <div className="flex gap-2">
              {BACKSTORY_OPTIONS.map(opt => (
                <button key={opt} onClick={() => setBackstory(opt)} className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all min-h-[44px]",
                  backstory === opt ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "border-border/50 text-muted-foreground hover:text-foreground",
                )}>{opt}</button>
              ))}
            </div>
          </div>

          {/* Session Length */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Session Length</h3>
            <div className="flex flex-col gap-2">
              {SESSION_LENGTH_OPTIONS.map(opt => (
                <button key={opt} onClick={() => setSessionLength(opt)} className={cn(
                  "py-2.5 px-3 rounded-lg text-sm font-medium border transition-all min-h-[44px] text-left",
                  sessionLength === opt ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "border-border/50 text-muted-foreground hover:text-foreground",
                )}>{opt}</button>
              ))}
            </div>
          </div>

          {/* Player Style */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Player Style</h3>
            <div className="grid grid-cols-2 gap-2">
              {PLAYER_STYLE_OPTIONS.map(opt => (
                <button key={opt} onClick={() => setPlayerStyle(opt)} className={cn(
                  "py-2.5 px-3 rounded-lg text-sm font-medium border transition-all min-h-[44px]",
                  playerStyle === opt ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "border-border/50 text-muted-foreground hover:text-foreground",
                )}>{opt}</button>
              ))}
            </div>
          </div>

          {/* Character Hooks */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-semibold text-foreground">Character Hooks</h3>
            <textarea
              value={hooks}
              onChange={e => setHooks(e.target.value)}
              placeholder="Optional: describe your character's goals, fears, or backstory hooks..."
              className="w-full h-24 rounded-lg border border-border/50 bg-card/30 px-3 py-2 text-sm resize-none focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy} className="flex-1 gap-2 h-11">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button onClick={handleInstall} className="flex-1 gap-2 h-11 bg-emerald-600 hover:bg-emerald-500 text-white">
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
