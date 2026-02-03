// Campaign Stats Card
// Displays cumulative statistics for a campaign

import { memo } from 'react';
import { 
  Swords, Heart, Skull, Coins, Package, Sparkles, 
  BedDouble, Moon, Zap, Dice6, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CumulativeStats } from '@/lib/chronicleSync/multiSession/types';

interface CampaignStatsCardProps {
  stats: CumulativeStats;
  sessionCount: number;
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
}

function StatItem({ icon, label, value, color = 'text-muted-foreground' }: StatItemProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
      <span className={color}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="font-semibold text-sm">{value}</p>
      </div>
    </div>
  );
}

export const CampaignStatsCard = memo(function CampaignStatsCard({ 
  stats, 
  sessionCount 
}: CampaignStatsCardProps) {
  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Cumulative Stats
          <span className="text-xs text-muted-foreground font-normal">
            ({sessionCount} {sessionCount === 1 ? 'session' : 'sessions'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Combat Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatItem
            icon={<Swords className="w-4 h-4" />}
            label="Damage Dealt"
            value={formatNumber(stats.totalDamageDealt)}
            color="text-red-400"
          />
          <StatItem
            icon={<Skull className="w-4 h-4" />}
            label="Kills"
            value={formatNumber(stats.totalKills)}
            color="text-orange-400"
          />
          <StatItem
            icon={<Heart className="w-4 h-4" />}
            label="Healing"
            value={formatNumber(stats.totalHealingReceived)}
            color="text-emerald-400"
          />
          <StatItem
            icon={<Zap className="w-4 h-4" />}
            label="Crits"
            value={formatNumber(stats.totalCriticalHits)}
            color="text-yellow-400"
          />
        </div>

        {/* Resources */}
        <div className="grid grid-cols-2 gap-2">
          <StatItem
            icon={<Coins className="w-4 h-4" />}
            label="Net Gold"
            value={`${stats.netGold >= 0 ? '+' : ''}${formatNumber(stats.netGold)}`}
            color={stats.netGold >= 0 ? 'text-amber-400' : 'text-red-400'}
          />
          <StatItem
            icon={<Package className="w-4 h-4" />}
            label="Items Acquired"
            value={formatNumber(stats.totalItemsAcquired)}
            color="text-blue-400"
          />
        </div>

        {/* XP and Spells */}
        <div className="grid grid-cols-2 gap-2">
          <StatItem
            icon={<Sparkles className="w-4 h-4" />}
            label="Total XP"
            value={formatNumber(stats.totalXP)}
            color="text-purple-400"
          />
          <StatItem
            icon={<Dice6 className="w-4 h-4" />}
            label="Spells Cast"
            value={formatNumber(stats.totalSpellsCast)}
            color="text-cyan-400"
          />
        </div>

        {/* Rests */}
        <div className="grid grid-cols-2 gap-2">
          <StatItem
            icon={<BedDouble className="w-4 h-4" />}
            label="Short Rests"
            value={formatNumber(stats.totalShortRests)}
            color="text-sky-400"
          />
          <StatItem
            icon={<Moon className="w-4 h-4" />}
            label="Long Rests"
            value={formatNumber(stats.totalLongRests)}
            color="text-indigo-400"
          />
        </div>

        {/* Death Saves */}
        {(stats.totalDeathSaveSuccesses > 0 || stats.totalDeathSaveFailures > 0) && (
          <div className="grid grid-cols-2 gap-2">
            <StatItem
              icon={<Heart className="w-4 h-4" />}
              label="Death Saves ✓"
              value={formatNumber(stats.totalDeathSaveSuccesses)}
              color="text-emerald-400"
            />
            <StatItem
              icon={<Skull className="w-4 h-4" />}
              label="Death Saves ✗"
              value={formatNumber(stats.totalDeathSaveFailures)}
              color="text-red-400"
            />
          </div>
        )}

        {/* Timeline */}
        {stats.firstSessionDate && stats.lastSessionDate && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
            <p>
              Campaign span: {new Date(stats.firstSessionDate).toLocaleDateString()} — {new Date(stats.lastSessionDate).toLocaleDateString()}
            </p>
            {stats.totalDowntimeDays > 0 && (
              <p className="mt-1">
                Downtime days: {stats.totalDowntimeDays}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
