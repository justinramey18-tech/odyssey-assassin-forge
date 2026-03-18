import React from 'react';

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
}

const SITUATION_META: Record<string, { label: string; emoji: string; color: string }> = {
  combat:      { label: 'Combat',      emoji: '⚔️', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  social:      { label: 'Social',      emoji: '🗣️', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  exploration: { label: 'Exploration', emoji: '🔍', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  training:    { label: 'Training',    emoji: '📖', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  downtime:    { label: 'Downtime',    emoji: '🏕️', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  crisis:      { label: 'Crisis',      emoji: '🚨', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
};

function buildActions(char: string, dragon: string, signet: string): Record<string, ActionItem[]> {
  const d = dragon || 'my dragon';
  const s = signet || 'my signet';

  return {
    combat: [
      { id: 'c-fire', label: 'Dragon Fire Attack', emoji: '🐉', prompt: `${char} commands ${d} to unleash a fire attack on the nearest enemy. Describe the dragon's strike from the air.` },
      { id: 'c-signet', label: 'Signet Blast', emoji: '⚡', prompt: `${char} channels ${s} at maximum intensity against the enemy. Describe the signet manifestation and its effect. Track burnout.` },
      { id: 'c-aerial', label: 'Aerial Maneuver', emoji: '🌪️', prompt: `${char} and ${d} execute an evasive aerial maneuver. Describe the dive, roll, or climb and how it repositions them in the fight.` },
      { id: 'c-shield', label: 'Shield Formation', emoji: '🛡️', prompt: `${char} calls for a defensive formation, using ${d} as cover. Describe the tactical repositioning.` },
      { id: 'c-ground', label: 'Ground Combat', emoji: '⬇️', prompt: `${char} dismounts and fights on foot. Describe the transition from aerial to ground combat.` },
      { id: 'c-retreat', label: 'Tactical Retreat', emoji: '🏃', prompt: `${char} signals ${d} to pull back. Describe the retreat — what's covering them, what they're leaving behind.` },
    ],
    social: [
      { id: 's-rank', label: 'Pull Rank', emoji: '👑', prompt: `${char} invokes the chain of command to assert authority in this situation. Describe the reaction of those present.` },
      { id: 's-read', label: 'Read the Room', emoji: '🎭', prompt: `${char} uses bond bleed-through with ${d} to sense the emotional state of the people present. What does the dragon notice?` },
      { id: 's-intel', label: 'Gather Intel', emoji: '🤫', prompt: `${char} carefully steers the conversation to extract information without revealing their own knowledge. Describe the verbal chess match.` },
      { id: 's-dragon', label: "Dragon's Opinion", emoji: '🐉', prompt: `${char} reaches through the bond to ask ${d} for a read on this person or situation. What does the dragon think?` },
      { id: 's-report', label: 'Report to Command', emoji: '📋', prompt: `${char} considers reporting what they've learned to the chain of command. Describe the internal debate about loyalty vs. truth.` },
      { id: 's-share', label: 'Share Forbidden Knowledge', emoji: '🔥', prompt: `${char} decides to share dangerous information with someone present. Describe the risk, the delivery, and the reaction.` },
    ],
    exploration: [
      { id: 'e-scout', label: 'Aerial Scout', emoji: '🦅', prompt: `${char} takes ${d} airborne to scout the area from above. Describe what they see from dragonback.` },
      { id: 'e-signet', label: 'Signet Detection', emoji: '⚡', prompt: `${char} uses ${s} to sense the environment — magical signatures, hidden threats, ward line integrity. Describe what the signet reveals.` },
      { id: 'e-memory', label: 'Dragon Memory', emoji: '🐉', prompt: `${char} asks ${d} to search ancestral memories about this place. What does the dragon recall?` },
      { id: 'e-invest', label: 'Investigate', emoji: '🔍', prompt: `${char} dismounts and investigates on foot, looking for clues, tracks, or hidden passages. Describe what they find.` },
      { id: 'e-map', label: 'Map the Area', emoji: '🗺️', prompt: `${char} surveys and mentally maps the area, noting tactical advantages, escape routes, and points of interest.` },
      { id: 'e-ward', label: 'Ward Check', emoji: '⚠️', prompt: `${char} reaches out to sense the ward line's integrity in this area. Is it strong, flickering, or failed? Describe the sensory impression.` },
    ],
    training: [
      { id: 't-spar', label: 'Sparring Challenge', emoji: '⚔️', prompt: `${char} challenges a fellow cadet to a sparring match. Set the scene in the training grounds and describe the opponent.` },
      { id: 't-flight', label: 'Flight Drill', emoji: '🐉', prompt: `${char} and ${d} practice a complex aerial formation. Describe the drill, the instructor's commands, and how they perform.` },
      { id: 't-signet', label: 'Signet Practice', emoji: '⚡', prompt: `${char} pushes ${s} in a controlled training exercise. Describe the attempt, the control level, and the instructor's assessment.` },
      { id: 't-study', label: 'Study Session', emoji: '📚', prompt: `${char} studies in the archives — tactics, history, or forbidden texts. What do they find or learn?` },
      { id: 't-squad', label: 'Squad Bonding', emoji: '🤝', prompt: `${char} spends time with their squad — in the mess hall, the common room, or during downtime. Describe the social dynamics.` },
      { id: 't-bond', label: 'Bond Training', emoji: '🐉', prompt: `${char} works on deepening the telepathic bond with ${d} through focused meditation. Describe the shared mental space.` },
    ],
    downtime: [
      { id: 'd-reflect', label: 'Reflect', emoji: '💭', prompt: `${char} finds a quiet moment alone — on a parapet, in the dragon den, or by a window. Describe their thoughts and what weighs on them.` },
      { id: 'd-dragon', label: 'Dragon Time', emoji: '🐉', prompt: `${char} spends unhurried time with ${d} — grooming, feeding, or simply sitting together. Describe the quiet bond.` },
      { id: 'd-letter', label: 'Letter Home', emoji: '✉️', prompt: `${char} writes or receives a letter. Describe the contents and the emotions it stirs.` },
      { id: 'd-recover', label: 'Recovery', emoji: '🏥', prompt: `${char} rests and recovers from recent exertion. Describe the physical and mental healing process. Reduce burnout.` },
      { id: 'd-project', label: 'Personal Project', emoji: '🔮', prompt: `${char} works on something personal — a private investigation, a side project, or a secret practice. Describe what they're working on.` },
      { id: 'd-social', label: 'Social Evening', emoji: '🍺', prompt: `${char} joins other cadets for an evening off — tavern, card games, or conversation. Describe the atmosphere and who's there.` },
    ],
    crisis: [
      { id: 'x-respond', label: 'Emergency Response', emoji: '🚨', prompt: `${char} responds to the crisis immediately. Describe the scramble — alarms, running, mounting ${d}, and the scene of the emergency.` },
      { id: 'x-deploy', label: 'Dragon Deployment', emoji: '🐉', prompt: `${char} and ${d} launch into the air at full speed toward the crisis. Describe the urgent flight.` },
      { id: 'x-overdrive', label: 'Signet Overdrive', emoji: '⚡', prompt: `${char} pushes ${s} beyond safe limits to address the emergency. Describe the desperate use of power and the burnout cost.` },
      { id: 'x-rally', label: 'Rally Others', emoji: '📢', prompt: `${char} takes command and rallies nearby riders to respond. Describe the leadership moment.` },
      { id: 'x-protect', label: 'Protect Civilians', emoji: '🛡️', prompt: `${char} prioritizes protecting non-combatants in the crisis. Describe the protective action.` },
      { id: 'x-assess', label: 'Assess Threat', emoji: '🔍', prompt: `${char} holds position and assesses the threat before committing. Describe what they observe and the tactical calculation.` },
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
}: EmpyreanContextualActionsProps) {
  const allActions = React.useMemo(
    () => buildActions(characterName, dragonName, signetType),
    [characterName, dragonName, signetType],
  );

  const actions = allActions[situation] ?? allActions.exploration;
  const meta = SITUATION_META[situation] ?? SITUATION_META.exploration;

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      {/* Situation badge */}
      <span
        className={`self-start inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.color}`}
      >
        {meta.emoji} {meta.label}
      </span>

      {/* Scrollable action pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none flex-nowrap pb-1">
        {actions.map((a) => (
          <button
            key={a.id}
            disabled={disabled}
            onClick={() => onAction(a.prompt)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 active:bg-purple-500/30 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
          >
            <span>{a.emoji}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
