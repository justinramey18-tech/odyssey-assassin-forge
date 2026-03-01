import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Ghost, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_GUIDE_LENGTH = 2000;

interface AfkPersonalityGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyId: string;
  userId: string;
  characterName: string;
  currentGuide: string | null;
  onSaved: (guide: string | null) => void;
}

export function AfkPersonalityGuide({
  open,
  onOpenChange,
  partyId,
  userId,
  characterName,
  currentGuide,
  onSaved,
}: AfkPersonalityGuideProps) {
  const [guide, setGuide] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setGuide(currentGuide || '');
    }
  }, [open, currentGuide]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: member } = await (supabase.from('party_members') as any)
        .select('character_status')
        .eq('party_id', partyId)
        .eq('user_id', userId)
        .single();

      const currentStatus = (member?.character_status as Record<string, unknown>) || {};
      const trimmed = guide.trim() || null;

      await (supabase.from('party_members') as any)
        .update({
          character_status: {
            ...currentStatus,
            afkPersonalityGuide: trimmed,
          },
        })
        .eq('party_id', partyId)
        .eq('user_id', userId);

      onSaved(trimmed);
      toast.success(trimmed ? 'AFK guide saved!' : 'AFK guide removed');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save AFK guide:', err);
      toast.error('Failed to save AFK guide');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setGuide('');
    setSaving(true);
    try {
      const { data: member } = await (supabase.from('party_members') as any)
        .select('character_status')
        .eq('party_id', partyId)
        .eq('user_id', userId)
        .single();

      const currentStatus = (member?.character_status as Record<string, unknown>) || {};

      await (supabase.from('party_members') as any)
        .update({
          character_status: {
            ...currentStatus,
            afkPersonalityGuide: null,
          },
        })
        .eq('party_id', partyId)
        .eq('user_id', userId);

      onSaved(null);
      toast.success('AFK guide removed');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to clear AFK guide:', err);
      toast.error('Failed to clear AFK guide');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] max-h-[100dvh] p-0 bg-background/95 backdrop-blur-xl border-t-2 border-purple-500/30 rounded-none flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="p-4 pb-2 border-b border-purple-500/20 bg-purple-950/30 shrink-0">
          <SheetTitle className="font-cinzel text-lg flex items-center gap-2 text-purple-200">
            <Ghost className="w-5 h-5 text-purple-400" />
            AFK Personality Guide
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Describe how {characterName} should act when you're away. The AI will roleplay your character using this guide when the round timer expires.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
          <Textarea
            value={guide}
            onChange={(e) => setGuide(e.target.value.slice(0, MAX_GUIDE_LENGTH))}
            placeholder={`Example: ${characterName} is cautious and always protects the party healer. They prefer ranged attacks and will retreat if HP drops below 30%. They speak with dry sarcasm and rarely trust strangers.`}
            className="min-h-[200px] flex-1 resize-y bg-background/50 border-border/50 focus:border-purple-500/50 focus:ring-purple-500/20"
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {guide.length}/{MAX_GUIDE_LENGTH}
          </p>
        </div>

        <SheetFooter className="p-4 pt-2 border-t border-purple-500/20 shrink-0 gap-2 sm:gap-2 flex-row justify-end">
          {currentGuide && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={saving}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </Button>
          )}
          <Button
            onClick={handleSave}
            size="sm"
            disabled={saving}
            className="gap-1 bg-purple-900/60 border border-purple-500/30 hover:bg-purple-900/80 text-purple-200"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Guide'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
