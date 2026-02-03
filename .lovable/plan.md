# Upgrade Smart Scribe with Enhanced Writing Styles

## Overview
Adding **7 new distinctive writing styles** to the Narrative Forge system, each with refined voice characteristics and granular prompt engineering for maximum accuracy:

| New Style | Core Identity | Signature Techniques |
|-----------|---------------|---------------------|
| **R. A. Salvatore** | Poetic sword & sorcery with warrior philosophy | Combat as dance metaphor, weapon personification, inner monologue during battle, named fighting techniques, loyalty/honor themes |
| **Deadpool** | Fourth-wall-shattering meta-comedy | Direct reader address, parenthetical chaos, pop culture anachronisms, self-aware genre mockery, violence as punchline |
| **Dark Comedy** | Tragic inevitability played for laughs | Sardonic narrator voice, Murphy's Law escalation, understated horror, cosmic indifference, gallows humor timing |
| **Subtle Absurdity** | Kafka meets D&D | Bureaucratic language for impossible events, deadpan surrealism, no acknowledgment of weirdness, mundane reactions to chaos |
| **Lovecraftian Horror** | Cosmic dread and sanity erosion | Non-Euclidean descriptions, knowledge-as-curse, indescribable entities, escalating paranoia, archaic prose, existential terror |
| **Gonzo Journalism** | Hunter S. Thompson chaos reporting | Stream-of-consciousness, unreliable narrator, substance-fueled tangents, savage social commentary, frantic energy, "too weird to live, too rare to die" |
| **Hemingway Minimalist** | Sparse, brutal efficiency | Short declarative sentences, no adverbs, iceberg theory (subtext > text), understated emotion, focus on physical action, "true sentences" |

---

## Changes Required

### 1. Update Type Definition
**File:** `src/lib/narrativeProcessor.ts`

Expand the `narrativeStyle` union type:

```typescript
narrativeStyle: 'fantasy' | 'noir' | 'literary' | 'action' 
             | 'salvatore' | 'deadpool' | 'dark_comedy' | 'subtle_absurdity'
             | 'lovecraftian' | 'gonzo' | 'hemingway';
```

---

### 2. Add Offline Enhancement Templates
**File:** `src/lib/narrativeProcessor.ts`

Granular style entries for offline processing with action-specific vocabulary:

| Style | Attack | Hit | Miss | Magic | Movement |
|-------|--------|-----|------|-------|----------|
| **salvatore** | "weaves the Hunter's dance" | "Icingdeath bites deep, a silver kiss of death" | "the feint fails—a lesson learned in blood" | "calls upon Mielikki's grace, the forest answering" | "flows like water between stones" |
| **deadpool** | "goes full murder-hobo (it's in the job description)" | "*THWACK!* (That's gonna need a montage to heal)" | "whiffs harder than my last movie—wait, which timeline is this?" | "does the sparkly-hands thing (FX budget: $12)" | "*PARKOUR!* (nailed it)" |
| **dark_comedy** | "makes a decision that will haunt future therapy sessions" | "succeeds in a way that will complicate everything later" | "fails upward into a worse situation" | "tampers with forces that really should have a warning label" | "shambles toward destiny with the confidence of the doomed" |
| **subtle_absurdity** | "initiates standard violence protocol" | "achieves the statistically expected perforation" | "the sword declines to participate" | "submits Form 27-B: Arcane Manifestation Request" | "relocates in accordance with spatial regulations" |
| **lovecraftian** | "strikes at that which should not be struck" | "the blade finds purchase in geometry that *writhes*" | "the weapon passes through angles the mind rejects" | "invokes syllables that corrode sanity itself" | "traverses space in ways that *bend* understanding" |
| **gonzo** | "Jesus, here we go—pure savage instinct" | "BAM! Right in the teeth, beautiful chaos" | "swung like a maniac but the universe said no" | "pulled some weird wizard shit out of the bag" | "hauled ass like the devil himself was on the clock" |
| **hemingway** | "swung" | "hit hard" | "missed" | "cast the spell" | "moved" |

---

### 3. Update Frontend Style Selector
**File:** `src/components/scribe/NarrativeForgeScreen.tsx`

Add 7 new `<SelectItem>` entries with evocative descriptions:

```text
• R.A. Salvatore — Epic sword-and-sorcery with warrior poetry and named blade techniques
• Deadpool — Fourth-wall-breaking meta chaos with pop culture asides
• Dark Comedy — Morbid wit, gallows humor, and sardonic cosmic indifference
• Subtle Absurdity — Deadpan Kafkaesque surrealism played completely straight
• Lovecraftian Horror — Cosmic dread, sanity erosion, and indescribable geometry
• Gonzo Journalism — Hunter S. Thompson's frantic, savage reporting style
• Hemingway Minimalist — Brutal efficiency, short sentences, understated emotion
```

---

### 4. Update Edge Function Validation
**File:** `supabase/functions/narrative-forge/index.ts`

Expand `VALID_STYLES` constant:

```typescript
const VALID_STYLES = [
  'fantasy', 'noir', 'literary', 'action',
  'salvatore', 'deadpool', 'dark_comedy', 'subtle_absurdity',
  'lovecraftian', 'gonzo', 'hemingway'
] as const;
```

---

### 5. Add Granular AI Style Guides
**File:** `supabase/functions/narrative-forge/index.ts`

Detailed writing instructions with specific do's/don'ts:

---

#### **R. A. Salvatore Style**

**Core Principles:**
- Combat is a **dance** with rhythm and poetry
- Weapons have **names and personalities** (Icingdeath, Twinkle, Taulmaril)
- Inner monologue reveals **philosophical warrior code**
- Bonds of friendship/loyalty are sacred narrative weight
- Action flows in **blow-by-blow choreography** with emotional stakes

**Mandatory Elements:**
- Name fighting techniques ("the Hunter's dance," "the double-thrust-low")
- Use simile for weapon movement (blade "sang," "whispered," "screamed")
- Include internal conflict during external battle
- Reference character relationships in combat context
- Poetic sentence rhythm with action beats

**Forbidden:**
- Generic "he attacked" phrasing
- Combat without emotional context
- Ignoring weapon/armor significance
- Lack of movement description
- Cynicism about heroism

**Example Transformation:**
- **Input:** "Rolled 18, hit for 12 damage"
- **Output:** "Drizzt's scimitars sang their deadly song, Icingdeath leading with a feint while Twinkle followed in the killing arc. The orc's eyes widened—too late—as the enchanted blade found the gap between helm and gorget. *Forgive me,* the drow thought, *but you chose this path.* Twelve wounds worth of justice delivered in a single, fluid motion."

---

#### **Deadpool Style**

**Core Principles:**
- **Constant fourth-wall breaks** addressing "you" (the reader)
- Pop culture references **even when anachronistic**
- Self-aware mockery of fantasy tropes
- Parenthetical asides interrupt serious moments
- Violence described in **cartoonish graphic detail**
- Inappropriate humor at worst possible timing

**Mandatory Elements:**
- Direct reader address at least once per paragraph
- (Parenthetical commentary on the action)
- Reference to "the writer," "the DM," or "plot armor"
- Movie/comic/meme references
- Acknowledge dice rolls or game mechanics meta-textually

**Forbidden:**
- Playing anything straight without commentary
- Serious emotional moments without undercutting
- Ignoring the absurdity of D&D mechanics
- Lack of visual sound effects (THWACK, SLICE, etc.)

**Example Transformation:**
- **Input:** "Cast fireball, 8d6 damage, 3 goblins died"
- **Output:** "*FWOOOOSH!* (Cue the Michael Bay explosions.) Three goblins—let's call them Steve, Steve, and Todd—experience rapid unplanned disassembly. (Don't worry, they're minions. They knew what they signed up for when they took the 'Goblin Henchman' gig.) You ever notice how fireball is just the fantasy equivalent of solving all your problems with arson? (The DM is giving me a look. Worth it.)"

---

#### **Dark Comedy Style**

**Core Principles:**
- **Sardonic narrator voice** with cosmic detachment
- Tragedy described with **understated dryness**
- Murphy's Law as narrative engine
- Characters make terrible choices, narrated matter-of-factly
- Death/failure treated with gallows humor timing
- Tone: Douglas Adams meets Lemony Snicket meets Terry Pratchett's Death

**Mandatory Elements:**
- Narrator commentary on the futility/irony of actions
- Understated phrasing for horrible events ("mildly inconvenient" death)
- Foreshadowing of doom delivered casually
- Cosmic indifference to character suffering
- Dry wit in sentence structure

**Forbidden:**
- Slapstick or silly comedy (this is *dark* comedy)
- Happy outcomes without ironic cost
- Sympathetic narrator tone
- Lack of consequence acknowledgment

**Example Transformation:**
- **Input:** "Failed the save, took 24 damage, dropped to 0 HP"
- **Output:** "It was at this precise moment—roughly 3.7 seconds before impact—that Gerald realized his decision to 'tank the hit' might have been what philosophers call 'a profound miscalculation.' The ground rose to meet him with the enthusiasm of an old friend, which is to say: painfully, and with a sense of inevitability that suggested the universe had been planning this reunion for some time. He would not be getting up. The party cleric sighed. It was going to be *that* kind of Tuesday."

---

#### **Subtle Absurdity Style**

**Core Principles:**
- **Bureaucratic/clinical language** for impossible events
- Deadpan delivery with **zero acknowledgment of weirdness**
- Mundane reactions to cosmic horror
- Kafka-esque normalcy applied to fantasy chaos
- Characters treat the bizarre as routine administrative procedure

**Mandatory Elements:**
- Formal/technical language for magic and violence
- No exclamation points or emotional language
- Treat physics violations as clerical matters
- Reference forms, protocols, or regulations for the impossible
- Understatement to the point of absurdity

**Forbidden:**
- Acknowledging anything is strange
- Emotional reactions
- Colorful adjectives
- Excitement or urgency in tone

**Example Transformation:**
- **Input:** "The dragon breathed fire, everyone roll for damage"
- **Output:** "The dragon processed its respiratory obligations in accordance with standard thermal output protocols. Personnel in the affected zone were advised to complete their combustion paperwork in triplicate. The flames proceeded in an orderly fashion, distributing heat damage equitably among participants. Several party members experienced involuntary status changes to 'crispy' and were asked to update their condition reports accordingly."

---

#### **Lovecraftian Horror Style**

**Core Principles:**
- **Cosmic dread** and insignificance of mortals
- Knowledge itself is **corrupting and maddening**
- Entities described through **what they're NOT** (indescribable, non-Euclidean)
- Escalating paranoia and sanity erosion
- Archaic prose with clauses and antiquated vocabulary
- Existential terror > physical danger

**Mandatory Elements:**
- Archaic language ("eldritch," "blasphemous," "cyclopean," "gibbous")
- Describe entities as "defying geometry" or "beyond comprehension"
- Sanity/mental state deterioration noted
- References to forbidden knowledge or ancient texts
- Atmosphere of *wrongness* pervading descriptions
- Long, winding sentences with subordinate clauses

**Forbidden:**
- Direct, clear descriptions of monsters
- Heroic confidence or triumph
- Modern casual language
- Lack of atmosphere
- Physical combat without psychological cost

**Example Transformation:**
- **Input:** "Encountered a tentacle monster, rolled initiative"
- **Output:** "What emerged from the cyclopean archway was not—could *not*—be reconciled with the geometries known to sane minds. Its form, if form it could be called, writhed with appendages that seemed to exist in angles perpendicular to reality itself. To gaze upon it was to feel the very foundations of reason crumble, as though the universe whispered a terrible secret: that the laws of nature were merely polite suggestions, and something ancient had declined to RSVP. Sanity, that fragile gossamer thread, began to fray at the edges of consciousness."

---

#### **Gonzo Journalism Style**

**Core Principles:**
- **Stream-of-consciousness** frantic energy (Hunter S. Thompson)
- Unreliable narrator admitting to altered states
- Savage social commentary embedded in chaos
- Tangents that spiral into philosophy/paranoia
- "Too weird to live, too rare to die" energy
- Present-tense immediacy with visceral detail

**Mandatory Elements:**
- First-person perspective (even if adapting third-person)
- References to substances, exhaustion, or sensory overload
- Sudden philosophical tangents mid-action
- Savage descriptors for people/creatures
- Paranoid observations about power structures
- Sentence fragments. Rapid fire. Like this.

**Forbidden:**
- Calm, measured prose
- Objective third-person distance
- Lack of personal voice
- Ignoring the absurdity of the situation
- Pretending the narrator is reliable

**Example Transformation:**
- **Input:** "The party negotiates with the corrupt mayor"
- **Output:** "The mayor—this bloated tick of a man, sweating through his silk doublet like a guilty conscience given form—is lying. Obviously. You can see it in the way his eyes dart toward the exit, the way his fingers drum that nervous rhythm on the mahogany desk that probably cost more than every peasant in this godforsaken town makes in a year. This is it. This is the moment. The savage heart of the American D—wait, wrong continent, wrong century, but the *principle* stands. Power. Corruption. The same old song and dance, just with more codpieces."

---

#### **Hemingway Minimalist Style**

**Core Principles:**
- **Short, declarative sentences** (subject-verb-object)
- **No adverbs** (never "quickly ran"—just "ran")
- Iceberg theory: **subtext over text** (90% unsaid)
- Understated emotion (show through action, not description)
- Focus on **physical, concrete details**
- Brutal efficiency—every word earns its place

**Mandatory Elements:**
- Sentences averaging 10 words or fewer
- Action verbs without modifiers
- Emotional weight conveyed through what's NOT said
- Dialogue without attributions when possible ("he said" only)
- Physical sensations over abstract feelings
- Repetition for emphasis (not variety)

**Forbidden:**
- Adverbs (-ly words)
- Flowery adjectives
- Explaining emotions directly
- Complex subordinate clauses
- Metaphors (unless stark and simple)

**Example Transformation:**
- **Input:** "The warrior bravely charged forward, swinging his mighty sword with tremendous force at the evil dragon"
- **Output:** "The warrior charged. He swung. The sword was heavy. The dragon was there. He swung again. It was good."

---

## Technical Summary

| File | Changes |
|------|---------|
| `src/lib/narrativeProcessor.ts` | Type update + 7 new enhancement templates with granular vocabulary |
| `src/components/scribe/NarrativeForgeScreen.tsx` | 7 new dropdown options with descriptive labels |
| `supabase/functions/narrative-forge/index.ts` | Validation update + 7 detailed AI prompts with do's/don'ts |

---

## Example Output Previews

**Original Input:**
> [Player] I attack the goblin with my longsword. Rolled 18+5=23. Hit! 2d6+3=11 damage. The goblin dies.

---

**Fantasy (Existing):**
> The blade sang through the air, striking true through the goblin's guard. The creature fell, its life extinguished.

---

**Salvatore:**
> Artemis's sword—that patient killer he'd named Charon's Claw—whispered through the torchlit air in a arc his old mentor would have called "the Reaper's Smile." The goblin's eyes widened in that final moment of clarity warriors know: the understanding that death has already arrived, and protest is futile. Eleven wounds worth of precision. The creature crumpled, and Artemis felt the familiar emptiness of another life taken. *Necessary,* he told himself. *But never easy.*

---

**Deadpool:**
> *SHLICK!* (That's the sound of steel meeting goblin—very specific, very wet.) Little green dude goes down like my credit score after a trip to the taco truck. (What? You think chimichangas pay for themselves?) "That's gonna leave a mark," I quip to absolutely no one, because let's be honest, the goblin's super dead and you—yeah, YOU reading this—are the only one who appreciates my wit. (The DM just rolled their eyes. They always do.)

---

**Dark Comedy:**
> The goblin had, until 0.3 seconds prior, been entertaining modest hopes for the future—perhaps a promotion to "Goblin Sergeant," maybe even dental coverage. These aspirations were abruptly and comprehensively revised downward to "not being perforated by eleven sword-shaped holes." The universe, in its infinite indifference, declined the request. The goblin's last thought, appropriately, was "Well, *shit*."

---

**Subtle Absurdity:**
> The longsword was inserted into the goblin at the regulation depth and angle, as specified in Combat Manual Section 4.7: "Edged Weapon Protocols." The goblin received eleven (11) units of damage and processed this information by transitioning to Status Code: Deceased. All parties acknowledged the transaction had been completed satisfactorily. The body was filed in the appropriate location (the floor).

---

**Lovecraftian:**
> The blade descended—though in what dimension it truly *moved*, no mortal geometry could ascertain—and found purchase in that blasphemous green flesh. What ichor spilled forth was not blood as wholesome men know it, but some eldritch humour that seemed to *writhe* with malevolent sentience. Eleven wounds, each a doorway through which sanity might escape. The creature's death-rattle was a syllable in a tongue predating human language, and hearing it, I felt some fundamental pillar of my reason crack and list sideways into madness.

---

**Gonzo:**
> Jesus Christ, here it comes—pure lizard-brain reflex, the sword already moving before the conscious mind even gets the memo. WHAM. Eleven points of damage, they'll say later, when we're writing this up for the expense report, but right now it's just meat and steel and that copper smell of blood mixing with goblin funk. The little bastard's eyes go wide. Shock. The universal expression of "I have made a terrible career choice." He drops. They always drop. And somewhere in the back of my skull, the little voice that sounds like my dead mentor whispers: *This is what you are now.* Yeah. Yeah, I know.

---

**Hemingway:**
> He swung. The sword was sharp. It cut deep. The goblin fell. It did not get up. That was good.

---

## Result

After this upgrade, the Narrative Forge will offer **11 total writing styles** spanning:
- **Epic Fantasy** (Tolkien, Salvatore)
- **Genre Fiction** (Noir, Action, Horror)
- **Literary** (Hemingway minimalism, Literary prose)
- **Comedy** (Deadpool meta, Dark comedy, Subtle absurdity)
- **Experimental** (Gonzo journalism, Lovecraftian)

Each style now includes:
✅ Granular prompt engineering with specific do's/don'ts  
✅ Example transformations for AI training  
✅ Action-specific vocabulary for offline fallback  
✅ Clear forbidden elements to prevent style drift  
✅ Tonal consistency guidelines  

This provides maximum creative flexibility while ensuring AI output accuracy and style authenticity.