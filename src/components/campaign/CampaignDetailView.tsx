// Campaign Detail View
// Shows sessions, stats, and import options for a single campaign

import { useState, useMemo } from 'react';
import { 
  ArrowLeft, Plus, FileText, Calendar, Trash2, 
  Upload, BarChart3, MoreVertical, ExternalLink, Book
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Campaign, CampaignSession, CumulativeStats } from '@/lib/chronicleSync/multiSession/types';
import { GMGuide } from '@/lib/gm-guides-storage';
import { GuidePreset } from '@/hooks/use-guide-presets';
import { CampaignStatsCard } from './CampaignStatsCard';
import { BatchImportPanel } from './BatchImportPanel';
import { CampaignGuidesTab } from './CampaignGuidesTab';
import { formatDistanceToNow, format } from 'date-fns';

interface CampaignDetailViewProps {
  campaign: Campaign;
  sessions: CampaignSession[];
  stats: CumulativeStats;
  guides: GMGuide[];
  guidePresets: GuidePreset[];
  onBack: () => void;
  onImportSessions: (sessions: Array<Omit<CampaignSession, 'id' | 'campaignId' | 'createdAt'>>) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSession?: (session: CampaignSession) => void;
  onUpdateGuideIds: (guideIds: string[]) => void;
  onCreatePreset: (name: string, guideIds: string[]) => void;
  onDeletePreset: (id: string) => void;
}

export function CampaignDetailView({
  campaign,
  sessions,
  stats,
  guides,
  guidePresets,
  onBack,
  onImportSessions,
  onDeleteSession,
  onOpenSession,
  onUpdateGuideIds,
  onCreatePreset,
  onDeletePreset,
}: CampaignDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'stats' | 'import' | 'guides'>('sessions');
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  const sortedSessions = useMemo(() => 
    [...sessions].sort((a, b) => b.sessionNumber - a.sessionNumber),
    [sessions]
  );

  const handleDeleteConfirm = () => {
    if (deleteSessionId) {
      onDeleteSession(deleteSessionId);
      setDeleteSessionId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-background/95 via-background/90 to-transparent backdrop-blur-md border-b border-primary/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 min-w-0">
            <h1 className="font-cinzel font-bold text-lg truncate">{campaign.name}</h1>
            <p className="text-xs text-muted-foreground">
              {campaign.sessionCount} {campaign.sessionCount === 1 ? 'session' : 'sessions'}
              {campaign.dmName && ` • DM: ${campaign.dmName}`}
            </p>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
        <div className="px-4 pt-3">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="sessions" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="guides" className="gap-1.5 text-xs">
              <Book className="w-3.5 h-3.5" />
              Guides
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5 text-xs">
              <Upload className="w-3.5 h-3.5" />
              Import
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="flex-1 px-4 py-4 m-0">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold mb-2">No Sessions Yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                Import your first session log to start tracking your campaign progress.
              </p>
              <Button onClick={() => setActiveTab('import')} className="gap-2">
                <Plus className="w-4 h-4" />
                Import Sessions
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-2 pb-4">
                {sortedSessions.map(session => (
                  <Card 
                    key={session.id} 
                    className="border-border/50 bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-all cursor-pointer"
                    onClick={() => onOpenSession?.(session)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                          <span className="font-bold text-sm">#{session.sessionNumber}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{session.sessionName}</h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {session.sessionDate 
                              ? format(new Date(session.sessionDate), 'MMM d, yyyy')
                              : formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })
                            }
                          </div>
                          
                          {/* Quick Stats */}
                          {session.summary && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {session.summary.totalXP > 0 && (
                                <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-400">
                                  +{session.summary.totalXP} XP
                                </Badge>
                              )}
                              {session.summary.goldGained > 0 && (
                                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-400">
                                  +{session.summary.goldGained} GP
                                </Badge>
                              )}
                              {session.summary.kills > 0 && (
                                <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-400">
                                  {session.summary.kills} kills
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onOpenSession?.(session);
                            }}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteSessionId(session.id);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Guides Tab */}
        <TabsContent value="guides" className="flex-1 px-4 py-4 m-0">
          <CampaignGuidesTab
            guides={guides}
            assignedGuideIds={campaign.gmGuideIds || []}
            presets={guidePresets}
            onUpdateGuideIds={onUpdateGuideIds}
            onCreatePreset={onCreatePreset}
            onDeletePreset={onDeletePreset}
          />
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="flex-1 px-4 py-4 m-0">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="pb-4">
              <CampaignStatsCard stats={stats} sessionCount={sessions.length} />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="flex-1 px-4 py-4 m-0">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="pb-4">
              <BatchImportPanel
                campaignId={campaign.id}
                onImport={(importedSessions) => {
                  onImportSessions(importedSessions);
                  setActiveTab('sessions');
                }}
                onCancel={() => setActiveTab('sessions')}
              />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this session from the campaign. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
