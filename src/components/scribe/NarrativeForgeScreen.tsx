import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Wand2, Cog, Copy, Check, Loader2, BookOpen, Cpu, Info, Save, Plus, FileText, Trash2, Eye, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { 
  processTextOffline, 
  getRemovalPreview,
  ProcessingOptions,
  defaultProcessingOptions,
} from '@/lib/narrativeProcessor';
import { supabase } from '@/integrations/supabase/client';
import scribeBackground from '@/assets/scribe-background.jpg';

const SAVED_STORY_KEY = 'narrative-forge-saved-story';

interface SavedStory {
  title: string;
  content: string;
  lastUpdated: string;
  style: string;
}

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
  const [savedStory, setSavedStory] = useState<SavedStory | null>(null);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const { toast } = useToast();

  // Load saved story from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SAVED_STORY_KEY);
    if (stored) {
      try {
        setSavedStory(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse saved story:', e);
      }
    }
  }, []);

  // Save story to localStorage
  const persistStory = useCallback((story: SavedStory | null) => {
    if (story) {
      localStorage.setItem(SAVED_STORY_KEY, JSON.stringify(story));
    } else {
      localStorage.removeItem(SAVED_STORY_KEY);
    }
    setSavedStory(story);
  }, []);

  const handleSaveAsNewStory = useCallback(() => {
    if (!outputText.trim()) {
      toast({
        title: "No content to save",
        description: "Generate a narrative first before saving.",
        variant: "destructive",
      });
      return;
    }

    const newStory: SavedStory = {
      title: `${characterName}'s Chronicle`,
      content: outputText,
      lastUpdated: new Date().toISOString(),
      style: options.narrativeStyle,
    };

    persistStory(newStory);
    toast({
      title: "Story Saved!",
      description: "Your narrative has been saved. You can now add more content to it.",
    });
  }, [outputText, characterName, options.narrativeStyle, persistStory, toast]);

  const handleAddToStory = useCallback(() => {
    if (!outputText.trim()) {
      toast({
        title: "No content to add",
        description: "Generate a narrative first before adding to your story.",
        variant: "destructive",
      });
      return;
    }

    if (!savedStory) {
      toast({
        title: "No saved story",
        description: "Save a story first before adding to it.",
        variant: "destructive",
      });
      return;
    }

    const updatedStory: SavedStory = {
      ...savedStory,
      content: savedStory.content + '\n\n---\n\n' + outputText,
      lastUpdated: new Date().toISOString(),
    };

    persistStory(updatedStory);
    toast({
      title: "Added to Story!",
      description: "Your narrative has been appended to your saved story.",
    });
  }, [outputText, savedStory, persistStory, toast]);

  const handleDeleteStory = useCallback(() => {
    persistStory(null);
    setIsEditingStory(false);
    toast({
      title: "Story Deleted",
      description: "Your saved story has been removed.",
    });
  }, [persistStory, toast]);

  const handleStartEditing = useCallback(() => {
    if (savedStory) {
      setEditedContent(savedStory.content);
      setIsEditingStory(true);
    }
  }, [savedStory]);

  const handleCancelEditing = useCallback(() => {
    setIsEditingStory(false);
    setEditedContent('');
  }, []);

  const handleSaveEdits = useCallback(() => {
    if (!savedStory || !editedContent.trim()) {
      toast({
        title: "Cannot save empty story",
        description: "Please add some content before saving.",
        variant: "destructive",
      });
      return;
    }

    const updatedStory: SavedStory = {
      ...savedStory,
      content: editedContent,
      lastUpdated: new Date().toISOString(),
    };

    persistStory(updatedStory);
    setIsEditingStory(false);
    toast({
      title: "Story Updated",
      description: "Your changes have been saved.",
    });
  }, [savedStory, editedContent, persistStory, toast]);

  const handleCopyStory = useCallback(async () => {
    if (!savedStory?.content) return;
    
    try {
      await navigator.clipboard.writeText(savedStory.content);
      toast({
        title: "Copied!",
        description: "Your full story has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive",
      });
    }
  }, [savedStory, toast]);

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
    <BackgroundWrapper 
      imagePath={scribeBackground} 
      overlayOpacity={75} 
      tintColor="amber" 
      tintOpacity={25}
    >
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
          
          {/* Story Viewer Button */}
          <Sheet open={storyViewerOpen} onOpenChange={setStoryViewerOpen}>
            <SheetTrigger asChild>
              <button 
                className={`p-2 -mr-2 rounded-lg transition-colors relative ${
                  savedStory ? 'hover:bg-amber-900/30 text-amber-400' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <FileText className="w-5 h-5" />
                {savedStory && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-background" />
                )}
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-amber-400">
                  <BookOpen className="w-5 h-5" />
                  {savedStory?.title || 'Saved Story'}
                </SheetTitle>
              </SheetHeader>
              
              {savedStory ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Last updated: {new Date(savedStory.lastUpdated).toLocaleDateString()}</span>
                    <span className="capitalize">{savedStory.style} style</span>
                  </div>
                  
                  {isEditingStory ? (
                    <>
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="h-[calc(100vh-300px)] resize-none font-serif text-sm leading-relaxed bg-background/50 border-amber-900/30 focus:border-amber-500/50"
                        placeholder="Edit your story..."
                      />
                      <div className="text-xs text-muted-foreground text-right">
                        {editedContent.split(/\s+/).filter(Boolean).length} words
                      </div>
                    </>
                  ) : (
                    <ScrollArea className="h-[calc(100vh-250px)] pr-4">
                      <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-serif leading-relaxed">
                        {savedStory.content}
                      </div>
                    </ScrollArea>
                  )}
                  
                  <div className="flex gap-2 pt-4 border-t border-border/50">
                    {isEditingStory ? (
                      <>
                        <Button
                          onClick={handleSaveEdits}
                          size="sm"
                          className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700"
                        >
                          <Save className="w-4 h-4" />
                          Save Changes
                        </Button>
                        <Button
                          onClick={handleCancelEditing}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={handleStartEditing}
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2 text-amber-400 hover:text-amber-300 border-amber-900/50 hover:border-amber-500/50"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button
                          onClick={handleCopyStory}
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Copy All
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Saved Story?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete your saved story. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  handleDeleteStory();
                                  setStoryViewerOpen(false);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-8 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">No story saved yet.</p>
                  <p className="text-xs mt-1">Generate a narrative and save it to start building your chronicle.</p>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
        
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Saved Story Indicator */}
        {savedStory && (
          <Card className="border-green-900/30 bg-green-950/20">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-400">{savedStory.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {savedStory.content.split(/\s+/).length} words • Updated {new Date(savedStory.lastUpdated).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStoryViewerOpen(true)}
                className="gap-1 text-green-400 hover:text-green-300"
              >
                <Eye className="w-4 h-4" />
                View
              </Button>
            </CardContent>
          </Card>
        )}
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
            
            <div className="space-y-2">
              <Label htmlFor="narrativeStyle" className="text-sm">Narrative Style:</Label>
              <Select 
                value={options.narrativeStyle} 
                onValueChange={(v) => setOptions(prev => ({ ...prev, narrativeStyle: v as ProcessingOptions['narrativeStyle'] }))}
              >
                <SelectTrigger id="narrativeStyle" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fantasy">
                    <span className="font-medium">Fantasy</span>
                    <span className="text-xs text-muted-foreground ml-2">— Epic high fantasy prose</span>
                  </SelectItem>
                  <SelectItem value="noir">
                    <span className="font-medium">Noir</span>
                    <span className="text-xs text-muted-foreground ml-2">— Dark, gritty detective style</span>
                  </SelectItem>
                  <SelectItem value="literary">
                    <span className="font-medium">Literary</span>
                    <span className="text-xs text-muted-foreground ml-2">— Elegant, refined prose</span>
                  </SelectItem>
                  <SelectItem value="action">
                    <span className="font-medium">Action</span>
                    <span className="text-xs text-muted-foreground ml-2">— Fast-paced, punchy writing</span>
                  </SelectItem>
                  <SelectItem value="salvatore">
                    <span className="font-medium">R.A. Salvatore</span>
                    <span className="text-xs text-muted-foreground ml-2">— Warrior poetry & named blade techniques</span>
                  </SelectItem>
                  <SelectItem value="deadpool">
                    <span className="font-medium">Deadpool</span>
                    <span className="text-xs text-muted-foreground ml-2">— Fourth-wall-breaking meta chaos</span>
                  </SelectItem>
                  <SelectItem value="dark_comedy">
                    <span className="font-medium">Dark Comedy</span>
                    <span className="text-xs text-muted-foreground ml-2">— Gallows humor & sardonic wit</span>
                  </SelectItem>
                  <SelectItem value="subtle_absurdity">
                    <span className="font-medium">Subtle Absurdity</span>
                    <span className="text-xs text-muted-foreground ml-2">— Kafkaesque deadpan surrealism</span>
                  </SelectItem>
                  <SelectItem value="lovecraftian">
                    <span className="font-medium">Lovecraftian Horror</span>
                    <span className="text-xs text-muted-foreground ml-2">— Cosmic dread & sanity erosion</span>
                  </SelectItem>
                  <SelectItem value="gonzo">
                    <span className="font-medium">Gonzo Journalism</span>
                    <span className="text-xs text-muted-foreground ml-2">— Hunter S. Thompson's savage reporting</span>
                  </SelectItem>
                  <SelectItem value="hemingway">
                    <span className="font-medium">Hemingway Minimalist</span>
                    <span className="text-xs text-muted-foreground ml-2">— Brutal efficiency, short sentences</span>
                  </SelectItem>
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
            <CardContent className="space-y-4">
              <ScrollArea className="max-h-[400px]">
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-serif leading-relaxed">
                  {outputText}
                </div>
              </ScrollArea>
              
              {/* Save Options */}
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border/50">
                <Button
                  onClick={handleSaveAsNewStory}
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 border-amber-600/50 text-amber-400 hover:bg-amber-950/50 hover:text-amber-300"
                >
                  <Save className="w-4 h-4" />
                  {savedStory ? 'Replace Saved Story' : 'Save as New Story'}
                </Button>
                
                {savedStory && (
                  <Button
                    onClick={handleAddToStory}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 border-green-600/50 text-green-400 hover:bg-green-950/50 hover:text-green-300"
                  >
                    <Plus className="w-4 h-4" />
                    Add to Saved Story
                  </Button>
                )}
              </div>
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
    </BackgroundWrapper>
  );
}
