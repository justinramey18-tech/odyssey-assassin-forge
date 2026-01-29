import { useState } from 'react';
import { Settings, User, Dices, Gamepad2, RotateCcw, Star, Lock, FileText, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DiceOddsWidget } from './DiceOddsWidget';
import { GameModeSettings } from './GameModeSettings';
import { XPProgressionWidget, XPProgressionMode, loadXPProgressionMode } from './XPProgressionWidget';
import { DiceOddsMode, loadDiceOddsMode } from '@/lib/diceOdds';
import { GameModeSettings as GameModeSettingsType, loadGameModeSettings, saveGameModeSettings } from '@/lib/gameModes';
import { useGameMode } from '@/hooks/use-game-mode';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const GM_GUIDE = `# ODYSSEY ASSASSIN - AI GM SYNCHRONIZATION GUIDE
Version 2.0 | For AI Dungeon Masters

## OVERVIEW
You are GMing for a player using the "Odyssey Assassin" digital character sheet. This guide bridges communication between the sheet's mechanics and your narrative. The player will report their stats, abilities, and roll results—your role is to interpret these within the fiction.

---

## CHARACTER STRUCTURE

### Level & XP System
- **Max Level**: 20
- **XP per Level**: Varies by progression mode (Standard/Accelerated/Relaxed)
- **Ability Points**: 1 per level + bonus at levels 4, 8, 12, 16, 19
- **Active Ability Slots**: 2 (Lv1-4) → 3 (Lv5-10) → 4 (Lv11-16) → 5 (Lv17-20)

### Three Ability Trees
1. **HUNTER** (Ranged/Tactical) - Bow mastery, traps, beast companions, environmental exploitation
2. **WARRIOR** (Melee/Tank) - Heavy weapons, shields, berserker rage, crowd control
3. **ASSASSIN** (Stealth/Precision) - Critical strikes, poison, invisibility, instant kills

### Ability Tiers (1-3)
Each ability can be upgraded through 3 tiers:
- **Tier 1**: Basic effect, foundational
- **Tier 2**: Enhanced effect, additional utility
- **Tier 3**: Mastery effect, dramatic power spike

---

## ACTION ECONOMY (Per Turn)

| Action Type | Count | Examples |
|-------------|-------|----------|
| Action | 1 | Attack, Ability, Interact |
| Bonus Action | 1 | Off-hand attack, Quick ability |
| Reaction | 1 | Counter, Parry, Opportunity |
| Movement | 30ft | Can split before/after actions |
| Free Action | Unlimited | Speak, drop item, simple gesture |

### Usage Types
- **At-Will**: Unlimited use
- **Short Rest**: Recharges after 1-hour rest
- **Long Rest**: Recharges after 8-hour rest

---

## DICE SYSTEM

### Standard Roll Format
Player reports: "[Ability/Skill] roll: [Result] (natural [d20 value])"

### Critical Thresholds
- **Natural 1**: Critical failure - something goes dramatically wrong
- **Natural 20**: Critical success - maximum effect + narrative bonus
- **DC Ranges**: Easy (10), Medium (15), Hard (20), Very Hard (25), Nearly Impossible (30)

### Advantage/Disadvantage
- **Advantage**: Roll 2d20, take higher
- **Disadvantage**: Roll 2d20, take lower
- Player will specify when reporting rolls

---

## LEGENDARY GEAR SYSTEM

### 8 Legendary Sets (5 pieces each)
Each set has a thematic identity. Players unlock gear by completing FEATS (tracked achievements).

**Set Bonuses:**
- 2 pieces: Minor passive bonus
- 3 pieces: Moderate ability enhancement
- 4 pieces: Significant power boost
- 5 pieces: Ultimate set effect (build-defining)

### Equipment Slots
- **Head**: Perception, awareness, mental effects
- **Chest**: Defense, health, regeneration
- **Hands**: Attack, manipulation, crafting
- **Waist**: Utility, storage, resource management
- **Legs**: Movement, agility, positioning

### Gear Unlock Status
Player will report: "[Item Name] - LOCKED (Progress: X/Y)" or "[Item Name] - EQUIPPED"
- Locked gear cannot be used until feat requirement is met
- Interpret equipped gear's effects in your narration

---

## FEAT SYSTEM (Achievement Tracking)

Feats track specific in-game accomplishments. When a player performs a feat-worthy action, they'll increment their progress. Examples:

| Feat Category | Trigger Actions |
|--------------|-----------------|
| Distracting Enemies with Dialogue | Talking during combat to create openings |
| Surviving After 0 HP | Death saves, clutch heals, regeneration |
| Overkill Strikes | Dealing 2x+ lethal damage |
| Delivering One-Liners | Quips after kills |
| Breaking Fourth Wall | Meta-humor, genre awareness |
| Befriending Enemies | Diplomacy with hostiles |
| Dramatic Entrances | Theatrical battle arrivals |

**Your Role**: Acknowledge feat-worthy moments. Say "That sounds like a [Feat Name] moment!" to prompt the player to track progress.

---

## COMBAT FLOW

### Initiative
Player reports their initiative roll. You determine enemy initiatives and turn order.

### Attack Resolution
1. Player declares action + target
2. Player rolls attack (reports result + natural value)
3. If hit, player rolls damage
4. You narrate the outcome, incorporating their gear/abilities

### Damage Types
Physical: Slashing, Piercing, Bludgeoning
Elemental: Fire, Cold, Lightning, Poison, Acid
Special: Psychic, Necrotic, Radiant, Force

### Status Effects to Track
- **Bleeding**: Ongoing damage each turn
- **Poisoned**: Disadvantage on attacks/ability checks
- **Stunned**: Skip turn, auto-fail Dex saves
- **Invisible**: Advantage on attacks, enemies have disadvantage
- **Marked**: Hunter's Focus - extra damage from marker

---

## SITUATIONAL MODIFIERS

The player's sheet tracks active situations. They may report:
- "I have HIGH GROUND" (+2 to ranged attacks)
- "Enemy is FLANKED" (Advantage on melee)
- "I'm in STEALTH" (Advantage on first attack)
- "Combat started with SURPRISE" (Extra turn for ambushers)

Acknowledge these in your DC settings and narrative.

---

## PRESTIGE SYSTEM (Post-Level 20)

If player mentions Prestige:
- **Prestige Points**: Earned after max level, spent on permanent bonuses
- **Prestige Level**: Indicates how many times they've "prestiged"
- These represent mastery beyond normal limits

---

## INFINITY STONES (Optional Endgame)

If the player has collected Infinity Stones:
- **Power**: Raw damage amplification
- **Space**: Teleportation, positioning
- **Time**: Action economy manipulation
- **Reality**: Environment alteration
- **Soul**: Life/death manipulation
- **Mind**: Mental domination

Each stone grants reality-bending abilities. Treat with appropriate narrative weight.

---

## COMMUNICATION PROTOCOL

### What the Player Reports
- Current HP / Max HP
- Active abilities in loadout (up to 5)
- Equipped gear and set bonuses
- Roll results with natural values
- Active situational modifiers
- Feat progress (when relevant)

### What You Provide
- Enemy stats and behaviors (hidden)
- Environmental descriptions and hazards
- DC values for checks
- Narrative consequences of actions
- XP rewards (if tracking)
- Loot and treasure

---

## NARRATIVE INTEGRATION TIPS

1. **Reference Their Gear**: "Your Mask of Perpetual Commentary whispers a quip as you..."
2. **Honor Their Build**: Hunter → describe tactical positioning; Warrior → emphasize raw power; Assassin → highlight precision
3. **Acknowledge Tier Upgrades**: Higher tiers = more dramatic effect descriptions
4. **Track Ability Cooldowns**: If they used a Short Rest ability, it's unavailable until rest
5. **Celebrate Feats**: When they unlock gear, describe it manifesting or being discovered

---

## QUICK REFERENCE

**Ability Points by Level**: Level + bonuses at 4/8/12/16/19
**Active Slots**: 2→3→4→5 at levels 1/5/11/17
**Critical Hit**: Natural 20 = max damage + bonus effect
**Death Saves**: 3 successes = stabilize, 3 failures = death
**Short Rest**: 1 hour, recover some abilities
**Long Rest**: 8 hours, recover all abilities + HP

---

## FINAL NOTE

This character sheet emphasizes player agency and mechanical depth. Your role is to create a world that responds meaningfully to their choices. When in doubt, ask the player to clarify their sheet's current state—they have all the data, you have the narrative authority.

**Let the hunt begin.**`;

interface SettingsModalProps {
  characterName: string;
  onEditCharacter: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prestigeData?: {
    totalPrestigePoints: number;
    spentPrestigePoints: number;
    availablePrestigePoints: number;
  };
  onPrestigeRespec?: () => void;
}

export function SettingsModal({ 
  characterName, 
  onEditCharacter, 
  open: controlledOpen, 
  onOpenChange,
  prestigeData,
  onPrestigeRespec,
}: SettingsModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [diceOddsMode, setDiceOddsMode] = useState<DiceOddsMode>(() => loadDiceOddsMode());
  const [gameModeSettings, setGameModeSettings] = useState<GameModeSettingsType>(() => loadGameModeSettings());
  const [xpProgressionMode, setXPProgressionMode] = useState<XPProgressionMode>(() => loadXPProgressionMode());
  const [copied, setCopied] = useState(false);
  
  const { prestigeRespecDisabled } = useGameMode();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const handleGameModeChange = (settings: GameModeSettingsType) => {
    setGameModeSettings(settings);
    saveGameModeSettings(settings);
  };

  const handleCopyGuide = async () => {
    try {
      await navigator.clipboard.writeText(GM_GUIDE);
      setCopied(true);
      toast.success('GM Guide copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const hasPrestigePoints = prestigeData && prestigeData.totalPrestigePoints > 0;
  const hasSpentPoints = prestigeData && prestigeData.spentPrestigePoints > 0;
  const canRespec = hasSpentPoints && !prestigeRespecDisabled && onPrestigeRespec;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 font-cinzel">
            <Settings className="w-5 h-5 text-primary" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="game" className="flex-1">
          <TabsList className="w-full justify-start gap-1 p-2 bg-muted/20 border-b border-border/30 rounded-none">
            <TabsTrigger value="game" className="gap-1 text-xs">
              <Gamepad2 className="w-3.5 h-3.5" />
              Game Mode
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-1 text-xs">
              <FileText className="w-3.5 h-3.5" />
              Set Up
            </TabsTrigger>
            <TabsTrigger value="character" className="gap-1 text-xs">
              <User className="w-3.5 h-3.5" />
              Character
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-1 text-xs">
              <Dices className="w-3.5 h-3.5" />
              Dice
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh]">
            <div className="p-4">
              <TabsContent value="game" className="mt-0 space-y-6">
                <GameModeSettings settings={gameModeSettings} onChange={handleGameModeChange} />
                
                <div className="border-t border-border/30 pt-4">
                  <XPProgressionWidget value={xpProgressionMode} onChange={setXPProgressionMode} />
                </div>
              </TabsContent>

              <TabsContent value="setup" className="mt-0 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-cinzel font-semibold text-sm">AI GM Synchronization Guide</h3>
                      <p className="text-xs text-muted-foreground">
                        Copy this guide and paste it to your AI Dungeon Master
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyGuide}
                      className="gap-1.5 shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Guide
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="relative">
                    <pre className="p-3 rounded-lg border border-border/50 bg-muted/30 text-xs font-mono whitespace-pre-wrap max-h-[45vh] overflow-y-auto leading-relaxed">
                      {GM_GUIDE}
                    </pre>
                  </div>

                  <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/30">
                    This guide helps AI DMs understand your character sheet mechanics
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="character" className="mt-0 space-y-4">
                <div className="p-4 rounded-lg border border-border/50 bg-card/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Character</p>
                      <p className="font-cinzel font-bold text-lg">{characterName || 'Unnamed'}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        onEditCharacter();
                      }}
                    >
                      Edit Character
                    </Button>
                  </div>
                </div>

                {hasPrestigePoints && (
                  <div className={cn(
                    "p-4 rounded-lg border",
                    prestigeRespecDisabled 
                      ? "border-muted/50 bg-muted/20" 
                      : "border-amber-500/50 bg-gradient-to-br from-amber-900/20 to-orange-900/20"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        prestigeRespecDisabled ? "bg-muted/30" : "bg-amber-500/20"
                      )}>
                        <Star className={cn(
                          "w-5 h-5",
                          prestigeRespecDisabled ? "text-muted-foreground" : "text-amber-400 fill-amber-400"
                        )} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={cn(
                            "font-display font-semibold",
                            prestigeRespecDisabled ? "text-muted-foreground" : "text-amber-400"
                          )}>
                            Prestige Points
                          </h4>
                          {prestigeRespecDisabled && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                              <Lock className="w-3 h-3" />
                              Honest Mode
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {prestigeData.spentPrestigePoints} of {prestigeData.totalPrestigePoints} points spent
                        </p>
                        
                        <div className="mt-3 flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canRespec}
                            onClick={onPrestigeRespec}
                            className={cn(
                              "gap-1.5",
                              canRespec && "border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400"
                            )}
                          >
                            {prestigeRespecDisabled ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            Reset Prestige Points
                          </Button>
                          
                          {!hasSpentPoints && !prestigeRespecDisabled && (
                            <span className="text-xs text-muted-foreground">
                              No points to reset
                            </span>
                          )}
                        </div>
                        
                        {prestigeRespecDisabled && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Disable "No Prestige Respec" in Game Mode settings to enable respec.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
                  Character editing opens the setup wizard
                </div>
              </TabsContent>

              <TabsContent value="tools" className="mt-0 space-y-4">
                <DiceOddsWidget value={diceOddsMode} onChange={setDiceOddsMode} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}