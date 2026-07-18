import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import { SignetIntensitySelector } from './SignetIntensitySelector';

const LONG_PRESS_MS = 450;

/**
 * Hook that distinguishes a tap (fires onTap) from a long-press
 * (fires onLongPress and suppresses the tap). Works for mouse + touch.
 */
function usePressPreview(onTap: () => void, onLongPress: () => void) {
  const timerRef = useRef<number | null>(null);
  const longFiredRef = useRef(false);

  const start = useCallback(() => {
    longFiredRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      longFiredRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const end = useCallback(() => {
    cancel();
    if (!longFiredRef.current) onTap();
  }, [cancel, onTap]);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); end(); },
    onTouchCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

interface PreviewPillProps {
  emoji: string;
  label: string;
  prompt: string;
  disabled?: boolean;
  className: string;
  onSend: () => void;
  previewOpen: boolean;
  onOpenPreview: () => void;
  onClosePreview: () => void;
}

function PreviewPill({ emoji, label, prompt, disabled, className, onSend, previewOpen, onOpenPreview, onClosePreview }: PreviewPillProps) {
  const handlers = usePressPreview(onSend, onOpenPreview);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        className={className}
        style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}
        {...handlers}
      >
        <span className="shrink-0 text-sm">{emoji}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      {previewOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClosePreview} onTouchStart={onClosePreview} />
          <div
            role="tooltip"
            className="absolute left-0 right-0 bottom-full mb-1.5 z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-2.5 text-[11px] leading-snug animate-in fade-in zoom-in-95"
          >
            <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Preview · tap pill to send</div>
            <div className="whitespace-pre-wrap">{prompt}</div>
          </div>
        </>
      )}
    </div>
  );
}

interface ActionItem {
  id: string;
  label: string;
  emoji: string;
  prompt: string;
}

interface EmpyreanContextualActionsProps {
  situation: string;
  characterName: string;
  dragonName: string;
  signetType: string;
  onAction: (prompt: string) => void;
  disabled?: boolean;
  isUnbonded?: boolean;
  fetchMasterworkPills?: (category: 'dragon' | 'situation', situationLabel: string) => Promise<ActionItem[]>;
  currentBurnout?: number;
  maxBurnout?: number;
  onArmSignet?: (intensity: number) => void;
}

type MasterworkState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; pills: ActionItem[] }
  | { status: 'error'; error: string };

const SITUATION_META: Record<string, { label: string; emoji: string; color: string }> = {
  combat:      { label: 'Combat',      emoji: '⚔️', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  social:      { label: 'Social',      emoji: '🗣️', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  exploration: { label: 'Exploration', emoji: '🔍', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  training:    { label: 'Training',    emoji: '📖', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  downtime:    { label: 'Downtime',    emoji: '🏕️', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  crisis:        { label: 'Crisis',        emoji: '🚨', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  flight:        { label: 'Flight',        emoji: '🦅', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  stealth:       { label: 'Stealth',       emoji: '🥷', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' },
  political:     { label: 'Political',     emoji: '🏛️', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  wardline:      { label: 'Ward Line',     emoji: '🛡️', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  investigation: { label: 'Investigation', emoji: '🕵️', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  ritual:        { label: 'Ritual',        emoji: '🔮', color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' },
};

const EXECUTION_FIRE_AUDIO_URL = '/audio/dragon-execution-fire.mp3';
const DRAGON_ROAR_AUDIO_URL = '/audio/dragon-roar.mp3';
const DRAGON_TAKEOFF_AUDIO_URL = '/audio/dragon-takeoff.mp3';
const DRAGON_LAND_AUDIO_URL = '/audio/dragon-land.mp3';

function playExecutionFireAudio() {
  try {
    const audio = new Audio(EXECUTION_FIRE_AUDIO_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

function playDragonRoarAudio() {
  try {
    const audio = new Audio(DRAGON_ROAR_AUDIO_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

function playDragonTakeoffAudio() {
  try {
    const audio = new Audio(DRAGON_TAKEOFF_AUDIO_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

function playDragonLandAudio() {
  try {
    const audio = new Audio(DRAGON_LAND_AUDIO_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

function buildDragonActions(char: string, dragon: string): ActionItem[] {
  const d = dragon || 'my dragon';
  return [
    { id: 'da-roar', label: 'Roar', emoji: '🔊', prompt: `${char} commands ${d} to roar. The sound is primal, bone-rattling — it echoes off stone and shakes the air itself. Describe the roar's effect on everyone within earshot: allies steadied, enemies shaken, smaller creatures fleeing. The ground vibrates. Dust falls from the ceiling. This is not a sound — it is a declaration.` },
    { id: 'da-execution-fire', label: 'Execution by Fire', emoji: '🔥', prompt: `${char} gives ${d} the kill command. The dragon opens its jaws and unleashes a concentrated, devastating stream of fire directly at the target — not a breath weapon, an execution. Describe the heat distortion in the air before it hits, the color of the flame (specific to this dragon), the target's final moment, and the silence that follows. This is not combat. This is a sentence carried out.` },
    { id: 'da-takeoff', label: 'Take Off', emoji: '🚀', prompt: `${char} mounts ${d} and they launch into the sky. Describe the physical experience: the bunching of muscle beneath the saddle, the explosive thrust of wings, the lurch in the stomach as the ground falls away. Wind hits the rider's face. The world shrinks. Describe what they see as they climb — the terrain below, the horizon opening up, the other dragons in the sky if any.` },
    { id: 'da-land', label: 'Land', emoji: '⬇️', prompt: `${char} and ${d} descend and land. Describe the approach — the angle of descent, the wind shifting, the ground rushing up. The landing itself: the impact through the rider's spine, the scrape of claws on stone or earth, the fold of wings. Describe the reactions of anyone on the ground watching a dragon land near them.` },
    { id: 'da-tail', label: 'Tail Attack', emoji: '💥', prompt: `${d} whips its tail at the target with devastating force. Describe the speed — the tail moves faster than the eye can track. The impact is not a strike, it's a demolition. Describe what the tail hits, the sound of the impact, and the aftermath. If it hits a person, they do not get back up easily. If it hits a structure, the structure loses.` },
    { id: 'da-bite', label: 'Bite', emoji: '🦷', prompt: `${d} lunges and bites. Describe the speed of the strike — the jaw opening wider than seems possible, the rows of teeth, the snap that sounds like a thunderclap. Describe what the dragon bites, the pressure of the jaw, and the result. Dragons do not nibble. This is a predator ending a discussion.` },
    { id: 'da-fly', label: 'Fly', emoji: '🐉', prompt: `${char} and ${d} are in flight. Describe the experience of flying: the rhythm of wingbeats, the tilt of turns, the wind, the altitude. What does the world look like from dragonback? Describe the bond between rider and dragon in motion — the way the rider's body moves with the dragon's, the shared awareness of air currents and thermals. Make it feel like freedom.` },
    { id: 'da-growl', label: 'Intimidating Growl', emoji: '😤', prompt: `${d} growls — low, sustained, and threatening. This is not a roar. This is a warning. Describe the sound: it starts in the chest and vibrates through the ground. The dragon's eyes lock onto the target. Its lips pull back just enough to show teeth. Describe the effect on the target — the primal fear response that no amount of training can fully suppress when a dragon is telling you to reconsider your choices.` },
    { id: 'da-claw', label: 'Claw Gouge', emoji: '🐾', prompt: `${d} rakes its claws across the target. Describe the reach — a dragon's foreleg extends further than you expect. The claws are not decorative; they are siege weapons attached to a living creature. Describe the gouges left behind — in armor, in stone, in whatever was unfortunate enough to be in the way. The sound of dragon claws on metal is something you hear once and never forget.` },
    { id: 'da-firebreath', label: 'Fire Breath', emoji: '🌋', prompt: `${d} unleashes a wide breath of fire across the area. Unlike the precision of an execution, this is area denial — a sweeping wall of flame that turns the battlefield into an inferno. Describe the buildup: the glow in the dragon's chest, the heat shimmer before the flame arrives, the ignition point where air itself seems to catch fire. Describe the spread, the color, and the aftermath. The ground will be scorched. The air will taste like ash.` },
  ];
}

function buildActions(char: string, dragon: string, signet: string): Record<string, ActionItem[]> {
  const d = dragon || 'my dragon';
  const s = signet || 'my signet';

  return {
    combat: [
      { id: 'sov-c-read', label: 'Read Battle', emoji: '🧠', prompt: `${char} takes a beat to process the full tactical picture — terrain, enemy positioning, friendly disposition, escape routes, environmental factors, the enemy commander's likely intent. Not panic, not reaction — analysis. Narrate what ${char} sees that others miss: the vulnerability in the enemy's formation, the terrain feature that changes everything, the timing window about to open or close.` },
      { id: 'sov-c-shot', label: 'Call Shot', emoji: '🎯', prompt: `${char} sees it — the single action that unravels the enemy's position. It requires total commitment: resources pulled from other sectors, risk accepted elsewhere, everything bet on one read. Narrate ${char}'s decision, the order given with total conviction, and the cascade that follows when the one right move makes five problems disappear.` },
      { id: 'sov-c-tempo', label: 'Break Tempo', emoji: '⏱️', prompt: `${char} does something the enemy does not expect — not bigger force, but different timing. A pause when aggression was expected. An attack during a lull. A direction change that forces the enemy to restart their decision cycle. Narrate the disruption and the moment the enemy's coordination fractures because they rehearsed for one speed and ${char} keeps changing it.` },
      { id: 'sov-c-trap', label: 'Set Trap', emoji: '🪤', prompt: `${char} prepares the ground — creating a vulnerability that looks accidental, an opening that looks exploitable, a retreat that looks panicked. Everything the enemy sees is an invitation into a kill zone. Narrate ${char}'s preparation, the bait, and the moment the trap closes on an enemy that thought they were winning.` },
      { id: 'sov-c-wounded', label: 'Fight Wounded', emoji: '🩸', prompt: `${char} is hurt, drained, running on fumes. The rational move is withdrawal. ${char} chooses precision instead — every remaining resource calculated to the last unit, pain sharpened into focus, movements stripped to only what is essential. Narrate the fight: not heroic excess, but lethal economy. ${char} becomes more dangerous wounded because desperation strips away everything that is not survival.` },
      { id: 'sov-c-retreat', label: 'Bait Retreat', emoji: '🏃', prompt: `${char} orders withdrawal — controlled, disciplined, designed to look just desperate enough that the enemy pursues aggressively. Each abandoned position was prepared. The retreat path is a funnel. Narrate the fighting withdrawal: the rearguard actions that sell the illusion, the enemy's growing confidence, and the moment ${char} stops running and the pursuit becomes an encirclement.` },
      { id: 'sov-c-shield', label: 'Shield Them', emoji: '🛡️', prompt: `${char} reorganizes around the vulnerable — not by clustering but by creating layered security: an outer screen to buy time, a mobile reserve to respond to breakthroughs, and an evacuation route scouted but not obviously prepared. Narrate the deployment, the balance between protection and combat effectiveness, and the moment the plan is tested.` },
      { id: 'sov-c-flip', label: 'Flip Strength', emoji: '🔄', prompt: `${char} studies the enemy's advantage and identifies the dependency — the thing that makes their strength work. Then targets that dependency. Superior numbers become a coordination problem in confined terrain. High ground becomes exposure to flanking. Narrate the analysis, the specific counter, and the enemy's confusion when their greatest asset becomes their biggest liability.` },
      { id: 'sov-c-improv', label: 'Improvise', emoji: '💡', prompt: `The plan is dead. ${char} does not mourn it — they build the next one from whatever the chaos has given them. The enemy's aggression reveals their priorities. The disruption that scattered forces can be turned into dispersed positioning. Narrate ${char} constructing a new plan in real time, communicating it clearly under pressure, and the moment the team shifts from reactive to proactive.` },
      { id: 'sov-c-next', label: 'Next Fight', emoji: '♟️', prompt: `While others celebrate or collapse, ${char} is already thinking ahead. What did the enemy learn? What will they change? What did ${char}'s own side reveal about their weaknesses? Narrate the honest post-action analysis stripped of ego, the adjustments ordered, and the intelligence gathered that predicts the enemy's next move. The fight just ended. ${char} is already winning the next one.` },
    ],
    social: [
      { id: 'sov-s-read', label: 'Read Room', emoji: '👁️', prompt: `${char} pauses and reads the room before engaging — scanning body language, alliances, tension lines, and unspoken hierarchies. Who holds real power here? Who is performing confidence they do not feel? Who is the most dangerous person and why? Narrate what ${char} picks up through pure observation and social intelligence — the subtext underneath the surface conversation.` },
      { id: 'sov-s-win', label: 'Win Over', emoji: '🤝', prompt: `${char} sets aside ego and focuses entirely on the other person — finding the specific thing they need to hear, the specific concern driving their resistance, the specific value they hold that ${char} can genuinely align with. This is not manipulation — it is radical empathy deployed with precision. Narrate the approach, what ${char} says, and the moment the other person's guard drops because they feel genuinely understood.` },
      { id: 'sov-s-reframe', label: 'Reframe', emoji: '🔀', prompt: `${char} listens to both sides, then speaks — not to agree with either, but to reframe the conflict so completely that the original disagreement no longer makes sense. ${char} identifies what both sides actually want underneath their stated positions and presents a perspective that satisfies both without compromise. Narrate the exact words and the shift in the room.` },
      { id: 'sov-s-truth', label: 'Hard Truth', emoji: '🗡️', prompt: `${char} tells this person the truth — directly, without softening it into uselessness, but with enough precision that it lands as surgery instead of violence. ${char} names the behavior, names the consequences, then names the potential they are wasting and the version of themselves worth fighting for. Narrate the delivery and the tension of a moment where honesty could either heal or destroy.` },
      { id: 'sov-s-confess', label: 'Make Talk', emoji: '🗝️', prompt: `${char} creates space for the truth — not through interrogation but through presence. ${char} shares something vulnerable first, asks questions that are really observations, and communicates safety through stillness and attention. Narrate how the truth is drawn out without force, making the secret harder to hold than to release.` },
      { id: 'sov-s-name', label: 'Name It', emoji: '💣', prompt: `${char} says the thing everyone is thinking but nobody will speak. The fear, the failure, the elephant in the room. Not aggressively — plainly, as if it is simply obvious. Narrate the words, the shock of hearing the unspoken made spoken, and the relief or discomfort that follows as the group is forced to deal with reality instead of performing around it.` },
      { id: 'sov-s-charge', label: 'Take Charge', emoji: '👑', prompt: `${char} does not ask for attention — they take it. Through voice, presence, and the absolute certainty of someone who already sees the whole picture. ${char} gives clear, specific direction that cuts through the noise. Narrate the shift: how the chaos organizes around ${char}'s words and why people obey someone with no formal authority to command them.` },
      { id: 'sov-s-nowords', label: 'No Words', emoji: '🔥', prompt: `${char} does not give a speech. Instead, they do something — a specific act of competence, courage, or sacrifice that communicates more than words could. The people watching do not need to be told things will be okay. They need to see someone behaving as if things will be okay. Narrate the action and the ripple effect as resolve becomes contagious.` },
      { id: 'sov-s-raw', label: 'Raw Honesty', emoji: '⚡', prompt: `In a room full of posturing and half-truths, ${char} does something no one anticipates: tells the complete, unvarnished truth. Their real position, their real constraints, their real fears. Narrate the shock — how radical honesty among liars becomes the most destabilizing force possible. Everyone else's deceptions become visible by contrast. Show how transparency gives ${char} more power than any lie could have.` },
      { id: 'sov-s-threat', label: 'Quiet Threat', emoji: '🌑', prompt: `${char} needs someone to change course. They never raise their voice, never make an explicit threat — they methodically walk the other person through the logical consequences of their current path. Not "I will destroy you" but "here is what happens next, and next, and I wonder if you have considered how that ends." Narrate the conversation and the moment the other person realizes they have been educated, not threatened — which is worse.` },
    ],
    exploration: [
      { id: 'sov-e-power', label: 'Map Power', emoji: '🕸️', prompt: `${char} studies the people, relationships, and dynamics here — not the official hierarchy but the real one. Who do people actually defer to? Who controls resources? Who is a figurehead? Narrate ${char}'s analysis — the specific observations that reveal the invisible power structure beneath the visible one.` },
      { id: 'sov-e-gap', label: 'Find the Gap', emoji: '🔓', prompt: `${char} examines the rules, protocols, and norms — not to break them but to find the gap between how the system is written and how it actually operates. Every institution has exploitable distance between stated policy and lived practice. Narrate ${char} identifying the specific gap and threading the needle without technically violating anything.` },
      { id: 'sov-e-detect', label: 'Detect Play', emoji: '🎭', prompt: `${char} steps back and analyzes recent interactions through the lens of manipulation tactics: flattery followed by requests, isolation from allies, manufactured urgency, information asymmetry. Narrate what ${char} identifies — the specific technique being used, how long it has been running, and the manipulator's actual objective beneath the performance.` },
      { id: 'sov-e-scout', label: 'Scout Ahead', emoji: '🦅', prompt: `${char} surveys this new environment with a strategist's eye — not just physical terrain but social terrain. Entry points, exits, sight lines, who is watching whom, where conversations happen that are not overheard. Narrate the full tactical and social assessment of this space, what advantages it offers, and what dangers it hides.` },
      { id: 'sov-e-signs', label: 'Read Signs', emoji: '🔍', prompt: `Something is off and ${char} can feel it. They slow down and observe what others are rushing past — the detail that does not fit, the absence where something should be, the pattern that breaks. Narrate ${char}'s attention catching the thing everyone else missed and what it reveals about what happened here or what is about to happen.` },
      { id: 'sov-e-dragon', label: 'Ask Dragon', emoji: '🐉', prompt: `${char} reaches through the bond and asks ${d} for a read on this place or situation. The dragon's senses are different — older, less verbal, more instinctual. Narrate what comes through the bond: not words but impressions, warnings, curiosities. What does the dragon notice that human senses cannot?` },
    ],
    training: [
      { id: 'sov-t-standard', label: 'Set Standard', emoji: '📏', prompt: `${char}'s preparation is more thorough, execution more precise, discipline more consistent than anyone else's — and they do not mention it. Narrate a specific moment where ${char}'s standard is visible: the extra work nobody asked for, the detail that catches what everyone missed. Show how this silent standard becomes the group's new floor because mediocrity in ${char}'s presence became intolerable.` },
      { id: 'sov-t-push', label: 'Push Harder', emoji: '🔥', prompt: `${char} designs a challenge for a trainee or squad member that is precisely hard enough to shatter a limitation without shattering the person. Narrate the calibration — ${char} knows this person's breaking point and pushes to ninety-five percent. Show the moment they hit their wall, ${char}'s decision about when to intervene versus when to let them struggle, and the transformation when they push through.` },
      { id: 'sov-t-underdog', label: 'Back Underdog', emoji: '💪', prompt: `${char} publicly backs someone that everyone else has written off — not with empty encouragement but with a specific task, a specific responsibility, a specific expression of trust. Narrate what ${char} sees that others miss, the risk of staking credibility on an unproven person, and the moment the underdog rises to the belief placed in them.` },
      { id: 'sov-t-show', label: 'Show Don\'t Tell', emoji: '⚔️', prompt: `${char} stops talking and starts demonstrating. The hardest task, the most dangerous position, the most unglamorous job — ${char} takes it. Not performatively — just quietly doing the thing nobody else wants to do at the standard nobody else can match. Narrate the action and the ripple: others matching ${char}'s effort without a word being spoken.` },
      { id: 'sov-t-rewrite', label: 'Rewrite Story', emoji: '📖', prompt: `${char} takes the same facts this person uses to diminish themselves and reframes them. The struggle they are ashamed of is evidence of resilience. The lucky break was preparation meeting opportunity. The weakness is actually their greatest weapon. Narrate ${char} retelling this person's story back to them with the interpretation they could never see, and the moment their self-concept shifts.` },
      { id: 'sov-t-test', label: 'Test Loyalty', emoji: '🔍', prompt: `${char} suspects someone is not trustworthy and designs a quiet test — sharing a specific piece of false information with them alone and waiting to see if it surfaces where it should not. Narrate the test design, the wait, and the result — whether the person passes or fails, and what ${char} does with the answer.` },
    ],
    downtime: [
      { id: 'sov-d-seed', label: 'Plant Seed', emoji: '🌱', prompt: `${char} introduces an idea — not as a proposal, but disguised as a question, an observation, or a story. Something that lodges in the listener's mind and grows. ${char} does not push. Narrate exactly how ${char} plants it, why the framing makes it feel like the listener's own thought, and ${char}'s quiet exit knowing the seed will bloom on its own schedule.` },
      { id: 'sov-d-goodwill', label: 'Build Goodwill', emoji: '🤝', prompt: `${char} helps someone — genuinely, not performatively — solving a real problem they have. The help is authentic but also strategic. Narrate the assistance, why ${char} chose this person and this moment, and how the act creates goodwill that will compound over time without feeling transactional.` },
      { id: 'sov-d-whispers', label: 'Gather Whispers', emoji: '👂', prompt: `${char} spends time in the spaces where information flows freely — the mess hall, the training yard between sessions, the quiet corners where people let their guard down. Not interrogating, just present, listening, remembering. Narrate who ${char} talks to casually, what fragments of information they collect, and the larger picture that emerges when the fragments are assembled later.` },
      { id: 'sov-d-sharpen', label: 'Sharpen Edge', emoji: '🔪', prompt: `${char} uses this quiet time to prepare — not physically but mentally. Rehearsing conversations that have not happened yet, gaming out scenarios, identifying weaknesses in their own position before an adversary can find them. Narrate the internal war-gaming and the specific insight or preparation that will pay off later when the pressure is on.` },
      { id: 'sov-d-network', label: 'Tend Network', emoji: '🕸️', prompt: `${char} checks in with people across their network — not because they need something, but to maintain the relationships that are their real source of power. A word of encouragement here, a shared meal there, a quiet acknowledgment of someone's struggle. Narrate the rounds and how each small investment sustains a web of trust that will hold when tested.` },
      { id: 'sov-d-mercy', label: 'Offer Mercy', emoji: '⚖️', prompt: `${char} has defeated or outmaneuvered someone — they are exposed, finished. Everyone expects ${char} to press the advantage. Instead, ${char} offers a path forward that preserves the adversary's dignity while redirecting their energy from enemy to asset. Narrate the offer, the adversary's confusion, and why mercy from a position of strength creates deeper loyalty than force ever could.` },
    ],
    crisis: [
      { id: 'sov-x-seize', label: 'Seize Control', emoji: '👑', prompt: `${char} does not ask for attention — they take it. Through voice, presence, and absolute certainty. ${char} gives clear, specific direction that cuts through panic. Narrate how the chaos organizes around ${char}'s words, why people obey someone with no formal authority, and the moment the group becomes a functioning unit again.` },
      { id: 'sov-x-call', label: 'Make the Call', emoji: '⚡', prompt: `${char} makes the decision everyone else is afraid to make. Not the safe decision, not the popular one — the right one. ${char} issues the order with total clarity and total ownership: no hedging, no blame delegation. This is what we are doing. This is why. This is on me. Narrate the order, the reactions, and the release of tension when someone finally takes the weight.` },
      { id: 'sov-x-raise', label: 'Raise Fallen', emoji: '🔥', prompt: `${char} sits with someone in their lowest moment. No platitudes. ${char} acknowledges the pain as real, then names — specifically, with examples — the strength this person has demonstrated before that they have temporarily forgotten. Not "you will be fine" but "here is the evidence that you can survive this." Narrate the conversation and the moment something shifts behind their eyes.` },
      { id: 'sov-x-unite', label: 'Unite Them', emoji: '⚒️', prompt: `${char} does not waste time on reconciliation. The threat is the priority. ${char} lays out the danger in terms every faction understands, makes clear that division is the only way they lose, and assigns roles that force cooperation. Narrate the briefing, the reluctant alignment, and the moment rivalry becomes irrelevant because the alternative is annihilation.` },
      { id: 'sov-x-honor', label: 'Honor Dead', emoji: '🕯️', prompt: `${char} stops the momentum for a deliberate pause. Not a ceremony. ${char} names the fallen. Says one true thing about each. Then draws the line: they are gone, we carry them, and we move. Narrate the pause, the names, and the moment the group transitions from paralysis to purposeful motion.` },
      { id: 'sov-x-absorb', label: 'Absorb Blow', emoji: '🌊', prompt: `${char} lets the attack, the setback, the devastating news land — absorbs it without resistance. Then redirects the energy. Not by being clever, but by agreeing with just enough to make the aggressor overextend, then using their own momentum to expose the weakness in their position. Narrate the aikido — taking the hit and converting it into advantage.` },
      { id: 'sov-x-fear', label: 'Name Fear', emoji: '🎭', prompt: `Before a mission where people may die — everyone knows it, nobody will say it — ${char} addresses the fear directly. Not dismissing it. Saying it plainly: some of us may not come back. That is real. Here is what we do with that. Narrate the relief that floods the room when someone finally speaks the unspoken, and how ${char} converts acknowledged fear into actionable preparation.` },
    ],
    flight: [
      { id: 'sov-f-read', label: 'Read Sky', emoji: '🧠', prompt: `${char} reads the aerial battlefield the way a grandmaster reads a chess endgame — dragon positions, wind currents, altitude advantages, the enemy formation's hidden vulnerability. Narrate ${char}'s analysis from dragonback: what others see as chaos, they see as a system with exploitable patterns. Describe the tactical insight that changes everything.` },
      { id: 'sov-f-trap', label: 'Aerial Trap', emoji: '🪤', prompt: `${char} positions ${d} to look vulnerable — altitude too low, angle too steep, an apparent mistake. The enemy takes the bait. Narrate the setup: what makes the trap convincing, the moment the enemy commits, and the reversal when ${char} and ${d} spring the counter from a position the enemy thought was weakness.` },
      { id: 'sov-f-break', label: 'Break Formation', emoji: '💥', prompt: `${char} identifies the keystone rider in the enemy formation — the one whose position holds the whole structure together. Narrate the targeted strike: the approach vector, the communication through the bond, and the moment the formation collapses when that single rider is forced to break. Show how ${char}'s squad exploits the chaos.` },
      { id: 'sov-f-bond', label: 'Bond Precision', emoji: '🐉', prompt: `${char} and ${d} execute a maneuver that requires perfect synchronization — rider and dragon moving as one mind. Narrate the bond in motion: the wordless communication, the shared awareness of wind and gravity, the maneuver executed with a precision that makes other riders stop and watch. This is what a deep bond looks like at full expression.` },
      { id: 'sov-f-bait', label: 'Bait Chase', emoji: '🏃', prompt: `${char} breaks off and retreats — but the retreat is designed to draw pursuit into a trap. Narrate the performance: making the withdrawal look just desperate enough, the enemy's growing confidence as they chase, and the moment ${char} stops running and the pursuers realize they have been lured into a kill zone of ${char}'s choosing.` },
      { id: 'sov-f-alt', label: 'Own Altitude', emoji: '⬆️', prompt: `${char} refuses to engage at the enemy's altitude. Narrate the climb — burning energy, thinning air, cold biting through flight leathers — until ${char} holds the dominant position. The enemy must look up into the sun. Gravity becomes ${char}'s weapon. Describe the devastating diving attack from absolute altitude advantage.` },
    ],
    stealth: [
      { id: 'sov-st-blank', label: 'Stay Blank', emoji: '😶', prompt: `${char} controls every signal — facial expression, posture, breathing, word choice, reaction timing. Not a mask of blankness but a curated display that appears natural while revealing nothing. Narrate the internal discipline: what ${char} actually feels versus what they project, and the frustration of the person trying to read them as they realize they are getting nothing useful.` },
      { id: 'sov-st-reverse', label: 'Reverse It', emoji: '🔄', prompt: `${char} is being questioned and answers in ways that are technically responsive but strategically designed to provoke follow-up questions that reveal the interrogator's own knowledge and objectives. Every answer is bait. Narrate the exchange: the interrogator believing they are in control, the specific answers ${char} crafts, and the intelligence ${char} extracts from the questions themselves.` },
      { id: 'sov-st-plant', label: 'Plant Evidence', emoji: '📝', prompt: `${char} leaves something where exactly the right person will find it — a document, a clue, an object that will lead them to a specific conclusion ${char} needs them to reach. Narrate the placement: what is left, where, why this person will find it, and what chain of actions it is designed to trigger. ${char}'s fingerprints are nowhere near it.` },
      { id: 'sov-st-listen', label: 'Listen and Log', emoji: '👂', prompt: `${char} positions themselves where they can overhear a conversation they need intelligence from — around a corner, in an adjacent room, in a crowd where they are unremarkable. Narrate the position, the risk of discovery, and what they overhear. ${char} memorizes every word. The information will be used later, precisely when it will do the most damage or the most good.` },
      { id: 'sov-st-immune', label: 'Immunize Ally', emoji: '💉', prompt: `${char} does not tell this person they are being manipulated — that would trigger defensiveness. Instead, ${char} casually describes the manipulation technique in another context: a historical example, a hypothetical. The person connects the dots themselves. Narrate the indirect approach and the moment recognition dawns in the other person's eyes.` },
      { id: 'sov-st-expose', label: 'Expose Pattern', emoji: '🔦', prompt: `${char} does not make accusations — accusations can be denied. Instead, they lay out the pattern: a timeline of incidents, a series of coincidences that form a clear shape when arranged sequentially. Narrate the presentation — calm, factual, devastating — and the moment the room sees what was always there but hidden in plain sight.` },
    ],
    political: [
      { id: 'sov-po-negotiate', label: 'Negotiate', emoji: '⚖️', prompt: `${char} enters this negotiation holding no cards — and proceeds to play the other side's cards better than they can. ${char} identifies what the other party actually needs, demonstrates understanding of their hidden constraints, and reframes the deal so giving ${char} what they want appears to be the other party's best option. Narrate the negotiation and the moment leverage invisibly shifts.` },
      { id: 'sov-po-king', label: 'Kingmake', emoji: '♔', prompt: `${char} does not pursue the position. They pick who should hold it and quietly ensure the outcome. Narrate how ${char} elevates their chosen candidate without appearing partisan, neutralizes dangerous alternatives without appearing hostile, and shapes consensus that feels organic. The winner takes the title. ${char} takes something more valuable: permanent gratitude from someone in power.` },
      { id: 'sov-po-overton', label: 'Overton Shift', emoji: '📐', prompt: `${char} does not propose what they actually want. They propose something more extreme — something that will be rejected but will make the real proposal seem reasonable by comparison. Narrate the anchoring: the outrageous suggestion, the predictable pushback, and then the compromise that was ${char}'s actual goal all along. The room thinks they negotiated ${char} down. ${char} got exactly what they wanted.` },
      { id: 'sov-po-coalition', label: 'Coalition', emoji: '🤝', prompt: `${char} identifies the shared threat or shared opportunity that makes cooperation the only rational choice for parties that currently oppose each other. Narrate how ${char} approaches each party separately, what they say to each one, and the moment self-interest aligns everyone in the same direction despite their differences.` },
      { id: 'sov-po-flow', label: 'Control Flow', emoji: '🌊', prompt: `${char} holds information that multiple parties want. Instead of sharing or hoarding it all, ${char} distributes pieces strategically — each party gets the slice that makes them act in ways serving ${char}'s larger goal. Narrate the calculation: who gets what, in what order, and how the combined reactions create the outcome ${char} needs.` },
      { id: 'sov-po-precedent', label: 'Set Precedent', emoji: '📜', prompt: `${char} does not propose a policy change — they create conditions where the change proposes itself. Narrate how ${char} engineers or highlights a situation that makes the current approach visibly inadequate, positioning the desired change as the natural, obvious response. The decision-makers believe they are reacting to circumstances. ${char} built the circumstances.` },
      { id: 'sov-po-venom', label: 'Return Venom', emoji: '🐍', prompt: `A powerful rival attacks ${char} in front of an audience. ${char} does not counter-attack. They ask one precisely targeted question that exposes the real motivation — insecurity, jealousy, deflection. Delivered calmly, almost gently, which makes it devastating. Narrate the question, the silence that follows, and ${char} moving the conversation forward as if nothing happened — the ultimate dismissal.` },
      { id: 'sov-po-mercy', label: 'Strategic Mercy', emoji: '🕊️', prompt: `${char} has outmaneuvered an adversary completely. Everyone expects ${char} to press the advantage. Instead, ${char} offers a path forward that preserves the adversary's dignity while redirecting their energy from enemy to asset. Narrate the offer and why mercy from a position of strength creates deeper loyalty than destruction: a person you crush becomes an enemy for life, a person you lift up becomes an unshakeable ally.` },
    ],
    wardline: [
      { id: 'sov-w-sense', label: 'Sense Weakness', emoji: '📡', prompt: `${char} reaches out with every sense — natural and signet-enhanced — to read the ward line's health in this section. Narrate the sensory experience: the hum, the color, the vibration in the chest. What does ${char} detect that others miss? A flicker, a dead spot, a section patched too many times. Name the specific vulnerability and what it means for what is coming.` },
      { id: 'sov-w-channel', label: 'Channel Pain', emoji: '⚡', prompt: `${char} feeds power into the ward — and it costs. The ward pulls more than ${char} intended to give. Narrate the physical experience of channeling ${s} into ancient stone: the drain, the way vision narrows, the heat in the relic, the burnout creeping in. ${char} holds the channel because if they do not, the ward fails. Show the cost and whether it holds.` },
      { id: 'sov-w-hold', label: 'Hold Alone', emoji: '🛡️', prompt: `The ward has been breached and ${char} is the only rider at this section. Reinforcements are minutes away — minutes that might as well be hours. Narrate ${char} making a stand: using terrain, using ${d}, using ${s} at levels they cannot afford. This is not a battle — it is a delay action. Every second ${char} holds is a second bought for the people behind the line.` },
      { id: 'sov-w-read', label: 'Read Corruption', emoji: '☠️', prompt: `Something has crossed the ward — or something has changed on the other side. ${char} reads the corruption signatures: the discoloration of the earth, the way plants have died in a pattern, the wrongness in the air. Narrate ${char}'s analysis — what type of Venin, how many, how recently, what direction. Reading corruption is like reading a crime scene. The landscape tells the story.` },
      { id: 'sov-w-rally', label: 'Rally Defense', emoji: '📢', prompt: `The ward is failing and the defenders are scattered or demoralized. ${char} gathers them — not with a speech but with a presence that says I am not leaving this line. Narrate how ${char} organizes the defense: assigning sectors, positioning dragons, communicating a plan that transforms a panicking crowd into a fighting force. The ward may fall. But it will not fall without a fight.` },
      { id: 'sov-w-sacrifice', label: 'Sacrifice Play', emoji: '💀', prompt: `The ward can be saved — but the cost is personal. ${char} channels everything they have into the ward, knowing the burnout may be permanent, the injury may be lasting. Narrate the decision, the moment of commitment, the power flowing out of ${char} and into ancient stone. The ward holds. ${char} may not. Show the aftermath.` },
    ],
    investigation: [
      { id: 'sov-i-trap', label: 'Trap Liar', emoji: '🪤', prompt: `${char} already knows or suspects the truth. Instead of confronting, they ask questions designed to let the liar dig deeper — questions that seem innocent but create contradictions the liar will not notice until it is too late. Narrate the questioning, the liar's increasing confidence, and the moment ${char} closes the trap by revealing the contradiction they have been patiently constructing.` },
      { id: 'sov-i-connect', label: 'Connect Dots', emoji: '🧩', prompt: `${char} lays out everything they know — every fact, every rumor, every odd coincidence — and looks for the pattern that ties them together. Narrate the mental process: the moment when two unrelated facts suddenly are not unrelated, the thread that connects them, and the picture that emerges. What was invisible becomes obvious. Now ${char} knows what is really happening.` },
      { id: 'sov-i-gaslight', label: 'Counter Gaslight', emoji: '📋', prompt: `A person in authority is systematically distorting reality — denying things they said, rewriting agreements, shifting blame. ${char} recognized the pattern early and has been documenting: witnesses cultivated, exact quotes memorized with dates. Narrate the moment ${char} chooses to deploy the documentation, the setting that makes denial impossible, and the gaslighter's face when they meet someone who was three moves ahead the entire time.` },
      { id: 'sov-i-web', label: 'Expose Web', emoji: '🔦', prompt: `${char} does not make accusations — accusations can be denied. They lay out the pattern: a timeline of incidents, a series of coincidences that form a clear shape when arranged sequentially. Narrate the presentation — calm, factual, devastating — and the moment everyone else sees what was always there but hidden in plain sight.` },
      { id: 'sov-i-absence', label: 'Read Absence', emoji: '👻', prompt: `The most important clue is what is missing. ${char} notices what should be here and is not — the document that was removed, the person who should be present but is not, the gap in the timeline that nobody has explained. Narrate ${char} identifying the absence and deducing what was removed, who removed it, and why. Sometimes the hole in the picture is more revealing than the picture itself.` },
      { id: 'sov-i-power', label: 'Follow Power', emoji: '💰', prompt: `${char} stops investigating the crime and starts investigating the motive. Who benefits from this? Whose position improves? Who had access and opportunity? Narrate ${char} tracing the lines of benefit backward from the outcome to the architect — not through evidence but through the oldest investigative question: who profits?` },
    ],
    ritual: [
      { id: 'sov-r-honor', label: 'Honor Dead', emoji: '🕯️', prompt: `${char} stops the momentum for a deliberate pause. Not a ceremony. ${char} names the fallen. Says one true thing about each. Then draws the line: they are gone, we carry them, and we move. Narrate the pause, the names, and the moment the group transitions from paralysis to purposeful motion.` },
      { id: 'sov-r-legacy', label: 'Legacy Charge', emoji: '📜', prompt: `${char} speaks to each person — not sentimentally but tactically. For each one: the specific strength they do not yet see in themselves, the specific trap ${char} knows they will fall into, the specific decision point where they will need to choose between comfortable and correct. These are not goodbyes. They are weapons disguised as words. Narrate what ${char} tells each person and why each message is calibrated to that individual.` },
      { id: 'sov-r-line', label: 'Draw Line', emoji: '🚫', prompt: `${char} says no — once, clearly, without justification. A clear statement that this is where compliance ends. Delivered without anger and without apology. Narrate the refusal, the shock of someone encountering a wall where they expected a door, and the permanent change in the relationship that follows.` },
      { id: 'sov-r-oath', label: 'Swear Oath', emoji: '🔥', prompt: `${char} makes a vow — not lightly, not performatively. The kind of oath that costs something to keep. Narrate the words ${char} chooses, the weight of speaking them in front of witnesses, and the understanding that this commitment will be tested. ${char} swears knowing the price. They swear anyway. Describe the silence after the oath lands and the change in how people look at ${char}.` },
      { id: 'sov-r-break', label: 'Break Ritual', emoji: '⚡', prompt: `${char} disrupts the ceremony — not out of disrespect but because something about it is wrong, unjust, or dangerous. Narrate the moment ${char} steps forward, speaks, acts, or refuses when tradition demands silence and compliance. Describe the shock, the consequences, and whether ${char}'s disruption reveals something the ceremony was designed to hide.` },
      { id: 'sov-r-claim', label: 'Claim Moment', emoji: '👑', prompt: `This is ${char}'s moment — the ceremony, the occasion, the gathering exists because of what ${char} has done or must now become. Narrate ${char} stepping into it fully: not with arrogance but with the quiet authority of someone who has earned this. No title was given. No rank was conferred. But everyone present understands they are looking at someone who leads — not by appointment, but by nature. Describe the moment the room knows it.` },
    ],
  };
}

function buildUnbondedActions(char: string): Record<string, ActionItem[]> {
  return {
    combat: [
      { id: 'u-blade', label: 'Blade Attack', emoji: '⚔️', prompt: `${char} attacks with their weapon. Describe the strike — no dragon, no signet, just steel and skill.` },
      { id: 'u-tactical', label: 'Tactical Move', emoji: '🏃', prompt: `${char} repositions on the ground. Describe how they use terrain and timing to compensate for having no dragon.` },
      { id: 'u-defend', label: 'Hold Position', emoji: '🛡️', prompt: `${char} digs in and defends. They have no dragon to fall back on — describe the weight of that.` },
      { id: 'u-improvise', label: 'Improvise', emoji: '💡', prompt: `${char} improvises with whatever is available. No signet, no dragon fire — just desperation and cleverness.` },
    ],
    social: [
      { id: 'u-prove', label: 'Prove Yourself', emoji: '💪', prompt: `${char} tries to earn respect despite being unbonded. Describe the NPC reactions.` },
      { id: 'u-listen', label: 'Observe Quietly', emoji: '👂', prompt: `${char} stays quiet and observes. Without a dragon, people sometimes forget they're there. Use that.` },
      { id: 'u-ask', label: 'Ask About Threshing', emoji: '❓', prompt: `${char} asks about the Threshing — what it takes, what it feels like, whether they have a chance.` },
    ],
    training: [
      { id: 'u-spar', label: 'Ground Sparring', emoji: '🤺', prompt: `${char} trains in ground combat. Describe how the other cadets — who all have dragons — react to sparring with an unbonded rider.` },
      { id: 'u-study', label: 'Study the Dragons', emoji: '📖', prompt: `${char} watches the dragons during training. Describe what they notice — behaviors, patterns, how dragons evaluate humans.` },
      { id: 'u-endure', label: 'Endurance Trial', emoji: '🏔️', prompt: `${char} pushes through a physical trial meant for bonded riders. Without a dragon's bond sustaining them, everything is harder.` },
    ],
    exploration: [
      { id: 'u-scout', label: 'Scout on Foot', emoji: '🥾', prompt: `${char} scouts ahead on foot while the rest of the squad flies. Describe the isolation and the different perspective from the ground.` },
      { id: 'u-investigate', label: 'Investigate', emoji: '🔍', prompt: `${char} investigates the area. Without a dragon's senses to rely on, they have to use their own.` },
    ],
    downtime: [
      { id: 'u-silence', label: 'Sit With the Silence', emoji: '🌙', prompt: `${char} spends time alone. Describe the unbonded silence — the hollow space where a dragon's presence should be.` },
      { id: 'u-bond-watch', label: 'Watch the Bonded Pairs', emoji: '👀', prompt: `${char} watches other riders interact with their dragons. Describe what they see and what they feel.` },
    ],
    crisis: [
      { id: 'u-survive', label: 'Survive', emoji: '🔥', prompt: `${char} fights to survive the crisis with no dragon and no signet. Just human against whatever is coming. Make it desperate.` },
      { id: 'u-sacrifice', label: 'Put Yourself in Danger', emoji: '⚠️', prompt: `${char} steps into danger to protect someone else. Without a dragon bond as a safety net, this could be fatal. Narrate the stakes.` },
    ],
    flight: [
      { id: 'u-ground-watch', label: 'Watch From Ground', emoji: '👀', prompt: `${char} watches the riders fly overhead. Describe what it feels like to be earthbound while others soar.` },
    ],
    stealth: [
      { id: 'u-sneak', label: 'Move Unseen', emoji: '🌑', prompt: `${char} moves through Basgiath unseen. Without a dragon bond humming in their mind, the silence is absolute. Describe the stealth.` },
      { id: 'u-listen', label: 'Eavesdrop', emoji: '👂', prompt: `${char} listens in on a conversation. Unbonded riders are easy to overlook. Use that.` },
    ],
    political: [
      { id: 'u-stand', label: 'Stand Your Ground', emoji: '💪', prompt: `${char} makes a political argument despite having no dragon, no signet, no leverage — only conviction. Describe the audacity and the reaction.` },
    ],
    wardline: [
      { id: 'u-footpatrol', label: 'Ground Patrol', emoji: '🚶', prompt: `${char} patrols the ward line on foot. Without a dragon's senses, they rely on their own. Describe what they notice.` },
    ],
    investigation: [
      { id: 'u-dig', label: 'Dig Deeper', emoji: '🔍', prompt: `${char} investigates without signet abilities. Old-fashioned observation, logic, and persistence. Describe the detective work.` },
      { id: 'u-overlooked', label: 'The Overlooked', emoji: '👻', prompt: `${char} uses their invisibility as an unbonded rider to access places and conversations that bonded riders can't.` },
    ],
    ritual: [
      { id: 'u-witness-threshing', label: 'Watch the Threshing', emoji: '🐉', prompt: `${char} witnesses a Threshing ceremony. Describe the hunger to bond, the dragons evaluating candidates, the hope and dread.` },
      { id: 'u-prove-worthy', label: 'Prove Worthy', emoji: '🔥', prompt: `${char} performs an act during the ceremony that draws attention — from riders, from officers, or from a dragon.` },
    ],
  };
}

export default function EmpyreanContextualActions({
  situation,
  characterName,
  dragonName,
  signetType,
  onAction,
  disabled = false,
  isUnbonded = false,
  fetchMasterworkPills,
  currentBurnout = 0,
  maxBurnout = 0,
  onArmSignet,
}: EmpyreanContextualActionsProps) {
  const allActions = React.useMemo(
    () => isUnbonded ? buildUnbondedActions(characterName) : buildActions(characterName, dragonName, signetType),
    [characterName, dragonName, signetType, isUnbonded],
  );

  const dragonActions = React.useMemo(
    () => !isUnbonded ? buildDragonActions(characterName, dragonName) : [],
    [characterName, dragonName, isUnbonded],
  );

  const actions = allActions[situation] ?? allActions.exploration ?? [];
  const meta = SITUATION_META[situation] ?? SITUATION_META.exploration;

  const [dragonExpanded, setDragonExpanded] = useState(false);
  const [situationExpanded, setSituationExpanded] = useState(false);
  const [armingSignet, setArmingSignet] = useState(false);
  const signetMaxed = !isUnbonded && maxBurnout > 0 && currentBurnout >= maxBurnout;

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [masterworkDragon, setMasterworkDragon] = useState<MasterworkState>({ status: 'idle' });
  const [masterworkSituation, setMasterworkSituation] = useState<MasterworkState>({ status: 'idle' });

  const handleDragonAction = React.useCallback((action: ActionItem) => {
    if (action.id === 'da-execution-fire') {
      playExecutionFireAudio();
    } else if (action.id === 'da-roar') {
      playDragonRoarAudio();
    } else if (action.id === 'da-takeoff') {
      playDragonTakeoffAudio();
    } else if (action.id === 'da-land') {
      playDragonLandAudio();
    }
    onAction(action.prompt);
  }, [onAction]);

  const generateMasterwork = useCallback(async (category: 'dragon' | 'situation') => {
    if (!fetchMasterworkPills) return;
    const setter = category === 'dragon' ? setMasterworkDragon : setMasterworkSituation;
    setter({ status: 'loading' });
    try {
      const pills = await fetchMasterworkPills(category, meta.label);
      if (!Array.isArray(pills) || pills.length === 0) {
        setter({ status: 'error', error: 'No pills returned.' });
        return;
      }
      setter({ status: 'loaded', pills });
    } catch (e: any) {
      console.error('[masterwork] generation failed:', e);
      setter({ status: 'error', error: e?.message || 'Failed to generate pills.' });
    }
  }, [fetchMasterworkPills, meta.label]);

  const revertMasterwork = useCallback((category: 'dragon' | 'situation') => {
    if (category === 'dragon') setMasterworkDragon({ status: 'idle' });
    else setMasterworkSituation({ status: 'idle' });
  }, []);

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      {/* Signet arming row (only when bonded) */}
      {!isUnbonded && onArmSignet && (
        <>
          {!armingSignet && (
            <div className="flex">
              <button
                type="button"
                onClick={() => setArmingSignet(true)}
                disabled={disabled || signetMaxed}
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30 active:bg-amber-500/40 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                style={{ touchAction: 'manipulation' }}
              >
                🔥 Use My Signet {signetMaxed ? '(Burned Out)' : ''}
              </button>
            </div>
          )}
          {armingSignet && (
            <SignetIntensitySelector
              currentBurnout={currentBurnout}
              maxBurnout={maxBurnout}
              selected={null}
              onSelect={(n) => {
                setArmingSignet(false);
                onArmSignet(n);
              }}
              onCancel={() => setArmingSignet(false)}
            />
          )}
        </>
      )}

      {/* Row 1: Headers side-by-side */}
      {(dragonActions.length > 0 || actions.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {dragonActions.length > 0 && (
            <button
              type="button"
              onClick={() => setDragonExpanded(v => !v)}
              aria-expanded={dragonExpanded}
              aria-label={`${dragonExpanded ? 'Collapse' : 'Expand'} dragon actions`}
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 active:bg-amber-500/40 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <span>🐉 Dragon</span>
              <span className="text-amber-200/80">({dragonActions.length})</span>
              {dragonExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {actions.length > 0 && (
            <button
              type="button"
              onClick={() => setSituationExpanded(v => !v)}
              aria-expanded={situationExpanded}
              aria-label={`${situationExpanded ? 'Collapse' : 'Expand'} ${meta.label.toLowerCase()} actions`}
              className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors hover:brightness-125 active:brightness-150 ${meta.color}`}
              style={{ touchAction: 'manipulation' }}
            >
              <span>{meta.emoji} {meta.label}</span>
              <span className="opacity-80">({actions.length})</span>
              {situationExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      )}

      {/* Row 2: Expanded columns side-by-side when both open, full-width when one open */}
      {(dragonExpanded || situationExpanded) && (
        <div className={`grid gap-2 pb-1 ${
          (dragonExpanded && dragonActions.length > 0 && situationExpanded && actions.length > 0) ? 'grid-cols-2' : 'grid-cols-1'
        }`}>
          {dragonExpanded && dragonActions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <MasterworkColumnHeader
                category="dragon"
                state={masterworkDragon}
                disabled={disabled || !fetchMasterworkPills}
                onGenerate={() => generateMasterwork('dragon')}
                onRevert={() => revertMasterwork('dragon')}
              />
              {masterworkDragon.status === 'loaded' ? (
                masterworkDragon.pills.map((a) => (
                  <PreviewPill
                    key={a.id}
                    emoji={a.emoji}
                    label={a.label}
                    prompt={a.prompt}
                    disabled={disabled}
                    className="w-full inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25 active:bg-amber-500/35 transition-colors disabled:opacity-40 disabled:pointer-events-none text-left"
                    onSend={() => onAction(a.prompt)}
                    previewOpen={previewId === a.id}
                    onOpenPreview={() => setPreviewId(a.id)}
                    onClosePreview={() => setPreviewId(null)}
                  />
                ))
              ) : masterworkDragon.status === 'loading' ? (
                <MasterworkSkeleton count={4} accent="amber" />
              ) : (
                dragonActions.map((a) => (
                  <PreviewPill
                    key={a.id}
                    emoji={a.emoji}
                    label={a.label}
                    prompt={a.prompt}
                    disabled={disabled}
                    className="w-full inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 active:bg-amber-500/30 transition-colors disabled:opacity-40 disabled:pointer-events-none text-left"
                    onSend={() => handleDragonAction(a)}
                    previewOpen={previewId === a.id}
                    onOpenPreview={() => setPreviewId(a.id)}
                    onClosePreview={() => setPreviewId(null)}
                  />
                ))
              )}
            </div>
          )}
          {situationExpanded && actions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <MasterworkColumnHeader
                category="situation"
                state={masterworkSituation}
                disabled={disabled || !fetchMasterworkPills}
                onGenerate={() => generateMasterwork('situation')}
                onRevert={() => revertMasterwork('situation')}
              />
              {masterworkSituation.status === 'loaded' ? (
                masterworkSituation.pills.map((a) => (
                  <PreviewPill
                    key={a.id}
                    emoji={a.emoji}
                    label={a.label}
                    prompt={a.prompt}
                    disabled={disabled}
                    className="w-full inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium bg-purple-500/15 border border-purple-500/30 text-purple-200 hover:bg-purple-500/25 active:bg-purple-500/35 transition-colors disabled:opacity-40 disabled:pointer-events-none text-left"
                    onSend={() => onAction(a.prompt)}
                    previewOpen={previewId === a.id}
                    onOpenPreview={() => setPreviewId(a.id)}
                    onClosePreview={() => setPreviewId(null)}
                  />
                ))
              ) : masterworkSituation.status === 'loading' ? (
                <MasterworkSkeleton count={4} accent="purple" />
              ) : (
                actions.map((a) => (
                  <PreviewPill
                    key={a.id}
                    emoji={a.emoji}
                    label={a.label}
                    prompt={a.prompt}
                    disabled={disabled}
                    className="w-full inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 active:bg-purple-500/30 transition-colors disabled:opacity-40 disabled:pointer-events-none text-left"
                    onSend={() => onAction(a.prompt)}
                    previewOpen={previewId === a.id}
                    onOpenPreview={() => setPreviewId(a.id)}
                    onClosePreview={() => setPreviewId(null)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MasterworkColumnHeader({
  category,
  state,
  disabled,
  onGenerate,
  onRevert,
}: {
  category: 'dragon' | 'situation';
  state: MasterworkState;
  disabled: boolean;
  onGenerate: () => void;
  onRevert: () => void;
}) {
  const accent = category === 'dragon' ? 'amber' : 'purple';
  const accentClasses = accent === 'amber'
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 active:bg-amber-500/30'
    : 'border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 active:bg-purple-500/30';

  if (state.status === 'loaded') {
    return (
      <button
        type="button"
        onClick={onRevert}
        className={`self-start inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border transition-colors ${accentClasses}`}
        style={{ touchAction: 'manipulation' }}
      >
        <ArrowLeft className="w-3 h-3" />
        <span>Show defaults</span>
      </button>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className={`self-start inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${accentClasses} opacity-80`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Generating moves...</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled}
        className={`self-start inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border transition-colors disabled:opacity-40 disabled:pointer-events-none ${accentClasses}`}
        style={{ touchAction: 'manipulation' }}
      >
        <Sparkles className="w-3 h-3" />
        <span>Masterwork</span>
      </button>
      {state.status === 'error' && (
        <p className="text-[10px] text-red-300/90 leading-snug px-1">{state.error}</p>
      )}
    </>
  );
}

export function MasterworkSkeleton({ count, accent }: { count: number; accent: 'amber' | 'purple' }) {
  const tint = accent === 'amber'
    ? 'bg-amber-500/5 border-amber-500/15'
    : 'bg-purple-500/5 border-purple-500/15';
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`w-full h-9 rounded-lg border ${tint} animate-pulse`}
        />
      ))}
    </>
  );
}
