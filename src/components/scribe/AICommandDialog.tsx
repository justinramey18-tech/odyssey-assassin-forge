import { useState, useCallback } from 'react';
import { Wand2, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AICommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyCommand: (instruction: string) => Promise<void>;
  isProcessing: boolean;
  storyWordCount: number;
}

const EXAMPLE_COMMANDS = [
  { label: "Replace names", instruction: "Change every instance of '[old name]' to '[new name]'" },
  { label: "Change perspective", instruction: "Convert all dialogue and narration to first person perspective" },
  { label: "Add descriptions", instruction: "Add more sensory details and vivid descriptions throughout" },
  { label: "Adjust tone", instruction: "Make the overall tone more dramatic and intense" },
  { label: "Remove content", instruction: "Remove all references to [specific character or element]" },
  { label: "Expand scenes", instruction: "Expand combat scenes with more detailed action choreography" },
];

export function AICommandDialog({
  open,
  onOpenChange,
  onApplyCommand,
  isProcessing,
  storyWordCount,
}: AICommandDialogProps) {
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleApply = useCallback(async () => {
    const trimmedInstruction = instruction.trim();
    
    // Validation
    if (trimmedInstruction.length < 3) {
      setError('Please enter a more detailed instruction (at least 3 characters)');
      return;
    }
    
    if (trimmedInstruction.length > 1000) {
      setError('Instruction is too long (max 1000 characters)');
      return;
    }
    
    setError(null);
    
    try {
      await onApplyCommand(trimmedInstruction);
      setInstruction('');
      onOpenChange(false);
    } catch {
      // Error handling is done in the parent component
    }
  }, [instruction, onApplyCommand, onOpenChange]);

  const handleSelectExample = useCallback((exampleInstruction: string) => {
    setInstruction(exampleInstruction);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      setInstruction('');
      setError(null);
      onOpenChange(false);
    }
  }, [isProcessing, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Command
          </DialogTitle>
          <DialogDescription>
            Apply an AI transformation to the entire story. The AI will process all {storyWordCount.toLocaleString()} words according to your instruction.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Example Commands Dropdown */}
          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Quick Examples
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                  Select example
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[300px]">
                {EXAMPLE_COMMANDS.map((example, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => handleSelectExample(example.instruction)}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium text-sm">{example.label}</span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {example.instruction}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Custom Instruction */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Wand2 className="w-3 h-3" />
              Your Instruction
            </Label>
            <Textarea
              placeholder="e.g., Change every instance of 'lzj' to 'xeyle' throughout the story..."
              value={instruction}
              onChange={(e) => {
                setInstruction(e.target.value);
                setError(null);
              }}
              disabled={isProcessing}
              className="min-h-[120px] resize-none"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{instruction.length}/1000 characters</span>
              {storyWordCount > 5000 && (
                <span className="text-amber-400">
                  Long story - processing may take 15-30 seconds
                </span>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleApply}
            disabled={isProcessing || instruction.trim().length < 3}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Apply Command
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
