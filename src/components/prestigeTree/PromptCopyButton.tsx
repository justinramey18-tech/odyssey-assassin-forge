// Copy-to-Clipboard Button for AI DM Prompts

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PromptCopyButtonProps {
  abilityName: string;
  prompt: string;
  mechanicalContext: string;
  className?: string;
  variant?: 'default' | 'icon';
}

export function PromptCopyButton({ 
  abilityName, 
  prompt, 
  mechanicalContext,
  className,
  variant = 'default',
}: PromptCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    const fullPrompt = `[Ability: ${abilityName}]

${prompt}

${mechanicalContext}`;

    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      toast({
        title: "Prompt Copied!",
        description: `"${abilityName}" prompt copied to clipboard.`,
        className: "border-purple-500 bg-purple-500/10",
      });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className={cn(
          "h-8 w-8 text-muted-foreground hover:text-purple-400",
          copied && "text-green-400",
          className
        )}
        aria-label={copied ? "Copied!" : "Copy prompt"}
      >
        {copied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn(
        "gap-2 border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/10",
        copied && "border-green-500/50 bg-green-500/10",
        className
      )}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-400" />
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          <span>Copy Prompt</span>
        </>
      )}
    </Button>
  );
}
