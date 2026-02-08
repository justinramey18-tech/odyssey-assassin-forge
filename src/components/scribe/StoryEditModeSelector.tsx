import { Eye, Pencil, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type StoryEditMode = 'view' | 'text' | 'ai';

interface StoryEditModeSelectorProps {
  mode: StoryEditMode;
  onModeChange: (mode: StoryEditMode) => void;
  disabled?: boolean;
}

const MODES = [
  {
    value: 'view' as const,
    label: 'View',
    description: 'Read-only view',
    icon: Eye,
    color: 'text-muted-foreground',
  },
  {
    value: 'text' as const,
    label: 'Text Edit',
    description: 'Direct text editing',
    icon: Pencil,
    color: 'text-amber-400',
  },
  {
    value: 'ai' as const,
    label: 'AI Edit',
    description: 'Select text to regenerate',
    icon: Sparkles,
    color: 'text-purple-400',
  },
];

export function StoryEditModeSelector({
  mode,
  onModeChange,
  disabled = false,
}: StoryEditModeSelectorProps) {
  const currentMode = MODES.find(m => m.value === mode) || MODES[0];
  const CurrentIcon = currentMode.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "gap-2 min-w-[120px] justify-between",
            mode === 'ai' && "border-purple-500/50 bg-purple-950/20",
            mode === 'text' && "border-amber-500/50 bg-amber-950/20"
          )}
        >
          <span className="flex items-center gap-1.5">
            <CurrentIcon className={cn("w-4 h-4", currentMode.color)} />
            <span className={currentMode.color}>{currentMode.label}</span>
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {MODES.map((modeOption) => {
          const Icon = modeOption.icon;
          return (
            <DropdownMenuItem
              key={modeOption.value}
              onClick={() => onModeChange(modeOption.value)}
              className={cn(
                "flex items-start gap-3 p-3 cursor-pointer",
                mode === modeOption.value && "bg-accent"
              )}
            >
              <Icon className={cn("w-4 h-4 mt-0.5", modeOption.color)} />
              <div className="flex flex-col gap-0.5">
                <span className={cn("font-medium text-sm", modeOption.color)}>
                  {modeOption.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {modeOption.description}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
