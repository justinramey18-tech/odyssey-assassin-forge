import { useState } from 'react';
import { Settings, User, Layers, Dices } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FloatingOverlaySettings } from './FloatingOverlaySettings';
import { DiceOddsWidget } from './DiceOddsWidget';
import { DiceOddsMode, loadDiceOddsMode } from '@/lib/diceOdds';

interface SettingsModalProps {
  characterName: string;
  onEditCharacter: () => void;
}

export function SettingsModal({ characterName, onEditCharacter }: SettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [diceOddsMode, setDiceOddsMode] = useState<DiceOddsMode>(() => loadDiceOddsMode());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 border border-muted/40 hover:bg-muted/20 font-cinzel uppercase tracking-wider text-[9px] px-3"
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 font-cinzel">
            <Settings className="w-5 h-5 text-primary" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="app" className="flex-1">
          <TabsList className="w-full justify-start gap-1 p-2 bg-muted/20 border-b border-border/30 rounded-none">
            <TabsTrigger value="app" className="gap-1 text-xs">
              <Layers className="w-3.5 h-3.5" />
              App
            </TabsTrigger>
            <TabsTrigger value="character" className="gap-1 text-xs">
              <User className="w-3.5 h-3.5" />
              Character
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-1 text-xs">
              <Dices className="w-3.5 h-3.5" />
              Dice
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh]">
            <div className="p-4">
              <TabsContent value="app" className="mt-0 space-y-4">
                {/* Floating Overlay Settings */}
                <FloatingOverlaySettings />

                {/* Future app settings can go here */}
                <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
                  More app settings coming soon
                </div>
              </TabsContent>

              <TabsContent value="character" className="mt-0 space-y-4">
                {/* Character Name Display */}
                <div className="p-4 rounded-lg border border-border/50 bg-card/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Character</p>
                      <p className="font-cinzel font-bold text-lg">{characterName || 'Unnamed'}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        onEditCharacter();
                      }}
                    >
                      Edit Character
                    </Button>
                  </div>
                </div>

                <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
                  Character editing opens the setup wizard
                </div>
              </TabsContent>

              <TabsContent value="tools" className="mt-0 space-y-4">
                {/* Dice Odds Widget */}
                <DiceOddsWidget value={diceOddsMode} onChange={setDiceOddsMode} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
