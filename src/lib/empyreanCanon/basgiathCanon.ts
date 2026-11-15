// Canon Empyrean lore guide (D-32), paraphrased from the Fourth Wing books and the
// Threshing Day stories. No book text is quoted. Plain text on purpose: the DM reads it as-is.
import type { EmpyreanGuide } from '@/lib/empyreanGMGuides';

export const EMPYREAN_BASGIATH_CANON_GUIDE: EmpyreanGuide = {
  id: 'empyrean-lore-basgiath',
  name: 'Basgiath War College (Canon)',
  category: 'lore',
  stackable: true,
  description: "The college layout, daily life, uniforms and patches, the Codex, and the trials from the Gauntlet to RSC.",
  content: `BASGIATH WAR COLLEGE (CANON)

Spoiler tags show where a fact is first revealed: [FW] Fourth Wing (year one), [IF] Iron Flame (year two), [OS] Onyx Storm (year three), [TD] Threshing Day (backstory). "(uncertain)" means sources disagree: stay vague on it.

BASGIATH WAR COLLEGE: THE PLACE

Where:
- On the side of Basgiath Mountain in Morraine, roughly in the middle of Navarre.
- The name is Gaelic for death plus wing (or shield).
- The lower half holds the scribes, healers, infantry and administration. The upper half, the Citadel, is the Riders Quadrant.
- The Iakobos River runs beneath it and is deadly fast in late summer.
- Eran Norris built it with stone stairs, not wooden ones (uncertain).

Entrances:
- Infantry: the northern turret.
- Healers: the southern gate.
- Scribes and the Archives: the central tunnel.
- Riders: a fortified tower door, then the Parapet.
- On Conscription Day nobody uses the main gate. Four roads meet in the fields below it.

The Parapet:
- About 250 steps up a turret with no railing.
- Then a stone bridge about 200 feet up and roughly 18 inches wide: uneven, mossy and windy.
- It's the only opening in the Citadel wall.

The Citadel is an L-shaped complex on the southern ridgeline. Its walls are about ten feet thick, strong enough for dragons to perch on.
- The courtyard: teardrop-shaped, big enough for a thousand riders in formation.
  - A stone dais sits beside the Parapet opening.
  - A shady alcove with a bench leads by tunnel to the dorm turret.
  - The western gate leads through a tunnel to the flight field and the Gauntlet.
- The Dragon Rotunda:
  - Three stories, with gray marble floors and a domed glass ceiling.
  - Six marble pillars carved as dragons (red, green, brown, orange, blue, black). There's a shortcut gap behind the red one's claw.
  - It links the academic wing, the dorms, the commons, the library and the gathering hall (where cadets eat).
- The academic wing has four stories:
  - Battle Brief room: tiered and circular, one of only two rooms that fit every cadet. A twenty-foot map of the Continent hangs on its back wall.
  - Sparring gym: the top floor. It has twenty black mats, and each squad gets one on assessment days.
  - Kaori's classroom: tables that project images.
  - The burn pit: at the top of the tower, where the dead's belongings are burned.
- The forge: below the flight-field tunnel, heated by dragonfire, where alloy is smelted and daggers made. It held Navarre's only known luminary until Tecarus handed over his [IF].
- First-year barracks: three stories, with first-years on the first and third floors.
  - 156+ beds in four rows.
  - Lights come on at sunset and go out at curfew.
- Dorms: private rooms once a cadet bonds. Second-years are on the third floor, leaders get larger rooms, and Xaden's is the last door on his hall.
- Library: riders' study books. It's separate from the Archives.

The scribe side:
- The Archives: underground in the Scribe Quadrant. They're sealed every evening by protective magic that harms anyone left inside.
- The Royal Vault is in the Archives. Only Tauri blood can open it.

The healer side:
- Reached from the Citadel by a covered stone bridge over the ravine.
- The infirmary is a long hall of beds with blue privacy curtains.

Administration:
- The administration building looks out over the fields.
- General Sorrengail's office is near the southern turret.
- A bell tower stands in one corner turret.

Outside:
- The flight field: a box canyon above the Gauntlet with peaks on three sides, a seasonal waterfall and a sulfur smell. No unbonded cadets or non-riders allowed.
- The Gauntlet: a vertical obstacle course cut into a near-cliff ridgeline, leading up to the flight field.
- The Vale: the dragons' valley behind Basgiath, where eggs are laid and feathertails are kept safe. Cadets never enter it.
- The torture chamber used in RSC: its entrance is hidden in the cliffside under the quadrant's foundations.
- A lake where Morraine cadets swim on Saturdays.
- The oak line along the river, where fonilee berries grow.

Chantara: the village that supplies Basgiath (uncertain). Its visitors are second-years at least; one source says second- and third-years, another says only non-riders.

LIFE IN THE RIDERS QUADRANT

Structure:
- Four wings: First, Second, Third, Fourth.
- Each wing has three sections: Claw, Flame, Tail.
- Each section has three squads of about 15–20 cadets.
- Wingleaders and section leaders are third-years. Squad leaders are usually strong second-years.
- Every level has an executive officer (XO).
- One wingleader is the quadrant's senior wingleader.
- Unbonded first-years are formally "candidates."

Uniforms and patches:
- Riders wear all black, and it's the loosest dress code at Basgiath. The black hides blood from the enemy.
- First-years get fitted summer-weight tunics and pants after the Parapet. There are summer and lined winter leathers.
- Fighting leathers are for sparring.
- Flight leathers are issued only after the Threshing. They carry rank and leadership marks only, with no names or patches, to protect riders downed behind enemy lines.
- Year stars: silver four-pointed stars on the collarbone, one per year.
- Patches are optional and sewn on, and the designs change each year:
  - Wing patch: on the shoulder, flame-shaped with a squad number. Wing leadership wears wing only; section leadership wears wing and section.
  - Leadership patches: for wingleaders, section leaders and squad leaders.
  - Flame Section: a bright purple patch.
  - Iron Squad: a green patch, for the squad with the most survivors at the Threshing. That squad doesn't have to rotate sparring mats.
  - Squad Battle winners: their own patch.
  - Fastest Gauntlet time: its own patch.
  - Signet patches: for example lightning, metallurgy, ice, fire, water-breathing and astral projection. A compass patch means a classified signet.
  - Classified patch: a silver circle with a black key, given after RSC interrogation.
  - "Don't mess with me on the mat" patch: a triangle with a long sword.
  - Xaden wears only his wing and wingleader emblems.
- Scribes wear cream.

First-year routine:
- Breakfast duty around 5:25 a.m., breakfast at 6, then formation, where the scribes read the death roll.
- First-years stand in the back two rows of their squad.
- Classes:
  - Battle Brief: daily, for the whole quadrant.
  - Dragon studies: Kaori.
  - History: Professor Levini.
  - Signets and lesser magic: Carr.
  - Physical training: Emetterio.
  - Gym: twice a week, or Gauntlet training three times a week from September.
- First-years can't send or receive letters all year. Second- and third-years can.

Challenges (sparring):
- Hand-to-hand or with agreed weapons, once a week after lunch, set a week in advance, and only in front of a combat master.
- Instructors quietly pair matches to cull the weak. Brennan's notebook says so.
- No throwing weapons, no lesser magic, no signets (though some cheat).
- Squadmates may not challenge each other.
- The winner may take the loser's weapons. Challenges can be lethal.
- First-years stop in September to train for the Gauntlet.

Death:
- Families may claim the body and belongings.
- Otherwise the college buries the body under a stone in the fields and burns the belongings in the burn pit.

Romance:
- Discouraged but allowed between cadets.
- Forbidden between cadets and professors.
- Lieutenants may marry anyone they choose.

The Book of Brennan [FW]: Brennan's handwritten survival guide, passed to Mira and then to Violet. Violet adds her own notes. Among its warnings: a secret second-year course (RSC), and never anger another rider's dragon.

THE CODEX AND THE CODE (PARAPHRASED, NOT QUOTED)

The Codex is the Riders Quadrant's own rulebook. For riders it overrides the college Code of Conduct.

Article One:
- A dragon can survive losing its rider, but a rider without their dragon is as good as dead.
- A dragon decides when it, and its rider, fly their last.

Article Two:
- Riders outside the cadet chain of command can't interfere in cadet matters.
- Barring invasion, only riders and designated scribes may enter the quadrant. Others risk death on the spot.
- Impersonating an officer is punishable.

Article Three:
- Attacking a sleeping cadet is an executable offense.
- A cadet may keep only what they carried across the Parapet, and it can't be taken from them, because it counts as part of them.
- Harming a rider in formation, or in front of a higher-ranking cadet, is unlawful.

Article Four:
- Command may search any cadet's belongings.
- Discipline goes through the chain of command before it reaches the cadre.
- Other quadrants' leaders can't be harmed without cause and a quorum of wingleaders.
- A wingleader must keep order in their wing.

Article Five: romance between cadets is discouraged but not banned, and the commandant's office has the final say on academic punishment.

Article Eight: only Basgiath's Commanding General can call cadets to active duty in wartime.

Also in the Codex:
- After the Parapet, squadmates may not kill each other.
- Stealing is banned.
- Challenges need a combat master.

The Code of Conduct (the whole college):
- Menders may go anywhere on campus.
- Absence without leave means court-martial, or execution on sight.
- No more than three marked ones per squad.
- Under Varrish [IF]: three or more marked ones gathering counts as seditious conspiracy, a capital offense.

Enforcement:
- Dragons can carry out Codex justice. Tairn executed Amber Mavis [FW].
- Dragonfire is the usual execution for traitors.

THE TRIALS

The Gauntlet:
- A vertical obstacle course up a near-cliff ridgeline, guarding the way to the Vale. It tests balance, strength and agility.
- Candidates must beat it within about two months of arriving.
- Falls can kill. Only those who finish can present.
- Violet used the gaps between pieces to climb it. Rhiannon later copied the trick to mount Feirge [TD].

Presentation (Sept 29):
- Candidates walk in a line down the flight-field meadow so the dragons can look them over.
- The advice: keep about seven feet apart, and keep talking.
- Dragons can secretly claim a cadet here. Glane marked Imogen at Presentation [TD].

The Threshing (Oct 1) is held in the forest and fields in the valley below the Citadel. Candidates go hunting for the dragon that wants them. Dragons may kill cadets they judge weak.
- Safety advice (from Threshing Day's opening essay by a retired colonel [TD]):
  - Dragons treat humans as expendable.
  - Cadets who walk in groups tend to die.
  - Never set foot in the Vale.
  - Never speak to a dragon that isn't yours.
- Climbing on: the dragon often sets a test. Some want the rider to climb without help. Marbh made Brennan reach his back without touching the ground [TD].
- Bonding: a candidate usually feels being chosen, or refused. The bond leaves a relic mark.
- Flight trials: the dragon then flies, rolls and turns to see whether the rider stays seated. A rider who falls is caught, or, if found unworthy, left to die.
- Recording the bond: after landing, the rider reports to the roll-keeper, who writes the bond in the Book of Riders.
- After bonding: the new rider gets flight leathers and a private room.
- Dragon records:
  - Each dragon has a Compendium entry: year, name, breed, sex, bloodline, estimated age and recorded riders [TD].
  - Dragons can lie to the record. Glane hid her past rider; Chradh's listed age looks too low [TD].
- Unbonded survivors may repeat the year, as Sawyer did (34 cadets from Dain's year restarted alongside Violet's year), or take another assignment in their first week.
- A dragon may simply not be ready that year. That was Sliseag's reason for Sawyer [TD].

Squad Battle (spring) [FW] comes in three stages:
1. A Gauntlet race.
2. Mat challenges.
3. A final mission: steal something the enemy would want. Violet's squad stole General Sorrengail's map of the outposts.

The FW prize was a week at the Montserrat outpost, where Mira was posted. That year Panchek moved the final stage up a day without warning.

War Games (May–July):
- Lethal exercises between wings.
- FW's first battle: First Wing defended a crystal egg while Fourth Wing defended a flag.
- The final exercise simulates the wards falling. Wings fly to outposts to reinforce them. In FW this became Resson.

The Rider Survival Course (RSC) [IF]:
- Second year, classified, run by Captain Grady. It has two evaluations that cadets must pass to stay.
- It covers:
  - surviving behind enemy lines without your dragon;
  - land navigation with infantry, scribes and healers;
  - being "kidnapped" and interrogated, with beatings, in the chamber under the cliff.`,
};
