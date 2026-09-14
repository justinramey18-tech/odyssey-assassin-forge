// A reply in the Live DM Table is encoded as a prefix on the message content:
//
//   [reply:8f3a...]\nActual message text here
//
// This keeps replies out of the database schema entirely. Same approach as the
// [image:URL] convention used by the main DM stream.

/** Matches the reply prefix at the very start of a message. */
export const REPLY_PREFIX_REGEX = /^\s*\[reply:([0-9a-fA-F-]{8,})\]\s*\n?/;

export interface ParsedReply {
  /** The id of the message being replied to, or null. */
  replyToId: string | null;
  /** The message text with the prefix removed. */
  body: string;
}

/** Splits a stored message into its reply pointer and its visible text. */
export function parseReply(content: string): ParsedReply {
  const raw = content || '';
  const match = raw.match(REPLY_PREFIX_REGEX);
  if (!match) return { replyToId: null, body: raw };
  return { replyToId: match[1], body: raw.slice(match[0].length) };
}

/** Builds the stored content for a reply. */
export function formatReply(replyToId: string | null, body: string): string {
  const text = body ?? '';
  return replyToId ? `[reply:${replyToId}]\n${text}` : text;
}

/** The visible text only. Safe to call on content that has no prefix. */
export function stripReply(content: string): string {
  return parseReply(content).body;
}

/** A one-line preview of a quoted message, for the composer bar and the bubble. */
export function quotePreview(content: string, max = 90): string {
  const body = stripReply(content).replace(/\s+/g, ' ').trim();
  const shown = body.replace(/^\[image:.*\]$/, '📷 Picture');
  return shown.length > max ? `${shown.slice(0, max)}…` : shown;
}
