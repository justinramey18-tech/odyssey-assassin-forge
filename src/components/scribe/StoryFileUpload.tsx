import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import mammoth from 'mammoth';

interface StoryFileUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (content: string, mode: 'append' | 'replace') => void;
  currentWordCount: number;
}

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.docx', '.rtf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Normalize special characters (smart quotes, em dashes, etc.)
function normalizeSpecialCharacters(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/\u2014/g, '—')         // Em dash
    .replace(/\u2013/g, '–')         // En dash
    .replace(/\u2026/g, '...')       // Ellipsis
    .replace(/\u00A0/g, ' ')         // Non-breaking space
    .replace(/\r\n/g, '\n')          // Windows line endings
    .replace(/\r/g, '\n');           // Old Mac line endings
}

// Extract text from RTF content
function extractTextFromRtf(rtfContent: string): string {
  // Strip RTF control words and groups
  let text = rtfContent
    .replace(/\\par\s*/g, '\n')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-z]+\d*\s?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return text;
}

export function StoryFileUpload({
  open,
  onOpenChange,
  onImport,
  currentWordCount,
}: StoryFileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetState = useCallback(() => {
    setFileContent(null);
    setFileName(null);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File is too large (max 5MB)');
      }

      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        throw new Error(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      }

      let content: string;

      if (extension === '.docx') {
        // Parse DOCX using mammoth
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else if (extension === '.rtf') {
        // Parse RTF
        const rawContent = await file.text();
        content = extractTextFromRtf(rawContent);
      } else {
        // Plain text or markdown
        content = await file.text();
      }

      // Normalize content
      content = normalizeSpecialCharacters(content).trim();

      if (!content || content.length < 10) {
        throw new Error('File appears to be empty or contains too little text');
      }

      setFileContent(content);
      setFileName(file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read file';
      setError(message);
      toast({
        title: "Import Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleImport = useCallback((mode: 'append' | 'replace') => {
    if (!fileContent) return;
    onImport(fileContent, mode);
    handleClose();
  }, [fileContent, onImport, handleClose]);

  const importedWordCount = fileContent 
    ? fileContent.split(/\s+/).filter(Boolean).length 
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-400" />
            Import File to Story
          </DialogTitle>
          <DialogDescription>
            Upload a text file to add its content to your story.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!fileContent ? (
            <>
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-amber-900/50 hover:border-amber-500/50 rounded-lg p-8 text-center transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS.join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <p className="text-sm text-muted-foreground">Reading file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-amber-400/60" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop a file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Supported: {ACCEPTED_EXTENSIONS.join(', ')} (max 5MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              {/* File Info */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {importedWordCount.toLocaleString()} words
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content Preview */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Content Preview
                </Label>
                <ScrollArea className="h-[200px] rounded-lg border bg-muted/20 p-3">
                  <div className="text-sm font-serif whitespace-pre-wrap">
                    {fileContent.slice(0, 2000)}
                    {fileContent.length > 2000 && (
                      <span className="text-muted-foreground">
                        ... [{(fileContent.length - 2000).toLocaleString()} more characters]
                      </span>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Import Info */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Append:</strong> Adds content with a separator to your existing story ({currentWordCount.toLocaleString()} → {(currentWordCount + importedWordCount).toLocaleString()} words)
                </p>
                <p>
                  <strong>Replace:</strong> Replaces your entire story with this content ({importedWordCount.toLocaleString()} words)
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {fileContent && (
            <>
              <Button
                variant="outline"
                onClick={() => handleImport('append')}
                className="gap-2 border-amber-900/50 text-amber-400 hover:bg-amber-950/30"
              >
                Append to Story
              </Button>
              <Button
                onClick={() => handleImport('replace')}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
              >
                Replace Story
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
