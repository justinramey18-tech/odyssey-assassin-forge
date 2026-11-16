// The first scene of a solo Empyrean campaign (CL-067).
// When the DM screen opens with an opening message (a campaign the Empyrean Guide just built, a
// saved opening scene, or a prompt from the library), it is sent once the chat is empty.
// - A fresh start clears an older story at most once per opening; a message sent afterwards
//   (the player's or the DM's) is never wiped.
// - The short delay before sending is not restarted when the screen re-renders, so a busy screen
//   cannot keep pushing the send back for ever.
import { useEffect, useRef } from 'react';

export interface EmpyreanOpeningOptions {
  open: boolean;
  initialMessage?: string | null;
  startFresh?: boolean;
  messageCount: number;
  isLoading: boolean;
  newGame: () => void;
  sendMessage: (content: string) => unknown;
}

export const OPENING_DELAY_MS = 300;

export function useEmpyreanOpening(o: EmpyreanOpeningOptions): void {
  const { open, initialMessage, startFresh = false, messageCount, isLoading } = o;
  // 'idle' → (fresh start with an older story: 'cleared') → 'sent'. Back to 'idle' when the screen closes.
  const stepRef = useRef<'idle' | 'cleared' | 'sent'>('idle');
  const timerRef = useRef<number | null>(null);
  const latest = useRef(o);
  latest.current = o;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Clear the timer when the screen goes away.
  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (!open) {
      stepRef.current = 'idle';
      clearTimer();
      return;
    }
    if (!initialMessage || stepRef.current === 'sent' || timerRef.current !== null) return;
    if (startFresh && stepRef.current === 'idle' && messageCount > 0) {
      stepRef.current = 'cleared';
      latest.current.newGame();
      return;
    }
    if (messageCount > 0 || isLoading) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const now = latest.current;
      // Checked again at send time: the player may have sent something meanwhile.
      if (!now.open || !now.initialMessage || stepRef.current === 'sent' || now.messageCount > 0 || now.isLoading) return;
      stepRef.current = 'sent';
      void now.sendMessage(now.initialMessage);
    }, OPENING_DELAY_MS);
  }, [open, initialMessage, startFresh, messageCount, isLoading]);
}
