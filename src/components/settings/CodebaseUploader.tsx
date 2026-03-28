import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, FileCode, Loader2, Save, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSection } from './SettingsSection';
import { toast } from 'sonner';
import {
  extractAndStoreCodebase,
  getCodebaseStats,
  getCodebaseIndex,
  clearCodebase,
  saveDevAssistantInstructions,
  loadDevAssistantInstructions,
  type CodebaseIndex,
  type CodebaseFileEntry,
} from '@/lib/codebase-storage';

const DEFAULT_INSTRUCTIONS = `This is Odyssey Assassin Forge — a D&D companion app built in React, TypeScript, and Supabase. I am the sole non-technical developer. I use Lovable.dev to make code changes by giving it prompts.

When I describe a problem, give me:
1) A plain English explanation of what's wrong
2) The exact file paths involved
3) A ready-to-paste Lovable prompt that specifies exactly what to change and where

Always flag if a fix could break something else.

When writing Lovable prompts, be specific about file paths, function names, and what code to add/change/remove. Write prompts as plain text, not markdown.`;

const CATEGORY_LABELS: Record<CodebaseFileEntry['category'], string> = {
  component: 'Components',
  hook: 'Hooks',
  lib: 'Lib',
  page: 'Pages',
  'edge-function': 'Edge Functions',
  type: 'Types',
  config: 'Config',
  other: 'Other',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CodebaseUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<{ fileCount: number; totalSize: number; lastUpdated: string } | null>(null);
  const [index, setIndex] = useState<CodebaseIndex | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [instructionsLoaded, setInstructionsLoaded] = useState(false);

  useEffect(() => {
    getCodebaseStats().then(setStats);
  }, []);

  useEffect(() => {
    const saved = loadDevAssistantInstructions();
    setInstructions(saved || DEFAULT_INSTRUCTIONS);
    setInstructionsLoaded(true);
  }, []);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsExtracting(true);
    try {
      const result = await extractAndStoreCodebase(file);
      setStats({ fileCount: result.totalFiles, totalSize: result.totalSizeBytes, lastUpdated: result.extractedAt });
      setIndex(result);
      toast.success(`Codebase indexed! ${result.totalFiles} files extracted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to extract codebase');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClear = async () => {
    await clearCodebase();
    setStats(null);
    setIndex(null);
    toast.success('Codebase cleared');
  };

  const handleLoadIndex = async () => {
    const idx = await getCodebaseIndex();
    setIndex(idx);
  };

  const saveInstructions = () => {
    saveDevAssistantInstructions(instructions);
    toast.success('Instructions saved!');
  };

  const grouped = index
    ? index.files.reduce<Record<string, CodebaseFileEntry[]>>((acc, f) => {
        (acc[f.category] ??= []).push(f);
        return acc;
      }, {})
    : null;

  return (
    <div className="space-y-3">
      {/* SECTION 1 — Codebase Upload */}
      <SettingsSection title="Codebase Upload" icon={<FileCode className="w-4 h-4 text-rose-400" />} defaultOpen>
        <div className="px-2 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileSelected}
          />

          {isExtracting ? (
            <div className="flex items-center gap-2 text-amber-400 text-xs py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Extracting codebase...</span>
            </div>
          ) : stats ? (
            <div className="space-y-2">
              <p className="text-xs text-green-400">
                {stats.fileCount} files · {formatSize(stats.totalSize)} · uploaded {new Date(stats.lastUpdated).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Re-upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  onClick={handleClear}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-amber-400">No codebase uploaded yet</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3 h-3 mr-1" />
                Upload ZIP
              </Button>
            </div>
          )}
        </div>

        {/* File Index Preview (nested collapsible) */}
        {stats && (
          <div className="mt-3">
            <SettingsSection title="File Index Preview">
              <div className="px-2 space-y-3 max-h-[50vh] overflow-y-auto">
                {!index ? (
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleLoadIndex}>
                    <BookOpen className="w-3 h-3 mr-1" />
                    Load file index
                  </Button>
                ) : grouped && (
                  Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                    const files = grouped[cat];
                    if (!files?.length) return null;
                    return (
                      <div key={cat}>
                        <p className="text-xs font-cinzel font-semibold text-foreground mb-1">{label} ({files.length})</p>
                        {files.map((f) => (
                          <div key={f.path} className="flex justify-between text-[10px] text-muted-foreground leading-snug py-0.5 pl-2">
                            <span className="truncate mr-2">{f.path}</span>
                            <span className="shrink-0">{formatSize(f.sizeBytes)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </SettingsSection>
          </div>
        )}
      </SettingsSection>

      {/* SECTION 2 — Custom Instructions */}
      <SettingsSection title="Custom Instructions for Dev Assistant" icon={<BookOpen className="w-4 h-4 text-rose-400" />}>
        <div className="px-2 space-y-3">
          <p className="text-xs text-muted-foreground">
            These instructions are included in every Dev Assistant AI call. Use them to tell the AI about your app architecture, coding conventions, preferred prompt style, etc.
          </p>
          {instructionsLoaded && (
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onBlur={saveInstructions}
              className="w-full h-[200px] rounded-md border border-border/40 bg-background/50 p-3 text-xs font-mono text-muted-foreground resize-y focus:outline-none focus:ring-1 focus:ring-rose-500/50"
              spellCheck={false}
            />
          )}
          <Button variant="outline" size="sm" className="text-xs" onClick={saveInstructions}>
            <Save className="w-3 h-3 mr-1" />
            Save Instructions
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
