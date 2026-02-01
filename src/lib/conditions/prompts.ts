// AI DM Prompts for Condition Application
// Each prompt is designed to help an AI DM narrate the application of a condition

import { ConditionCategory, ConditionSeverity } from './types';

export interface ConditionPromptConfig {
  conditionId: string;
  prompt: string;
}

// Generate a context-aware prompt for condition application
export function generateConditionPrompt(
  conditionId: string,
  conditionName: string,
  category: ConditionCategory,
  severity: ConditionSeverity,
  source?: string,
  characterName?: string
): string {
  const char = characterName || 'The Assassin';
  const prompts = CONDITION_PROMPTS[conditionId];
  
  if (prompts) {
    return formatPrompt(prompts, char, source);
  }
  
  // Fallback generic prompt based on category/severity
  return generateGenericPrompt(conditionName, category, severity, char, source);
}

function formatPrompt(prompt: string, characterName: string, source?: string): string {
  let formatted = prompt.replace(/\{character\}/g, characterName);
  if (source) {
    formatted = formatted.replace(/\{source\}/g, source);
  } else {
    formatted = formatted.replace(/from \{source\}/g, '');
    formatted = formatted.replace(/\{source\}'s /g, 'the ');
    formatted = formatted.replace(/\{source\}/g, 'an enemy');
  }
  return formatted;
}

function generateGenericPrompt(
  name: string,
  category: ConditionCategory,
  severity: ConditionSeverity,
  characterName: string,
  source?: string
): string {
  const severityDesc = {
    minor: 'a manageable setback',
    moderate: 'a significant hindrance',
    severe: 'a devastating affliction',
  };
  
  const categoryVerb = {
    debuff: 'is afflicted with',
    buff: 'gains the benefit of',
    concentration: 'maintains concentration on',
  };
  
  const sourceNote = source ? ` from ${source}` : '';
  
  return `## Condition Applied: ${name}

**Character:** ${characterName}
**Effect:** ${name}${sourceNote}
**Severity:** ${severity.charAt(0).toUpperCase() + severity.slice(1)} — ${severityDesc[severity]}

---

### Narration Direction

${characterName} ${categoryVerb[category]} **${name}**.

Describe how this condition manifests:
- What physical or mental symptoms appear?
- How does ${characterName} react to this change?
- What tactical implications does this create?

Consider the pacing—${severity === 'severe' ? 'this is a critical moment that deserves dramatic weight' : severity === 'moderate' ? 'this significantly impacts the flow of combat' : 'this is a complication but not catastrophic'}.`;
}

// ============================================
// Detailed Prompts for Each Condition
// ============================================

export const CONDITION_PROMPTS: Record<string, string> = {
  // === SEVERE DEBUFFS ===
  paralyzed: `## Condition Applied: Paralyzed

**Character:** {character}
**Source:** {source}
**Severity:** SEVERE — Complete loss of bodily control

---

### Narration Direction

{character}'s muscles seize completely. Describe the horrifying moment when the body becomes a prison:

**Physical Manifestation:**
- Does {character} collapse mid-motion, frozen in an awkward pose?
- Are the eyes still aware, tracking threats while the body refuses to respond?
- Is there a visible tremor as {character} desperately tries to break free?

**Tactical Implications:**
- Enemies recognize {character} as a helpless target—attacks against {character} are devastating (auto-crits in melee)
- Allies must decide: defend {character} or trust they'll recover?
- The paralysis creates a moment of terrible vulnerability

**Emotional Beat:**
The worst part isn't the inability to move—it's being fully conscious while completely defenseless. Play up the psychological horror of watching danger approach with no ability to react.

---

*Paralyzed: Incapacitated, can't move or speak, auto-fail STR/DEX saves, attacks have advantage, melee hits are critical*`,

  petrified: `## Condition Applied: Petrified

**Character:** {character}
**Source:** {source}
**Severity:** SEVERE — Transformation into stone

---

### Narration Direction

{character} begins to transform into solid stone. This is a slow, creeping horror:

**The Transformation:**
- Does it start at the extremities, gray stone climbing up limbs?
- Is there a moment of desperate movement before the final freeze?
- What expression is frozen on {character}'s face—determination, fear, defiance?

**Environmental Impact:**
- The sudden silence as a living being becomes an object
- The weight shift as flesh becomes stone
- The cold, mineral scent that replaces the smell of a living person

**Story Hook:**
{character} still exists within the stone—aware or not? This creates dramatic tension for allies who must find a cure while {character} stands as a silent statue, a monument to the danger faced.

---

*Petrified: Turned to stone, incapacitated, unaware, auto-fail STR/DEX saves, resistance to all damage*`,

  stunned: `## Condition Applied: Stunned

**Character:** {character}
**Source:** {source}
**Severity:** SEVERE — Complete mental disruption

---

### Narration Direction

{character}'s mind goes blank from {source}'s effect. The lights are on but nobody's home:

**The Moment of Impact:**
- Did a psychic blast scramble {character}'s thoughts?
- Was it a physical blow that rang {character}'s bell?
- Perhaps a flash of blinding light or deafening sound overwhelmed the senses?

**Visible Signs:**
- Slack jaw, unfocused eyes
- Weapon arm dropping to the side
- Stumbling steps or swaying in place
- Mumbled, incoherent speech

**Combat Dynamics:**
{character} is completely open—attackers have advantage and {character} will automatically fail STR/DEX saves. But unlike paralysis, there's movement—just purposeless, ineffective motion. Describe the frustration of a trained warrior reduced to a stumbling mess.

---

*Stunned: Incapacitated, can't move, auto-fail STR/DEX saves, attacks have advantage*`,

  unconscious: `## Condition Applied: Unconscious

**Character:** {character}
**Source:** {source}
**Severity:** SEVERE — Complete incapacitation

---

### Narration Direction

{character} goes down. This is the moment the battle's stakes become viscerally real:

**The Fall:**
- Does {character} crumple like a puppet with cut strings?
- Is there a final, defiant attempt to stay upright before collapsing?
- What does {character} drop—weapon clattering, shield falling?

**On the Ground:**
- The terrible stillness of an unconscious body
- Shallow breathing (if any) that allies desperately watch for
- The vulnerability of a prone, helpless form

**Battlefield Impact:**
All attacks against {character} have advantage. Any melee hit is automatically a critical. For allies, this creates an urgent tactical decision: defend the fallen or press the attack? For enemies, this is an opportunity to finish off a dangerous foe.

**If from HP loss:** Is {character} now making death saves? The next moments will determine survival.

---

*Unconscious: Incapacitated, prone, drops items, unaware, melee attacks are critical hits*`,

  // === MODERATE DEBUFFS ===
  blinded: `## Condition Applied: Blinded

**Character:** {character}
**Source:** {source}
**Severity:** Moderate — Complete loss of sight

---

### Narration Direction

{character}'s world goes dark. For an assassin who relies on precision, this is a nightmare:

**The Blinding:**
- Was it a flash of brilliant light that seared the eyes?
- Magical darkness that swallows all illumination?
- A physical obstruction—sand, blood, a hood?

**Compensating Instincts:**
- {character} might turn an ear toward sounds of movement
- Hands extended, seeking walls or enemies by touch
- Heightened awareness of air currents, footfalls, the sound of breathing

**Combat Reality:**
{character}'s attacks are wild swings with disadvantage, while enemies can strike with impunity (advantage on their attacks). Describe the frustration of a skilled combatant reduced to blind flailing.

**The Question:** Can {character} clear their eyes, or must they fight blind until the effect ends?

---

*Blinded: Can't see, auto-fail sight checks, attacks have disadvantage, attacks against have advantage*`,

  frightened: `## Condition Applied: Frightened

**Character:** {character}
**Source:** {source}
**Severity:** Moderate — Overwhelming fear

---

### Narration Direction

Fear takes hold of {character}. Even the boldest warriors have moments when terror wins:

**The Fear Response:**
- Cold sweat breaking out, hands trembling on weapons
- An instinct to run warring with trained discipline
- Eyes unable to look away from the source of terror

**Physical Manifestation:**
- Shortened breath, racing heart
- Muscles tensed for flight rather than fight
- A step backward, involuntary, away from {source}

**Combat Impact:**
{character} cannot willingly approach the source of fear—every step toward {source} requires fighting against primal instinct. All attacks and ability checks have disadvantage while {source} is visible.

**Character Moment:**
This is an opportunity for roleplay—how does {character} cope with fear? Do they mask it with bravado? Acknowledge it and fight through it? Let the terror show on their face?

---

*Frightened: Disadvantage on attacks/checks while source visible, can't willingly approach source*`,

  incapacitated: `## Condition Applied: Incapacitated

**Character:** {character}
**Source:** {source}
**Severity:** Moderate — Unable to act

---

### Narration Direction

{character} is frozen in place, unable to take any meaningful action:

**The Cause:**
- Magical compulsion holding {character} in place?
- Overwhelming pain making coordinated action impossible?
- Mental intrusion scrambling {character}'s ability to form intent?

**What Remains:**
{character} can still perceive the world, still think, still want to act—but the body refuses to obey. Describe the frustration of a warrior trapped in their own flesh.

**Tactical Note:**
{character} cannot take actions or reactions, but can still move (unless another condition prevents it). This creates interesting decisions—try to retreat? Stay and hope the effect ends?

---

*Incapacitated: Cannot take actions or reactions*`,

  poisoned: `## Condition Applied: Poisoned

**Character:** {character}
**Source:** {source}
**Severity:** Moderate — Toxins coursing through the body

---

### Narration Direction

Poison works its way through {character}'s system. The assassin who deals in venoms now suffers their effects:

**Physical Symptoms:**
- Skin taking on a sickly pallor or greenish tinge
- Cold sweats and waves of nausea
- Trembling hands that can't quite grip properly
- The taste of copper or bile in the mouth

**Impact on Performance:**
- Every movement feels sluggish, reactions delayed
- Focus keeps slipping as the toxin demands attention
- Pain radiates from the point of poisoning

**Combat Reality:**
Disadvantage on all attack rolls and ability checks. {character} is fighting through a fog of sickness, every swing slightly off, every dodge a heartbeat too slow.

**The Clock is Ticking:**
How long until the poison runs its course—or until it gets worse?

---

*Poisoned: Disadvantage on attack rolls and ability checks*`,

  restrained: `## Condition Applied: Restrained

**Character:** {character}
**Source:** {source}
**Severity:** Moderate — Movement completely restricted

---

### Narration Direction

{character} is caught, held fast by {source}:

**The Binding:**
- Magical chains materialized from thin air?
- Tangling vines or webs wrapping tight?
- A grappler's iron grip preventing all movement?
- Ensnared in a trap of nets or ropes?

**The Struggle:**
- {character} strains against the restraints
- Muscles bulging with effort but making no progress
- The frustration of strength made useless

**Combat Dynamics:**
Speed reduced to 0, attacks have disadvantage, attackers have advantage, DEX saves have disadvantage. {character} is a sitting duck, but not helpless—they can still fight back, just at a significant disadvantage.

**The Escape:**
What will it take to break free? Brute strength (Athletics)? Clever maneuvering (Acrobatics)? Or must {character} wait for rescue?

---

*Restrained: Speed 0, disadvantage on attacks, advantage on attacks against, disadvantage on DEX saves*`,

  // === MINOR DEBUFFS ===
  charmed: `## Condition Applied: Charmed

**Character:** {character}
**Source:** {source}
**Severity:** Minor — Supernatural influence on the mind

---

### Narration Direction

{source}'s magic has touched {character}'s mind, creating a false sense of trust:

**The Enchantment:**
- Does {character} suddenly see {source} as an old friend?
- Is there a dreamy, unfocused quality to {character}'s gaze?
- Perhaps just a subtle softening of hostility, a hesitation to attack?

**What {character} Experiences:**
- A warm feeling of goodwill toward {source}
- Reluctance to cause harm to this... trusted ally?
- The normal paranoia of an assassin dulled, suspicion evaporated

**The Danger:**
{character} can't attack {source} or target them with harmful abilities. {source} has advantage on social interactions. But {character} isn't a puppet—they just can't bring themselves to hurt their new "friend."

**Hidden Tension:**
Some part of {character} might know something is wrong. Do they fight the enchantment internally while externally compliant?

---

*Charmed: Can't attack the charmer, charmer has advantage on social interactions*`,

  deafened: `## Condition Applied: Deafened

**Character:** {character}
**Source:** {source}
**Severity:** Minor — Complete loss of hearing

---

### Narration Direction

The world goes silent for {character}. For an assassin who relies on subtle sounds, this is deeply unsettling:

**The Silence:**
- Was it a thunderclap that overwhelmed the ears?
- Magical silencing that creates an eerie void?
- A ringing aftermath of some concussive blast?

**Sensory Compensation:**
- Eyes darting more frequently, compensating for lost warning sounds
- Heightened awareness of vibrations through the floor
- A strange disconnection from allies' shouts and warnings

**Tactical Impact:**
- Can't hear enemies approaching from behind
- Unable to coordinate verbally with allies
- Spellcasting with verbal components becomes uncertain
- Any ability check requiring hearing automatically fails

**The Isolation:**
Describe the strange loneliness of being cut off from the sounds of battle—the clash of steel, the cries of the wounded, the commands of allies.

---

*Deafened: Can't hear, auto-fail hearing-based checks*`,

  grappled: `## Condition Applied: Grappled

**Character:** {character}
**Source:** {source}
**Severity:** Minor — Physically held by an enemy

---

### Narration Direction

{source} has seized {character}, locking them in close combat:

**The Grip:**
- A bear hug pinning {character}'s arms?
- One hand on the wrist, controlling the weapon arm?
- A tackle that's left both combatants locked together?

**The Struggle:**
- {character} twisting, trying to break free
- Testing the grip, looking for weakness
- The claustrophobic reality of close-quarters combat

**What Still Works:**
{character} can't move away, but can still attack (even the grappler). Speed is 0, but hands are (probably) free. This is a clinch, not complete control.

**The Option:**
Break free with Athletics or Acrobatics? Or turn this close range into an advantage with close-quarters attacks?

---

*Grappled: Speed 0, ends if grappler incapacitated or forced apart*`,

  prone: `## Condition Applied: Prone

**Character:** {character}
**Source:** {source}
**Severity:** Minor — Knocked to the ground

---

### Narration Direction

{character} hits the dirt. Time to decide: stay down or get up?

**The Fall:**
- A trip, a shove, a crushing blow that knocked {character} off their feet?
- Landing hard, breath knocked out?
- Rolling with the impact or slamming flat?

**On the Ground:**
- Limited mobility—crawling is the only option
- Attacks are awkward with disadvantage
- Vulnerable to anyone standing over them (melee attacks have advantage)
- But also a smaller target for ranged attacks (which have disadvantage)

**The Choice:**
Stand up (costs half movement) and regain full fighting capability? Or stay prone for the defensive benefits against ranged attacks?

**Assassin's Perspective:**
For someone who specializes in quick movement and precise strikes, being on the ground is a significant disadvantage. But a skilled warrior can fight from any position...

---

*Prone: Crawl only, disadvantage on attacks, melee attacks against have advantage, ranged have disadvantage*`,

  invisible: `## Condition Applied: Invisible (Enemy)

**Character:** {character} cannot see the enemy
**Source:** {source}
**Severity:** Variable — An unseen threat

---

### Narration Direction

The enemy has vanished from sight. For {character}, this changes everything:

**The Disappearance:**
- A shimmer in the air as the enemy fades?
- One moment there, the next... gone?
- The unnerving sound of footsteps with no visible source?

**Fighting the Unseen:**
- {character}'s attacks against the invisible enemy have disadvantage
- The enemy's attacks have advantage
- Every shadow could hide the threat, every sound could be the enemy moving

**Assassin's Expertise:**
{character} knows this game—they've played it from the other side. Listen for breathing, watch for dust disturbed by movement, feel the air displacement of an approaching strike.

**Tension:**
This is a horror-movie moment. The enemy could be anywhere. Build the suspense.

---

*Invisible target: Your attacks have disadvantage, their attacks have advantage*`,

  // === BUFFS ===
  blessed: `## Buff Active: Blessed

**Character:** {character}
**Source:** Divine favor from {source}
**Concentration:** Yes — requires ongoing focus

---

### Narration Direction

Divine power flows through {character}, blessing their every action:

**The Blessing:**
- A subtle golden glow surrounds {character}
- Movements feel guided, attacks more true
- A sense of righteous confidence, of being favored by higher powers

**Mechanical Manifestation:**
+1d4 to every attack roll and saving throw. Describe moments where this bonus matters—a swing that would have missed finds its mark, a save that would have failed succeeds by a hair.

**Narrative Flavor:**
Is this {character}'s own faith manifesting? A deity's direct intervention? The power of {source}'s conviction?

---

*Blessed: +1d4 to attack rolls and saving throws*`,

  hasted: `## Buff Active: Hasted

**Character:** {character}
**Source:** Chronomantic acceleration from {source}
**Concentration:** Yes — requires ongoing focus

---

### Narration Direction

Time bends around {character}. They move at impossible speed:

**The Acceleration:**
- The world seems to slow as {character} speeds up
- Afterimages trailing behind each movement
- Reactions that seem precognitive—dodging before the attack fully forms

**Combat Reality:**
- Double movement speed—{character} is a blur on the battlefield
- +2 AC as attacks slide past accelerated reflexes
- Advantage on DEX saves, practically guaranteed
- An extra action each turn (Attack, Dash, Disengage, Hide, or Use Object)

**The Danger:**
When this spell ends, {character} will suffer a wave of lethargy, losing their action and movement for a turn. Use now, pay later.

**Descriptive Moments:**
Show the speed—{character} is at one point on the battlefield, then suddenly across it. Enemies struggle to track the accelerated assassin.

---

*Hasted: 2x speed, +2 AC, advantage on DEX saves, extra action*`,

  invisible_self: `## Buff Active: Invisibility

**Character:** {character}
**Source:** Magical concealment
**Concentration:** Yes — requires ongoing focus

---

### Narration Direction

{character} vanishes from sight. The assassin in their element:

**The Concealment:**
- Body fading from view like morning mist
- Footsteps must still be careful—invisible isn't silent
- The predatory joy of unseen approach

**Combat Advantages:**
- Attacks have advantage (striking from the unseen)
- Enemy attacks have disadvantage (can't target what you can't see)
- Perfect for positioning, reconnaissance, or the killing blow

**The Limitation:**
Any attack or spell cast ends the invisibility. Choose the moment carefully—one perfect strike, or ongoing stealth?

**Assassin's Art:**
This is what {character} was born for. Describe the patient stalking, the perfect positioning, the inevitable strike from nowhere.

---

*Invisible: Advantage on attacks, attacks against have disadvantage, ends on attack/cast*`,

  bardic_inspiration: `## Buff Active: Bardic Inspiration

**Character:** {character}
**Source:** Inspiring words from {source}
**Duration:** 10 minutes to use

---

### Narration Direction

{source}'s words echo in {character}'s mind, ready to bolster a crucial moment:

**The Inspiration:**
- A remembered phrase that steels resolve
- A melody that provides perfect timing
- The confidence of knowing someone believes in you

**When to Use:**
{character} can add the inspiration die to one attack roll, ability check, or saving throw. This should be a dramatic moment—the make-or-break roll.

**Narrative Beat:**
When used, describe {character} remembering {source}'s words at the crucial moment. The inspiration transforms doubt into determination, hesitation into action.

---

*Bardic Inspiration: Add inspiration die to one attack, check, or save*`,

  guidance: `## Buff Active: Guidance

**Character:** {character}
**Source:** Divine direction from {source}
**Concentration:** Yes — requires ongoing focus

---

### Narration Direction

Subtle divine guidance enhances {character}'s abilities:

**The Effect:**
- A feeling of rightness when making the correct choice
- Hands guided to the proper position
- Intuition sharpened by divine insight

**One Perfect Moment:**
+1d4 to a single ability check before the spell ends. Choose wisely—this is one boost to one check.

**Narrative Flavor:**
When the bonus is used, describe that moment of divine intervention—the whisper of guidance, the subtle nudge toward success.

---

*Guidance: +1d4 to one ability check*`,

  shield_of_faith: `## Buff Active: Shield of Faith

**Character:** {character}
**Source:** Divine protection from {source}
**Concentration:** Yes — requires ongoing focus

---

### Narration Direction

A shimmering shield of divine energy surrounds {character}:

**The Protection:**
- A translucent barrier of golden light
- Attacks that would connect sliding past
- The warmth of divine favor against the cold of battle

**Mechanical Effect:**
+2 AC. Describe attacks that narrowly miss, deflected by the divine shield. Blows that would have found their mark instead glance off shimmering protection.

**Faith Made Manifest:**
This is tangible evidence of divine protection. How does {character} respond to fighting under this blessing?

---

*Shield of Faith: +2 AC*`,

  mirror_image: `## Buff Active: Mirror Image

**Character:** {character}
**Source:** Illusory duplication
**Duration:** 1 minute (non-concentration)

---

### Narration Direction

Three illusory duplicates of {character} spring into existence:

**The Illusions:**
- Perfect copies that mirror {character}'s every move
- Identical equipment, identical stance, identical threats
- Enemies must guess which is real

**Combat Chaos:**
Each attack targeting {character} might hit a duplicate instead (roll determines). Duplicates have AC 10 + DEX modifier—when hit, they pop like soap bubbles.

**Tactical Advantage:**
With three decoys, enemies waste attacks on phantoms while {character} moves untouched. As duplicates fall, the advantage diminishes—use this protection well.

**Visual Description:**
Four identical assassins weaving through combat. Even {character} might momentarily lose track of which hands are their own.

---

*Mirror Image: 3 duplicates, attacks may target them instead (AC 10+DEX)*`,

  hunters_mark: `## Buff Active: Hunter's Mark

**Character:** {character}
**Target:** Marked prey
**Concentration:** Yes — requires ongoing focus

---

### Narration Direction

{character} has marked their prey. The hunt begins:

**The Mark:**
- A mystical awareness of the target's position
- The target practically glows with vulnerability
- Every attack finds weak points with supernatural precision

**Mechanical Effect:**
+1d6 damage on every weapon attack against the marked target. Describe the mark guiding strikes to vital spots, the hunter's instinct zeroing in on the prey.

**The Hunt:**
This isn't just combat—it's predation. {character} has designated this enemy as their quarry. The mark can be transferred when the target dies, continuing the hunt.

**Assassin's Edge:**
For a hunter-assassin, this is the perfect combination of the two paths. Mark, stalk, strike, kill, repeat.

---

*Hunter's Mark: +1d6 damage on weapon attacks vs marked target*`,

  hex: `## Buff Active: Hex

**Character:** {character}
**Target:** Cursed enemy
**Concentration:** Yes — requires ongoing focus

---

### Narration Direction

{character} places a dark curse upon their enemy:

**The Curse:**
- Shadowy tendrils connect {character} to the hexed target
- The target seems to weaken, one ability compromised
- Every strike carries necrotic venom

**Mechanical Effect:**
+1d6 necrotic damage on every attack against the hexed target, plus disadvantage on one ability's checks (chosen at casting).

**Dark Power:**
This is warlock magic—describe the ominous, slightly unsettling nature of the curse. {character} is wielding dark forces, and it shows.

**The Chosen Weakness:**
Which ability did {character} target? Strength (can't break free), Dexterity (can't dodge), Wisdom (can't perceive), etc.? Describe how that weakness manifests.

---

*Hex: +1d6 necrotic on attacks, target has disadvantage on one ability's checks*`,
};

// Export helper to check if a condition has a custom prompt
export function hasCustomPrompt(conditionId: string): boolean {
  return conditionId in CONDITION_PROMPTS;
}

// Get all condition IDs that have prompts
export function getConditionsWithPrompts(): string[] {
  return Object.keys(CONDITION_PROMPTS);
}
