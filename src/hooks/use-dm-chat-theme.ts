import { useState, useCallback, useEffect } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { DMChatThemeId, getDMChatTheme } from '@/lib/dm-chat-themes';

const STORAGE_KEY = 'odyssey-dm-chat-theme';
const DEFAULT_THEME: DMChatThemeId = 'default';

export function useDMChatTheme() {
  const [themeId, setThemeId] = useState<DMChatThemeId>(() => {
    try {
      const saved = getScopedItem(STORAGE_KEY);
      if (saved) return saved as DMChatThemeId;
    } catch (e) {
      console.error('[DMChatTheme] Failed to load:', e);
    }
    return DEFAULT_THEME;
  });

  // Persist on change
  useEffect(() => {
    try {
      setScopedItem(STORAGE_KEY, themeId);
    } catch (e) {
      console.error('[DMChatTheme] Failed to save:', e);
    }
  }, [themeId]);

  // Re-init on character switch
  useEffect(() => {
    const handleCharacterLoaded = () => {
      try {
        const saved = getScopedItem(STORAGE_KEY);
        setThemeId((saved as DMChatThemeId) || DEFAULT_THEME);
      } catch {
        setThemeId(DEFAULT_THEME);
      }
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  const setTheme = useCallback((id: DMChatThemeId) => {
    setThemeId(id);
  }, []);

  const theme = getDMChatTheme(themeId);

  return { themeId, theme, setTheme };
}
