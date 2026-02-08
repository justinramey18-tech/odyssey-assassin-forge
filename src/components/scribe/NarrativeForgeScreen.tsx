import { useState, useCallback, useEffect, useMemo } from 'react';
import { ArrowLeft, Wand2, Cog, Copy, Check, Loader2, BookOpen, Cpu, Info, Save, Plus, FileText, Trash2, Eye, Pencil, X, Upload, ClipboardPaste, Square, CheckSquare, Download, RotateCcw, Sparkles, ArrowLeftRight } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { 
  processTextOffline, 
  getRemovalPreview,
  ProcessingOptions,
  defaultProcessingOptions,
} from '@/lib/narrativeProcessor';
import { supabase } from '@/integrations/supabase/client';
import { CampaignFileUpload } from './CampaignFileUpload';
import { StoryListSheet } from './StoryListSheet';
import { SmartParsePreview } from './SmartParsePreview';
import { EditingRulesEditor } from './EditingRulesEditor';
import { TemplateControls } from './TemplateControls';
import { StyleBlendControls } from './StyleBlendControls';
import { StylePreviewSheet } from './StylePreviewSheet';
import { StoryTags } from './StoryTags';
import { ComparisonView } from './ComparisonView';
import { useCampaignProcessor } from '@/hooks/use-campaign-processor';
import { useSavedStories, MergeOptions } from '@/hooks/use-saved-stories';
import { useEditingRules } from '@/hooks/use-editing-rules';
import { useProcessingTemplates } from '@/hooks/use-processing-templates';
import { DetectedSession, estimateProcessingTime } from '@/lib/scribe/sessionDetection';
import { getSmartParsePreview } from '@/lib/scribe/smartParsing';
import { BlendConfig } from '@/lib/scribe/processingTemplates';
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
  const [smartParseEnabled, setSmartParseEnabled] = useState(true);
  const [showSmartParsePreview, setShowSmartParsePreview] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [inputSource, setInputSource] = useState<'paste' | 'upload'>('paste');
  const [styleBlendEnabled, setStyleBlendEnabled] = useState(false);
  const [blendConfig, setBlendConfig] = useState<BlendConfig | undefined>(undefined);
  const [showComparisonView, setShowComparisonView] = useState(false);
  const [lastProcessedInput, setLastProcessedInput] = useState('');
  const { toast } = useToast();

  // Multi-story management
  const {
    stories,
    activeStoryId,
    activeStory,
    setActiveStoryId,
    createStory,
    updateStory,
    appendToStory,
    deleteStory,
    renameStory,
    addTagToStory,
    removeTagFromStory,
    getAllTags,
    mergeStories,
  } = useSavedStories();

  // Campaign processor for file uploads
  const campaignProcessor = useCampaignProcessor();

  // Custom editing rules
  const editingRulesHook = useEditingRules();

  // Processing templates
  const templatesHook = useProcessingTemplates();
  const smartParseInfo = useMemo(() => {
    const textToCheck = inputSource === 'paste' 
      ? inputText 
      : campaignProcessor?.fileContent || '';
    return getSmartParsePreview(textToCheck);
  }, [inputText, inputSource, campaignProcessor?.fileContent]);

  const handleSaveAsNewStory = useCallback(() => {
    if (!outputText.trim()) {
      toast({
        title: "No content to save",
        description: "Generate a narrative first before saving.",
        variant: "destructive",
      });
      return;
    }

    createStory(
      `${characterName}'s Chronicle`,
      outputText,
      options.narrativeStyle
    );
    
    toast({
      title: "Story Saved!",
      description: "Your narrative has been saved as a new story.",
    });
  }, [outputText, characterName, options.narrativeStyle, createStory, toast]);

  const handleAddToStory = useCallback(() => {
    if (!outputText.trim()) {
      toast({
        title: "No content to add",
        description: "Generate a narrative first before adding to your story.",
        variant: "destructive",
      });
      return;
    }

    if (!activeStory) {
      toast({
        title: "No story selected",
        description: "Select or create a story first before adding to it.",
        variant: "destructive",
      });
      return;
    }

    appendToStory(activeStory.id, outputText);
    toast({
      title: "Added to Story!",
      description: `Your narrative has been appended to "${activeStory.title}".`,
    });
  }, [outputText, activeStory, appendToStory, toast]);

  const handleDeleteActiveStory = useCallback(() => {
    if (!activeStory) return;
    deleteStory(activeStory.id);
    setIsEditingStory(false);
    toast({
      title: "Story Deleted",
      description: "Your saved story has been removed.",
    });
  }, [activeStory, deleteStory, toast]);

  const handleStartEditing = useCallback(() => {
    if (activeStory) {
      setEditedContent(activeStory.content);
      setIsEditingStory(true);
    }
  }, [activeStory]);

  const handleCancelEditing = useCallback(() => {
    setIsEditingStory(false);
    setEditedContent('');
  }, []);

  const handleSaveEdits = useCallback(() => {
    if (!activeStory || !editedContent.trim()) {
      toast({
        title: "Cannot save empty story",
        description: "Please add some content before saving.",
        variant: "destructive",
      });
      return;
    }

    updateStory(activeStory.id, { content: editedContent });
    setIsEditingStory(false);
    toast({
      title: "Story Updated",
      description: "Your changes have been saved.",
    });
  }, [activeStory, editedContent, updateStory, toast]);

  const handleCopyStory = useCallback(async () => {
    if (!activeStory?.content) return;
    
    try {
      await navigator.clipboard.writeText(activeStory.content);
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
  }, [activeStory, toast]);

  // Handle file upload
  const handleFileLoaded = useCallback((content: string, fileName: string, sessions: DetectedSession[]) => {
    campaignProcessor.loadFile(content, fileName, sessions);
    // Clear paste input when switching to file
    setInputText('');
  }, [campaignProcessor]);

  const handleFileClear = useCallback(() => {
    campaignProcessor.reset();
  }, [campaignProcessor]);

  const handleProcess = useCallback(async () => {
    // Handle file upload mode
    if (inputSource === 'upload' && campaignProcessor.fileName) {
      const selectedCount = campaignProcessor.selectedSessionIds.size;
      
      if (selectedCount === 0) {
        toast({
          title: "No sessions selected",
          description: "Please select at least one session to process.",
          variant: "destructive",
        });
        return;
      }

      // Prepare custom editing rules for the processor
      const rulesForApi = editingRulesHook.rules
        .filter(r => r.isValid && r.instruction.trim())
        .map(r => ({ type: r.type, instruction: r.instruction, scope: r.scope }));

      const result = await campaignProcessor.processSelectedSessions(
        processingMode,
        options,
        characterName,
        smartParseEnabled,
        rulesForApi
      );

      if (result) {
        setOutputText(result);
        toast({
          title: "Processing complete!",
          description: `${selectedCount} session${selectedCount > 1 ? 's' : ''} processed successfully.`,
        });
      }
      return;
    }

    // Handle paste mode (original logic)
    if (!inputText.trim()) {
      toast({
        title: "No input",
        description: "Please paste some game chat history to process.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setLastProcessedInput(inputText); // Store for comparison view
    
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
        // Prepare custom editing rules for the API
        const rulesForApi = editingRulesHook.rules
          .filter(r => r.isValid && r.instruction.trim())
          .map(r => ({ type: r.type, instruction: r.instruction, scope: r.scope }));

        // Use AI-powered processing via edge function
        const { data, error } = await supabase.functions.invoke('narrative-forge', {
          body: { 
            text: inputText,
            characterName,
            style: options.narrativeStyle,
            smartParseEnabled,
            customEditingRules: rulesForApi,
            blendConfig: styleBlendEnabled ? blendConfig : undefined,
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
  }, [inputSource, campaignProcessor, inputText, processingMode, options, characterName, smartParseEnabled, editingRulesHook.rules, styleBlendEnabled, blendConfig, toast]);

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

  // Export narrative as file
  const handleExport = useCallback((format: 'txt' | 'md', content?: string, title?: string) => {
    const textToExport = content || outputText;
    if (!textToExport) return;

    const storyTitle = title || activeStory?.title;
    const fileName = storyTitle 
      ? `${storyTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim()}.${format}`
      : `narrative-${new Date().toISOString().split('T')[0]}.${format}`;

    let finalContent = textToExport;
    
    // Add markdown header for .md files
    if (format === 'md') {
      const headerTitle = storyTitle || `${characterName}'s Chronicle`;
      finalContent = `# ${headerTitle}\n\n*Exported from Narrative Forge on ${new Date().toLocaleDateString()}*\n\n---\n\n${textToExport}`;
    }

    const blob = new Blob([finalContent], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported!",
      description: `Saved as ${fileName}`,
    });
  }, [outputText, activeStory, characterName, toast]);

  // Export saved story
  const handleExportSavedStory = useCallback((format: 'txt' | 'md') => {
    if (!activeStory) return;
    handleExport(format, activeStory.content, activeStory.title);
  }, [activeStory, handleExport]);

  // Retry failed sessions
  const handleRetryFailed = useCallback(async () => {
    const failedCount = campaignProcessor.getFailedSessionCount();
    if (failedCount === 0) return;

    // Prepare custom editing rules for the processor
    const rulesForApi = editingRulesHook.rules
      .filter(r => r.isValid && r.instruction.trim())
      .map(r => ({ type: r.type, instruction: r.instruction, scope: r.scope }));

    const result = await campaignProcessor.retryFailedSessions(
      processingMode,
      options,
      characterName,
      smartParseEnabled,
      rulesForApi
    );

    if (result) {
      setOutputText(result);
      const newFailedCount = campaignProcessor.getFailedSessionCount();
      if (newFailedCount === 0) {
        toast({
          title: "All sessions processed!",
          description: `Successfully retried ${failedCount} failed session${failedCount > 1 ? 's' : ''}.`,
        });
      } else {
        toast({
          title: "Retry complete",
          description: `${failedCount - newFailedCount} of ${failedCount} sessions succeeded. ${newFailedCount} still failed.`,
          variant: newFailedCount > 0 ? "destructive" : "default",
        });
      }
    }
  }, [campaignProcessor, processingMode, options, characterName, smartParseEnabled, editingRulesHook.rules, toast]);

  // Template handlers
  const handleSaveTemplate = useCallback((name: string) => {
    const template = templatesHook.saveAsTemplate(
      name,
      options.narrativeStyle,
      smartParseEnabled,
      options,
      editingRulesHook.rules,
      styleBlendEnabled ? blendConfig : undefined
    );
    
    if (template) {
      toast({
        title: "Template Saved",
        description: `"${name}" has been saved for future use.`,
      });
    } else {
      toast({
        title: "Failed to save template",
        description: "Maximum templates reached or invalid name.",
        variant: "destructive",
      });
    }
  }, [templatesHook, options, smartParseEnabled, editingRulesHook.rules, styleBlendEnabled, blendConfig, toast]);

  const handleLoadTemplate = useCallback((id: string) => {
    const template = templatesHook.getTemplateById(id);
    if (!template) return;

    // Apply template settings
    setOptions(template.processingOptions);
    setSmartParseEnabled(template.smartParseEnabled);
    
    // Apply blend config
    if (template.blendConfig) {
      setStyleBlendEnabled(true);
      setBlendConfig(template.blendConfig);
    } else {
      setStyleBlendEnabled(false);
      setBlendConfig(undefined);
    }
    
    // Load editing rules
    if (template.editingRules.length > 0) {
      editingRulesHook.clearAllRules();
      template.editingRules.forEach(rule => {
        editingRulesHook.addRule(rule.instruction, rule.type);
      });
    }

    toast({
      title: "Template Loaded",
      description: `Applied "${template.name}" settings.`,
    });
  }, [templatesHook, editingRulesHook, toast]);

  const handleDeleteTemplate = useCallback((id: string) => {
    templatesHook.deleteTemplate(id);
    toast({
      title: "Template Deleted",
      description: "The template has been removed.",
    });
  }, [templatesHook, toast]);

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
          
          {/* Story List Button */}
          <StoryListSheet
            stories={stories}
            activeStoryId={activeStoryId}
            onSelectStory={setActiveStoryId}
            onDeleteStory={deleteStory}
            onRenameStory={renameStory}
            onViewStory={(id) => {
              setActiveStoryId(id);
              setStoryViewerOpen(true);
            }}
            onMergeStories={(orderedIds, options) => {
              const merged = mergeStories(orderedIds, options);
              if (merged) {
                toast({
                  title: "Stories Merged!",
                  description: `Created "${merged.title}" with ${merged.wordCount.toLocaleString()} words.`,
                });
              }
            }}
            onAddTag={addTagToStory}
            onRemoveTag={removeTagFromStory}
            allTags={getAllTags()}
          />
        </div>
        
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </header>

      {/* Active Story Viewer Sheet */}
      <Sheet open={storyViewerOpen} onOpenChange={setStoryViewerOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-amber-400">
              <BookOpen className="w-5 h-5" />
              {activeStory?.title || 'Saved Story'}
            </SheetTitle>
          </SheetHeader>
          
          {activeStory ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Last updated: {new Date(activeStory.lastUpdated).toLocaleDateString()}</span>
                <span className="capitalize">{activeStory.style} style</span>
              </div>
              
              {/* Story Tags */}
              <StoryTags
                tags={activeStory.tags || []}
                allTags={getAllTags()}
                onAddTag={(tag) => addTagToStory(activeStory.id, tag)}
                onRemoveTag={(tag) => removeTagFromStory(activeStory.id, tag)}
              />
              
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
                    {activeStory.content}
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
                          <AlertDialogTitle>Delete "{activeStory.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this story ({activeStory.wordCount.toLocaleString()} words). This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              handleDeleteActiveStory();
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

              {/* Export Options */}
              {!isEditingStory && (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleExportSavedStory('txt')}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Download className="w-4 h-4" />
                    Export .txt
                  </Button>
                  <Button
                    onClick={() => handleExportSavedStory('md')}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Download className="w-4 h-4" />
                    Export .md
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">No story selected.</p>
              <p className="text-xs mt-1">Generate a narrative and save it to start building your chronicle.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Active Story Indicator */}
        {activeStory && (
          <Card className="border-green-900/30 bg-green-950/20">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-400">{activeStory.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeStory.wordCount.toLocaleString()} words • Updated {new Date(activeStory.lastUpdated).toLocaleDateString()}
                    {stories.length > 1 && ` • ${stories.length} stories saved`}
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

        {/* Resume Processing Banner */}
        {campaignProcessor.hasSavedProgress && campaignProcessor.savedProgressInfo && (
          <Card className="border-purple-900/30 bg-purple-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Loader2 className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-purple-400">Interrupted Processing Found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {campaignProcessor.savedProgressInfo.fileName} • {' '}
                    {campaignProcessor.savedProgressInfo.completedCount} of {campaignProcessor.savedProgressInfo.totalCount} sessions completed
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Saved {new Date(campaignProcessor.savedProgressInfo.savedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={async () => {
                      const rulesForApi = editingRulesHook.rules
                        .filter(r => r.isValid && r.instruction.trim())
                        .map(r => ({ type: r.type, instruction: r.instruction, scope: r.scope }));
                      const result = await campaignProcessor.resumeProcessing(processingMode, options, characterName, smartParseEnabled, rulesForApi);
                      if (result) {
                        setOutputText(result);
                        toast({
                          title: "Processing resumed and completed!",
                          description: "All sessions have been processed.",
                        });
                      }
                    }}
                    className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Wand2 className="w-3 h-3" />
                    Resume
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={campaignProcessor.clearSavedProgress}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cog className="w-4 h-4 text-amber-400" />
                Processing Options
              </CardTitle>
              {processingMode === 'ai' && (
                <TemplateControls
                  templates={templatesHook.templates}
                  canAddTemplate={templatesHook.canAddTemplate}
                  onSaveTemplate={handleSaveTemplate}
                  onLoadTemplate={handleLoadTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                />
              )}
            </div>
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

            {/* Smart Parse Toggle - AI mode only */}
            {processingMode === 'ai' && (
              <div className="pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="smartParse" className="text-sm cursor-pointer flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Smart Parse
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {smartParseEnabled 
                        ? 'Filters out player inputs, keeping only DM/AI content' 
                        : 'Includes all content (player & DM messages)'}
                    </p>
                  </div>
                  <Switch 
                    id="smartParse"
                    checked={smartParseEnabled}
                    onCheckedChange={setSmartParseEnabled}
                  />
                </div>
              </div>
            )}
            
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

            {/* Style Blending - AI mode only */}
            {processingMode === 'ai' && (
              <div className="pt-3 border-t border-border/50">
                <StyleBlendControls
                  enabled={styleBlendEnabled}
                  onEnabledChange={setStyleBlendEnabled}
                  primaryStyle={options.narrativeStyle}
                  blendConfig={blendConfig}
                  onBlendConfigChange={setBlendConfig}
                />
              </div>
            )}

            {/* Custom Editing Rules - AI mode only */}
            {processingMode === 'ai' && (
              <div className="pt-3 border-t border-border/50">
                <EditingRulesEditor 
                  sampleText={inputSource === 'paste' ? inputText : (campaignProcessor.fileContent || '')}
                  characterName={characterName}
                  narrativeStyle={options.narrativeStyle}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Input Source Toggle */}
        <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/30 border border-border/50 w-fit">
          <button
            onClick={() => setInputSource('paste')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
              inputSource === 'paste' 
                ? 'bg-amber-500/20 text-amber-400' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            Paste Text
          </button>
          <button
            onClick={() => setInputSource('upload')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
              inputSource === 'upload' 
                ? 'bg-amber-500/20 text-amber-400' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
        </div>

        {/* Input Section */}
        {inputSource === 'paste' ? (
          <>
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
                
                {/* Smart Parse Preview Button (AI mode only) */}
                {inputText && processingMode === 'ai' && smartParseInfo.isChatFormat && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <button 
                      onClick={() => setShowSmartParsePreview(!showSmartParsePreview)}
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {showSmartParsePreview ? 'Hide' : 'Show'} Smart Parse preview
                      {smartParseInfo.stats && (
                        <span className="text-muted-foreground ml-1">
                          ({smartParseInfo.stats.reductionPercent}% will be filtered)
                        </span>
                      )}
                    </button>
                  </div>
                )}
                
                {/* Style Comparison Preview Button (AI mode only) */}
                {inputText && processingMode === 'ai' && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <StylePreviewSheet
                      sampleText={inputText}
                      characterName={characterName}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Smart Parse Preview Panel (paste mode) */}
            {showSmartParsePreview && inputText && processingMode === 'ai' && (
              <SmartParsePreview 
                text={inputText} 
                onClose={() => setShowSmartParsePreview(false)} 
              />
            )}
          </>
        ) : (
          <div className="space-y-4">
            {/* File Upload */}
            <CampaignFileUpload
              onFileLoaded={handleFileLoaded}
              onClear={handleFileClear}
              currentFile={campaignProcessor.fileName}
              fileStats={campaignProcessor.getFileStats()}
            />

            {/* Session Selection */}
            {campaignProcessor.sessions.length > 0 && (
              <Card className="border-amber-900/30 bg-card/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Detected Sessions ({campaignProcessor.sessions.length})
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={campaignProcessor.selectAllSessions}
                        className="text-xs h-7 px-2"
                      >
                        <CheckSquare className="w-3 h-3 mr-1" />
                        All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={campaignProcessor.deselectAllSessions}
                        className="text-xs h-7 px-2"
                      >
                        <Square className="w-3 h-3 mr-1" />
                        None
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2">
                      {campaignProcessor.sessions.map((session) => {
                        const isSelected = campaignProcessor.selectedSessionIds.has(session.id);
                        const isProcessed = campaignProcessor.processedSessions.has(session.id);
                        const processed = campaignProcessor.processedSessions.get(session.id);
                        
                        return (
                          <div
                            key={session.id}
                            onClick={() => campaignProcessor.toggleSession(session.id)}
                            className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-amber-500/10 border border-amber-500/30' 
                                : 'hover:bg-muted/30 border border-transparent'
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => campaignProcessor.toggleSession(session.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{session.title}</span>
                                {isProcessed && processed?.status === 'completed' && (
                                  <Check className="w-3 h-3 text-green-400 shrink-0" />
                                )}
                                {isProcessed && processed?.status === 'error' && (
                                  <X className="w-3 h-3 text-destructive shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{session.preview}</p>
                              <span className="text-xs text-muted-foreground/60">
                                {session.wordCount.toLocaleString()} words
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  
                  {/* Processing estimate */}
                  {campaignProcessor.selectedSessionIds.size > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                      <span className="text-amber-400">{campaignProcessor.selectedSessionIds.size}</span> session{campaignProcessor.selectedSessionIds.size > 1 ? 's' : ''} selected
                      {processingMode === 'ai' && (
                        <span className="ml-2">
                          • Est. time: {estimateProcessingTime(
                            campaignProcessor.sessions.filter(s => campaignProcessor.selectedSessionIds.has(s.id)),
                            processingMode
                          )}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Smart Parse Preview Button (file upload, AI mode) */}
                  {processingMode === 'ai' && smartParseInfo.isChatFormat && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <button 
                        onClick={() => setShowSmartParsePreview(!showSmartParsePreview)}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        {showSmartParsePreview ? 'Hide' : 'Show'} Smart Parse preview
                        {smartParseInfo.stats && (
                          <span className="text-muted-foreground ml-1">
                            ({smartParseInfo.stats.reductionPercent}% will be filtered)
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Smart Parse Preview Panel (file upload mode) */}
            {showSmartParsePreview && campaignProcessor.fileContent && processingMode === 'ai' && (
              <SmartParsePreview 
                text={campaignProcessor.fileContent} 
                onClose={() => setShowSmartParsePreview(false)} 
              />
            )}

            {/* Processing Progress */}
            {campaignProcessor.isProcessing && (
              <Card className="border-purple-900/30 bg-purple-950/20">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-400">
                        Processing: {campaignProcessor.sessions.find(s => s.id === campaignProcessor.currentlyProcessing)?.title || '...'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={campaignProcessor.cancelProcessing}
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Cancel
                      </Button>
                    </div>
                    <Progress value={campaignProcessor.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      {campaignProcessor.progress}% complete
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Live Preview Panel - Shows already-processed outputs during processing */}
            {campaignProcessor.processedSessions.size > 0 && (
              <Card className="border-green-900/30 bg-card/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Live Preview
                      {campaignProcessor.isProcessing && (
                        <span className="text-xs font-normal text-muted-foreground">
                          ({campaignProcessor.processedSessions.size} of {campaignProcessor.selectedSessionIds.size} sessions)
                        </span>
                      )}
                    </CardTitle>
                    {!campaignProcessor.isProcessing && campaignProcessor.processedSessions.size > 0 && (
                      <span className="text-xs text-green-400/70">
                        {Array.from(campaignProcessor.processedSessions.values())
                          .filter(s => s.status === 'completed')
                          .reduce((sum, s) => sum + s.wordCount, 0)
                          .toLocaleString()} words total
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-4">
                      {campaignProcessor.sessions
                        .filter(s => campaignProcessor.processedSessions.has(s.id))
                        .map((session) => {
                          const processed = campaignProcessor.processedSessions.get(session.id);
                          if (!processed) return null;
                          
                          return (
                            <div key={session.id} className="space-y-2">
                              <div className="flex items-center gap-2 text-xs">
                                {processed.status === 'completed' ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : processed.status === 'error' ? (
                                  <X className="w-3 h-3 text-destructive" />
                                ) : (
                                  <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                                )}
                                <span className="font-medium text-foreground/80">{session.title}</span>
                                <span className="text-muted-foreground">
                                  • {processed.wordCount.toLocaleString()} words
                                </span>
                              </div>
                              {processed.status === 'completed' && processed.output ? (
                                <div className="pl-5 text-sm text-muted-foreground font-serif leading-relaxed line-clamp-3">
                                  {processed.output.slice(0, 300)}{processed.output.length > 300 ? '...' : ''}
                                </div>
                              ) : processed.status === 'error' ? (
                                <div className="pl-5 text-xs text-destructive">
                                  Error: {processed.error || 'Processing failed'}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                  
                  {/* Retry Failed Sessions Button */}
                  {!campaignProcessor.isProcessing && campaignProcessor.getFailedSessionCount() > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <Button
                        onClick={handleRetryFailed}
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 border-amber-600/50 text-amber-400 hover:bg-amber-950/50 hover:text-amber-300"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Retry {campaignProcessor.getFailedSessionCount()} Failed Session{campaignProcessor.getFailedSessionCount() > 1 ? 's' : ''}
                      </Button>
                    </div>
                  )}
                  
                  {/* Combined preview toggle for completed sessions */}
                  {!campaignProcessor.isProcessing && campaignProcessor.processedSessions.size > 1 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <details className="group">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          View combined output
                        </summary>
                        <ScrollArea className="mt-2 max-h-[200px]">
                          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-serif leading-relaxed text-sm">
                            {campaignProcessor.combineProcessedSessions()}
                          </div>
                        </ScrollArea>
                      </details>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Process Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleProcess}
            disabled={
              (isProcessing || campaignProcessor.isProcessing) ||
              (inputSource === 'paste' && !inputText.trim()) ||
              (inputSource === 'upload' && (!campaignProcessor.fileName || campaignProcessor.selectedSessionIds.size === 0))
            }
            className="gap-2 px-8 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white border-0"
            size="lg"
          >
            {(isProcessing || campaignProcessor.isProcessing) ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {processingMode === 'ai' ? 'AI is writing...' : 'Processing...'}
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                {inputSource === 'upload' && campaignProcessor.selectedSessionIds.size > 1
                  ? `Forge ${campaignProcessor.selectedSessionIds.size} Sessions`
                  : 'Forge Narrative'
                }
              </>
            )}
          </Button>
        </div>

        {/* Comparison View */}
        {showComparisonView && lastProcessedInput && outputText && (
          <ComparisonView
            originalText={lastProcessedInput}
            transformedText={outputText}
            onClose={() => setShowComparisonView(false)}
          />
        )}

        {/* Output Section */}
        {outputText && (
          <Card className="border-green-900/30 bg-card/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-400">Output: Pure Prose</CardTitle>
              <div className="flex items-center gap-2">
                {/* Compare button */}
                {lastProcessedInput && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setShowComparisonView(!showComparisonView)}
                        variant="ghost"
                        size="sm"
                        className={`gap-2 ${showComparisonView ? 'text-purple-400' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                        Compare
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Compare original vs transformed</TooltipContent>
                  </Tooltip>
                )}
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
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="max-h-[400px]">
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-serif leading-relaxed">
                  {outputText}
                </div>
              </ScrollArea>
              
              {/* Save Options */}
              <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleSaveAsNewStory}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 border-amber-600/50 text-amber-400 hover:bg-amber-950/50 hover:text-amber-300"
                  >
                    <Save className="w-4 h-4" />
                    Save as New Story
                  </Button>
                  
                  {activeStory && (
                    <Button
                      onClick={handleAddToStory}
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 border-green-600/50 text-green-400 hover:bg-green-950/50 hover:text-green-300"
                    >
                      <Plus className="w-4 h-4" />
                      Add to "{activeStory.title.slice(0, 15)}{activeStory.title.length > 15 ? '...' : ''}"
                    </Button>
                  )}
                </div>

                {/* Export Options */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleExport('txt')}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Download className="w-4 h-4" />
                    Export .txt
                  </Button>
                  <Button
                    onClick={() => handleExport('md')}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Download className="w-4 h-4" />
                    Export .md
                  </Button>
                </div>
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
