import { useState, useCallback, useEffect } from 'react';

export interface AICommandTemplate {
  id: string;
  name: string;
  instruction: string;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
}

const STORAGE_KEY = 'scribe-ai-command-templates';
const MAX_TEMPLATES = 20;

// Load templates from localStorage
function loadTemplates(): AICommandTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load AI command templates:', error);
  }
  return [];
}

// Save templates to localStorage
function saveTemplates(templates: AICommandTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save AI command templates:', error);
  }
}

// Generate unique ID
function generateId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface UseAICommandTemplatesReturn {
  templates: AICommandTemplate[];
  createTemplate: (name: string, instruction: string) => AICommandTemplate | null;
  deleteTemplate: (id: string) => void;
  renameTemplate: (id: string, newName: string) => void;
  updateInstruction: (id: string, newInstruction: string) => void;
  useTemplate: (id: string) => AICommandTemplate | undefined;
  canAddTemplate: boolean;
}

export function useAICommandTemplates(): UseAICommandTemplatesReturn {
  const [templates, setTemplates] = useState<AICommandTemplate[]>(() => loadTemplates());

  // Persist templates when they change
  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  const canAddTemplate = templates.length < MAX_TEMPLATES;

  const createTemplate = useCallback((
    name: string,
    instruction: string
  ): AICommandTemplate | null => {
    if (!canAddTemplate) return null;
    if (!name.trim() || !instruction.trim()) return null;

    const newTemplate: AICommandTemplate = {
      id: generateId(),
      name: name.trim(),
      instruction: instruction.trim(),
      createdAt: new Date().toISOString(),
      useCount: 0,
    };

    setTemplates(prev => [newTemplate, ...prev]);
    return newTemplate;
  }, [canAddTemplate]);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const renameTemplate = useCallback((id: string, newName: string) => {
    if (!newName.trim()) return;
    
    setTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, name: newName.trim() } : t
    ));
  }, []);

  const updateInstruction = useCallback((id: string, newInstruction: string) => {
    if (!newInstruction.trim()) return;
    
    setTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, instruction: newInstruction.trim() } : t
    ));
  }, []);

  const useTemplate = useCallback((id: string): AICommandTemplate | undefined => {
    const template = templates.find(t => t.id === id);
    if (template) {
      // Update lastUsed and increment useCount
      setTemplates(prev => prev.map(t => 
        t.id === id 
          ? { ...t, lastUsed: new Date().toISOString(), useCount: t.useCount + 1 } 
          : t
      ));
    }
    return template;
  }, [templates]);

  return {
    templates,
    createTemplate,
    deleteTemplate,
    renameTemplate,
    updateInstruction,
    useTemplate,
    canAddTemplate,
  };
}
