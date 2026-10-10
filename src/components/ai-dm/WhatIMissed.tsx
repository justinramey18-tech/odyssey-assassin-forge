// Player stand-ins: when the host played your character as a live NPC while you were away,
// this shows the notes it remembered so you can catch up.
import { useEffect, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { NpcMemoryNote, PartyNpcsApi } from '@/hooks/use-party-npcs';

export function WhatIMissed({ roster, userId }: { roster: PartyNpcsApi; userId: string }) {
  const standIn = roster.npcs.find(n => n.player_user_id === userId) ?? null;
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<NpcMemoryNote[] | null>(null);

  useEffect(() => {
    if (!open || !standIn) return;
    setNotes(null);
    roster.loadMemories(standIn.id).then(setNotes).catch(() => setNotes([]));
  }, [open, standIn?.id, roster.loadMemories]);

  if (!standIn) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ touchAction: 'manipulation' }}
        className="fixed z-[55] right-3 bottom-28 min-h-[48px] px-4 rounded-full border border-amber-400/50 bg-background/90 text-[13px] text-amber-100 font-cinzel flex items-center gap-2 shadow-lg"
      >
        <BookOpen className="w-4 h-4" /> What I Missed
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          <SheetTitle className="font-cinzel text-amber-300">What I Missed</SheetTitle>
          <SheetDescription className="text-[12px]">
            What {standIn.name} remembers from while the AI played them{standIn.on_stage ? ' (still on stage now)' : ''}.
          </SheetDescription>
          <div className="mt-3 space-y-2 pb-4">
            {notes === null ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : notes.length === 0 ? (
              <p className="text-[13px] text-muted-foreground py-4 text-center">Nothing remembered yet. Notes appear after the scene is handed to the DM.</p>
            ) : notes.map(n => (
              <p key={n.id} className="rounded-lg border border-border bg-muted/30 p-3 text-[14px] leading-snug">{n.note}</p>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
