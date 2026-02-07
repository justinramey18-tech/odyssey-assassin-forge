import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, AlertTriangle, FileType } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  DetectedSession, 
  detectSessions, 
  splitByChunkSize, 
  parseJsonCampaign,
  countWords 
} from '@/lib/scribe/sessionDetection';

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
const WARNING_FILE_SIZE = 512 * 1024; // 500 KB
const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.json', '.log'];
const ACCEPTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'text/x-log',
];

interface CampaignFileUploadProps {
  onFileLoaded: (content: string, fileName: string, sessions: DetectedSession[]) => void;
  onClear: () => void;
  currentFile: string | null;
  fileStats: { wordCount: number; charCount: number; sessionCount: number } | null;
}

export function CampaignFileUpload({ 
  onFileLoaded, 
  onClear, 
  currentFile,
  fileStats,
}: CampaignFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processFile = useCallback(async (file: File) => {
    // Validate file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      toast({
        title: "Invalid file type",
        description: `Accepted formats: ${ACCEPTED_EXTENSIONS.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Maximum file size is 1 MB. Consider splitting your campaign into smaller files.",
        variant: "destructive",
      });
      return;
    }

    // Show warning for large files
    if (file.size > WARNING_FILE_SIZE) {
      setShowWarning(true);
    }

    setIsLoading(true);

    try {
      const text = await file.text();
      let content = text;
      let sessions: DetectedSession[] = [];

      // Handle JSON files specially
      if (extension === '.json') {
        const parsed = parseJsonCampaign(text);
        if (parsed) {
          content = parsed.text;
          sessions = parsed.sessions;
        } else {
          // If JSON parsing fails, treat as plain text
          content = text;
          sessions = detectSessions(text);
        }
      } else {
        // Detect sessions in text files
        sessions = detectSessions(text);
      }

      // If no sessions detected, fall back to chunk-based splitting
      if (sessions.length === 0 && content.length > 15000) {
        sessions = splitByChunkSize(content, 10000);
        toast({
          title: "No session markers detected",
          description: `Split into ${sessions.length} parts based on size. Processing will be done in chunks.`,
        });
      } else if (sessions.length > 0) {
        toast({
          title: "Sessions detected!",
          description: `Found ${sessions.length} session${sessions.length > 1 ? 's' : ''} in your campaign file.`,
        });
      }

      onFileLoaded(content, file.name, sessions);
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "Failed to read file",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onFileLoaded, toast]);

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

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [processFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClear = useCallback(() => {
    setShowWarning(false);
    onClear();
  }, [onClear]);

  // Show loaded file state
  if (currentFile && fileStats) {
    return (
      <Card className="border-amber-900/30 bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{currentFile}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                <span>{fileStats.wordCount.toLocaleString()} words</span>
                <span>•</span>
                <span>{(fileStats.charCount / 1024).toFixed(1)} KB</span>
                {fileStats.sessionCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-amber-400">
                      {fileStats.sessionCount} session{fileStats.sessionCount > 1 ? 's' : ''} detected
                    </span>
                  </>
                )}
              </div>
              
              {showWarning && (
                <div className="flex items-center gap-2 mt-2 text-xs text-yellow-400">
                  <AlertTriangle className="w-3 h-3" />
                  Large file - processing may take several minutes
                </div>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
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
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-amber-400 bg-amber-500/10' 
              : 'border-border/50 hover:border-amber-500/50 hover:bg-muted/30'
            }
            ${isLoading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-3">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${isDragging ? 'bg-amber-500/20' : 'bg-muted/50'}
            `}>
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className={`w-5 h-5 ${isDragging ? 'text-amber-400' : 'text-muted-foreground'}`} />
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium text-foreground">
                {isDragging ? 'Drop your file here' : 'Upload Campaign File'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Drag & drop or click to browse
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileType className="w-3 h-3" />
              <span>.txt, .md, .json, .log</span>
              <span>•</span>
              <span>Max 1 MB</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
