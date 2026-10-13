// Server-written Live Table lines (NPC replies) don't come back to the asking phone directly.
// After one is saved, ask the Live Table to re-read now and once more shortly after,
// so the line shows even when the live update is missed.
export const ROUND_CHAT_REFRESH_EVENT = 'odyssey-round-chat-refresh';
export const ROUND_CHAT_REFRESH_RETRY_MS = 2000;

export function requestRoundChatRefresh(partyId: string | null | undefined): void {
  if (!partyId || typeof window === 'undefined') return;
  const fire = () => window.dispatchEvent(new CustomEvent(ROUND_CHAT_REFRESH_EVENT, { detail: { partyId } }));
  fire();
  window.setTimeout(fire, ROUND_CHAT_REFRESH_RETRY_MS);
}
