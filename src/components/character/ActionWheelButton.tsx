import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { characterPrompts, promptCategories, CharacterPrompt } from '@/lib/characterPrompts';
import { PromptEditModal } from './PromptEditModal';

interface ActionWheelButtonProps {
  characterName: string;
}

export function ActionWheelButton({ characterName }: ActionWheelButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<CharacterPrompt | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const handlePromptClick = (prompt: CharacterPrompt) => {
    setSelectedPrompt(prompt);
    setShowEditModal(true);
    setIsOpen(false);
  };

  // Group prompts by category
  const groupedPrompts = promptCategories.map(cat => ({
    category: cat,
    prompts: characterPrompts.filter(p => p.category === cat),
  }));

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Expanded Wheel Menu */}
        {isOpen && (
          <div 
            className="absolute bottom-16 right-0 w-80 max-h-[70vh] overflow-y-auto 
                       rounded-xl border-2 border-primary/50 bg-card/95 backdrop-blur-md
                       shadow-xl shadow-primary/20 animate-in slide-in-from-bottom-4 fade-in duration-300"
          >
            <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border/50 p-3">
              <h3 className="font-display text-lg text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                RP Action Prompts
              </h3>
              <p className="text-xs text-muted-foreground font-body mt-1">
                Tap a prompt to customize and copy
              </p>
            </div>

            <div className="p-2 space-y-3">
              {groupedPrompts.map(({ category, prompts }) => (
                <div key={category}>
                  <div className="text-xs font-display uppercase tracking-wider text-muted-foreground px-2 py-1">
                    {category}
                  </div>
                  <div className="space-y-1">
                    {prompts.map((prompt) => (
                      <button
                        key={prompt.id}
                        onClick={() => handlePromptClick(prompt)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg',
                          'bg-background/50 hover:bg-accent/30 border border-transparent hover:border-primary/30',
                          'transition-all duration-200 group'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{prompt.icon}</span>
                          <span className="font-body text-sm text-foreground group-hover:text-primary transition-colors">
                            {prompt.title}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main FAB Button */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="lg"
          className={cn(
            'w-14 h-14 rounded-full shadow-lg transition-all duration-300',
            isOpen 
              ? 'bg-destructive hover:bg-destructive/90 rotate-45' 
              : 'bg-primary hover:bg-primary/90 glow-gold'
          )}
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Sparkles className="w-6 h-6" />
          )}
        </Button>
      </div>

      {/* Prompt Edit Modal */}
      {selectedPrompt && (
        <PromptEditModal
          prompt={selectedPrompt}
          characterName={characterName}
          open={showEditModal}
          onOpenChange={setShowEditModal}
        />
      )}

      {/* Backdrop when open */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
