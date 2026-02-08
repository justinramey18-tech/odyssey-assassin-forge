import { useState, useMemo } from 'react';
import { BookOpen, Plus, FileText, Trash2, Check, X, Pencil, ChevronRight, Filter, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { StoryTags } from './StoryTags';
import { getColorForTagName, TAG_COLORS, filterStoriesByTags } from '@/lib/scribe/storyOrganization';
import type { SavedStory } from '@/hooks/use-saved-stories';

interface StoryListSheetProps {
  stories: SavedStory[];
  activeStoryId: string | null;
  onSelectStory: (id: string) => void;
  onDeleteStory: (id: string) => void;
  onRenameStory: (id: string, newTitle: string) => void;
  onViewStory: (id: string) => void;
  onAddTag?: (storyId: string, tag: string) => void;
  onRemoveTag?: (storyId: string, tag: string) => void;
  allTags?: string[];
  trigger?: React.ReactNode;
}

export function StoryListSheet({
  stories,
  activeStoryId,
  onSelectStory,
  onDeleteStory,
  onRenameStory,
  onViewStory,
  onAddTag,
  onRemoveTag,
  allTags = [],
  trigger,
}: StoryListSheetProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const handleStartRename = (story: SavedStory) => {
    setEditingId(story.id);
    setEditingTitle(story.title);
  };

  const handleSaveRename = () => {
    if (editingId && editingTitle.trim()) {
      onRenameStory(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const toggleFilterTag = (tag: string) => {
    setFilterTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Filter and sort stories
  const filteredStories = useMemo(() => {
    let result = [...stories];
    
    // Apply tag filter
    if (filterTags.length > 0) {
      result = filterStoriesByTags(result, filterTags, 'any');
    }
    
    // Sort by last updated
    return result.sort(
      (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );
  }, [stories, filterTags]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <button 
            className={cn(
              'p-2 -mr-2 rounded-lg transition-colors relative',
              stories.length > 0 
                ? 'hover:bg-amber-900/30 text-amber-400' 
                : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <FileText className="w-5 h-5" />
            {stories.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-green-500 rounded-full border border-background flex items-center justify-center text-[10px] font-bold text-white">
                {stories.length}
              </span>
            )}
          </button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-amber-400">
            <BookOpen className="w-5 h-5" />
            Saved Stories
          </SheetTitle>
        </SheetHeader>
        
        {stories.length > 0 ? (
          <>
            {/* Tag filter */}
            {allTags.length > 0 && (
              <div className="mt-4 mb-2 flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-xs">
                      <Filter className="w-3 h-3" />
                      Filter by Tag
                      {filterTags.length > 0 && (
                        <span className="bg-primary/20 text-primary px-1.5 rounded-full text-[10px]">
                          {filterTags.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel className="text-xs">Filter by tags</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {allTags.map(tag => (
                      <DropdownMenuCheckboxItem
                        key={tag}
                        checked={filterTags.includes(tag)}
                        onCheckedChange={() => toggleFilterTag(tag)}
                      >
                        <span className="flex items-center gap-2">
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      </DropdownMenuCheckboxItem>
                    ))}
                    {filterTags.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full justify-start text-xs"
                          onClick={() => setFilterTags([])}
                        >
                          Clear filters
                        </Button>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {filterTags.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Showing {filteredStories.length} of {stories.length}
                  </span>
                )}
              </div>
            )}
            
            <ScrollArea className="h-[calc(100vh-180px)] -mx-2 px-2">
              <div className="space-y-2">
                {filteredStories.map((story) => (
                <div
                  key={story.id}
                  className={cn(
                    'group rounded-lg border p-3 transition-all',
                    activeStoryId === story.id
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-border/50 bg-card/50 hover:bg-card hover:border-border'
                  )}
                >
                  {editingId === story.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename();
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-500 hover:text-green-400"
                        onClick={handleSaveRename}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={handleCancelRename}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div 
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => {
                          onSelectStory(story.id);
                          onViewStory(story.id);
                          setOpen(false);
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {activeStoryId === story.id && (
                              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                            )}
                            <h3 className="font-medium text-sm truncate">
                              {story.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{story.wordCount.toLocaleString()} words</span>
                            <span>•</span>
                            <span className="capitalize">{story.style}</span>
                            <span>•</span>
                            <span>{new Date(story.lastUpdated).toLocaleDateString()}</span>
                          </div>
                          
                          {/* Story tags */}
                          {story.tags && story.tags.length > 0 && (
                            <div className="mt-1.5">
                              <StoryTags
                                tags={story.tags}
                                allTags={allTags}
                                onAddTag={(tag) => onAddTag?.(story.id, tag)}
                                onRemoveTag={(tag) => onRemoveTag?.(story.id, tag)}
                                compact
                                readonly
                              />
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(story);
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                          Rename
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{story.title}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this story ({story.wordCount.toLocaleString()} words). This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeleteStory(story.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}
                </div>
              ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="mt-12 text-center text-muted-foreground">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">No stories saved yet</p>
            <p className="text-xs mt-1 max-w-[240px] mx-auto">
              Generate a narrative and save it to start building your chronicle collection.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
