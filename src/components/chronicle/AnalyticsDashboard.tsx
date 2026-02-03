// Chronicle Analytics Dashboard Component
// Visual display of campaign statistics and session history

import { useMemo } from 'react';
import { 
  Sword, Shield, Heart, Zap, Skull, Sparkles, 
  Coins, Package, Trophy, Moon, Sun, Flame, 
  Clock, Target, TrendingUp, History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CampaignAnalytics, ChronicleSession } from '@/lib/chronicleSync/enhancedTypes';
import { formatDistanceToNow } from 'date-fns';

interface AnalyticsDashboardProps {
  analytics: CampaignAnalytics;
  sessions: ChronicleSession[];
  onSessionClick?: (session: ChronicleSession) => void;
}

export function AnalyticsDashboard({ 
  analytics, 
  sessions,
  onSessionClick 
}: AnalyticsDashboardProps) {
  // Calculate derived stats
  const stats = useMemo(() => {
    const netGold = analytics.totalGoldEarned - analytics.totalGoldSpent;
    const avgDamagePerSession = analytics.totalSessionsImported > 0
      ? Math.round(analytics.totalDamageDealt / analytics.totalSessionsImported)
      : 0;
    const avgXpPerSession = analytics.totalSessionsImported > 0
      ? Math.round(analytics.totalXpEarned / analytics.totalSessionsImported)
      : 0;
    const deathSaveSuccessRate = (analytics.deathSaveSuccesses + analytics.deathSaveFailures) > 0
      ? Math.round((analytics.deathSaveSuccesses / (analytics.deathSaveSuccesses + analytics.deathSaveFailures)) * 100)
      : 0;
    
    return { netGold, avgDamagePerSession, avgXpPerSession, deathSaveSuccessRate };
  }, [analytics]);

  // Spell slots by level for visualization
  const spellSlotData = useMemo(() => {
    const levels = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const maxSlots = Math.max(1, ...Object.values(analytics.spellSlotsUsedByLevel || {}));
    
    return levels.map(level => ({
      level,
      used: analytics.spellSlotsUsedByLevel?.[level] || 0,
      percentage: ((analytics.spellSlotsUsedByLevel?.[level] || 0) / maxSlots) * 100,
    }));
  }, [analytics.spellSlotsUsedByLevel]);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-black/40 border border-blue-900/40">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600/30 gap-1.5">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="combat" className="data-[state=active]:bg-red-600/30 gap-1.5">
            <Sword className="w-4 h-4" />
            <span className="hidden sm:inline">Combat</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-purple-600/30 gap-1.5">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Trophy className="w-5 h-5 text-yellow-400" />}
              label="Sessions"
              value={analytics.totalSessionsImported}
              color="yellow"
            />
            <StatCard
              icon={<Sparkles className="w-5 h-5 text-purple-400" />}
              label="Total XP"
              value={analytics.totalXpEarned.toLocaleString()}
              subValue={`~${stats.avgXpPerSession}/session`}
              color="purple"
            />
            <StatCard
              icon={<Coins className="w-5 h-5 text-amber-400" />}
              label="Net Gold"
              value={`${stats.netGold >= 0 ? '+' : ''}${stats.netGold.toLocaleString()}`}
              subValue={`${analytics.totalGoldEarned.toLocaleString()} earned`}
              color="amber"
            />
            <StatCard
              icon={<Package className="w-5 h-5 text-blue-400" />}
              label="Items"
              value={analytics.totalItemsAcquired}
              subValue={`${analytics.totalItemsConsumed} used`}
              color="blue"
            />
          </div>

          {/* Rest Tracking */}
          <Card className="border-indigo-900/30 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-400" />
                Rest History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-400">{analytics.totalShortRests}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Sun className="w-3 h-3" /> Short Rests
                  </div>
                </div>
                <div className="text-center p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <div className="text-2xl font-bold text-indigo-400">{analytics.totalLongRests}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" /> Long Rests
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Spell Slot Usage */}
          {analytics.totalSpellsCast > 0 && (
            <Card className="border-purple-900/30 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Flame className="w-4 h-4 text-purple-400" />
                  Spell Slots Used ({analytics.totalSpellsCast} total)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {spellSlotData.filter(s => s.used > 0).map(slot => (
                    <div key={slot.level} className="flex items-center gap-3">
                      <div className="w-12 text-xs text-muted-foreground">Lvl {slot.level}</div>
                      <Progress value={slot.percentage} className="flex-1 h-2" />
                      <div className="w-8 text-xs text-right font-medium">{slot.used}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Combat Tab */}
        <TabsContent value="combat" className="space-y-4 mt-4">
          {/* Combat Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              icon={<Sword className="w-5 h-5 text-red-400" />}
              label="Damage Dealt"
              value={analytics.totalDamageDealt.toLocaleString()}
              subValue={`~${stats.avgDamagePerSession}/session`}
              color="red"
            />
            <StatCard
              icon={<Shield className="w-5 h-5 text-orange-400" />}
              label="Damage Taken"
              value={analytics.totalDamageTaken.toLocaleString()}
              color="orange"
            />
            <StatCard
              icon={<Heart className="w-5 h-5 text-emerald-400" />}
              label="Healing Received"
              value={analytics.totalHealingReceived.toLocaleString()}
              color="emerald"
            />
            <StatCard
              icon={<Zap className="w-5 h-5 text-yellow-400" />}
              label="Critical Hits"
              value={analytics.totalCriticalHits}
              color="yellow"
            />
            <StatCard
              icon={<Target className="w-5 h-5 text-rose-400" />}
              label="Kills"
              value={analytics.totalKills}
              color="rose"
            />
            <StatCard
              icon={<Skull className="w-5 h-5 text-gray-400" />}
              label="Deaths"
              value={analytics.totalDeaths}
              color="gray"
            />
          </div>

          {/* Death Saves */}
          {(analytics.deathSaveSuccesses > 0 || analytics.deathSaveFailures > 0) && (
            <Card className="border-rose-900/30 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Skull className="w-4 h-4 text-rose-400" />
                  Death Saving Throws
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-emerald-400">{analytics.deathSaveSuccesses} Successes</span>
                      <span className="text-rose-400">{analytics.deathSaveFailures} Failures</span>
                    </div>
                    <div className="h-3 bg-rose-500/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                        style={{ width: `${stats.deathSaveSuccessRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.deathSaveSuccessRate}%
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card className="border-purple-900/30 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                Recent Sessions ({sessions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                {sessions.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No sessions imported yet. Parse a session log to get started!
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {sessions.map(session => (
                      <SessionRow 
                        key={session.id} 
                        session={session} 
                        onClick={() => onSessionClick?.(session)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  icon, 
  label, 
  value, 
  subValue, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  subValue?: string;
  color: string;
}) {
  return (
    <div className={`p-3 rounded-lg border bg-${color}-500/10 border-${color}-500/20`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-lg font-bold text-${color}-400`}>{value}</div>
      {subValue && (
        <div className="text-xs text-muted-foreground mt-0.5">{subValue}</div>
      )}
    </div>
  );
}

// Session Row Component
function SessionRow({ 
  session, 
  onClick 
}: { 
  session: ChronicleSession; 
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 text-left hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{session.sessionName}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {session.parseMode === 'ai' ? 'AI' : 'Pattern'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {session.inputPreview.slice(0, 60)}...
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-medium text-yellow-400">+{session.xpTotal} XP</div>
          <div className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(session.parsedAt), { addSuffix: true })}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
        {session.damageDealt > 0 && (
          <span className="flex items-center gap-1">
            <Sword className="w-3 h-3 text-red-400" /> {session.damageDealt}
          </span>
        )}
        {session.kills > 0 && (
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3 text-rose-400" /> {session.kills}
          </span>
        )}
        {session.goldGained > 0 && (
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-amber-400" /> +{session.goldGained}
          </span>
        )}
        {session.criticalHits > 0 && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-400" /> {session.criticalHits}
          </span>
        )}
      </div>
    </button>
  );
}
