import { useCallback } from 'react';
import { Eye, Trash2, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

export interface ActiveOOCNote {
  id: string;
  text: string;
  turnsRemaining: number;
}

interface OOCNotesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: ActiveOOCNote[];
  onClearNote: (id: string) => void;
  onClearAll: () => void;
}

export function OOCNotesSheet({ open, onOpenChange, notes, onClearNote, onClearAll }: OOCNotesSheetProps) {
  const handleClearAll = useCallback(() => {
    onClearAll();
  }, [onClearAll]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[70vh] p-0 bg-background/95 backdrop-blur-lg border-t border-cyan-500/25 rounded-t-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-border/40">
          <SheetTitle className="text-base font-cinzel text-cyan-300 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Active OOC Notes
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
          {notes.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <Eye className="w-8 h-8 text-cyan-400/30 mx-auto" />
              <p className="text-sm font-cinzel text-foreground">No active notes</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                When you confirm an OOC note in "Talk to the DM", it appears here until its turns expire.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-cyan-200/70 italic leading-relaxed">
                The DM sees these silently on upcoming turns. They fade after their turn count reaches zero.
              </p>
              <div className="space-y-2">
                {notes.map(note => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs leading-relaxed text-white/85 flex-1 min-w-0">
                        {note.text}
                      </p>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-200">
                        {note.turnsRemaining} {note.turnsRemaining === 1 ? 'turn' : 'turns'} left
                      </span>
                    </div>
                    <button
                      onClick={() => onClearNote(note.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-400 transition-colors px-2 py-1 rounded"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear this note
                    </button>
                  </div>
                ))}
              </div>
              {notes.length > 1 && (
                <div className="pt-2">
                  <Button
                    onClick={handleClearAll}
                    variant="outline"
                    className="w-full gap-2 h-10 text-xs border-white/15 hover:bg-white/5 text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear all notes
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
