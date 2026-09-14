// Alignment flavours for the "suggest my next move" picker. Choosing one asks the
// generator for 4 suggestions that all sit in that alignment, ordered from the
// mildest expression of it to the boldest.

export interface RpFlavor {
  id: string;
  /** Shown on the card, two lines. */
  law: string;
  moral: string;
  /** Full name sent to the generator. */
  label: string;
  emoji: string;
  /** One line under the card title. */
  blurb: string;
  /** Tailwind classes for the card's border, background and title colour. */
  accent: string;
  titleColor: string;
  /** Sent to the model to pin down what this alignment actually means in play. */
  guidance: string;
}

export const RP_FLAVORS: RpFlavor[] = [
  {
    id: 'lawful-good',
    law: 'Lawful', moral: 'Good', label: 'Lawful Good',
    emoji: '⚖️',
    blurb: 'By the book, for the right reasons',
    accent: 'border-amber-400/30 bg-amber-500/5',
    titleColor: 'text-amber-300',
    guidance: 'Honour the rules, the oath and the chain of command, and use them to protect people. Work through proper channels even when it is slower. Keep your word at cost to yourself.',
  },
  {
    id: 'neutral-good',
    law: 'Neutral', moral: 'Good', label: 'Neutral Good',
    emoji: '💛',
    blurb: 'Do good, however it needs doing',
    accent: 'border-emerald-400/30 bg-emerald-500/5',
    titleColor: 'text-emerald-300',
    guidance: 'Help the person in front of you. Follow rules when they help and set them aside when they do not. No ideology, just decency applied practically.',
  },
  {
    id: 'chaotic-good',
    law: 'Chaotic', moral: 'Good', label: 'Chaotic Good',
    emoji: '🕊️',
    blurb: 'Break the rules, save the person',
    accent: 'border-sky-400/30 bg-sky-500/5',
    titleColor: 'text-sky-300',
    guidance: 'Freedom and kindness over order. Defy authority, improvise, cause a scene if it gets someone out alive. Never cruel, frequently inconvenient.',
  },
  {
    id: 'lawful-neutral',
    law: 'Lawful', moral: 'Neutral', label: 'Lawful Neutral',
    emoji: '📜',
    blurb: 'The system, whatever it serves',
    accent: 'border-slate-400/30 bg-slate-400/5',
    titleColor: 'text-slate-300',
    guidance: 'The code, contract or procedure matters more than the outcome. Consistent, reliable, unmoved by sob stories. Honour the letter of the deal exactly.',
  },
  {
    id: 'true-neutral',
    law: 'True', moral: 'Neutral', label: 'True Neutral',
    emoji: '⚪',
    blurb: 'Balance. Do not pick a side',
    accent: 'border-zinc-400/30 bg-zinc-400/5',
    titleColor: 'text-zinc-300',
    guidance: 'Stay out of it. Act in self-interest and equilibrium rather than principle. Withhold, observe, or take the option that keeps every door open.',
  },
  {
    id: 'chaotic-neutral',
    law: 'Chaotic', moral: 'Neutral', label: 'Chaotic Neutral',
    emoji: '🎲',
    blurb: "Whatever's interesting right now",
    accent: 'border-violet-400/30 bg-violet-500/5',
    titleColor: 'text-violet-300',
    guidance: 'Personal freedom above everything. Unpredictable, self-interested, allergic to being told what to do. Not malicious, just genuinely not anyone\'s ally.',
  },
  {
    id: 'lawful-evil',
    law: 'Lawful', moral: 'Evil', label: 'Lawful Evil',
    emoji: '🏛️',
    blurb: 'Cruelty, properly authorised',
    accent: 'border-orange-400/30 bg-orange-500/5',
    titleColor: 'text-orange-300',
    guidance: 'Use the rules as a weapon. Leverage contracts, hierarchy and technicality to take what you want while remaining technically compliant. Never break a deal — write better deals.',
  },
  {
    id: 'neutral-evil',
    law: 'Neutral', moral: 'Evil', label: 'Neutral Evil',
    emoji: '🐍',
    blurb: 'Whatever gets me what I want',
    accent: 'border-rose-400/30 bg-rose-500/5',
    titleColor: 'text-rose-300',
    guidance: 'Pure self-interest with no scruples and no theatrics. Betray, lie or abandon when it pays. Avoid unnecessary risk and unnecessary mercy alike.',
  },
  {
    id: 'chaotic-evil',
    law: 'Chaotic', moral: 'Evil', label: 'Chaotic Evil',
    emoji: '🔥',
    blurb: 'Burn it. See what happens',
    accent: 'border-red-500/30 bg-red-500/5',
    titleColor: 'text-red-300',
    guidance: 'Destruction and appetite, unrestrained. Escalate, provoke, wreck the plan for the pleasure of it. Consequences are somebody else\'s problem.',
  },
];

export function getRpFlavor(id: string): RpFlavor | undefined {
  return RP_FLAVORS.find(f => f.id === id);
}
