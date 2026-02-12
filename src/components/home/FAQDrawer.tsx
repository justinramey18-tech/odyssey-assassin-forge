import { useCallback, useRef } from 'react';
import { HelpCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FAQ_ITEMS } from '@/lib/faq-data';

interface FAQDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FAQDrawer({ open, onOpenChange }: FAQDrawerProps) {
  const touchStart = useRef<{ y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { y: e.touches[0].clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const diffY = e.changedTouches[0].clientY - touchStart.current.y;
    const velocity = diffY / (Date.now() - touchStart.current.time);
    // Fast downward swipe (>100px or high velocity)
    if (diffY > 100 || velocity > 0.5) {
      onOpenChange(false);
    }
    touchStart.current = null;
  }, [onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] overflow-hidden flex flex-col rounded-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-3 shrink-0" />
        <SheetTitle className="font-cinzel text-base flex items-center gap-2 mb-1">
          <HelpCircle className="w-4 h-4 text-primary" />
          Help & FAQ
        </SheetTitle>
        <p className="text-xs text-muted-foreground mb-4">
          {FAQ_ITEMS.length} categories • {FAQ_ITEMS.reduce((sum, cat) => sum + cat.questions.length, 0)} questions
        </p>

        <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((category, catIdx) => (
              <AccordionItem
                key={catIdx}
                value={`category-${catIdx}`}
                className="border border-border/40 rounded-lg bg-card/30 overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 text-left">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary border-primary/30"
                    >
                      {category.questions.length}
                    </Badge>
                    <span className="font-display font-semibold text-sm">
                      {category.category}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <div className="border-t border-border/30 bg-background/50">
                    <Accordion type="single" collapsible className="divide-y divide-border/20">
                      {category.questions.map((item, qIdx) => (
                        <AccordionItem
                          key={qIdx}
                          value={`q-${catIdx}-${qIdx}`}
                          className="border-0"
                        >
                          <AccordionTrigger className="px-4 py-3 text-sm text-left hover:no-underline hover:bg-muted/20 transition-colors gap-3">
                            <span className="text-foreground/90">{item.q}</span>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pt-0">
                            <div className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 ml-1 pl-3">
                              {item.a}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}
