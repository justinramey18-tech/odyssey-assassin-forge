import { useState } from 'react';
import { BookOpen, Copy, Check, Wand2, FileText, Eraser } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EdgeDrawer } from './EdgeDrawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { processTextOffline, ProcessingOptions } from '@/lib/narrativeProcessor';

import type { NarrativeStyle } from '@/lib/narrativeProcessor';

const INTENSITY_LABELS: Record<number, { name: string; description: string }> = {
  1: { name: 'Subtle', description: 'Light touches, preserves original feel' },
  2: { name: 'Mild', description: 'Gentle enhancements' },
  3: { name: 'Moderate', description: 'Balanced transformation' },
  4: { name: 'Strong', description: 'Bold stylization' },
  5: { name: 'Dramatic', description: 'Maximum style intensity' },
};

const GENRE_STYLES: Record<NarrativeStyle, { name: string; description: string }> = {
  fantasy: { name: 'Fantasy', description: 'Epic high fantasy prose' },
  noir: { name: 'Noir', description: 'Dark, gritty detective style' },
  literary: { name: 'Literary', description: 'Elegant, refined prose' },
  action: { name: 'Action', description: 'Fast-paced, punchy writing' },
  salvatore: { name: 'R.A. Salvatore', description: 'Warrior poetry & blade techniques' },
  deadpool: { name: 'Deadpool', description: 'Fourth-wall-breaking chaos' },
  dark_comedy: { name: 'Dark Comedy', description: 'Gallows humor & sardonic wit' },
  subtle_absurdity: { name: 'Subtle Absurdity', description: 'Kafkaesque deadpan' },
  lovecraftian: { name: 'Lovecraftian', description: 'Cosmic dread & sanity erosion' },
  gonzo: { name: 'Gonzo', description: 'Hunter S. Thompson style' },
  hemingway: { name: 'Hemingway', description: 'Brutal minimalism' },
  custom: { name: 'Custom', description: 'Your own style guide' },
};

interface ScribeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
}

export function ScribeDrawer({ 
  open, 
  onOpenChange,
  characterName,
}: ScribeDrawerProps) {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<NarrativeStyle>('fantasy');
  const [toneIntensity, setToneIntensity] = useState(3);
  const [customStylePrompt, setCustomStylePrompt] = useState('');
  const [copied, setCopied] = useState(false);

  const handleProcess = () => {
    if (!inputText.trim()) {
      toast.error('Please paste some text to process');
      return;
    }
    
    const options: ProcessingOptions = {
      removeRolls: true,
      removeStats: true,
      removeMechanics: true,
      enhanceDescriptions: true,
      narrativeStyle: selectedGenre,
      toneIntensity,
      customStylePrompt: selectedGenre === 'custom' ? customStylePrompt : undefined,
    };
    
    const processed = processTextOffline(inputText, options);
    setOutputText(processed);
    toast.success('Narrative processed!');
  };

  const handleCopy = async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInputText('');
    setOutputText('');
  };

  const genreButtons = Object.entries(GENRE_STYLES).map(([key, config]) => ({
    id: key as NarrativeStyle,
    name: config.name,
    description: config.description,
  }));

  return (
    <EdgeDrawer
      side="right"
      open={open}
      onOpenChange={onOpenChange}
      title="Scribe"
      icon={<BookOpen className="w-5 h-5" />}
      accentColor="#d97706"
    >
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-4 pr-2">
          <p className="text-xs text-muted-foreground">
            Transform TTRPG chat logs into narrative prose
          </p>

          {/* Genre Selection */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Narrative Style
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {genreButtons.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => setSelectedGenre(genre.id)}
                  className={cn(
                    'p-2 rounded-lg border text-left transition-all',
                    selectedGenre === genre.id
                      ? 'border-amber-500/50 bg-amber-500/20'
                      : 'border-border/50 bg-card/50 hover:bg-card'
                  )}
                >
                  <span className="text-sm font-medium">{genre.name}</span>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {genre.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Style Prompt (shown when Custom is selected) */}
          {selectedGenre === 'custom' && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Wand2 className="w-3 h-3" />
                Your Style Guide
              </h3>
              <Textarea
                placeholder={`Define word replacements like:
• Replace "attacks" with "lunges viciously"
• Use "crimson spray" instead of "blood"
• "hits" -> "connects brutally"
• Say "shadows whisper" for "moves"`}
                value={customStylePrompt}
                onChange={(e) => setCustomStylePrompt(e.target.value)}
                className="min-h-[100px] text-xs resize-none border-amber-500/30 focus:border-amber-500/50"
              />
              <p className="text-[10px] text-muted-foreground">
                Define word replacements using patterns like "replace X with Y" or "X → Y"
              </p>
            </div>
          )}

          {/* Tone Intensity Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tone Intensity
              </h3>
              <span className="text-xs font-medium text-amber-400">
                {INTENSITY_LABELS[toneIntensity]?.name}
              </span>
            </div>
            <Slider
              value={[toneIntensity]}
              onValueChange={(value) => setToneIntensity(value[0])}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <p className="text-[10px] text-muted-foreground text-center">
              {INTENSITY_LABELS[toneIntensity]?.description}
            </p>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FileText className="w-3 h-3" />
              Paste Chat Log
            </h3>
            <Textarea
              placeholder="Paste your TTRPG chat log here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="min-h-[120px] text-sm resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleProcess}
              disabled={!inputText.trim()}
              className="flex-1 gap-1 bg-amber-600 hover:bg-amber-700"
            >
              <Wand2 className="w-4 h-4" />
              Process
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              className="gap-1"
            >
              <Eraser className="w-4 h-4" />
              Clear
            </Button>
          </div>

          {/* Output */}
          {outputText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <BookOpen className="w-3 h-3" />
                  Narrative Output
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="h-7 gap-1 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div 
                className="p-3 rounded-lg border bg-card/50 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto border-amber-500/30"
              >
                {outputText}
              </div>
            </div>
          )}

          {/* Quick Prompts */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Session Prompts
            </h3>
            <div className="space-y-1">
              {[
                { label: 'Session Recap', prompt: `Summarize the key events from our last session featuring ${characterName}.` },
                { label: 'Character Moment', prompt: `Describe a meaningful character moment for ${characterName} from our recent adventure.` },
                { label: 'Combat Highlight', prompt: `Narrate the most exciting combat encounter ${characterName} participated in.` },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={async () => {
                    await navigator.clipboard.writeText(item.prompt);
                    toast.success(`${item.label} prompt copied!`);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 p-2 rounded-lg',
                    'bg-card/50 hover:bg-card border border-transparent',
                    'transition-all duration-200 text-left group'
                  )}
                >
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span className="text-sm flex-1">{item.label}</span>
                  <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </EdgeDrawer>
  );
}
