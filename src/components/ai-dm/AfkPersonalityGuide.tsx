import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
      // Fetch current character_status first
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-2 border-purple-500/30 bg-card/95">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-lg flex items-center gap-2">
            <Ghost className="w-5 h-5 text-purple-400" />
            AFK Personality Guide
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Describe how {characterName} should act when you're away. The AI will roleplay your character using this guide when the round timer expires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={guide}
            onChange={(e) => setGuide(e.target.value.slice(0, MAX_GUIDE_LENGTH))}
            placeholder={`Example: ${characterName} is cautious and always protects the party healer. They prefer ranged attacks and will retreat if HP drops below 30%. They speak with dry sarcasm and rarely trust strangers.`}
            className="min-h-[160px] max-h-[300px] resize-y bg-background/50 border-border/50 focus:border-purple-500/50 focus:ring-purple-500/20"
            rows={6}
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {guide.length}/{MAX_GUIDE_LENGTH}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
