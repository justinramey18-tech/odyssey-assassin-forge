// Chronicle Sync - Enemies Detected Panel
// Displays detected enemies with approval UI and Target Tracker integration

import { useState, useCallback, useMemo } from 'react';
import { 
  Target, 
  Check, 
  X, 
  Plus, 
  Trash2, 
  RefreshCw,
  Skull,
  Heart,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ParsedEnemy, ConfidenceLevel } from '@/lib/chronicleSync/types';
import { ConfidenceBadge } from './ParseResultCard';
import { 
  Enemy, 
  NewEnemyInput, 
  CreatureType,
  CreatureSize,
} from '@/lib/combat/targetTypes';
import { CREATURE_TYPES, CREATURE_SIZES } from '@/lib/combat/creatureTypes';

interface EnemiesDetectedPanelProps {
  enemies: ParsedEnemy[];
  existingEnemies: Enemy[];
  onAddEnemies: (enemies: NewEnemyInput[]) => number;
  onUpdateEnemy: (id: string, updates: Partial<Enemy>) => void;
  onClearDefeated: () => void;
}

interface EnemyApprovalState {
  id: string;
  enemy: ParsedEnemy;
  approved: boolean;
  existingMatch: Enemy | null;
  action: 'add' | 'update' | 'skip';
}

export function EnemiesDetectedPanel({
  enemies,
  existingEnemies,
  onAddEnemies,
  onUpdateEnemy,
  onClearDefeated,
}: EnemiesDetectedPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [applied, setApplied] = useState(false);
  
  // Build approval states with existing enemy matching
  const [approvalStates, setApprovalStates] = useState<EnemyApprovalState[]>(() => 
    enemies.map((enemy, i) => {
      // Try to find existing enemy match by name (fuzzy)
      const existingMatch = findExistingMatch(enemy.name, existingEnemies);
      
      // Default action: add new if no match, update if match exists
      const action: 'add' | 'update' | 'skip' = existingMatch ? 'update' : 'add';
      
      // Auto-approve active enemies, skip already-defeated
      const approved = enemy.status !== 'fled' && 
        (action === 'add' || (existingMatch && existingMatch.currentHP > 0));
      
      return {
        id: `enemy-${i}`,
        enemy,
        approved,
        existingMatch,
        action,
      };
    })
  );

  // Stats
  const activeCount = enemies.filter(e => e.status === 'active').length;
  const defeatedCount = enemies.filter(e => e.status === 'defeated').length;
  const fledCount = enemies.filter(e => e.status === 'fled').length;
  const approvedCount = approvalStates.filter(s => s.approved).length;

  // Toggle approval
  const toggleApproval = useCallback((id: string) => {
    setApprovalStates(prev => prev.map(s => 
      s.id === id ? { ...s, approved: !s.approved } : s
    ));
  }, []);

  // Toggle action type
  const toggleAction = useCallback((id: string) => {
    setApprovalStates(prev => prev.map(s => {
      if (s.id !== id) return s;
      // Cycle: add -> update -> skip -> add
      const nextAction = s.action === 'add' ? 'update' : s.action === 'update' ? 'skip' : 'add';
      return { ...s, action: nextAction, approved: nextAction !== 'skip' };
    }));
  }, []);

  // Apply approved enemies to tracker
  const handleApply = useCallback(() => {
    const approved = approvalStates.filter(s => s.approved);
    let addedCount = 0;
    let updatedCount = 0;

    // Process each approved enemy
    approved.forEach(state => {
      const { enemy, action, existingMatch } = state;

      if (action === 'add') {
        // Add as new enemy
        const newEnemy: NewEnemyInput = {
          name: enemy.name,
          maxHP: enemy.estimatedHP ?? 30, // Default if not detected
          ac: enemy.ac ?? 13, // Default if not detected
          notes: enemy.notes,
          creatureType: parseCreatureType(enemy.creatureType),
          size: parseCreatureSize(enemy.size),
        };
        
        // Add multiple if quantity > 1
        for (let i = 0; i < enemy.quantity; i++) {
          const input: NewEnemyInput = enemy.quantity > 1 
            ? { ...newEnemy, name: `${enemy.name} ${i + 1}` }
            : newEnemy;
          const added = onAddEnemies([input]);
          addedCount += added;
        }
      } else if (action === 'update' && existingMatch) {
        // Update existing enemy
        if (enemy.status === 'defeated') {
          onUpdateEnemy(existingMatch.id, { currentHP: 0 });
          updatedCount++;
        } else if (enemy.estimatedHP !== undefined) {
          // Update HP if detected
          onUpdateEnemy(existingMatch.id, { 
            currentHP: Math.min(enemy.estimatedHP, existingMatch.maxHP) 
          });
          updatedCount++;
        }
      }
    });

    setApplied(true);
    return { addedCount, updatedCount };
  }, [approvalStates, onAddEnemies, onUpdateEnemy]);

  // Select all active
  const selectAllActive = useCallback(() => {
    setApprovalStates(prev => prev.map(s => ({
      ...s,
      approved: s.enemy.status === 'active',
    })));
  }, []);

  // Clear defeated enemies from tracker
  const handleClearDefeated = useCallback(() => {
    onClearDefeated();
  }, [onClearDefeated]);

  if (enemies.length === 0) return null;

  return (
    <Card className="border-red-500/30 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
          >
            <Target className="w-4 h-4" />
            <span>Enemies Detected</span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30">
              {activeCount} active
            </Badge>
            {defeatedCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-zinc-500/10 text-zinc-400 border-zinc-500/30">
                {defeatedCount} defeated
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-3">
          {applied ? (
            <div className="text-center py-4">
              <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-emerald-400">Enemies added to Combat Tracker!</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setApplied(false)}
                className="mt-2 text-muted-foreground"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Review Again
              </Button>
            </div>
          ) : (
            <>
              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllActive}
                  className="text-xs h-7"
                >
                  Select Active Only
                </Button>
                {defeatedCount > 0 && existingEnemies.some(e => e.currentHP <= 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearDefeated}
                    className="text-xs h-7 text-zinc-400 border-zinc-600"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear Defeated in Tracker
                  </Button>
                )}
              </div>

              {/* Enemy List */}
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-2">
                  {approvalStates.map(state => (
                    <EnemyApprovalCard
                      key={state.id}
                      state={state}
                      onToggleApproval={() => toggleApproval(state.id)}
                      onToggleAction={() => toggleAction(state.id)}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Apply Button */}
              <Button
                onClick={handleApply}
                disabled={approvedCount === 0}
                className="w-full gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white"
              >
                <Plus className="w-4 h-4" />
                Add {approvedCount} to Combat Tracker
              </Button>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Individual enemy approval card
interface EnemyApprovalCardProps {
  state: EnemyApprovalState;
  onToggleApproval: () => void;
  onToggleAction: () => void;
}

function EnemyApprovalCard({ state, onToggleApproval, onToggleAction }: EnemyApprovalCardProps) {
  const { enemy, approved, existingMatch, action } = state;
  
  const statusIcon = enemy.status === 'defeated' ? (
    <Skull className="w-4 h-4 text-zinc-500" />
  ) : enemy.status === 'fled' ? (
    <span className="text-sm">🏃</span>
  ) : (
    <Heart className="w-4 h-4 text-red-400" />
  );

  const actionBadge = action === 'add' ? (
    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
      + Add
    </Badge>
  ) : action === 'update' ? (
    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
      ↻ Update
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] bg-zinc-500/10 text-zinc-400 border-zinc-500/30">
      Skip
    </Badge>
  );

  return (
    <div className={cn(
      "border rounded-lg p-3 transition-all",
      approved
        ? "border-red-500/30 bg-red-500/5"
        : "border-zinc-700/50 bg-zinc-800/20 opacity-60"
    )}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <Checkbox
          checked={approved}
          onCheckedChange={onToggleApproval}
          className="mt-0.5 border-red-500/50 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
        />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {statusIcon}
            <span className="text-sm font-medium">
              {enemy.quantity > 1 ? `${enemy.name} ×${enemy.quantity}` : enemy.name}
            </span>
            <ConfidenceBadge confidence={enemy.confidence} />
          </div>
          
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {enemy.ac && (
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded">AC {enemy.ac}</span>
            )}
            {enemy.estimatedHP && (
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded">~{enemy.estimatedHP} HP</span>
            )}
            {enemy.creatureType && (
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded capitalize">
                {enemy.size && `${enemy.size} `}{enemy.creatureType}
              </span>
            )}
          </div>
          
          {enemy.notes && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              "{enemy.notes}"
            </p>
          )}
          
          {existingMatch && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>
                Matches "{existingMatch.name}" ({existingMatch.currentHP}/{existingMatch.maxHP} HP)
              </span>
            </div>
          )}
        </div>
        
        {/* Action Toggle */}
        <button onClick={onToggleAction} className="shrink-0">
          {actionBadge}
        </button>
      </div>
    </div>
  );
}

// Utility: Find existing enemy by name (fuzzy match)
function findExistingMatch(name: string, enemies: Enemy[]): Enemy | null {
  const normalizedName = name.toLowerCase().replace(/\s+\d+$/, '').trim();
  
  return enemies.find(e => {
    const existingName = e.name.toLowerCase().replace(/\s+\d+$/, '').trim();
    return existingName === normalizedName || 
           existingName.includes(normalizedName) ||
           normalizedName.includes(existingName);
  }) ?? null;
}

// Utility: Parse creature type string to enum
function parseCreatureType(type?: string): CreatureType | undefined {
  if (!type) return undefined;
  const normalized = type.toLowerCase().trim();
  return CREATURE_TYPES.find(t => t === normalized) as CreatureType | undefined;
}

// Utility: Parse size string to enum
function parseCreatureSize(size?: string): CreatureSize | undefined {
  if (!size) return undefined;
  const normalized = size.toLowerCase().trim();
  return CREATURE_SIZES.find(s => s === normalized) as CreatureSize | undefined;
}
