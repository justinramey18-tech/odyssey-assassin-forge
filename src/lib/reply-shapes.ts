// Solo Empyrean: a different shape for each DM reply, so replies do not all look alike.
// Each turn the DM is offered two shapes; two turns in a row never share one. Pure functions only.

export interface ReplyShape { id: string; text: string }
export const REPLY_SHAPES: ReplyShape[] = [
  { id: 'quick', text: 'Quick beat: two or three short paragraphs. Answer the action, show one thing going on nearby, and stop.' },
  { id: 'talk', text: 'Mostly dialogue: people talking, to the rider or to each other, with only a line or two of description.' },
  { id: 'slow', text: 'One slow scene: stay in a single place and moment and let it unfold in detail.' },
  { id: 'elsewhere', text: 'Open on someone else: begin with other people and what they are doing, and reach the rider partway through.' },
  { id: 'moving', text: 'On the move: cover ground or time briskly, passing several small things, and land somewhere new.' },
  { id: 'close', text: 'Small and close: one or two paragraphs built on a single detail of sound, smell or touch, then the answer to the action.' },
  { id: 'cut', text: 'Hard cut: start in the middle of what happens next, with no lead-in, and end on an unfinished moment.' },
];

/** The two shapes offered for the reply after `turn` DM replies. Consecutive turns never share a shape. */
export function offeredShapes(turn: number): [ReplyShape, ReplyShape] {
  const n = REPLY_SHAPES.length;
  const t = Number.isFinite(turn) && turn > 0 ? Math.floor(turn) : 0;
  return [REPLY_SHAPES[(2 * t) % n], REPLY_SHAPES[(2 * t + 1) % n]];
}

/** The section added to the solo DM's instructions for the next reply. */
export function replyShapeSection(turn: number): string {
  const [a, b] = offeredShapes(turn);
  return [
    '## SHAPE OF THIS REPLY',
    '',
    'So that replies do not all look alike, write this reply in one of these two shapes, whichever fits the moment better:',
    `- ${a.text}`,
    `- ${b.text}`,
    'When the scene moves to a new place or skips ahead in time, put a line with only *** on it between the two parts. Put each spoken line in double quotation marks.',
    "Do not repeat the shape of your previous reply. The moment still wins: if the player's action needs something else, serve the action. Hidden tags, checks, app rulings and GAME FACTS work exactly as before. Never mention shapes to the player.",
  ].join('\n');
}
