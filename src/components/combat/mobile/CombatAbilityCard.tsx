import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ability, AbilityTree } from '@/lib/types';
import { WeaponAttack } from '@/lib/combat/combatTypes';
import { ActiveConditionInfo, SetBonusInfo } from '@/lib/combat/promptContext';
import { getAbilityDice, rollDice, DiceRoll } from '@/lib/diceRoller';
import { CooldownProgress } from '@/components/cooldowns/CooldownProgress';
import { COOLDOWN_CONFIGS } from '@/lib/cooldowns/config';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import {
  Dices,
  ChevronDown,
  ChevronUp,
  Sword,
  Zap,
  Shield,
  Clock,
  Copy,
  Check,
  Timer,
  Crosshair,
  Target,
  Skull,
} from 'lucide-react';

// Tree to weapon slot mapping
const TREE_WEAPON_MAP: Record<AbilityTree, 'primary_weapon' | 'secondary_weapon' | 'ranged_weapon'> = {
  warrior: 'primary_weapon',
  assassin: 'secondary_weapon',
  hunter: 'ranged_weapon',
};

// Tree to weapon label
const TREE_WEAPON_LABEL: Record<AbilityTree, string> = {
  warrior: 'Primary Weapon',
  assassin: 'Secondary Weapon',
  hunter: 'Ranged Weapon',
};

interface CombatAbilityCardProps {
  ability: Ability & { tier: 1 | 2 | 3 };
  characterName: string;
  weapons: {
    primary?: WeaponAttack | null;
    secondary?: WeaponAttack | null;
    ranged?: WeaponAttack | null;
  };
  cooldownState?: {
    isOnCooldown: boolean;
    remaining: number; // seconds
    total: number; // seconds
  };
  customImage?: string | null;
  activeConditions?: ActiveConditionInfo[];
  activeSetBonuses?: SetBonusInfo[];
  concentrationSpell?: string | null;
  onUse: (ability: Ability & { tier: 1 | 2 | 3 }, roll: DiceRoll, prompt: string, combinedDamage: string) => void;
  onTriggerCooldown?: (abilityId: string) => void;
}

export function CombatAbilityCard({
  ability,
  characterName,
  weapons,
  cooldownState,
  customImage,
  activeConditions = [],
  activeSetBonuses = [],
  concentrationSpell,
  onUse,
  onTriggerCooldown,
}: CombatAbilityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { die, count } = getAbilityDice(ability.tier);
  const config = COOLDOWN_CONFIGS[ability.id];
  const isPassive = ability.type === 'passive';
  const isOnCooldown = cooldownState?.isOnCooldown ?? false;

  // Get synergized weapon based on ability tree
  const getSynergyWeapon = useCallback((): WeaponAttack | null => {
    switch (ability.tree) {
      case 'hunter':
        return weapons.ranged ?? null;
      case 'warrior':
        return weapons.primary ?? null;
      case 'assassin':
        return weapons.secondary ?? null;
      default:
        return null;
    }
  }, [ability.tree, weapons]);

  const synergyWeapon = getSynergyWeapon();

  // Calculate combined damage output
  const getCombinedDamage = useCallback((): string => {
    const abilityDamage = `${count}${die}`;
    if (!synergyWeapon) return abilityDamage;
    return `${synergyWeapon.damage} + ${abilityDamage}`;
  }, [count, die, synergyWeapon]);

  // Generate full AI DM prompt
  const generateAbilityPrompt = useCallback((roll: DiceRoll): string => {
    const isCrit = roll.rolls.includes(20);
    const isFumble = roll.rolls.includes(1);
    const tierEffect = ability.tierEffects.find(t => t.tier === ability.tier);
    const combinedDamage = getCombinedDamage();
    
    const actionTypeEmoji = {
      action: '⚔️',
      bonus_action: '⚡',
      reaction: '🛡️',
      passive: '✨',
    };

    const treeTheme = {
      hunter: { emoji: '🏹', title: 'RANGED PRECISION', verb: 'looses' },
      warrior: { emoji: '⚔️', title: 'MARTIAL FURY', verb: 'strikes with' },
      assassin: { emoji: '🗡️', title: 'SHADOW STRIKE', verb: 'strikes from the shadows with' },
    };

    const theme = treeTheme[ability.tree];
    const quip = getDeadpoolAbilityQuip(roll.total, isCrit, isFumble, ability.tree);

    let weaponSection = '';
    if (synergyWeapon) {
      weaponSection = `
### Weapon Synergy
**${TREE_WEAPON_LABEL[ability.tree]}:** ${synergyWeapon.name}
**Weapon Damage:** ${synergyWeapon.damage} ${synergyWeapon.damageType}
**Properties:** ${synergyWeapon.properties.join(', ') || 'Standard'}`;
    }

    // Build conditions section if any active
    let conditionsSection = '';
    if (activeConditions.length > 0) {
      const conditionNarratives: Record<string, string> = {
        'Poisoned': 'suffering from poison, movements sluggish',
        'Frightened': 'gripped by fear, fighting desperately',
        'Blinded': 'striking blind, relying on instinct',
        'Stunned': 'reeling, struggling to act',
        'Prone': 'fighting from the ground',
        'Invisible': 'unseen, a phantom in combat',
        'Haste': 'moving with supernatural speed',
        'Blessed': 'guided by divine favor',
      };
      
      const conditionLines = activeConditions.map(c => {
        const narrative = conditionNarratives[c.name] || `affected by ${c.name.toLowerCase()}`;
        return `- **${c.name}** (${c.duration}): ${narrative}`;
      }).join('\n');
      
      conditionsSection = `\n### Active Conditions\n${conditionLines}\n`;
    }

    // Build set bonuses section
    let setBonusSection = '';
    if (activeSetBonuses.length > 0) {
      const bonusLines = activeSetBonuses.map(s => 
        `- **${s.name}** (${s.count}/${s.maxPieces}): ${s.effect}`
      ).join('\n');
      setBonusSection = `\n### Active Set Bonuses\n${bonusLines}\n`;
    }

    // Build concentration warning
    let concentrationSection = '';
    if (concentrationSpell) {
      concentrationSection = `\n### ⚡ Concentration Active\n**Maintaining:** ${concentrationSpell}\n*Warning: Taking damage requires a Constitution save to maintain concentration.*\n`;
    }

    const rawPrompt = `## ${theme.emoji} ${theme.title}: ${ability.name.toUpperCase()}

**Character:** ${characterName || 'The Assassin'}
**Action Type:** ${actionTypeEmoji[ability.actionType]} ${ability.actionType.replace('_', ' ').toUpperCase()}
**Ability Tier:** ${ability.tier}/3
${weaponSection}
${conditionsSection}${setBonusSection}${concentrationSection}
---

### Roll Result
**Ability Dice:** ${count}${die}
**Roll:** [${roll.rolls.join(', ')}] = **${roll.total}**
${isCrit ? '\n🎯 **CRITICAL SUCCESS!** The ability triggers with devastating effect!' : ''}
${isFumble ? '\n💀 **CRITICAL FAILURE!** Something goes terribly wrong...' : ''}

### Combined Damage Output
**Total Damage:** ${combinedDamage}
${synergyWeapon ? `*(${synergyWeapon.damage} from ${synergyWeapon.name} + ${count}${die} from ${ability.name})*` : ''}

---

### Ability Effect (Tier ${ability.tier})
${tierEffect?.description || 'No effect description available.'}

### Narration Guide
${characterName || 'The assassin'} ${theme.verb} **${ability.name}**${synergyWeapon ? ` empowered by their ${synergyWeapon.name}` : ''}.

${isCrit 
  ? 'Describe an exceptionally powerful activation—the ability surges with maximum potency, the weapon strikes true, and the effect is magnified beyond normal limits.' 
  : isFumble 
    ? 'Describe a dramatic mishap—the ability misfires, the weapon slips, or an unintended consequence occurs.' 
    : roll.total >= 15 
      ? 'Describe a skilled execution—the ability activates smoothly and the effect manifests as intended.'
      : roll.total >= 8
        ? 'Describe a passable but unremarkable activation—it works, but without particular flair.'
        : 'Describe a rough or clumsy activation—the ability functions but with visible effort or strain.'}

${ability.synergies?.length 
  ? `\n### Synergy Potential\nThis ability synergizes with: ${ability.synergies.join(', ')}` 
  : ''}
${activeConditions.length > 0 
  ? `\n### Condition Effects\nConsider how ${activeConditions.map(c => c.name).join(', ')} affects this ability's execution.`
  : ''}
${activeSetBonuses.length > 0 
  ? `\n### Set Bonus Effects\nThe ${activeSetBonuses.map(s => s.name).join(', ')} set effects may enhance this ability.`
  : ''}

---

*"${quip}"*

---
*Roll: ${roll.total} | Ability: ${ability.name} (T${ability.tier}) | Damage: ${combinedDamage}*`;

    return applyTimePrefix(rawPrompt);
  }, [ability, characterName, count, die, synergyWeapon, getCombinedDamage, activeConditions, activeSetBonuses, concentrationSpell]);

  // Handle ability use
  const handleUse = useCallback(() => {
    if (isPassive || isOnCooldown) return;
    
    const roll = rollDice(die, count);
    const prompt = generateAbilityPrompt(roll);
    const combinedDamage = getCombinedDamage();
    
    onUse(ability, roll, prompt, combinedDamage);
    onTriggerCooldown?.(ability.id);
  }, [ability, isPassive, isOnCooldown, die, count, generateAbilityPrompt, getCombinedDamage, onUse, onTriggerCooldown]);

  // Copy prompt to clipboard
  const handleCopyPrompt = useCallback(async () => {
    const roll = rollDice(die, count);
    const prompt = generateAbilityPrompt(roll);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [die, count, generateAbilityPrompt]);

  const treeColors = {
    hunter: 'border-l-green-500',
    warrior: 'border-l-amber-500',
    assassin: 'border-l-purple-500',
  };

  const treeGradients = {
    hunter: 'from-green-500/20 to-transparent',
    warrior: 'from-amber-500/20 to-transparent',
    assassin: 'from-purple-500/20 to-transparent',
  };

  const actionBadgeColors = {
    action: 'bg-red-500/20 text-red-300',
    bonus_action: 'bg-amber-500/20 text-amber-300',
    reaction: 'bg-cyan-500/20 text-cyan-300',
    passive: 'bg-green-500/20 text-green-300',
  };

  const actionIcons = {
    action: <Sword className="w-3 h-3" />,
    bonus_action: <Zap className="w-3 h-3" />,
    reaction: <Shield className="w-3 h-3" />,
    passive: <Clock className="w-3 h-3" />,
  };

  // Collapsed card
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        disabled={isPassive}
        className={cn(
          "w-full flex items-center gap-3 p-4 bg-card border border-muted/30 rounded-xl",
          "active:scale-[0.99] transition-all",
          !customImage && `border-l-4 ${treeColors[ability.tree]}`,
          isPassive && "opacity-60",
          isOnCooldown && "opacity-50"
        )}
      >
        {/* Custom image indicator or tree color border */}
        {customImage && (
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
            <img src={customImage} alt={ability.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{ability.name}</span>
            <Badge variant="outline" className="text-[9px] capitalize h-5">
              {ability.tree}
            </Badge>
            {isOnCooldown && (
              <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/50 h-5">
                <Timer className="w-2.5 h-2.5 mr-1" />
                CD
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1",
              actionBadgeColors[ability.actionType]
            )}>
              {actionIcons[ability.actionType]}
              {ability.actionType.replace('_', ' ')}
            </span>
            {synergyWeapon && (
              <span className="text-[10px] text-muted-foreground">
                + {synergyWeapon.name}
              </span>
            )}
          </div>
          
          {/* Cooldown progress (if on cooldown) */}
          {isOnCooldown && cooldownState && (
            <div className="mt-2">
              <CooldownProgress
                remaining={cooldownState.remaining}
                total={cooldownState.total}
                tree={ability.tree}
              />
            </div>
          )}
        </div>
        
        {!isPassive && !isOnCooldown && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 rounded-lg text-sm text-red-300">
              <Dices className="w-4 h-4" />
              <span className="font-mono">{count}{die}</span>
            </div>
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        
        {isPassive && (
          <div className="w-3 h-3 rounded-full bg-green-500/50" />
        )}
      </button>
    );
  }

  // Expanded card
  return (
    <div className={cn(
      "bg-card border rounded-xl overflow-hidden",
      !customImage && `border-l-4 ${treeColors[ability.tree]}`,
      `bg-gradient-to-r ${treeGradients[ability.tree]}`
    )}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-muted/20">
        <div className="flex items-center gap-3 flex-1">
          {customImage && (
            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
              <img src={customImage} alt={ability.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg">{ability.name}</span>
            <Badge variant="outline" className="text-[9px] capitalize">
              T{ability.tier} {ability.tree}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {ability.tierEffects.find(t => t.tier === ability.tier)?.description || 'No description'}
          </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(false)}
          className="h-10 w-10"
        >
          <ChevronUp className="w-5 h-5" />
        </Button>
      </div>

      {/* Weapon Synergy Section */}
      {synergyWeapon && (
        <div className="p-3 mx-4 mt-3 bg-black/30 rounded-lg border border-muted/20">
          <div className="text-[10px] text-muted-foreground font-mono mb-2 flex items-center gap-2">
            <Target className="w-3 h-3" />
            WEAPON SYNERGY ({TREE_WEAPON_LABEL[ability.tree].toUpperCase()})
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">{synergyWeapon.name}</div>
              <div className="text-xs text-muted-foreground">
                {synergyWeapon.properties.join(', ')}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-amber-300">{synergyWeapon.damage}</div>
              <div className="text-[10px] text-muted-foreground">{synergyWeapon.damageType}</div>
            </div>
          </div>
        </div>
      )}

      {/* Combined Damage Output */}
      <div className="p-3 mx-4 mt-3 bg-red-500/10 rounded-lg border border-red-500/30">
        <div className="text-[10px] text-red-400 font-mono mb-2 flex items-center gap-2">
          <Skull className="w-3 h-3" />
          COMBINED DAMAGE OUTPUT
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {synergyWeapon && (
            <>
              <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-sm font-mono">
                {synergyWeapon.damage}
              </span>
              <span className="text-muted-foreground">+</span>
            </>
          )}
          <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded-lg text-sm font-mono">
            {count}{die}
          </span>
          <span className="text-muted-foreground">=</span>
          <span className="px-3 py-1 bg-red-500/30 text-red-200 rounded-lg text-sm font-bold font-mono">
            {getCombinedDamage()}
          </span>
        </div>
      </div>

      {/* Cooldown Status */}
      {config && !config.isPassive && (
        <div className="p-3 mx-4 mt-3 bg-black/30 rounded-lg border border-muted/20">
          <div className="text-[10px] text-muted-foreground font-mono mb-2 flex items-center gap-2">
            <Timer className="w-3 h-3" />
            COOLDOWN STATUS
          </div>
          {isOnCooldown && cooldownState ? (
            <CooldownProgress
              remaining={cooldownState.remaining}
              total={cooldownState.total}
              tree={ability.tree}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-green-400">READY</span>
              <span className="text-xs text-muted-foreground ml-auto">
                Base: {Math.floor(config.baseCooldown / 60)}m
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-4 space-y-3">
        {/* Use Ability Button */}
        <Button
          onClick={handleUse}
          disabled={isPassive || isOnCooldown}
          className={cn(
            "w-full h-14 flex items-center justify-between px-4",
            isOnCooldown 
              ? "bg-muted/30 text-muted-foreground" 
              : "bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700"
          )}
        >
          <div className="flex items-center gap-3">
            <Crosshair className="w-5 h-5" />
            <span className="font-semibold">
              {isOnCooldown ? 'On Cooldown' : 'Use Ability'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dices className="w-4 h-4" />
            <span className="font-mono">{count}{die}</span>
          </div>
        </Button>

        {/* Copy AI DM Prompt Button */}
        <Button
          onClick={handleCopyPrompt}
          variant="outline"
          className="w-full h-12 border-muted/40"
        >
          {copied ? (
            <Check className="w-4 h-4 mr-2 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 mr-2" />
          )}
          {copied ? 'Prompt Copied!' : 'Copy AI DM Prompt'}
        </Button>
      </div>
    </div>
  );
}

// Deadpool-style quips for ability rolls
function getDeadpoolAbilityQuip(
  total: number,
  isCrit: boolean,
  isFumble: boolean,
  tree: AbilityTree
): string {
  if (isCrit) {
    const critQuips = [
      "Maximum effort! Did the dice just... compliment me?",
      "Ooh, that's going in the highlight reel!",
      "I'd kiss these dice if they weren't so... dice-y.",
      "The RNG gods have blessed this mess!",
      "Somewhere, a DM just facepalmed.",
    ];
    return critQuips[Math.floor(Math.random() * critQuips.length)];
  }
  
  if (isFumble) {
    const fumbleQuips = [
      "Well... that's not ideal. Fourth wall, witness my shame.",
      "I blame the player. Yes, YOU reading this.",
      "Plot armor, don't fail me now!",
      "This is fine. Everything is fine. *narrator: it was not fine*",
      "Time for a reroll! Oh wait, we're not doing those? Cool cool cool.",
    ];
    return fumbleQuips[Math.floor(Math.random() * fumbleQuips.length)];
  }

  const treeQuips: Record<AbilityTree, string[]> = {
    hunter: [
      "Arrow flies, enemy dies. Poetry in motion.",
      "You can't hide from these eyes. Trust me, I've tried.",
      "Legolas who? Never heard of him.",
    ],
    warrior: [
      "Violence IS the answer. The question was wrong.",
      "Diplomacy failed. Plan B never fails.",
      "Hit first, ask questions never.",
    ],
    assassin: [
      "Now you see me, now you're dead.",
      "Stealth mode: activated. Murder mode: also activated.",
      "The shadows are my friend. My stabby, stabby friend.",
    ],
  };

  const quips = treeQuips[tree];
  return quips[Math.floor(Math.random() * quips.length)];
}
