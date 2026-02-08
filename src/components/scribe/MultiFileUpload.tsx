import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, AlertTriangle, FileType, GripVertical, ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  DetectedSession, 
  detectSessions, 
  splitByChunkSize, 
  parseJsonCampaign,
  countWords 
} from '@/lib/scribe/sessionDetection';
import mammoth from 'mammoth';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_TOTAL_SIZE = 15 * 1024 * 1024; // 15 MB total
const MAX_FILES = 10;
const WARNING_FILE_SIZE = 1024 * 1024; // 1 MB
const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.json', '.log', '.docx', '.rtf'];

export interface UploadedFile {
  id: string;
  name: string;
  content: string;
  size: number;
  sessions: DetectedSession[];
  wordCount: number;
}

interface MultiFileUploadProps {
  onFilesLoaded: (files: UploadedFile[]) => void;
  onClear: () => void;
  currentFiles: UploadedFile[];
}

// Normalize special characters
function normalizeSpecialCharacters(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2022/g, '*')
    .replace(/\u00B7/g, '*')
    .replace(/\u2023/g, '>')
    .replace(/\u25E6/g, 'o');
}

// Simple RTF text extractor
function extractTextFromRtf(rtfContent: string): string {
  let text = rtfContent;
  text = text.replace(/\{\\(?:pict|object|fonttbl|colortbl|stylesheet|info|\\*)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi, '');
  text = text.replace(/\\par\b/gi, '\n');
  text = text.replace(/\\line\b/gi, '\n');
  text = text.replace(/\\tab\b/gi, '\t');
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/\\[a-z]+(-?\d+)?\s?/gi, '');
  text = text.replace(/[{}]/g, '');
  text = text.replace(/\\\\/g, '\\');
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return normalizeSpecialCharacters(text.trim());
}

function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function MultiFileUpload({ 
  onFilesLoaded, 
  onClear, 
  currentFiles,
}: MultiFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processFile = useCallback(async (file: File): Promise<UploadedFile | null> => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      toast({
        title: "Invalid file type",
        description: `${file.name}: Accepted formats: ${ACCEPTED_EXTENSIONS.join(', ')}`,
        variant: "destructive",
      });
      return null;
    }

    if (extension === '.doc') {
      toast({
        title: "Legacy Word format",
        description: `${file.name}: Please convert .doc to .docx`,
        variant: "destructive",
      });
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `${file.name}: Maximum 5 MB per file`,
        variant: "destructive",
      });
      return null;
    }

    try {
      let content = '';
      let sessions: DetectedSession[] = [];

      if (extension === '.docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = normalizeSpecialCharacters(result.value);
        sessions = detectSessions(content);
      } else if (extension === '.rtf') {
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        const rtfContent = decoder.decode(arrayBuffer);
        content = extractTextFromRtf(rtfContent);
        sessions = detectSessions(content);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(arrayBuffer);
        content = normalizeSpecialCharacters(text);

        if (extension === '.json') {
          const parsed = parseJsonCampaign(text);
          if (parsed) {
            content = parsed.text;
            sessions = parsed.sessions;
          } else {
            sessions = detectSessions(content);
          }
        } else {
          sessions = detectSessions(content);
        }
      }

      // Chunk if no sessions detected
      if (sessions.length === 0 && content.length > 15000) {
        sessions = splitByChunkSize(content, 10000);
      }

      return {
        id: generateFileId(),
        name: file.name,
        content,
        size: file.size,
        sessions,
        wordCount: countWords(content),
      };
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      toast({
        title: "Failed to read file",
        description: `${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const handleFiles = useCallback(async (fileList: FileList) => {
    const newFiles = Array.from(fileList);
    
    // Check file count limit
    if (currentFiles.length + newFiles.length > MAX_FILES) {
      toast({
        title: "Too many files",
        description: `Maximum ${MAX_FILES} files allowed`,
        variant: "destructive",
      });
      return;
    }

    // Check total size
    const currentSize = currentFiles.reduce((sum, f) => sum + f.size, 0);
    const newSize = newFiles.reduce((sum, f) => sum + f.size, 0);
    if (currentSize + newSize > MAX_TOTAL_SIZE) {
      toast({
        title: "Total size exceeded",
        description: "Maximum combined size is 15 MB",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const processedFiles: UploadedFile[] = [];
    for (const file of newFiles) {
      const processed = await processFile(file);
      if (processed) {
        processedFiles.push(processed);
      }
    }

    if (processedFiles.length > 0) {
      const updatedFiles = [...currentFiles, ...processedFiles];
      onFilesLoaded(updatedFiles);
      
      const totalSessions = processedFiles.reduce((sum, f) => sum + f.sessions.length, 0);
      toast({
        title: `${processedFiles.length} file${processedFiles.length > 1 ? 's' : ''} loaded`,
        description: `${totalSessions} session${totalSessions !== 1 ? 's' : ''} detected`,
      });
    }

    setIsLoading(false);
  }, [currentFiles, onFilesLoaded, processFile, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  }, [handleFiles]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const moveFile = useCallback((index: number, direction: 'up' | 'down') => {
    const newFiles = [...currentFiles];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newFiles.length) return;
    
    [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
    onFilesLoaded(newFiles);
  }, [currentFiles, onFilesLoaded]);

  const removeFile = useCallback((id: string) => {
    const newFiles = currentFiles.filter(f => f.id !== id);
    if (newFiles.length === 0) {
      onClear();
    } else {
      onFilesLoaded(newFiles);
    }
  }, [currentFiles, onFilesLoaded, onClear]);

  const totalWordCount = currentFiles.reduce((sum, f) => sum + f.wordCount, 0);
  const totalSessionCount = currentFiles.reduce((sum, f) => sum + f.sessions.length, 0);
  const totalSize = currentFiles.reduce((sum, f) => sum + f.size, 0);

  // Show file list if files are loaded
  if (currentFiles.length > 0) {
    return (
      <Card className="border-amber-900/30 bg-card/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Uploaded Files ({currentFiles.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={handleClick}
                disabled={currentFiles.length >= MAX_FILES}
              >
                <Plus className="w-3 h-3" />
                Add More
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={onClear}
              >
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1.5">
              {currentFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.wordCount.toLocaleString()} words • {file.sessions.length} session{file.sessions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => moveFile(index, 'up')}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === currentFiles.length - 1}
                      onClick={() => moveFile(index, 'down')}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          {/* Summary stats */}
          <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="text-amber-400 font-medium">
              {totalSessionCount} session{totalSessionCount !== 1 ? 's' : ''} across {currentFiles.length} file{currentFiles.length !== 1 ? 's' : ''}
            </span>
            <span>•</span>
            <span>{totalWordCount.toLocaleString()} total words</span>
            <span>•</span>
            <span>{(totalSize / 1024).toFixed(1)} KB</span>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
        </CardContent>
      </Card>
    );
  }

  // Show upload dropzone
  return (
    <Card className="border-amber-900/30 bg-card/50">
      <CardContent className="p-4">
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200',
            isDragging 
              ? 'border-amber-400 bg-amber-500/10' 
              : 'border-border/50 hover:border-amber-500/50 hover:bg-muted/30',
            isLoading && 'opacity-50 pointer-events-none'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
          
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              isDragging ? 'bg-amber-500/20' : 'bg-muted/50'
            )}>
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className={cn('w-5 h-5', isDragging ? 'text-amber-400' : 'text-muted-foreground')} />
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium text-foreground">
                {isDragging ? 'Drop your files here' : 'Upload Campaign Files'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Drag & drop or click to browse • Select multiple files
              </p>
            </div>
            
            <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileType className="w-3 h-3" />
                <span>.txt, .md, .json, .docx, .rtf</span>
              </div>
              <span className="text-muted-foreground/60">Max {MAX_FILES} files, 5 MB each</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
