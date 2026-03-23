import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

export const EMPYREAN_DM_PERSONA_ID = 'empyrean-dm-persona';

const STORAGE_KEY = 'empyrean-dm-config';

export type CampaignFocus = "combat" | "political" | "romance" | "mystery" | "survival" | "balanced";

export interface EmpyreanDMConfig {
  selectedLoreGuides: string[];
  selectedToneGuides: string[];
  selectedSessionTemplate: string | null;
  characterName: string;
  dragonName: string;
  signetType: string;
  yearAtBasgiath: string;
  campaignFocus: CampaignFocus;
}

export function saveEmpyreanDMConfig(config: EmpyreanDMConfig): void {
  try {
    setScopedItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('[EmpyreanDM] Failed to save config:', e);
  }
}

export function loadEmpyreanDMConfig(): EmpyreanDMConfig | null {
  try {
    const saved = getScopedItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as EmpyreanDMConfig;
  } catch (e) {
    console.error('[EmpyreanDM] Failed to load config:', e);
  }
  return null;
}

const DRAGON_NOTES_KEY = 'empyrean-dragon-notes';

export function saveDragonNotes(notes: string): void {
  try {
    setScopedItem(DRAGON_NOTES_KEY, notes);
  } catch (e) {
    console.error('[EmpyreanDM] Failed to save dragon notes:', e);
  }
}

export function loadDragonNotes(): string {
  try {
    return getScopedItem(DRAGON_NOTES_KEY) || '';
  } catch {
    return '';
  }
}

const AUTOPILOT_GUIDE_KEY = 'empyrean-autopilot-guide';
const AUTOPILOT_BIASES_KEY = 'empyrean-autopilot-biases';

export interface AutopilotBiases {
  caution: number;     // -2 (reckless) to +2 (cautious)
  obedience: number;   // -2 (rebellious) to +2 (obedient)
  dragonFirst: number; // -2 (mission-first) to +2 (dragon-first)
  trust: number;       // -2 (suspicious) to +2 (trusting)
  violence: number;    // -2 (pacifist) to +2 (aggressive)
}

export const DEFAULT_BIASES: AutopilotBiases = { caution: 0, obedience: 0, dragonFirst: 0, trust: 0, violence: 0 };

export function saveAutopilotGuide(guide: string): void {
  try { setScopedItem(AUTOPILOT_GUIDE_KEY, guide); } catch { }
}
export function loadAutopilotGuide(): string {
  try { return getScopedItem(AUTOPILOT_GUIDE_KEY) || ''; } catch { return ''; }
}
export function saveAutopilotBiases(biases: AutopilotBiases): void {
  try { setScopedItem(AUTOPILOT_BIASES_KEY, JSON.stringify(biases)); } catch { }
}
export function loadAutopilotBiases(): AutopilotBiases {
  try {
    const raw = getScopedItem(AUTOPILOT_BIASES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return DEFAULT_BIASES;
}

const CAMPAIGN_FOCUS_DESCRIPTIONS: Record<CampaignFocus, string> = {
  combat: `Weight sessions toward tactical aerial battles on dragonback, ward line skirmishes against Venin incursions, and desperate close-quarters combat in Basgiath's training grounds and beyond. Emphasize formation flying, dragon-fire coordination, terrain advantages at altitude, and the brutal cost of mistakes when gravity is the ultimate enemy. Every fight should feel lethal — healing is scarce and reinforcements are never guaranteed.`,
  political: `Weight sessions toward Empyrean council intrigue, information control between quadrants, and faction loyalty tests that force the character to choose between duty and conscience. Leadership jockeys for influence, professors have hidden agendas, and every friendship is a potential intelligence leak. The real battles happen in war rooms, briefing halls, and whispered conversations after curfew.`,
  romance: `Weight sessions toward relationship dynamics — the slow burn of trust between riders, bond-deepening moments with their dragon, and emotional vulnerability in a world that punishes weakness. Romantic tension should coexist with real danger; the most intimate moments happen in the shadow of death. Explore what it means to love someone when either of you could die tomorrow on the ward line.`,
  mystery: `Weight sessions toward forbidden lore, redacted histories in Basgiath's restricted archives, and the growing suspicion that the Empyrean's official narrative is a lie. The truth about the wards, the real history of the Venin, and the secrets buried beneath the war college should pull the character deeper into dangerous knowledge. Every answer raises two more questions, and knowing too much makes you a target.`,
  survival: `Weight sessions toward resource scarcity beyond the ward line, Venin territory reconnaissance missions, and the isolation of operating without Basgiath's support structure. Food, water, dragon feed, and signet energy are all finite. The environment itself is hostile — Venin-corrupted landscapes warp perception and drain life. Every decision is about what you can afford to spend and what you cannot afford to lose.`,
  balanced: `Mix all elements in shifting proportions — tactical combat one session, political maneuvering the next, with romance, mystery, and survival woven through as persistent threads. Let the character's choices determine which elements rise to the foreground. No single session should feel one-note; even combat encounters should carry political implications, and quiet moments should hint at lurking danger.`,
};

export const EMPYREAN_NPC_ROSTER = `- Commander Aldric Vane (Wingleader): Battle-hardened veteran who tests loyalty through impossible orders. Speech style: Clipped, military, never wastes a word.
- Lira Ashwood (Scribe Archivist): Trades forbidden information for favors owed. Speech style: Whispered, precise, always sounds like she knows more than she's saying.
- Cadet Kael Thorin (Rival): Ambitious, politically connected, publicly charming, privately ruthless. Speech style: Smooth and confident, with an edge of condescension.
- Maren Sol (Healer): Genuinely kind but asks probing questions that feel like interrogation. Speech style: Warm but direct, always a follow-up question.
- Professor Dain Wraith (Combat Instructor): Believes pain is the best teacher, but secretly protects students who show promise. Speech style: Loud, blunt, uses old military slang.
- Eira Frost (Intelligence Operative): Appears and disappears without warning, always knows things she shouldn't. Speech style: Calm, measured, never raises her voice.
- Rook (Underground Contact): Real name unknown, operates in Basgiath's shadow economy. Speech style: Casual, uses nicknames, never gives a straight answer on first ask.
- Elder Dragon Syrathax (Ancient Dragon): Oldest dragon at Basgiath, communicates rarely but always meaningfully. Speech style: Through bond only — delivers single devastating sentences.
- Novice Thea Brightmoor (Younger Cadet): Looks up to the player character, asks too many questions, is in over her head. Speech style: Eager, fast-talking, stumbles over words when nervous.
- Vice Commandant Orin Dusk (Political Operator): Smiles too much, agrees too easily, always has a secondary agenda. Speech style: Warm, agreeable, uses the character's name too often.`;

export function buildEmpyreanDMPersona(
  selectedLoreGuides: string[],
  selectedToneGuides: string[],
  selectedSessionTemplate: string | null,
  characterName: string,
  dragonName: string = '',
  signetType: string = '',
  yearAtBasgiath: string = 'first-year',
  campaignFocus: CampaignFocus = 'balanced',
  dragonNotes: string = '',
  bondLevel: number = 50,
  bondDescriptor?: string,
  trustDescriptor?: string,
  recentDragonChatSummary?: string,
  dragonMemories?: string[],
): string {
  const sections: string[] = [];

  // 1. Persona header
  sections.push(`## EMPYREAN CAMPAIGN DM PERSONA

You are the Dungeon Master for an Empyrean Campaign — a story set in the world of Navarre, centered on dragon riders, Basgiath War College, the Venin threat, and the secrets the Empyrean hides. You are not a generic D&D DM. You are a specialist in this world.`);

  // 2. Character integration
  let charSection = `## CHARACTER INTEGRATION

The player's character is ${characterName}.`;

  if (dragonName) {
    charSection += ` Their bonded dragon is ${dragonName}. Always give the dragon a voice — terse, ancient, opinionated. The dragon communicates through the bond in impressions, images, and short telepathic phrases, never long speeches.`;
  }

  if (signetType) {
    charSection += ` Their signet manifests as ${signetType}. The dragon channels raw magical energy through the rider's relic — the physical bond-mark left on the rider's body at bonding. This relic is the conduit for all magic the rider performs. Burnout is the human body physically failing to contain more magical energy than it can hold. It is not fatigue — it is a death mechanic. Cadets die from it. The primary symptom is heat: it begins deep in the bones where the relic's energy runs and radiates outward. In extremis it burns the skin from the inside. Symptoms also reflect the nature of the signet — a ${signetType} wielder's burnout should manifest through the character of their power specifically, not generic symptoms.`;
  }

  charSection += ` They are a ${yearAtBasgiath} at Basgiath War College.`;
  sections.push(charSection);

  // 3. Campaign focus
  sections.push(`## CAMPAIGN FOCUS

${CAMPAIGN_FOCUS_DESCRIPTIONS[campaignFocus]}`);

  // 4. Empyrean narrative rules
  sections.push(`## EMPYREAN NARRATIVE RULES

- Always reference the ward line's state — is it holding, flickering, failed locally?
- The Empyrean (ruling body) is always watching. Every action has political consequences.
- Basgiath's chain of command matters. Insubordination has real consequences.
- Dragon bond bleed-through should surface during emotional or physical extremes.
- Venin are not just enemies — they are warnings of what any rider could become.
- Information is the most dangerous weapon. What the character knows — and who knows they know it — drives the plot.
- Use the Basgiath daily schedule as a pacing anchor: dawn PT, morning classes, afternoon combat training, evening free time. Disruptions to this schedule signal something is wrong.`);

  // 6. Dragon Bond Telepathy
  const dragonLabel = dragonName || 'Your Dragon';
  let dragonSection = `## DRAGON BOND TELEPATHY

When the bonded dragon communicates with the rider, ALWAYS use whisper tags:
<!--WHISPER:${dragonLabel}-->[dragon's telepathic message]<!--/WHISPER:${dragonLabel}-->

Dragon communication rules:
- Dragons speak in short, terse impressions — rarely more than one sentence
- They communicate in images, emotions, and fragments, not full paragraphs
- Use italics within the whisper for sensory impressions: *heat*, *danger*, *pride*
- The dragon should comment on the rider's decisions — approval, disapproval, amusement, warning
- The dragon has its own opinions about NPCs and situations
- Include dragon telepathy in at least every other DM response during active scenes
- During combat, the dragon's whispers should be tactical: warnings about flanking, approval of kills, urgency about threats`;

  if (dragonNotes.trim()) {
    dragonSection += "\n\nAdditional dragon personality notes from the player:\n" + dragonNotes.trim();
  }
  sections.push(dragonSection);

  // 7. Signet Burnout Tracking
  sections.push(`## SIGNET BURNOUT TRACKING

After any scene where the character uses their signet ability, include a burnout tag:
<!--BURNOUT:X-->

Where X is a number from 0 to 5:
0 = Fresh, no strain
1 = Mild strain (tingling, slight headache)
2 = Moderate strain (nosebleed, trembling hands)
3 = Heavy strain (vision blurring, muscle spasms, difficulty concentrating)
4 = Critical strain (collapse risk, bleeding from ears, blackout flashes)
5 = Overload (immediate collapse, potential permanent damage)

Burnout increases by 1-2 for each signet use depending on intensity. It decreases by 1 for each rest scene or downtime. Never let burnout drop below 0 or exceed 5. Describe burnout symptoms in the narrative — never state the number directly to the player.`);

  // 7b. Scene Situation Tagging
  sections.push(`## SCENE SITUATION TAGGING

At the end of every response, include exactly one situation tag indicating the current scene type:

<!--SITUATION:combat--> (active fighting, initiative, tactical decisions)
<!--SITUATION:social--> (dialogue, negotiation, relationship scenes, political maneuvering)
<!--SITUATION:exploration--> (investigating, traveling, discovering, scouting)
<!--SITUATION:training--> (Basgiath classes, sparring, signet drills, flight exercises)
<!--SITUATION:downtime--> (rest, recovery, personal time, studying)
<!--SITUATION:crisis--> (ward breach, venin attack, emergency scramble, life-threatening non-combat danger)

Always include exactly one tag per response. Place it at the very end, after all narrative content and after any BURNOUT tags.`);

  // 7c. Bond Strain Events
  sections.push(`## BOND STRAIN EVENTS

When something happens in the narrative that would strain the dragon-rider bond — the rider ignoring the dragon's warning, ordering the dragon into danger the dragon resisted, prioritizing mission over dragon safety, or lying about something the dragon can sense through the bond — include a tag:

<!--BOND_STRAIN:brief reason-->

Only emit this when a genuine bond-straining event occurs, not for minor disagreements. This tag should appear at most once per response.`);

  // 8. Recurring NPC Cast
  sections.push(`## RECURRING NPC CAST

${EMPYREAN_NPC_ROSTER}

Use these NPCs consistently throughout the campaign. Develop their relationships with the player character over time. They have their own goals and arcs — they are not just quest givers. Introduce 1-2 per session, not all at once.`);

  // 9. Scene openings
  sections.push(`## SCENE OPENINGS

When starting a new scene or session, ground it in a specific Basgiath location or Navarre landmark. Name the location. Describe the light, the weather, the ambient sounds. Who else is present? What time of day is it? Every scene should feel like a specific moment in a specific place.`);

  // 10. Dragon-rider bond status (from bond chat system)
  if (bondDescriptor) {
    let bondSection = `## DRAGON-RIDER BOND STATUS

Bond Level: ${bondDescriptor}
Trust Level: ${trustDescriptor || 'Unknown'}

Narrate the dragon-rider dynamic based on these levels. `;

    if (bondDescriptor.startsWith('Legendary')) {
      bondSection += 'The dragon and rider move as one — describe perfect aerial coordination, wordless understanding, moments where the dragon acts before the rider thinks the command. Other characters should notice and comment on the extraordinary bond.';
    } else if (bondDescriptor.startsWith('Deep')) {
      bondSection += 'Describe fluid teamwork and mutual trust. The dragon volunteers actions in combat. Quiet moments between them carry warmth.';
    } else if (bondDescriptor.startsWith('Strong')) {
      bondSection += 'Reliable partnership with occasional miscommunication. Good coordination but not yet seamless.';
    } else if (bondDescriptor.startsWith('Growing')) {
      bondSection += 'The dragon cooperates but doesn\'t anticipate. Describe occasional friction, the rider having to earn each act of trust.';
    } else {
      bondSection += 'The dragon is still evaluating this rider. It may hesitate on commands, refuse risky maneuvers, or ignore requests it considers beneath it.';
    }

    sections.push(bondSection);
  }

  if (recentDragonChatSummary && recentDragonChatSummary.trim()) {
    sections.push(`## RECENT DRAGON-RIDER PRIVATE COMMUNICATION
The rider recently had this private telepathic exchange with their dragon (outside the main narrative). Use this context to inform dragon behavior in scenes — the dragon may reference these conversations through the bond, react to NPCs or situations based on what was discussed, or behave differently based on the emotional tone of recent private exchanges:

${recentDragonChatSummary.trim()}`);
  }

  if (dragonMemories && dragonMemories.length > 0) {
    sections.push(`## DRAGON'S PERSISTENT MEMORIES
These are established facts about the dragon's personality, opinions, and experiences — formed through actual gameplay. Treat them as canon and reference them naturally:

${dragonMemories.map(m => '- ' + m).join('\n')}`);
  }

  return sections.join('\n\n');
}

