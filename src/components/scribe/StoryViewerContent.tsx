import { BookOpen, Copy, Download, FileText, Save, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { StoryTags } from './StoryTags';
import { SelectableOutput, PartialRegenerateRequest } from './SelectableOutput';
import { StoryEditModeSelector, StoryEditMode } from './StoryEditModeSelector';
import { SavedStory } from '@/hooks/use-saved-stories';

interface StoryViewerContentProps {
  activeStory: SavedStory | null;
  storyEditMode: StoryEditMode;
  onModeChange: (mode: StoryEditMode) => void;
  isApplyingCommand: boolean;
  editedContent: string;
  onEditedContentChange: (content: string) => void;
  onSaveEdits: () => void;
  onCancelEditing: () => void;
  onCopyStory: () => void;
  onDeleteStory: () => void;
  onCloseViewer: () => void;
  onShowFileUpload: () => void;
  onShowAICommand: () => void;
  onPartialRegenerate: (request: PartialRegenerateRequest) => Promise<string | null>;
  onContentChange: (content: string) => void;
  onExportStory: (format: 'txt' | 'md') => void;
  onAddTag: (storyId: string, tag: string) => void;
  onRemoveTag: (storyId: string, tag: string) => void;
  allTags: string[];
  availableStyles: Array<{ value: string; label: string }>;
  isMobile?: boolean;
}

export function StoryViewerContent({
  activeStory,
  storyEditMode,
  onModeChange,
  isApplyingCommand,
  editedContent,
  onEditedContentChange,
  onSaveEdits,
  onCancelEditing,
  onCopyStory,
  onDeleteStory,
  onCloseViewer,
  onShowFileUpload,
  onShowAICommand,
  onPartialRegenerate,
  onContentChange,
  onExportStory,
  onAddTag,
  onRemoveTag,
  allTags,
  availableStyles,
  isMobile = false,
}: StoryViewerContentProps) {
  // Dynamic height calculation for mobile drawer vs desktop sheet
  const contentHeight = isMobile ? 'h-[50vh]' : 'h-[calc(100vh-380px)]';
  
  if (!activeStory) {
    return (
      <div className="mt-8 text-center text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">No story selected.</p>
        <p className="text-xs mt-1">Generate a narrative and save it to start building your chronicle.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Story Info & Mode Controls */}
      <div className={isMobile ? "flex flex-col gap-3" : "flex items-center justify-between"}>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-1">
          <span>{new Date(activeStory.lastUpdated).toLocaleDateString()}</span>
          <span>•</span>
          <span className="capitalize">{activeStory.style}</span>
          <span>•</span>
          <span>{activeStory.wordCount.toLocaleString()} words</span>
        </div>
        <StoryEditModeSelector
          mode={storyEditMode}
          onModeChange={onModeChange}
          disabled={isApplyingCommand}
        />
      </div>
      
      {/* Story Tags */}
      <StoryTags
        tags={activeStory.tags || []}
        allTags={allTags}
        onAddTag={(tag) => onAddTag(activeStory.id, tag)}
        onRemoveTag={(tag) => onRemoveTag(activeStory.id, tag)}
      />
      
      {/* Action Buttons for Import & AI Command */}
      <div className={isMobile ? "grid grid-cols-2 gap-2" : "flex gap-2"}>
        <Button
          variant="outline"
          size="sm"
          onClick={onShowFileUpload}
          disabled={isApplyingCommand}
          className="gap-1.5 text-amber-400 border-amber-900/50 hover:border-amber-500/50 hover:text-amber-300 min-h-[44px]"
        >
          <Upload className="w-4 h-4" />
          <span className={isMobile ? "text-xs" : ""}>Import File</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onShowAICommand}
          disabled={isApplyingCommand}
          className="gap-1.5 text-purple-400 border-purple-900/50 hover:border-purple-500/50 hover:text-purple-300 min-h-[44px]"
        >
          <Sparkles className="w-4 h-4" />
          <span className={isMobile ? "text-xs" : ""}>AI Command</span>
        </Button>
      </div>
      
      {/* Content Display Based on Mode */}
      {storyEditMode === 'text' ? (
        // Text Edit Mode
        <>
          <Textarea
            value={editedContent}
            onChange={(e) => onEditedContentChange(e.target.value)}
            className={`${contentHeight} resize-none font-serif text-sm leading-relaxed bg-background/50 border-amber-900/30 focus:border-amber-500/50`}
            placeholder="Edit your story..."
            disabled={isApplyingCommand}
          />
          <div className="text-xs text-muted-foreground text-right">
            {editedContent.split(/\s+/).filter(Boolean).length} words
          </div>
        </>
      ) : storyEditMode === 'ai' ? (
        // AI Edit Mode - SelectableOutput
        <ScrollArea className={`${contentHeight} pr-4`}>
          <SelectableOutput
            text={editedContent || activeStory.content}
            onTextChange={onContentChange}
            onPartialRegenerate={onPartialRegenerate}
            isProcessing={isApplyingCommand}
            currentStyle={activeStory.style}
            availableStyles={availableStyles}
          />
        </ScrollArea>
      ) : (
        // View Mode
        <ScrollArea className={`${contentHeight} pr-4`}>
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-serif leading-relaxed">
            {activeStory.content}
          </div>
        </ScrollArea>
      )}
      
      {/* Save/Cancel Buttons for Edit Modes */}
      {storyEditMode !== 'view' && (
        <div className="flex gap-2 pt-4 border-t border-border/50">
          <Button
            onClick={onSaveEdits}
            size="sm"
            disabled={isApplyingCommand}
            className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
          <Button
            onClick={onCancelEditing}
            variant="outline"
            size="sm"
            disabled={isApplyingCommand}
            className="gap-2 min-h-[44px]"
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      )}
      
      {/* View Mode Actions */}
      {storyEditMode === 'view' && (
        <div className="flex gap-2 pt-4 border-t border-border/50">
          <Button
            onClick={onCopyStory}
            variant="outline"
            size="sm"
            className="flex-1 gap-2 min-h-[44px]"
          >
            <Copy className="w-4 h-4" />
            Copy All
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive min-h-[44px]"
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
                    onDeleteStory();
                    onCloseViewer();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Export Options */}
      {storyEditMode === 'view' && (
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => onExportStory('txt')}
            variant="outline"
            size="sm"
            className="flex-1 gap-2 text-muted-foreground hover:text-foreground min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span className={isMobile ? "text-xs" : ""}>Export .txt</span>
          </Button>
          <Button
            onClick={() => onExportStory('md')}
            variant="outline"
            size="sm"
            className="flex-1 gap-2 text-muted-foreground hover:text-foreground min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span className={isMobile ? "text-xs" : ""}>Export .md</span>
          </Button>
        </div>
      )}
    </div>
  );
}
