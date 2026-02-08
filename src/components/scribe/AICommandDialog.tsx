import { useState, useCallback, useEffect } from 'react';
import { Wand2, Loader2, Sparkles, ChevronDown, Save, Trash2, FolderOpen, MoreHorizontal, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { useToast } from '@/hooks/use-toast';
import { useAICommandTemplates, AICommandTemplate } from '@/hooks/use-ai-command-templates';

interface AICommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyCommand: (instruction: string) => Promise<void>;
  isProcessing: boolean;
  storyWordCount: number;
  storyCharCount?: number;
  chunkProgress?: { current: number; total: number } | null;
}

const EXAMPLE_COMMANDS = [
  { label: "Replace names", instruction: "Change every instance of '[old name]' to '[new name]'" },
  { label: "Change perspective", instruction: "Convert all dialogue and narration to first person perspective" },
  { label: "Add descriptions", instruction: "Add more sensory details and vivid descriptions throughout" },
  { label: "Adjust tone", instruction: "Make the overall tone more dramatic and intense" },
  { label: "Remove content", instruction: "Remove all references to [specific character or element]" },
  { label: "Expand scenes", instruction: "Expand combat scenes with more detailed action choreography" },
];

export function AICommandDialog({
  open,
  onOpenChange,
  onApplyCommand,
  isProcessing,
  storyWordCount,
  storyCharCount = 0,
  chunkProgress,
}: AICommandDialogProps) {
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateToDelete, setTemplateToDelete] = useState<AICommandTemplate | null>(null);
  const [templateToEdit, setTemplateToEdit] = useState<AICommandTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editInstruction, setEditInstruction] = useState('');
  const [progress, setProgress] = useState(0);
  
  // Simulated progress for visual feedback during processing
  useEffect(() => {
    if (!isProcessing) {
      setProgress(0);
      return;
    }
    
    // Start progress animation
    setProgress(5);
    
    const intervals = [
      { delay: 500, value: 15 },
      { delay: 1500, value: 30 },
      { delay: 3000, value: 45 },
      { delay: 6000, value: 60 },
      { delay: 10000, value: 75 },
      { delay: 15000, value: 85 },
      { delay: 25000, value: 92 },
    ];
    
    const timeouts = intervals.map(({ delay, value }) => 
      setTimeout(() => setProgress(value), delay)
    );
    
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isProcessing]);
  
  const { toast } = useToast();
  const {
    templates,
    createTemplate,
    deleteTemplate,
    renameTemplate,
    updateInstruction,
    useTemplate,
    canAddTemplate,
  } = useAICommandTemplates();

  const handleApply = useCallback(async () => {
    const trimmedInstruction = instruction.trim();
    
    // Validation
    if (trimmedInstruction.length < 3) {
      setError('Please enter a more detailed instruction (at least 3 characters)');
      return;
    }
    
    if (trimmedInstruction.length > 1000) {
      setError('Instruction is too long (max 1000 characters)');
      return;
    }
    
    setError(null);
    
    try {
      await onApplyCommand(trimmedInstruction);
      setInstruction('');
      onOpenChange(false);
    } catch {
      // Error handling is done in the parent component
    }
  }, [instruction, onApplyCommand, onOpenChange]);

  const handleSelectExample = useCallback((exampleInstruction: string) => {
    setInstruction(exampleInstruction);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      setInstruction('');
      setError(null);
      setShowTemplatesPanel(false);
      onOpenChange(false);
    }
  }, [isProcessing, onOpenChange]);

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this template.",
        variant: "destructive",
      });
      return;
    }
    
    const result = createTemplate(templateName, instruction);
    if (result) {
      toast({
        title: "Template Saved",
        description: `"${templateName}" has been saved for future use.`,
      });
      setShowSaveDialog(false);
      setTemplateName('');
    } else {
      toast({
        title: "Failed to save",
        description: "Maximum templates reached or invalid data.",
        variant: "destructive",
      });
    }
  }, [templateName, instruction, createTemplate, toast]);

  const handleLoadTemplate = useCallback((template: AICommandTemplate) => {
    const used = useTemplate(template.id);
    if (used) {
      setInstruction(used.instruction);
      setError(null);
      setShowTemplatesPanel(false);
      toast({
        title: "Template Loaded",
        description: `"${template.name}" is ready to use.`,
      });
    }
  }, [useTemplate, toast]);

  const handleDeleteTemplate = useCallback(() => {
    if (templateToDelete) {
      deleteTemplate(templateToDelete.id);
      toast({
        title: "Template Deleted",
        description: `"${templateToDelete.name}" has been removed.`,
      });
      setTemplateToDelete(null);
    }
  }, [templateToDelete, deleteTemplate, toast]);

  const handleOpenEditDialog = useCallback((template: AICommandTemplate) => {
    setTemplateToEdit(template);
    setEditName(template.name);
    setEditInstruction(template.instruction);
  }, []);

  const handleSaveEditedTemplate = useCallback(() => {
    if (!templateToEdit) return;
    
    const trimmedName = editName.trim();
    const trimmedInstruction = editInstruction.trim();
    
    if (!trimmedName) {
      toast({
        title: "Name required",
        description: "Please enter a name for this template.",
        variant: "destructive",
      });
      return;
    }
    
    if (!trimmedInstruction || trimmedInstruction.length < 3) {
      toast({
        title: "Instruction required",
        description: "Please enter an instruction (at least 3 characters).",
        variant: "destructive",
      });
      return;
    }
    
    // Update name if changed
    if (trimmedName !== templateToEdit.name) {
      renameTemplate(templateToEdit.id, trimmedName);
    }
    
    // Update instruction if changed
    if (trimmedInstruction !== templateToEdit.instruction) {
      updateInstruction(templateToEdit.id, trimmedInstruction);
    }
    
    toast({
      title: "Template Updated",
      description: `"${trimmedName}" has been saved.`,
    });
    
    setTemplateToEdit(null);
    setEditName('');
    setEditInstruction('');
  }, [templateToEdit, editName, editInstruction, renameTemplate, updateInstruction, toast]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              AI Command
            </DialogTitle>
            <DialogDescription>
              Apply an AI transformation to the entire story. The AI will process all {storyWordCount.toLocaleString()} words according to your instruction.
            </DialogDescription>
          </DialogHeader>
          
          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm rounded-lg animate-fade-in">
              <div className="flex flex-col items-center gap-4 p-8">
                <div className="relative">
                  <Sparkles className="w-12 h-12 text-purple-400 animate-pulse" />
                  <div className="absolute inset-0 w-12 h-12 rounded-full bg-purple-500/20 animate-ping" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-lg">
                    {chunkProgress 
                      ? `Processing Section ${chunkProgress.current} of ${chunkProgress.total}...`
                      : 'Processing Story...'}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-[280px]">
                    {chunkProgress 
                      ? `Large story split into ${chunkProgress.total} sections for processing.`
                      : `AI is transforming ${storyWordCount.toLocaleString()} words. This may take 15-30 seconds for longer stories.`}
                  </p>
                </div>
                <div className="w-full max-w-[280px] space-y-2">
                  {chunkProgress ? (
                    <>
                      <Progress value={(chunkProgress.current / chunkProgress.total) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center">
                        Section {chunkProgress.current}/{chunkProgress.total} • 
                        ~{Math.ceil((chunkProgress.total - chunkProgress.current) * 20)}s remaining
                      </p>
                    </>
                  ) : (
                    <>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center">
                        {progress < 30 ? 'Reading story...' : 
                         progress < 60 ? 'Applying transformation...' : 
                         progress < 85 ? 'Generating output...' : 
                         'Finalizing...'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4 py-4">
            {/* Templates & Examples Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Saved Templates Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplatesPanel(!showTemplatesPanel)}
                className={`gap-1.5 h-8 ${showTemplatesPanel ? 'bg-purple-950/30 border-purple-500/50' : ''}`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                My Templates
                {templates.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-purple-500/20 text-purple-400">
                    {templates.length}
                  </span>
                )}
              </Button>
              
              {/* Example Commands Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-8 text-xs">
                    Quick Examples
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[300px]">
                  {EXAMPLE_COMMANDS.map((example, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={() => handleSelectExample(example.instruction)}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="font-medium text-sm">{example.label}</span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {example.instruction}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Save as Template Button */}
              {instruction.trim().length >= 3 && canAddTemplate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save as Template
                </Button>
              )}
            </div>

            {/* Templates Panel */}
            {showTemplatesPanel && (
              <div className="border border-purple-900/50 rounded-lg bg-purple-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-purple-400">
                    Saved Templates
                  </Label>
                  {!canAddTemplate && (
                    <span className="text-[10px] text-muted-foreground">
                      Max 20 templates
                    </span>
                  )}
                </div>
                
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No saved templates yet. Save an instruction to reuse it later.
                  </p>
                ) : (
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-1">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-purple-900/30 group cursor-pointer"
                          onClick={() => handleLoadTemplate(template)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{template.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {template.instruction}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {template.useCount > 0 && (
                              <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">
                                {template.useCount}×
                              </span>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleLoadTemplate(template);
                                }}>
                                  Use Template
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditDialog(template);
                                }}>
                                  <Pencil className="w-3.5 h-3.5 mr-2" />
                                  Edit Template
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTemplateToDelete(template);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Custom Instruction */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Wand2 className="w-3 h-3" />
                Your Instruction
              </Label>
              <Textarea
                placeholder="e.g., Change every instance of 'lzj' to 'xeyle' throughout the story..."
                value={instruction}
                onChange={(e) => {
                  setInstruction(e.target.value);
                  setError(null);
                }}
                disabled={isProcessing}
                className="min-h-[120px] resize-none"
              />
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>{instruction.length}/1000 characters</span>
                  {storyCharCount > 45000 && (
                    <span className="text-amber-400">
                      {Math.ceil(storyCharCount / 45000)} sections • ~{Math.ceil(storyCharCount / 45000) * 20}s
                    </span>
                  )}
                  {storyWordCount > 5000 && storyCharCount <= 45000 && (
                    <span className="text-amber-400">
                      Long story - processing may take 15-30 seconds
                    </span>
                  )}
                </div>
                {storyCharCount > 45000 && (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    📚 Large story ({storyCharCount.toLocaleString()} chars) will be processed in {Math.ceil(storyCharCount / 45000)} sections automatically.
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApply}
              disabled={isProcessing || instruction.trim().length < 3}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Apply Command
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-purple-400" />
              Save as Template
            </DialogTitle>
            <DialogDescription>
              Save this instruction for quick reuse in future AI commands.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Standard Name Fixes, Tone Adjustment..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && templateName.trim()) {
                    handleSaveTemplate();
                  }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Instruction Preview</Label>
              <div className="p-3 rounded-lg bg-muted/30 text-sm max-h-[100px] overflow-y-auto">
                {instruction}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4" />
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{templateToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This template will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!templateToEdit} onOpenChange={(open) => !open && setTemplateToEdit(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-purple-400" />
              Edit Template
            </DialogTitle>
            <DialogDescription>
              Update the name or instruction for this template.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Standard Name Fixes, Tone Adjustment..."
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Instruction</Label>
              <Textarea
                placeholder="Enter the AI command instruction..."
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <span className="text-xs text-muted-foreground">
                {editInstruction.length}/1000 characters
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateToEdit(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEditedTemplate}
              disabled={!editName.trim() || editInstruction.trim().length < 3}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
