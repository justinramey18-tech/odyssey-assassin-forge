import { useState, useCallback } from 'react';
import { ArrowLeft, Wand2, Cog, Copy, Check, Loader2, BookOpen, Cpu, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { 
  processTextOffline, 
  getRemovalPreview,
  ProcessingOptions,
  defaultProcessingOptions,
} from '@/lib/narrativeProcessor';
import { supabase } from '@/integrations/supabase/client';
import scribeBackground from '@/assets/scribe-background.jpg';

interface NarrativeForgeScreenProps {
  characterName: string;
  onBack: () => void;
}

export function NarrativeForgeScreen({ characterName, onBack }: NarrativeForgeScreenProps) {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [processingMode, setProcessingMode] = useState<'ai' | 'offline'>('offline');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<ProcessingOptions>(defaultProcessingOptions);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const handleProcess = useCallback(async () => {
    if (!inputText.trim()) {
      toast({
        title: "No input",
        description: "Please paste some game chat history to process.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      if (processingMode === 'offline') {
        // Use local logic-based processing
        const result = processTextOffline(inputText, options);
        setOutputText(result);
        toast({
          title: "Processing complete",
          description: "Your text has been transformed using offline logic.",
        });
      } else {
        // Use AI-powered processing via edge function
        const { data, error } = await supabase.functions.invoke('narrative-forge', {
          body: { 
            text: inputText,
            characterName,
            style: options.narrativeStyle,
          },
        });

        if (error) throw error;
        
        setOutputText(data.narrative || '');
        toast({
          title: "AI processing complete",
          description: "Your narrative has been crafted by the AI scribe.",
        });
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "An error occurred during processing.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, processingMode, options, characterName, toast]);

  const handleCopy = useCallback(async () => {
    if (!outputText) return;
    
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "The narrative has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive",
      });
    }
  }, [outputText, toast]);

  const removalPreview = inputText ? getRemovalPreview(inputText) : [];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Image with Parallax */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat bg-fixed scale-110 z-0"
        style={{ 
          backgroundImage: `url(${scribeBackground})`,
          transform: 'translateZ(0)',
        }}
      />
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-background/85 via-background/55 to-background/90 z-0" />
      <div className="fixed inset-0 bg-gradient-to-r from-amber-900/25 via-transparent to-amber-900/25 z-0" />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-background/90 via-background/80 to-transparent backdrop-blur-md border-b border-amber-900/30 px-4 py-3">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
        
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h1 className="font-cinzel font-bold text-lg uppercase tracking-wider text-amber-400">
              Narrative Forge
            </h1>
          </div>
          
          <div className="w-9" />
        </div>
        
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Mode Selection */}
        <Tabs value={processingMode} onValueChange={(v) => setProcessingMode(v as 'ai' | 'offline')}>
          <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-amber-900/40">
            <TabsTrigger 
              value="offline" 
              className="data-[state=active]:bg-gradient-to-b data-[state=active]:from-amber-600/30 data-[state=active]:to-amber-900/20 data-[state=active]:text-amber-400 gap-2"
            >
              <Cog className="w-4 h-4" />
              Offline Logic
            </TabsTrigger>
            <TabsTrigger 
              value="ai"
              className="data-[state=active]:bg-gradient-to-b data-[state=active]:from-purple-600/30 data-[state=active]:to-purple-900/20 data-[state=active]:text-purple-400 gap-2"
            >
              <Cpu className="w-4 h-4" />
              AI Scribe
            </TabsTrigger>
          </TabsList>

          {/* Mode Descriptions */}
          <TabsContent value="offline" className="mt-3">
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                <span>
                  <strong className="text-amber-400">Offline Mode:</strong> Uses pattern matching to strip dice rolls, 
                  stats, and game mechanics. Works instantly with no internet required. Best for quick cleanup.
                </span>
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="ai" className="mt-3">
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-purple-400" />
                <span>
                  <strong className="text-purple-400">AI Scribe:</strong> Uses AI to intelligently rewrite your 
                  game content into flowing prose narrative. Maintains story coherence and enhances descriptions.
                </span>
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Processing Options */}
        <Card className="border-amber-900/30 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cog className="w-4 h-4 text-amber-400" />
              Processing Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="removeRolls" className="text-sm cursor-pointer">Remove Dice Rolls</Label>
                <Switch 
                  id="removeRolls"
                  checked={options.removeRolls}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, removeRolls: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="removeStats" className="text-sm cursor-pointer">Remove Stats</Label>
                <Switch 
                  id="removeStats"
                  checked={options.removeStats}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, removeStats: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="removeMechanics" className="text-sm cursor-pointer">Remove Mechanics</Label>
                <Switch 
                  id="removeMechanics"
                  checked={options.removeMechanics}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, removeMechanics: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="enhanceDescriptions" className="text-sm cursor-pointer">Enhance Text</Label>
                <Switch 
                  id="enhanceDescriptions"
                  checked={options.enhanceDescriptions}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, enhanceDescriptions: checked }))}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Label htmlFor="narrativeStyle" className="text-sm shrink-0">Narrative Style:</Label>
              <Select 
                value={options.narrativeStyle} 
                onValueChange={(v) => setOptions(prev => ({ ...prev, narrativeStyle: v as ProcessingOptions['narrativeStyle'] }))}
              >
                <SelectTrigger id="narrativeStyle" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fantasy">Fantasy</SelectItem>
                  <SelectItem value="noir">Noir</SelectItem>
                  <SelectItem value="literary">Literary</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Input Section */}
        <Card className="border-amber-900/30 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Input: Game Chat History</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste your TTRPG game chat, AI-generated session log, or story content here...

Example:
[GM] The ancient door creaks open. Roll Perception.
[Player - Kira] I rolled a 17 (+3 WIS = 20)! 
[GM] Success! You notice a faint shimmer on the floor - a trap! DC 15 to disarm.
Kira carefully examines the mechanism (DEX check: 14+4=18)...
[OOC: Nice roll!]
The trap clicks harmlessly as she disables it."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="min-h-[200px] font-mono text-sm resize-none"
            />
            
            {/* Removal Preview */}
            {inputText && removalPreview.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <button 
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Info className="w-3 h-3" />
                  {showPreview ? 'Hide' : 'Show'} detection preview
                </button>
                {showPreview && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {removalPreview.map((item, i) => (
                      <span key={i} className="px-2 py-1 text-xs bg-amber-900/20 text-amber-300 rounded-full">
                        {item.count}× {item.element}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Process Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleProcess}
            disabled={isProcessing || !inputText.trim()}
            className="gap-2 px-8 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white border-0"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {processingMode === 'ai' ? 'AI is writing...' : 'Processing...'}
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Forge Narrative
              </>
            )}
          </Button>
        </div>

        {/* Output Section */}
        {outputText && (
          <Card className="border-green-900/30 bg-card/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-400">Output: Pure Prose</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCopy}
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy to clipboard</TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-serif leading-relaxed">
                  {outputText}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <div className="text-xs text-muted-foreground space-y-2 pt-4 border-t border-border/30">
          <p className="font-semibold text-foreground/70">Tips:</p>
          <ul className="list-disc list-inside space-y-1 opacity-70">
            <li>Paste raw chat logs from AI Dungeon, Character.AI, or any TTRPG game</li>
            <li>The tool removes dice notation (2d6+3), stat blocks, and OOC comments</li>
            <li>Use Offline mode for quick cleanup, AI mode for full narrative rewriting</li>
            <li>Different narrative styles change how action descriptions are enhanced</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
