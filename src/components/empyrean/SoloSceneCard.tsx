// Solo Empyrean story feed: what the rider sent from the Live Table, drawn as the table's own
// lines in the order they were said, each with its speaker's portrait (like the party story).
// Anything that is not a Live Table hand-off (an older typed prompt, say) is shown as plain text.
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { parseHandoffScene } from '@/lib/live-npc-tandem';
import { cn } from '@/lib/utils';

interface SoloSceneCardProps {
  /** The sent text, hidden tags already removed. */
  content: string;
  riderName: string;
  riderPortrait?: string;
  /** NPC portraits by lower-cased name. */
  npcPortraits: Record<string, string | undefined>;
}

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

export function SoloSceneCard({ content, riderName, riderPortrait, npcPortraits }: SoloSceneCardProps) {
  const scene = useMemo(() => parseHandoffScene(content), [content]);
  if (!scene) return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  return (
    <div className="space-y-2.5">
      {scene.lines.map((line, i) => {
        const portrait = line.npc ? npcPortraits[line.name.toLowerCase()] : riderPortrait;
        return (
          <div key={i} className="flex items-start gap-2">
            <div className={cn(
              'shrink-0 w-9 h-9 rounded-full overflow-hidden border flex items-center justify-center text-[11px] font-cinzel',
              line.npc ? 'border-homebrew-glow/40 bg-homebrew/10 text-homebrew-foreground' : 'border-primary/40 bg-primary/10 text-primary',
            )}>
              {portrait
                ? <img src={portrait} alt="" loading="lazy" className="w-full h-full object-cover" />
                : <span aria-hidden="true">{initials(line.name || riderName)}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-[12px] font-semibold leading-tight', line.npc ? 'text-homebrew-glow' : 'text-primary')}>
                {line.name || riderName}
                {line.whisper && <span className="ml-1.5 text-[11px] font-normal italic text-muted-foreground">🤫 whispered to you</span>}
              </p>
              <div className="text-sm break-words">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1 last:mb-0 whitespace-pre-wrap">{children}</p>,
                    em: ({ children }) => <em className="text-homebrew-glow/90">{children}</em>,
                  }}
                >
                  {line.text}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );
      })}
      {scene.tableTalk.length > 0 && (
        <div className="border-t border-border/20 pt-2">
          <p className="text-[11px] font-semibold text-muted-foreground">Table talk</p>
          <p className="text-xs italic text-muted-foreground whitespace-pre-wrap">{scene.tableTalk.join('\n')}</p>
        </div>
      )}
      {scene.notes.map((note, i) => (
        <p key={`note-${i}`} className="text-[11px] italic text-muted-foreground">{note}</p>
      ))}
    </div>
  );
}