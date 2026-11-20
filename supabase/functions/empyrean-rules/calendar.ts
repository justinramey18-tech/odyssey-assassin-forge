// Solo Empyrean canon calendar: Violet Sorrengail's first year at Basgiath (633 to 634 AU), written
// from the app's canon guides in our own words. No book text. Pure data and functions only (no Deno,
// no database), so the same file runs in the edge function and in the app's tests.
// Day 1 is Conscription Day. The campaign clock's day plus the campaign's calendar offset gives the canon day.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const START_YEAR = 633;
const dayOfYear = (month: number, day: number) => MONTH_DAYS.slice(0, month - 1).reduce((a, b) => a + b, 0) + day;
/** Conscription Day: July 20. */
const START_DOY = dayOfYear(7, 20);
/** The canon day for a calendar date. year 0 is 633 AU, year 1 is 634 AU. */
export const canonDayOf = (month: number, day: number, year = 0) => dayOfYear(month, day) - START_DOY + 1 + 365 * year;
export const CAL_MAX_DAY = 3650;
export const clampDay = (day: number) => Math.min(CAL_MAX_DAY, Math.max(1, Number.isFinite(day) ? Math.trunc(day) : 1));

/** "July 20, 633 AU" for a canon day. */
export function dateLabel(canonDay: number): string {
  let n = START_DOY + clampDay(canonDay) - 1;
  let year = START_YEAR;
  while (n > 365) { n -= 365; year += 1; }
  let month = 0;
  while (n > MONTH_DAYS[month]) { n -= MONTH_DAYS[month]; month += 1; }
  return `${MONTHS[month]} ${n}, ${year} AU`;
}

export interface CanonBeat {
  id: string;
  /** First and last canon day the beat is going on. */
  from: number;
  to: number;
  /** A date every cadet knows in advance. */
  scheduled?: boolean;
  title: string;
  what: string;
  /** Who is there to see it. */
  seen: string;
  /** How everyone else learns of it. null: they do not. */
  heard: string | null;
}

export const CANON_BEATS: CanonBeat[] = [
  {
    id: 'conscription', from: canonDayOf(7, 20), to: canonDayOf(7, 20), scheduled: true, title: 'Conscription Day',
    what: "Candidates climb the turret and cross the Parapet into the Riders Quadrant; nearly one in five falls this year. Jack Barlowe pushes a candidate off the Parapet. In the courtyard the survivors are sorted into squads. Violet Sorrengail and Rhiannon Matthias are put in Dain Aetos's Second Squad, Flame Section, which starts the day in Second Wing. After wingleader Xaden Riorson speaks with senior wingleader Nyra Voldaren, that section is swapped with Aura Beinhaven's into Fourth Wing. The swap is about Violet and Xaden.",
    seen: 'Every candidate in the courtyard sees the sorting and the swap. Only Xaden and Nyra know what was said.',
    heard: "The dead are read out at the next morning's death roll.",
  },
  {
    id: 'chakir', from: canonDayOf(7, 20), to: canonDayOf(7, 21), title: 'Attack on Chakir',
    what: 'On the night of Conscription Day an attack on Chakir kills 37 civilians before the Eastern Wing arrives.',
    seen: 'No cadet sees it.',
    heard: 'Battle Brief the next morning.',
  },
  {
    id: 'first-weeks', from: canonDayOf(7, 21), to: canonDayOf(8, 2), title: 'The first weeks',
    what: 'First-years learn the routine: breakfast duty before dawn, formation and the death roll, Battle Brief, classes, physical training. First-years cannot send or receive letters. Rhiannon Matthias quietly begins training Violet Sorrengail for the mat.',
    seen: 'The squad lives it together. The training is between Rhiannon and Violet.',
    heard: null,
  },
  {
    id: 'challenges', from: canonDayOf(8, 3), to: canonDayOf(9, 10), scheduled: true, title: 'Challenges begin',
    what: 'Weekly challenges on the sparring mats, after lunch, set a week ahead and fought in front of a combat master. Instructors quietly pair matches to cull the weak. Squadmates may not challenge each other. Cadets are hurt and some die.',
    seen: 'The whole quadrant watches the mats.',
    heard: 'Deaths are read at the next death roll.',
  },
  {
    id: 'violet-xaden-mat', from: canonDayOf(9, 2), to: canonDayOf(9, 6), title: 'Violet spars Xaden',
    what: 'In early September wingleader Xaden Riorson takes Violet Sorrengail onto the mat himself.',
    seen: 'Everyone in the sparring gym that day.',
    heard: 'Talk in the gathering hall.',
  },
  {
    id: 'gauntlet', from: canonDayOf(9, 11), to: canonDayOf(9, 28), scheduled: true, title: 'Gauntlet training begins',
    what: "Challenges stop. First-years train three times a week on the Gauntlet, a vertical obstacle course cut into the ridgeline below the flight field. Falls kill. Early in training Aurelie Donans of Second Squad falls and dies, and Violet Sorrengail burns her belongings at the burn pit.",
    seen: 'Each squad sees its own runs and its own dead.',
    heard: 'The death roll.',
  },
  {
    id: 'presentation', from: canonDayOf(9, 29), to: canonDayOf(9, 29), scheduled: true, title: 'The final Gauntlet run and Presentation',
    what: 'In the morning every first-year must finish the Gauntlet; Violet Sorrengail climbs it her own way, using the gaps between its pieces. Those who finish walk in a line down the flight-field meadow so the dragons can look them over. A dragon may quietly mark a cadet it wants.',
    seen: 'The first-years who finish, and the dragons.',
    heard: 'By evening the quadrant knows who made it.',
  },
  {
    id: 'threshing', from: canonDayOf(10, 1), to: canonDayOf(10, 1), scheduled: true, title: 'The Threshing',
    what: 'First-years go into the valley below the Citadel to find the dragon that wants them. Dragons kill cadets they judge weak. About a hundred dragons are willing to bond this year and none of them are blue. Violet Sorrengail bonds two dragons, Tairn (a black morningstartail) and Andarna (a golden feathertail), which is unheard of, after standing against Jack Barlowe and two others to protect the feathertail. Rhiannon Matthias bonds Feirge, Ridoc Gamlyn bonds Aotrom, Sawyer Henrick bonds Sliseag and Liam Mairi bonds Deigh.',
    seen: 'Each cadet sees only their own part of the valley. The fight over the feathertail is seen only by those in it.',
    heard: 'By nightfall the whole quadrant knows Violet bonded two dragons. Every bond is written in the Book of Riders.',
  },
  {
    id: 'imogen-trains', from: canonDayOf(10, 2), to: canonDayOf(10, 8), title: 'Imogen starts training Violet',
    what: 'From the day after the Threshing, second-year Imogen Cardulo trains Violet Sorrengail.',
    seen: 'Squadmates may notice the two of them together.',
    heard: null,
  },
  {
    id: 'liam-joins', from: canonDayOf(10, 10), to: canonDayOf(10, 20), title: 'Liam Mairi joins the squad',
    what: 'Liam Mairi is moved in from Tail Section and stays close to Violet Sorrengail.',
    seen: 'The squad. The transfer is public; that he is there to guard her, and on whose word, is not.',
    heard: null,
  },
  {
    id: 'attempt', from: canonDayOf(11, 10), to: canonDayOf(11, 20), title: 'An attempt on Violet, and an execution',
    what: "One night in November there is an attempt on Violet Sorrengail's life in her room. The next day Amber Mavis, wingleader of Third Wing, is executed by Tairn under the Codex, and her executive officer Lamani Zohar takes the wing.",
    seen: 'The attempt: only those in the room. The execution is known across the quadrant the same day.',
    heard: 'Formation, and talk in the gathering hall.',
  },
  {
    id: 'first-channel', from: canonDayOf(12, 1), to: canonDayOf(12, 7), title: 'Violet first channels',
    what: 'Violet Sorrengail channels power from her dragon for the first time.',
    seen: 'Violet and those closest to her.',
    heard: null,
  },
  {
    id: 'sumerton', from: canonDayOf(12, 8), to: canonDayOf(12, 14), title: 'Raid on Sumerton',
    what: 'Sumerton is raided and a convoy is looted.',
    seen: 'No cadet sees it.',
    heard: 'Battle Brief.',
  },
  {
    id: 'challenges-resume', from: canonDayOf(1, 15, 1), to: canonDayOf(3, 14, 1), scheduled: true, title: 'Challenges resume',
    what: 'Weekly challenges on the mats start again, now between bonded riders.',
    seen: 'The whole quadrant watches the mats.',
    heard: 'Deaths are read at the next death roll.',
  },
  {
    id: 'general-meeting', from: canonDayOf(3, 1, 1), to: canonDayOf(3, 7, 1), title: 'Violet and Xaden meet command',
    what: 'Violet Sorrengail and Xaden Riorson meet General Sorrengail and Colonel Aetos.',
    seen: 'Only the four of them.',
    heard: null,
  },
  {
    id: 'squad-battle', from: canonDayOf(3, 15, 1), to: canonDayOf(4, 20, 1), scheduled: true, title: 'Squad Battle',
    what: "Squads compete in three stages: a Gauntlet race, mat challenges, and a final mission to steal something the enemy would want. Commandant Panchek moves the final stage up a day without warning. In canon Second Squad wins by stealing General Sorrengail's map of the outposts, and the prize is a week at the Montserrat outpost, where Mira Sorrengail is posted.",
    seen: 'The whole quadrant competes.',
    heard: 'Results are announced to the quadrant.',
  },
  {
    id: 'war-games', from: canonDayOf(5, 12, 1), to: canonDayOf(5, 20, 1), scheduled: true, title: 'War Games: the first battle',
    what: "Fourth Wing against First Wing: First Wing defends a crystal egg and Fourth Wing a flag. Violet Sorrengail's lightning manifests. Jack Barlowe is buried by it and is believed dead.",
    seen: 'Both wings, in the air and on the ground.',
    heard: 'The whole quadrant knows within hours.',
  },
  {
    id: 'reunification', from: canonDayOf(7, 1, 1), to: canonDayOf(7, 1, 1), scheduled: true, title: 'Reunification Day',
    what: 'Navarre marks the anniversary of the Battle of Aretia, which ended the Tyrrish rebellion in 628 AU.',
    seen: 'Everyone.',
    heard: null,
  },
  {
    id: 'last-exercise', from: canonDayOf(7, 2, 1), to: canonDayOf(7, 2, 1), title: 'The last War Games exercise',
    what: "Formation is called at 4:15 in the morning. Fourth Wing is told the wards have fallen and is sent to reinforce outposts in the southeast, an exercise planned for five days. Xaden Riorson's group, with Violet Sorrengail and Liam Mairi, flies to Athebyne and arrives around one in the afternoon.",
    seen: 'The whole wing flies out. Only the riders Xaden picks go with him.',
    heard: null,
  },
];
export const CAL_END_DAY = canonDayOf(7, 2, 1);

/** The name of a canon day that has one ("Conscription Day"), else null. */
export function dayName(canonDay: number): string | null {
  const day = clampDay(canonDay);
  const beat = CANON_BEATS.find(b => b.scheduled && b.from === day && b.to === day);
  return beat ? beat.title : null;
}

const beatLine = (b: CanonBeat) => `- ${b.title}: ${b.what} Who sees it: ${b.seen} How others hear: ${b.heard ?? 'They do not. It stays private.'}`;

/** The calendar lines of the GAME FACTS block for a canon day. */
export function calendarFacts(canonDay: number): string {
  const day = clampDay(canonDay);
  const name = dayName(day);
  const head = `Calendar: today is ${dateLabel(day)}${name ? ` (${name})` : ''}.`;
  if (day > CAL_END_DAY + 7) return `${head} The app's canon calendar ends in early July 634 AU; from here follow the Calendar and Timeline guide.`;
  const lines = [
    `${head} This is day ${day} of Violet Sorrengail's first year at Basgiath. Unless this story has placed the rider elsewhere, the rider is a first-year in her squad: Second Squad, Flame Section, Fourth Wing, under squad leader Dain Aetos.`,
    "Canon events below happen on their dates whether or not the rider is there. They are about the people named in them, never about the rider. The one exception: if the rider's own actions in this story have already changed an event, keep the changed version and let what follows adjust. A rider who was elsewhere learns of an event only by the route given, and nobody (the rider included) learns what is marked private. Every morning the scribes read the death roll at formation, and Battle Brief brings news from the border.",
  ];
  const now = CANON_BEATS.filter(b => b.from <= day && day <= b.to);
  const recent = CANON_BEATS.filter(b => b.to < day && day - b.to <= 3);
  const next = CANON_BEATS.find(b => b.scheduled && b.from > day && b.from - day <= 30);
  if (now.length) lines.push('Happening now:', ...now.map(beatLine));
  if (recent.length) lines.push('In the last few days:', ...recent.map(beatLine));
  if (!now.length && !recent.length) lines.push('No dated canon event today. Basgiath carries on with its routine, and people are busy with their own lives.');
  if (next) lines.push(`Coming up (every cadet knows the schedule): ${next.title} in ${next.from - day} day${next.from - day === 1 ? '' : 's'}.`);
  return lines.join('\n');
}
