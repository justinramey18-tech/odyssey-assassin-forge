// Solo Empyrean: how each of the core cast sounds and moves (a voice fingerprint).
// Handed to the NPC as facts about themselves, never as a script. Everyone else gets a
// default from their temperament style. Pure data.
import type { Temperament } from './temperament';

export interface NpcVoice {
  /** How their sentences run. */
  rhythm: string;
  /** Their kind of language. */
  register: string;
  /** Where feeling shows on them. */
  shows: string;
  /** What gives them away when they are hiding something. */
  tell: string;
}

export const VOICES: Record<string, NpcVoice> = {
  'xaden-riorson': { rhythm: 'short, exact sentences; never a wasted word', register: 'dry, controlled, a commander used to being obeyed', shows: 'stillness and his eyes; the shadows near him stir when his control slips', tell: 'he gets quieter and more precise' },
  'dain-aetos': { rhythm: 'full, careful sentences that turn into rules', register: 'earnest and by the book', shows: 'his jaw and his hands: he reaches, then stops himself', tell: 'he over-explains and quotes regulations' },
  'garrick-tavis': { rhythm: 'easy and unhurried, a joke before the point', register: "plain soldier's talk", shows: 'his shoulders and his grin', tell: 'the humour drops out of his voice' },
  'bodhi-durran': { rhythm: 'quick and low, as if someone might overhear', register: 'plain and loyal', shows: 'glances over his shoulder; restless hands', tell: "he turns the talk to someone else's safety" },
  'mira-sorrengail': { rhythm: 'blunt and clipped, half of it orders', register: "an officer's bark with dry affection under it", shows: 'she checks people over with her eyes and her hands', tell: 'she goes brisk and practical' },
  'brennan-sorrengail': { rhythm: 'measured and warm, with a pause before anything hard', register: 'a tired older brother, gentle', shows: 'his hands; he rubs at old scars', tell: 'he answers with a question' },
  'lilith-sorrengail': { rhythm: 'few words, complete and final', register: 'cold command', shows: 'absolute stillness and a single look', tell: 'nothing shows; she simply ends the conversation' },
  'jack-barlowe': { rhythm: 'drawn-out taunts; he repeats the word that hurt', register: 'sneering and crude', shows: 'he crowds your space and smiles too wide', tell: 'the smile gets friendlier' },
  'jesinia-neilwart': { rhythm: 'precise and complete (she signs: write what she signs as her words)', register: 'bookish and exact, a little formal', shows: 'her hands and her eyebrows', tell: 'her signing gets smaller and faster' },
  'sloane-mairi': { rhythm: 'sharp and short, ending on a jab', register: 'a raw, angry first-year', shows: 'chin up, fists closed', tell: 'she attacks instead of answering' },
  'aaric-graycastle': { rhythm: 'spare and even, giving nothing away', register: 'well-bred and careful', shows: 'watchful eyes and a very controlled posture', tell: 'he turns the question back on you' },
  'violet-sorrengail': { rhythm: 'quick and thoughtful; facts tumble out when she is nervous', register: 'bookish with a dry edge', shows: 'she fidgets with her braid or a dagger hilt and shifts her weight off sore joints', tell: 'she recites facts' },
  'rhiannon-matthias': { rhythm: 'warm, direct and steady', register: "plain, a leader's calm", shows: 'open hands, a squared stance, a touch on the shoulder', tell: 'she becomes very reasonable' },
  'ridoc-gamlyn': { rhythm: 'fast, jokes stacked on jokes, the serious part arriving late', register: 'irreverent', shows: 'his whole body: the grin, the sprawl, the gestures', tell: 'the joke comes a beat too fast' },
  'imogen-cardulo': { rhythm: 'flat, short and cutting', register: 'bored contempt', shows: 'an eye-roll; a blade turning in her fingers', tell: 'she goes silent and stares' },
  'liam-mairi': { rhythm: 'gentle, even and earnest', register: 'polite and plain', shows: 'busy hands (he whittles); he stays close', tell: 'he looks at his hands' },
  'sawyer-henrick': { rhythm: 'a hesitant start, then solid', register: 'plain and modest', shows: 'he rubs the back of his neck and shifts his feet', tell: 'he mumbles and trails off' },
  'quinn-hollis': { rhythm: 'bright, quick and teasing', register: 'breezy', shows: 'she bounces on her feet; a big grin', tell: 'she laughs it off' },
};

const DEFAULT_VOICES: Record<Temperament['style'], NpcVoice> = {
  quiet: { rhythm: 'few words, chosen with care', register: 'plain', shows: 'small things: the eyes, the hands', tell: 'they say even less' },
  normal: { rhythm: 'ordinary, unhurried sentences', register: 'plain', shows: 'the face and the hands', tell: 'they hesitate before answering' },
  loud: { rhythm: 'quick and full, thinking out loud', register: 'plain and forward', shows: 'the whole body', tell: 'they talk faster' },
};

/** The voice for an NPC: hand-written for the core cast, a style default for everyone else. */
export function voiceFor(key: string, style: Temperament['style'] = 'normal'): NpcVoice {
  return VOICES[key] ?? DEFAULT_VOICES[style];
}
