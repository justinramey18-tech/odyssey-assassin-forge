// Batch Import Panel
// UI for importing multiple session logs at once

import { useState, useCallback } from 'react';
import { 
  Upload, FileText, Plus, Trash2, ChevronDown, ChevronUp, 
  Cog, Cpu, Play, Loader2, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { parseLogOffline, calculateChangeSummary } from '@/lib/chronicleSync/processor';
import { CampaignSession, SessionSummary, createEmptySessionSummary } from '@/lib/chronicleSync/multiSession/types';

interface SessionInput {
  id: string;
  name: string;
  content: string;
  date?: string;
  expanded: boolean;
  status: 'pending' | 'parsing' | 'success' | 'error';
  error?: string;
  summary?: SessionSummary;
}

interface BatchImportPanelProps {
  campaignId: string;
  onImport: (sessions: Array<Omit<CampaignSession, 'id' | 'campaignId' | 'createdAt'>>) => void;
  onCancel: () => void;
}

export function BatchImportPanel({ campaignId, onImport, onCancel }: BatchImportPanelProps) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionInput[]>([
    { id: crypto.randomUUID(), name: 'Session 1', content: '', expanded: true, status: 'pending' }
  ]);
  const [parseMode, setParseMode] = useState<'offline' | 'ai'>('offline');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);

  const addSession = () => {
    setSessions(prev => [
      ...prev,
      { 
        id: crypto.randomUUID(), 
        name: `Session ${prev.length + 1}`, 
        content: '', 
        expanded: true, 
        status: 'pending' 
      }
    ]);
  };

  const removeSession = (id: string) => {
    if (sessions.length <= 1) return;
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const updateSession = (id: string, updates: Partial<SessionInput>) => {
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  const toggleExpanded = (id: string) => {
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, expanded: !s.expanded } : s
    ));
  };

  const validSessions = sessions.filter(s => s.content.trim().length > 0);
  const canProcess = validSessions.length > 0 && !isProcessing;

  const processAllSessions = useCallback(async () => {
    if (!canProcess) return;
    
    setIsProcessing(true);
    setProcessProgress(0);

    const results: Array<Omit<CampaignSession, 'id' | 'campaignId' | 'createdAt'>> = [];
    const total = validSessions.length;

    for (let i = 0; i < validSessions.length; i++) {
      const session = validSessions[i];
      
      // Update status to parsing
      updateSession(session.id, { status: 'parsing' });
      setProcessProgress(((i + 0.5) / total) * 100);

      try {
        // Parse with offline mode (AI mode would require async calls)
        const parseResult = parseLogOffline(session.content);
        const changeSummary = calculateChangeSummary(parseResult);
        
        // Build session summary from parse result
        const summary: SessionSummary = {
          ...createEmptySessionSummary(),
          totalXP: changeSummary.totalXP,
          goldGained: changeSummary.totalGold.gained,
          goldSpent: changeSummary.totalGold.spent,
          itemsAcquired: parseResult.itemChanges.filter(i => i.action === 'acquired').length,
          itemsConsumed: parseResult.itemChanges.filter(i => i.action === 'consumed').length,
          totalDamageDealt: parseResult.hpChanges
            .filter(h => h.type === 'damage')
            .reduce((sum, h) => sum + h.amount, 0),
          totalHealingReceived: parseResult.hpChanges
            .filter(h => h.type === 'healing')
            .reduce((sum, h) => sum + h.amount, 0),
          levelUps: parseResult.levelUp ? 1 : 0,
        };

        // Add to results
        results.push({
          sessionNumber: i + 1,
          sessionName: session.name,
          sessionDate: session.date,
          inputPreview: session.content.slice(0, 200),
          inputHash: crypto.randomUUID().slice(0, 8),
          inputLength: session.content.length,
          parseMode,
          parsedAt: new Date().toISOString(),
          parseResult,
          summary,
          arcMarkers: [],
          notes: undefined,
        });

        updateSession(session.id, { status: 'success', summary });
      } catch (error) {
        updateSession(session.id, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Parse failed' 
        });
      }

      setProcessProgress(((i + 1) / total) * 100);
      
      // Small delay for UX
      await new Promise(r => setTimeout(r, 200));
    }

    setIsProcessing(false);
    
    if (results.length > 0) {
      toast({
        title: 'Batch Parse Complete',
        description: `Successfully parsed ${results.length} of ${total} sessions.`,
      });
      
      // Import the successful sessions
      onImport(results);
    } else {
      toast({
        title: 'Parse Failed',
        description: 'No sessions could be parsed successfully.',
        variant: 'destructive',
      });
    }
  }, [validSessions, canProcess, parseMode, onImport, toast, updateSession]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Batch Import
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add multiple session logs to parse at once
          </p>
        </div>
        
        {/* Parse Mode Toggle */}
        <div className="flex items-center gap-2 text-xs">
          <Cog className={`w-4 h-4 ${parseMode === 'offline' ? 'text-blue-400' : 'text-muted-foreground'}`} />
          <Switch
            checked={parseMode === 'ai'}
            onCheckedChange={(checked) => setParseMode(checked ? 'ai' : 'offline')}
            disabled={isProcessing}
          />
          <Cpu className={`w-4 h-4 ${parseMode === 'ai' ? 'text-purple-400' : 'text-muted-foreground'}`} />
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="max-h-[400px]">
        <div className="space-y-3 pr-2">
          {sessions.map((session, index) => (
            <Collapsible 
              key={session.id}
              open={session.expanded}
              onOpenChange={() => toggleExpanded(session.id)}
            >
              <Card className="border-border/50 bg-muted/20">
                <CollapsibleTrigger asChild>
                  <CardHeader className="p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2">
                      {/* Status Icon */}
                      {session.status === 'pending' && (
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      )}
                      {session.status === 'parsing' && (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      )}
                      {session.status === 'success' && (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      )}
                      {session.status === 'error' && (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      
                      <Input
                        value={session.name}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateSession(session.id, { name: e.target.value });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 text-sm font-medium bg-transparent border-none p-0 focus-visible:ring-0"
                        placeholder="Session name"
                      />
                      
                      <div className="flex items-center gap-1 ml-auto">
                        {session.content.trim() && (
                          <Badge variant="secondary" className="text-[10px]">
                            {session.content.length.toLocaleString()} chars
                          </Badge>
                        )}
                        {sessions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSession(session.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        {session.expanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="p-3 pt-0 space-y-3">
                    {/* Date Input */}
                    <div className="space-y-1">
                      <Label className="text-xs">Session Date (optional)</Label>
                      <Input
                        type="date"
                        value={session.date || ''}
                        onChange={(e) => updateSession(session.id, { date: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    
                    {/* Content Textarea */}
                    <div className="space-y-1">
                      <Label className="text-xs">Session Log</Label>
                      <Textarea
                        value={session.content}
                        onChange={(e) => updateSession(session.id, { content: e.target.value })}
                        placeholder="Paste your session log here..."
                        className="min-h-[120px] text-xs resize-none"
                      />
                    </div>

                    {/* Error Message */}
                    {session.status === 'error' && session.error && (
                      <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/30">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-400">{session.error}</p>
                      </div>
                    )}

                    {/* Success Summary */}
                    {session.status === 'success' && session.summary && (
                      <div className="flex flex-wrap gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                        <Badge variant="secondary" className="text-[10px]">
                          XP: {session.summary.totalXP}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Gold: +{session.summary.goldGained} / -{session.summary.goldSpent}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Items: {session.summary.itemsAcquired}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>

      {/* Add Session Button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={addSession}
        disabled={isProcessing}
      >
        <Plus className="w-4 h-4" />
        Add Another Session
      </Button>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <Progress value={processProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Processing {Math.round(processProgress)}%...
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-border/50">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 gap-2"
          onClick={processAllSessions}
          disabled={!canProcess}
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Process {validSessions.length} {validSessions.length === 1 ? 'Session' : 'Sessions'}
        </Button>
      </div>
    </div>
  );
}
