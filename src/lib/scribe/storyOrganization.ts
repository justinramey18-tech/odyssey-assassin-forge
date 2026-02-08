// Story Organization - Tags and filtering utilities

export interface StoryTag {
  id: string;
  name: string;
  color: TagColor;
}

export type TagColor = 
  | 'red' 
  | 'orange' 
  | 'amber' 
  | 'green' 
  | 'teal' 
  | 'blue' 
  | 'indigo' 
  | 'purple' 
  | 'pink';

// Predefined color palette for tags
export const TAG_COLORS: Record<TagColor, { bg: string; text: string; border: string }> = {
  red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  teal: { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
};

// Get all color names
export const TAG_COLOR_OPTIONS = Object.keys(TAG_COLORS) as TagColor[];

// Storage key for custom tags
export const TAGS_STORAGE_KEY = 'scribe-story-tags';

/**
 * Load saved tags from localStorage
 */
export function loadTags(): StoryTag[] {
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as StoryTag[];
  } catch (error) {
    console.error('Failed to load tags:', error);
    return [];
  }
}

/**
 * Save tags to localStorage
 */
export function saveTags(tags: StoryTag[]): void {
  try {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch (error) {
    console.error('Failed to save tags:', error);
  }
}

/**
 * Create a new tag
 */
export function createTag(name: string, color: TagColor = 'blue'): StoryTag {
  return {
    id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    color,
  };
}

/**
 * Get a consistent color for a tag name (for auto-assignment)
 */
export function getColorForTagName(name: string): TagColor {
  // Simple hash function to get consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  const colors = TAG_COLOR_OPTIONS;
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Filter stories by selected tags
 */
export function filterStoriesByTags<T extends { tags?: string[] }>(
  stories: T[],
  selectedTags: string[],
  mode: 'any' | 'all' = 'any'
): T[] {
  if (selectedTags.length === 0) return stories;
  
  return stories.filter(story => {
    if (!story.tags || story.tags.length === 0) return false;
    
    if (mode === 'any') {
      // Story has at least one of the selected tags
      return selectedTags.some(tag => story.tags!.includes(tag));
    } else {
      // Story has all of the selected tags
      return selectedTags.every(tag => story.tags!.includes(tag));
    }
  });
}

/**
 * Get unique tags from all stories
 */
export function getUniqueTagsFromStories<T extends { tags?: string[] }>(
  stories: T[]
): string[] {
  const tagSet = new Set<string>();
  stories.forEach(story => {
    story.tags?.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

/**
 * Get suggested tags based on story title and content
 */
export function getSuggestedTags(title: string, content: string): string[] {
  const suggestions: string[] = [];
  const text = `${title} ${content}`.toLowerCase();
  
  // Character name patterns
  if (text.includes('campaign') || text.includes('session')) {
    suggestions.push('Campaign');
  }
  
  // Genre hints
  if (text.includes('dragon') || text.includes('dungeon') || text.includes('quest')) {
    suggestions.push('D&D');
  }
  
  if (text.includes('chapter') || text.includes('part')) {
    suggestions.push('Series');
  }
  
  return suggestions.slice(0, 3);
}
