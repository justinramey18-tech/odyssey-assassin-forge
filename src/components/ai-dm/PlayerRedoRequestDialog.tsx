import { useState, useCallback } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface PlayerRedoRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => Promise<boolean>;
  hasExistingPending: boolean;
}

export function PlayerRedoRequestDialog({
  open, onOpenChange, onSubmit, hasExistingPending,
}: PlayerRedoRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const ok = await onSubmit(reason);
      if (ok) {
        toast.success('Request sent to host.');
        setReason('');
        onOpenChange(false);
      } else {
        toast.error('Failed to send request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [reason, onSubmit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request character redo</DialogTitle>
          <DialogDescription>
            {hasExistingPending
              ? "You already have a pending request. Wait for the host to respond before submitting another."
              : "Tell the host briefly why you'd like to rebuild your character. They'll approve or deny the request."
            }
          </DialogDescription>
        </DialogHeader>
        {!hasExistingPending && (
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional — e.g. 'My signet doesn't fit the campaign tone'"
            rows={3}
            maxLength={500}
            className="text-sm resize-none"
            disabled={isSubmitting}
          />
        )}
        <DialogFooter className="flex-col sm:flex-col gap-2">
          {!hasExistingPending && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send request
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={isSubmitting}
            className="w-full"
          >
            {hasExistingPending ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
