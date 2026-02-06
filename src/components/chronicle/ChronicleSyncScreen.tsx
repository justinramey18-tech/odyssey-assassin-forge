// Chronicle Sync Main Screen
// Session log parsing and change application interface with analytics

import { useState, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, Search, Cpu, Cog, Loader2, AlertTriangle, 
  FileText, CheckCircle, Info, ListChecks, Undo2, BookOpen,
  BarChart3, Cloud, CloudOff, History, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useChronicleHistory } from '@/hooks/use-chronicle-history';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { supabase } from '@/integrations/supabase/client';
import { 
  ChronicleParseResult, 
  ReviewableChange, 
  ApprovedChanges,
  ProcessProgress,
  MAX_INPUT_CHARS,
  WARN_THRESHOLD_CHARS,
  UndoSnapshot,
  UNDO_EXPIRATION_MS,
} from '@/lib/chronicleSync/types';
import { ChronicleSession } from '@/lib/chronicleSync/enhancedTypes';
import { parseLogOffline, parseAIResponse, calculateChangeSummary } from '@/lib/chronicleSync/processor';
import { parseEnhancedPatterns, computeEnhancedAnalytics } from '@/lib/chronicleSync/enhancedPatterns';
import { SAMPLE_LOGS, SampleLogKey, getSampleLogKeys } from '@/lib/chronicleSync/sampleLogs';
import { hasActionableChanges, hasDisplayOnlyChanges } from '@/lib/chronicleSync/validation';
import { ParseResultCard } from './ParseResultCard';
import { ReviewModal } from './ReviewModal';
import { DisplayOnlyAlerts } from './DisplayOnlyAlerts';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { AutoApplyPanel } from './AutoApplyPanel';
import { EnemiesDetectedPanel } from './EnemiesDetectedPanel';
import { EnemyUpdatesPanel } from './EnemyUpdatesPanel';
import { CampaignManagerScreen } from '@/components/campaign';
import { Enemy, NewEnemyInput, DamageType, EnemyCondition } from '@/lib/combat/targetTypes';
import { parseAllEnemyUpdates, ParsedEnemyUpdate } from '@/lib/chronicleSync/patterns/enemyUpdates';
import combatBackground from '@/assets/combat-background.jpg';

interface SpellSlotState {
  [level: number]: { current: number; max: number };
}

interface ChronicleSyncScreenProps {
  characterName: string;
  characterLevel: number;
  currentGold: number;
  currentHP: number;
  maxHP: number;
  activeConditions: string[];
  // Death saves state
  deathSaves: { successes: number; failures: number };
  // Spell slots state
  spellSlots?: SpellSlotState;
  onApplyChanges: (changes: ApprovedChanges) => void;
  onApplyGold: (netChange: number) => void;
  onApplyHP: (change: number, type: 'damage' | 'healing') => void;
  onApplyConditions: (toAdd: string[], toRemove: string[]) => void;
  onApplyRest: (type: 'short' | 'long') => void;
  onApplyDeathSaves: (saves: { successes: number; failures: number }) => void;
  onRegainHP: (amount: number) => void;
  onApplySpellSlots?: (slotsToExpend: Record<number, number>) => void;
  // Target tracker integration
  existingEnemies: Enemy[];
  onAddEnemies: (enemies: NewEnemyInput[]) => number;
  onUpdateEnemy: (id: string, updates: Partial<Enemy>) => void;
  onClearDefeated: () => void;
  onRefreshEnemies?: () => void;
  // Enemy update handlers for real-time stat sync
  onApplyEnemyDamage: (enemyId: string, amount: number, damageType?: DamageType) => void;
  onApplyEnemyHealing: (enemyId: string, amount: number) => void;
  onToggleEnemyCondition: (enemyId: string, condition: EnemyCondition) => void;
  onDefeatEnemy: (enemyId: string) => void;
  onBack: () => void;
}

const UNDO_STORAGE_KEY = 'odyssey-chronicle-undo';

export function ChronicleSyncScreen({ 
  characterName, 
  characterLevel,
  currentGold,
  currentHP,
  maxHP,
  activeConditions,
  deathSaves,
  spellSlots,
  onApplyChanges,
  onApplyGold,
  onApplyHP,
  onApplyConditions,
  onApplyRest,
  onApplyDeathSaves,
  onRegainHP,
  onApplySpellSlots,
  existingEnemies,
  onAddEnemies,
  onUpdateEnemy,
  onClearDefeated,
  onRefreshEnemies,
  onApplyEnemyDamage,
  onApplyEnemyHealing,
  onToggleEnemyCondition,
  onDefeatEnemy,
  onBack 
}: ChronicleSyncScreenProps) {
  const [inputText, setInputText] = useState('');
  const [parseResult, setParseResult] = useState<ChronicleParseResult | null>(null);
  const [reviewableChanges, setReviewableChanges] = useState<ReviewableChange[]>([]);
  const [processingMode, setProcessingMode] = useState<'ai' | 'offline'>('offline');
  const [processProgress, setProcessProgress] = useState<ProcessProgress | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'parse' | 'analytics' | 'campaigns'>('parse');
  const { toast } = useToast();
  
  // Chronicle history hook for session persistence and analytics
  const { 
    sessions, 
    analytics, 
    loading: historyLoading, 
    syncing, 
    isCloudEnabled,
    addSession 
  } = useChronicleHistory();
  
  // Enhanced pattern results
  const [enhancedResults, setEnhancedResults] = useState<ReturnType<typeof parseEnhancedPatterns> | null>(null);
  
  // Enemy updates detected from session log
  const [enemyUpdates, setEnemyUpdates] = useState<ParsedEnemyUpdate[]>([]);

  // Check for undo availability
  const undoSnapshot = useMemo(() => {
    try {
      const stored = localStorage.getItem(UNDO_STORAGE_KEY);
      if (!stored) return null;
      const snapshot: UndoSnapshot = JSON.parse(stored);
      // Check expiration
      if (Date.now() - snapshot.timestamp > UNDO_EXPIRATION_MS) {
        localStorage.removeItem(UNDO_STORAGE_KEY);
        return null;
      }
      return snapshot;
    } catch {
      return null;
    }
  }, [parseResult]); // Re-check when parseResult changes

  // Convert parse result to reviewable changes
  const buildReviewableChanges = useCallback((result: ChronicleParseResult): ReviewableChange[] => {
    const changes: ReviewableChange[] = [];
    
    // XP changes
    result.xpChanges.forEach((xp, i) => {
      changes.push({
        id: `xp-${i}`,
        category: 'xp',
        description: `+${xp.amount} XP (${xp.context.slice(0, 40)})`,
        confidence: xp.confidence,
        sourceText: xp.sourceText,
        approved: xp.confidence !== 'low',
        data: xp,
      });
    });
    
    // Achievement triggers
    result.achievementTriggers.forEach((ach, i) => {
      changes.push({
        id: `ach-${i}`,
        category: 'achievement',
        description: `${ach.achievementName} +${ach.increment}`,
        confidence: ach.confidence,
        sourceText: ach.sourceText,
        approved: ach.confidence !== 'low',
        data: ach,
      });
    });
    
    // Item changes
    result.itemChanges.forEach((item, i) => {
      const action = item.action === 'acquired' ? '📥' : '📤';
      changes.push({
        id: `item-${i}`,
        category: 'item',
        description: `${action} ${item.quantity}x ${item.name}`,
        confidence: item.confidence,
        sourceText: item.sourceText,
        approved: item.confidence !== 'low' && !!item.consumableId,
        data: item,
      });
    });
    
    // Level up
    if (result.levelUp) {
      changes.push({
        id: 'levelup-0',
        category: 'levelUp',
        description: `Level up to ${result.levelUp.newLevel}`,
        confidence: 'high',
        sourceText: result.levelUp.sourceText,
        approved: result.levelUp.newLevel > characterLevel,
        data: result.levelUp,
      });
    }
    
    // Gold changes
    result.goldChanges.forEach((gold, i) => {
      const icon = gold.action === 'gained' ? '💰' : '💸';
      changes.push({
        id: `gold-${i}`,
        category: 'gold',
        description: `${icon} ${gold.action === 'gained' ? '+' : '-'}${gold.amount} GP`,
        confidence: 'high',
        sourceText: gold.sourceText,
        approved: true,
        data: gold,
      });
    });
    
    // Shop items
    result.shopItems.forEach((item, i) => {
      changes.push({
        id: `shop-${i}`,
        category: 'shop',
        description: `🏪 ${item.name} (${item.costGold} GP)`,
        confidence: item.confidence,
        sourceText: item.sourceText,
        approved: true,
        data: item,
      });
    });
    
    return changes;
  }, [characterLevel]);

  // Parse with selected mode
  const handleParse = useCallback(async () => {
    if (!inputText.trim()) {
      toast({
        title: "No input",
        description: "Please paste a session log to parse.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (processingMode === 'offline') {
        setProcessProgress({ stage: 'parsing', message: 'Parsing with patterns...', progress: 50 });
        
        const result = parseLogOffline(inputText);
        
        setProcessProgress({ stage: 'matching', message: 'Matching items...', progress: 80 });
        await new Promise(r => setTimeout(r, 300)); // Brief delay for UX
        
        setParseResult(result);
        setReviewableChanges(buildReviewableChanges(result));
        
        // Parse enemy updates (damage, healing, conditions)
        const detectedEnemyUpdates = parseAllEnemyUpdates(inputText);
        setEnemyUpdates(detectedEnemyUpdates);
        
        setProcessProgress({ stage: 'complete', message: 'Complete!', progress: 100 });
        
        const summary = calculateChangeSummary(result);
        const enemyCount = summary.totalEnemies.active + summary.totalEnemies.defeated;
        
        toast({
          title: "Parsing complete",
          description: `Found ${summary.totalXP} XP, ${result.itemChanges.length} items${enemyCount > 0 ? `, ${enemyCount} enemies` : ''}`,
        });
      } else {
        // AI parsing
        setProcessProgress({ stage: 'sending', message: 'Sending to AI...', progress: 30 });
        
        const { data, error } = await supabase.functions.invoke('chronicle-sync', {
          body: { sessionLog: inputText },
        });

        if (error) throw error;
        
        if (data.fallback) {
          // Fallback to offline mode
          toast({
            title: "AI unavailable",
            description: data.message || "Falling back to Pattern Match mode.",
            variant: "destructive",
          });
          setProcessingMode('offline');
          
          setProcessProgress({ stage: 'parsing', message: 'Falling back to patterns...', progress: 50 });
          const result = parseLogOffline(inputText);
          setParseResult(result);
          setReviewableChanges(buildReviewableChanges(result));
          // Also parse enemy updates in fallback mode
          setEnemyUpdates(parseAllEnemyUpdates(inputText));
        } else {
          setProcessProgress({ stage: 'parsing', message: 'Processing response...', progress: 70 });
          
          const result = parseAIResponse(data);
          if (!result) throw new Error('Failed to parse AI response');
          
          result.inputLength = inputText.length;
          setParseResult(result);
          setReviewableChanges(buildReviewableChanges(result));
          // Parse enemy updates for AI mode as well
          setEnemyUpdates(parseAllEnemyUpdates(inputText));
          
          toast({
            title: "AI parsing complete",
            description: `Found ${calculateChangeSummary(result).totalXP} XP, ${result.itemChanges.length} items, ${result.achievementTriggers.length} achievements`,
          });
        }
        
        setProcessProgress({ stage: 'complete', message: 'Complete!', progress: 100 });
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast({
        title: "Parsing failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setProcessProgress({ stage: 'error', message: 'Failed', progress: 0 });
    } finally {
      setTimeout(() => setProcessProgress(null), 1500);
    }
  }, [inputText, processingMode, buildReviewableChanges, toast]);

  // Apply approved changes
  const handleApplyApproved = useCallback(() => {
    const approved = reviewableChanges.filter(c => c.approved);
    if (approved.length === 0) {
      toast({
        title: "No changes approved",
        description: "Select at least one change to apply.",
        variant: "destructive",
      });
      return;
    }

    const result: ApprovedChanges = {
      xp: approved
        .filter(c => c.category === 'xp')
        .map(c => c.data as ApprovedChanges['xp'][0]),
      achievements: approved
        .filter(c => c.category === 'achievement')
        .map(c => c.data as ApprovedChanges['achievements'][0]),
      items: approved
        .filter(c => c.category === 'item')
        .map(c => c.data as ApprovedChanges['items'][0]),
      gold: approved
        .filter(c => c.category === 'gold')
        .map(c => c.data as ApprovedChanges['gold'][0]),
      shopItems: approved
        .filter(c => c.category === 'shop')
        .map(c => c.data as ApprovedChanges['shopItems'][0]),
      levelUp: approved.find(c => c.category === 'levelUp')?.data as ApprovedChanges['levelUp'] || null,
      totalApplied: approved.length,
    };

    onApplyChanges(result);
    setShowReviewModal(false);
    
    // Clear parse state
    setParseResult(null);
    setReviewableChanges([]);
    setEnemyUpdates([]);
    setInputText('');
  }, [reviewableChanges, onApplyChanges, toast]);

  // Load sample log
  const handleLoadSample = (key: SampleLogKey) => {
    setInputText(SAMPLE_LOGS[key]);
    setParseResult(null);
    setReviewableChanges([]);
    setEnemyUpdates([]);
  };

  const summary = parseResult ? calculateChangeSummary(parseResult) : null;
  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_INPUT_CHARS;
  const isNearLimit = charCount > WARN_THRESHOLD_CHARS;

  return (
    <BackgroundWrapper 
      imagePath={combatBackground} 
      overlayOpacity={80} 
      tintColor="cyan" 
      tintOpacity={20}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-background/90 via-background/80 to-transparent backdrop-blur-md border-b border-blue-900/30 px-4 py-3">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
        
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            <h1 className="font-cinzel font-bold text-lg uppercase tracking-wider text-blue-400">
              Chronicle Sync
            </h1>
            {isCloudEnabled && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <Cloud className="w-3 h-3" /> Synced
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('campaigns')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title="Campaigns"
            >
              <FolderOpen className={`w-5 h-5 ${activeTab === 'campaigns' ? 'text-cyan-400' : 'text-muted-foreground'}`} />
            </button>
            <button 
              onClick={() => setActiveTab(activeTab === 'parse' ? 'analytics' : 'parse')}
              className="p-2 -mr-2 rounded-lg hover:bg-muted transition-colors"
            >
              {activeTab === 'parse' ? (
                <BarChart3 className="w-5 h-5 text-purple-400" />
              ) : activeTab === 'analytics' ? (
                <FileText className="w-5 h-5 text-blue-400" />
              ) : (
                <FileText className="w-5 h-5 text-blue-400" />
              )}
            </button>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      </header>

      {/* Campaigns View */}
      {activeTab === 'campaigns' && (
        <CampaignManagerScreen onBack={() => setActiveTab('parse')} />
      )}

      {/* Analytics View */}
      {activeTab === 'analytics' && (
        <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
          <AnalyticsDashboard 
            analytics={analytics} 
            sessions={sessions}
          />
        </div>
      )}

      {/* Parse View */}
      {activeTab === 'parse' && (
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Mode Selection */}
        <Tabs value={processingMode} onValueChange={(v) => setProcessingMode(v as 'ai' | 'offline')}>
          <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-blue-900/40">
            <TabsTrigger 
              value="offline" 
              className="data-[state=active]:bg-gradient-to-b data-[state=active]:from-blue-600/30 data-[state=active]:to-blue-900/20 data-[state=active]:text-blue-400 gap-2"
            >
              <Cog className="w-4 h-4" />
              Pattern Match
            </TabsTrigger>
            <TabsTrigger 
              value="ai"
              className="data-[state=active]:bg-gradient-to-b data-[state=active]:from-purple-600/30 data-[state=active]:to-purple-900/20 data-[state=active]:text-purple-400 gap-2"
            >
              <Cpu className="w-4 h-4" />
              Smart Parse
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offline" className="mt-3">
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
                <span>
                  <strong className="text-blue-400">Pattern Match:</strong> Uses regex patterns to detect 
                  XP gains, items, achievements, and more. Fast and works offline. Best for structured logs.
                </span>
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="ai" className="mt-3">
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-purple-400" />
                <span>
                  <strong className="text-purple-400">Smart Parse:</strong> Uses AI to intelligently 
                  extract game data from natural narrative text. Better for prose-style session logs.
                </span>
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Sample Log Selector */}
        <div className="flex items-center gap-3">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <Select onValueChange={(v) => handleLoadSample(v as SampleLogKey)}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Load sample log..." />
            </SelectTrigger>
            <SelectContent>
              {getSampleLogKeys().map(key => (
                <SelectItem key={key} value={key} className="text-xs">
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Try a sample to test parsing
          </span>
        </div>

        {/* Input Section */}
        <Card className="border-blue-900/30 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Session Log</span>
              <span className={`text-xs font-normal ${isOverLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-muted-foreground'}`}>
                {charCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste your TTRPG session log here...

Example:
You strike the goblin with your sword. Natural 20! Critical hit!
You deal 24 slashing damage. The goblin falls.
You gain 150 XP for defeating the goblin patrol.
Searching the bodies, you find 2 health potions and 35 gold pieces."
              value={inputText}
              onChange={(e) => {
                if (e.target.value.length <= MAX_INPUT_CHARS) {
                  setInputText(e.target.value);
                }
              }}
              className="min-h-[200px] font-mono text-sm resize-none"
            />
            
            {isNearLimit && !isOverLimit && (
              <Alert className="mt-3 border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <AlertDescription className="text-sm text-amber-400">
                  Approaching character limit. Very long logs may take longer to process.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Progress Indicator */}
        {processProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {processProgress.message}
              </span>
              <span className="text-muted-foreground">{processProgress.progress}%</span>
            </div>
            <Progress value={processProgress.progress} className="h-1" />
          </div>
        )}

        {/* Parse Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleParse}
            disabled={!!processProgress || !inputText.trim() || isOverLimit}
            className="gap-2 px-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white border-0"
            size="lg"
          >
            {processProgress ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {processProgress.message}
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Parse Session Log
              </>
            )}
          </Button>
        </div>

        {/* Results Section */}
        {parseResult && summary && (
          <Card className="border-blue-500/30 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-400 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Parse Results
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {parseResult.parseMode === 'ai' ? 'AI' : 'Patterns'} • {parseResult.inputLength.toLocaleString()} chars
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-center">
                <div className="bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/20">
                  <div className="text-lg font-bold text-yellow-400">+{summary.totalXP}</div>
                  <div className="text-xs text-muted-foreground">XP</div>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-2 border border-purple-500/20">
                  <div className="text-lg font-bold text-purple-400">{summary.totalAchievements}</div>
                  <div className="text-xs text-muted-foreground">Feats</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
                  <div className="text-lg font-bold text-blue-400">{summary.totalItems}</div>
                  <div className="text-xs text-muted-foreground">Items</div>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-2 border border-amber-500/20">
                  <div className="text-lg font-bold text-amber-400">{summary.hasLevelUp ? '⬆️' : '-'}</div>
                  <div className="text-xs text-muted-foreground">Level</div>
                </div>
                <div className="bg-yellow-600/10 rounded-lg p-2 border border-yellow-600/20">
                  <div className="text-lg font-bold text-yellow-500">
                    {summary.totalGold.gained > 0 ? `+${summary.totalGold.gained}` : '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">Gold</div>
                </div>
                <div className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                  <div className="text-lg font-bold text-emerald-400">{summary.totalShopItems}</div>
                  <div className="text-xs text-muted-foreground">Shop</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                  <div className="text-lg font-bold text-red-400">
                    {summary.totalEnemies.active + summary.totalEnemies.defeated > 0 
                      ? summary.totalEnemies.active + summary.totalEnemies.defeated 
                      : '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">Enemies</div>
                </div>
              </div>

              {/* Actionable Changes Preview */}
              {hasActionableChanges(parseResult) && (
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-blue-400" />
                    Changes to Apply ({reviewableChanges.filter(c => c.approved).length}/{reviewableChanges.length})
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2">
                      {reviewableChanges.slice(0, 5).map(change => (
                        <ParseResultCard
                          key={change.id}
                          change={change}
                          onToggleApproval={(id) => {
                            setReviewableChanges(prev => 
                              prev.map(c => c.id === id ? { ...c, approved: !c.approved } : c)
                            );
                          }}
                        />
                      ))}
                      {reviewableChanges.length > 5 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowReviewModal(true)}
                          className="w-full text-blue-400"
                        >
                          View all {reviewableChanges.length} changes...
                        </Button>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Auto-Apply Panel - one-click application for HP, gold, conditions, rests, death saves */}
              {parseResult && (hasDisplayOnlyChanges(parseResult) || (enhancedResults && enhancedResults.deathSaves.length > 0)) && (
                <AutoApplyPanel
                  parseResult={parseResult}
                  enhancedResults={enhancedResults ? {
                    restEvents: enhancedResults.restEvents,
                    deathSaves: enhancedResults.deathSaves,
                    spellSlotUsage: enhancedResults.spellSlotUsage,
                  } : undefined}
                  currentGold={currentGold}
                  currentHP={currentHP}
                  maxHP={maxHP}
                  activeConditions={activeConditions}
                  deathSaves={deathSaves}
                  spellSlots={spellSlots}
                  onApplyGold={onApplyGold}
                  onApplyHP={onApplyHP}
                  onApplyConditions={onApplyConditions}
                  onApplyRest={onApplyRest}
                  onApplyDeathSaves={onApplyDeathSaves}
                  onRegainHP={onRegainHP}
                  onApplySpellSlots={onApplySpellSlots}
                />
              )}

              {/* Enemies Detected Section */}
              {parseResult.enemies && parseResult.enemies.length > 0 && (
                <EnemiesDetectedPanel
                  enemies={parseResult.enemies}
                  existingEnemies={existingEnemies}
                  onAddEnemies={onAddEnemies}
                  onUpdateEnemy={onUpdateEnemy}
                  onClearDefeated={onClearDefeated}
                  onRefreshEnemies={onRefreshEnemies}
                />
              )}

              {/* Enemy Updates Section (damage, healing, conditions) */}
              {enemyUpdates.length > 0 && (
                <EnemyUpdatesPanel
                  updates={enemyUpdates}
                  existingEnemies={existingEnemies}
                  onApplyDamage={onApplyEnemyDamage}
                  onApplyHealing={onApplyEnemyHealing}
                  onToggleCondition={onToggleEnemyCondition}
                  onDefeatEnemy={onDefeatEnemy}
                />
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowReviewModal(true)}
                  className="flex-1 gap-2"
                >
                  <ListChecks className="w-4 h-4" />
                  Review All
                </Button>
                <Button
                  onClick={handleApplyApproved}
                  disabled={reviewableChanges.filter(c => c.approved).length === 0}
                  className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white"
                >
                  <CheckCircle className="w-4 h-4" />
                  Apply {reviewableChanges.filter(c => c.approved).length} Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Undo Alert */}
        {undoSnapshot && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <Undo2 className="h-4 w-4 text-amber-400" />
            <AlertTitle className="text-amber-400">Undo Available</AlertTitle>
            <AlertDescription className="text-sm flex items-center justify-between">
              <span>
                Last sync applied {undoSnapshot.changesApplied} changes. 
                Expires in {Math.round((UNDO_EXPIRATION_MS - (Date.now() - undoSnapshot.timestamp)) / 60000)} min.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Help Section */}
        <div className="text-xs text-muted-foreground space-y-2 pt-4 border-t border-border/30">
          <p className="font-semibold text-foreground/70">Tips:</p>
          <ul className="list-disc list-inside space-y-1 opacity-70">
            <li>Paste session logs from Discord, Roll20, Foundry, or AI chat games</li>
            <li>Pattern Match is faster but Smart Parse handles narrative text better</li>
            <li>Review changes before applying — low confidence items are auto-rejected</li>
            <li>HP, gold, conditions, and rests are detected with auto-apply options</li>
          </ul>
          <p className="font-semibold text-foreground/70 mt-3">Detected Patterns:</p>
          <ul className="list-disc list-inside space-y-1 opacity-70">
            <li>XP gains, level ups, item acquisitions, achievement triggers</li>
            <li>Spell slot usage, death saving throws, short/long rests</li>
            <li>Skill checks, saving throws, initiative rolls, inspiration</li>
            <li>Gold transactions, damage/healing, condition changes</li>
            <li><strong>Enemies:</strong> Names, quantities, AC, HP, creature types, defeated status</li>
            <li><strong>Enemy Updates:</strong> Real-time damage, healing, and condition changes applied to tracked enemies</li>
          </ul>
        </div>
      </div>
      )}

      {/* Review Modal */}
      <ReviewModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        changes={reviewableChanges}
        onUpdateChanges={setReviewableChanges}
        onApplyApproved={handleApplyApproved}
      />
    </BackgroundWrapper>
  );
}
