import { useState, useCallback, useEffect } from 'react';
import {
  ProcessingTemplate,
  BlendConfig,
  ProcessingOptions,
  loadTemplates,
  saveTemplates,
  createTemplate,
  MAX_TEMPLATES,
} from '@/lib/scribe/processingTemplates';
import { EditingRule, validateRule } from '@/lib/scribe/editingRules';

interface UseProcessingTemplatesReturn {
  // Templates
  templates: ProcessingTemplate[];
  
  // CRUD operations
  saveAsTemplate: (
    name: string,
    narrativeStyle: string,
    smartParseEnabled: boolean,
    processingOptions: ProcessingOptions,
    editingRules: EditingRule[],
    blendConfig?: BlendConfig
  ) => ProcessingTemplate | null;
  
  deleteTemplate: (id: string) => void;
  renameTemplate: (id: string, newName: string) => void;
  
  // Loading
  getTemplateById: (id: string) => ProcessingTemplate | undefined;
  
  // State
  canAddTemplate: boolean;
}

export function useProcessingTemplates(): UseProcessingTemplatesReturn {
  const [templates, setTemplates] = useState<ProcessingTemplate[]>(() => loadTemplates());

  // Persist templates when they change
  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  const canAddTemplate = templates.length < MAX_TEMPLATES;

  const saveAsTemplate = useCallback((
    name: string,
    narrativeStyle: string,
    smartParseEnabled: boolean,
    processingOptions: ProcessingOptions,
    editingRules: EditingRule[],
    blendConfig?: BlendConfig
  ): ProcessingTemplate | null => {
    if (!canAddTemplate) return null;
    if (!name.trim()) return null;

    const newTemplate = createTemplate(
      name,
      narrativeStyle,
      smartParseEnabled,
      processingOptions,
      editingRules,
      blendConfig
    );

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

  const getTemplateById = useCallback((id: string): ProcessingTemplate | undefined => {
    const template = templates.find(t => t.id === id);
    if (template) {
      // Update lastUsed timestamp
      setTemplates(prev => prev.map(t => 
        t.id === id ? { ...t, lastUsed: new Date().toISOString() } : t
      ));
    }
    return template;
  }, [templates]);

  return {
    templates,
    saveAsTemplate,
    deleteTemplate,
    renameTemplate,
    getTemplateById,
    canAddTemplate,
  };
}
