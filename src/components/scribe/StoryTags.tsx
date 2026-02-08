import { useState, useRef, useEffect } from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TAG_COLORS, getColorForTagName, TagColor } from '@/lib/scribe/storyOrganization';

interface StoryTagsProps {
  tags: string[];
  allTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  readonly?: boolean;
  compact?: boolean;
}

export function StoryTags({
  tags,
  allTags,
  onAddTag,
  onRemoveTag,
  readonly = false,
  compact = false,
}: StoryTagsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Get suggestions based on input
  const suggestions = allTags
    .filter(t => !tags.includes(t))
    .filter(t => newTag ? t.toLowerCase().includes(newTag.toLowerCase()) : true)
    .slice(0, 5);

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAddTag(trimmed);
    }
    setNewTag('');
    setIsAdding(false);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      handleAddTag(newTag);
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTag('');
      setShowSuggestions(false);
    }
  };

  const getTagStyles = (tagName: string) => {
    const color = getColorForTagName(tagName);
    return TAG_COLORS[color];
  };

  if (compact) {
    // Compact display mode - just show tag chips
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => {
          const styles = getTagStyles(tag);
          return (
            <span
              key={tag}
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border',
                styles.bg,
                styles.text,
                styles.border
              )}
            >
              {tag}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Tag chips */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => {
          const styles = getTagStyles(tag);
          return (
            <span
              key={tag}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
                styles.bg,
                styles.text,
                styles.border
              )}
            >
              <Tag className="w-3 h-3" />
              {tag}
              {!readonly && (
                <button
                  onClick={() => onRemoveTag(tag)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          );
        })}

        {/* Add tag button/input */}
        {!readonly && (
          <>
            {isAdding ? (
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={newTag}
                  onChange={(e) => {
                    setNewTag(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    // Delay to allow clicking suggestions
                    setTimeout(() => {
                      if (!newTag.trim()) {
                        setIsAdding(false);
                      }
                      setShowSuggestions(false);
                    }, 200);
                  }}
                  placeholder="Add tag..."
                  className="h-7 w-32 text-xs"
                />
                
                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-popover border border-border rounded-md shadow-lg z-50 py-1">
                    {suggestions.map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => handleAddTag(suggestion)}
                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Tag
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
