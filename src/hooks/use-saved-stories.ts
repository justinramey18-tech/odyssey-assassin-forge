import { useState, useCallback, useEffect } from 'react';
import { getScopedItem, setScopedItem, removeScopedItem, migrateToScoped } from '@/lib/scoped-storage';

const SAVED_STORIES_KEY = 'narrative-forge-saved-stories';
const ACTIVE_STORY_KEY = 'narrative-forge-active-story-id';

// Migration key for old single-story format
const LEGACY_STORY_KEY = 'narrative-forge-saved-story';

export interface SavedStory {
  id: string;
  title: string;
  content: string;
  lastUpdated: string;
  createdAt: string;
  style: string;
  wordCount: number;
  tags: string[];  // NEW: array of tag names
}

export interface MergeOptions {
  newTitle: string;
  separator: '---' | '***' | 'chapter' | 'none';
  preserveOriginals: boolean;
  inheritTags: boolean;
}

interface UseSavedStoriesReturn {
  stories: SavedStory[];
  activeStoryId: string | null;
  activeStory: SavedStory | null;
  setActiveStoryId: (id: string | null) => void;
  createStory: (title: string, content: string, style: string, tags?: string[]) => SavedStory;
  updateStory: (id: string, updates: Partial<Omit<SavedStory, 'id' | 'createdAt'>>) => void;
  appendToStory: (id: string, content: string) => void;
  deleteStory: (id: string) => void;
  renameStory: (id: string, newTitle: string) => void;
  getStoryById: (id: string) => SavedStory | undefined;
  addTagToStory: (id: string, tag: string) => void;
  removeTagFromStory: (id: string, tag: string) => void;
  getAllTags: () => string[];
  mergeStories: (orderedIds: string[], options: MergeOptions) => SavedStory | null;
}

function generateId(): string {
  return `story-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function useSavedStories(): UseSavedStoriesReturn {
  const [stories, setStories] = useState<SavedStory[]>([]);
  const [activeStoryId, setActiveStoryIdState] = useState<string | null>(null);

  // Load stories from localStorage on mount, including migration from legacy format
  useEffect(() => {
    // Migrate unscoped data if needed
    migrateToScoped(SAVED_STORIES_KEY);
    migrateToScoped(ACTIVE_STORY_KEY);
    // Try to load new format first
    const stored = getScopedItem(SAVED_STORIES_KEY);
    let loadedStories: SavedStory[] = [];
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Ensure all stories have tags array (migration for older stories)
        loadedStories = parsed.map((story: SavedStory) => ({
          ...story,
          tags: story.tags || [],
        }));
      } catch (e) {
        console.error('Failed to parse saved stories:', e);
      }
    }
    
    // Migrate from legacy single-story format if no stories exist
    if (loadedStories.length === 0) {
      const legacyStory = getScopedItem(LEGACY_STORY_KEY);
      if (legacyStory) {
        try {
          const legacy = JSON.parse(legacyStory);
          const migratedStory: SavedStory = {
            id: generateId(),
            title: legacy.title || 'Untitled Story',
            content: legacy.content || '',
            lastUpdated: legacy.lastUpdated || new Date().toISOString(),
            createdAt: legacy.lastUpdated || new Date().toISOString(),
            style: legacy.style || 'fantasy',
            wordCount: countWords(legacy.content || ''),
            tags: legacy.tags || [],
          };
          loadedStories = [migratedStory];
          // Save migrated data and remove legacy key
          setScopedItem(SAVED_STORIES_KEY, JSON.stringify(loadedStories));
          removeScopedItem(LEGACY_STORY_KEY);
          console.log('Migrated legacy story to new format');
        } catch (e) {
          console.error('Failed to migrate legacy story:', e);
        }
      }
    }
    
    setStories(loadedStories);
    
    // Load active story ID
    const activeId = getScopedItem(ACTIVE_STORY_KEY);
    if (activeId && loadedStories.some(s => s.id === activeId)) {
      setActiveStoryIdState(activeId);
    } else if (loadedStories.length > 0) {
      // Default to most recently updated story
      const mostRecent = loadedStories.sort(
        (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      )[0];
      setActiveStoryIdState(mostRecent.id);
    }
  }, []);

  // Persist stories to localStorage whenever they change
  const persistStories = useCallback((updatedStories: SavedStory[]) => {
    setScopedItem(SAVED_STORIES_KEY, JSON.stringify(updatedStories));
    setStories(updatedStories);
  }, []);

  const setActiveStoryId = useCallback((id: string | null) => {
    if (id) {
      setScopedItem(ACTIVE_STORY_KEY, id);
    } else {
      removeScopedItem(ACTIVE_STORY_KEY);
    }
    setActiveStoryIdState(id);
  }, []);

  const createStory = useCallback((title: string, content: string, style: string, tags: string[] = []): SavedStory => {
    const now = new Date().toISOString();
    const newStory: SavedStory = {
      id: generateId(),
      title,
      content,
      lastUpdated: now,
      createdAt: now,
      style,
      wordCount: countWords(content),
      tags,
    };
    
    const updatedStories = [newStory, ...stories];
    persistStories(updatedStories);
    setActiveStoryId(newStory.id);
    
    return newStory;
  }, [stories, persistStories, setActiveStoryId]);

  const updateStory = useCallback((id: string, updates: Partial<Omit<SavedStory, 'id' | 'createdAt'>>) => {
    const updatedStories = stories.map(story => {
      if (story.id !== id) return story;
      
      const updatedContent = updates.content ?? story.content;
      return {
        ...story,
        ...updates,
        lastUpdated: new Date().toISOString(),
        wordCount: countWords(updatedContent),
      };
    });
    
    persistStories(updatedStories);
  }, [stories, persistStories]);

  const appendToStory = useCallback((id: string, content: string) => {
    const story = stories.find(s => s.id === id);
    if (!story) return;
    
    const newContent = story.content + '\n\n---\n\n' + content;
    updateStory(id, { content: newContent });
  }, [stories, updateStory]);

  const deleteStory = useCallback((id: string) => {
    const updatedStories = stories.filter(s => s.id !== id);
    persistStories(updatedStories);
    
    // If deleted story was active, switch to another
    if (activeStoryId === id) {
      const nextStory = updatedStories[0];
      setActiveStoryId(nextStory?.id || null);
    }
  }, [stories, activeStoryId, persistStories, setActiveStoryId]);

  const renameStory = useCallback((id: string, newTitle: string) => {
    updateStory(id, { title: newTitle });
  }, [updateStory]);

  const getStoryById = useCallback((id: string): SavedStory | undefined => {
    return stories.find(s => s.id === id);
  }, [stories]);

  const addTagToStory = useCallback((id: string, tag: string) => {
    const story = stories.find(s => s.id === id);
    if (!story) return;
    
    const normalizedTag = tag.trim();
    if (!normalizedTag || story.tags.includes(normalizedTag)) return;
    
    updateStory(id, { tags: [...story.tags, normalizedTag] });
  }, [stories, updateStory]);

  const removeTagFromStory = useCallback((id: string, tag: string) => {
    const story = stories.find(s => s.id === id);
    if (!story) return;
    
    updateStory(id, { tags: story.tags.filter(t => t !== tag) });
  }, [stories, updateStory]);

  const getAllTags = useCallback((): string[] => {
    const tagSet = new Set<string>();
    stories.forEach(story => {
      story.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [stories]);

  const mergeStories = useCallback((orderedIds: string[], options: MergeOptions): SavedStory | null => {
    if (orderedIds.length < 2) return null;
    
    const storiesToMerge = orderedIds
      .map(id => stories.find(s => s.id === id))
      .filter((s): s is SavedStory => s !== undefined);
    
    if (storiesToMerge.length < 2) return null;
    
    // Get separator text
    const separatorText = options.separator === '---' ? '\n\n---\n\n'
      : options.separator === '***' ? '\n\n***\n\n'
      : options.separator === 'chapter' ? '\n\n'
      : '\n\n';
    
    // Build merged content
    const mergedContent = storiesToMerge
      .map((story, idx) => {
        if (options.separator === 'chapter') {
          return `## Chapter ${idx + 1}: ${story.title}\n\n${story.content}`;
        }
        return story.content;
      })
      .join(separatorText);
    
    // Collect all tags if inheriting
    const mergedTags = options.inheritTags
      ? Array.from(new Set(storiesToMerge.flatMap(s => s.tags || [])))
      : [];
    
    // Use the style from the first story
    const primaryStyle = storiesToMerge[0].style;
    
    // Create the merged story
    const newStory = createStory(options.newTitle, mergedContent, primaryStyle, mergedTags);
    
    // Delete originals if not preserving
    if (!options.preserveOriginals) {
      orderedIds.forEach(id => {
        if (id !== newStory.id) {
          deleteStory(id);
        }
      });
    }
    
    return newStory;
  }, [stories, createStory, deleteStory]);

  const activeStory = activeStoryId ? stories.find(s => s.id === activeStoryId) || null : null;

  return {
    stories,
    activeStoryId,
    activeStory,
    setActiveStoryId,
    createStory,
    updateStory,
    appendToStory,
    deleteStory,
    renameStory,
    getStoryById,
    addTagToStory,
    removeTagFromStory,
    getAllTags,
    mergeStories,
  };
}
