import { lazy, Suspense, type ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadOrReload } from '@/lib/lazyPanel';
import type { StandalonePartyDMScreen as PartyScreen } from './StandalonePartyDMScreen';

// The Party DM screen and everything under it load only when a party is opened, so the
// app starts faster for everyone. While the code arrives (usually a split second), a dark
// screen with a spinner sits where the table will appear.
const Lazy = lazy(() =>
  loadOrReload(() => import('./StandalonePartyDMScreen')).then(m => ({ default: m.StandalonePartyDMScreen })),
);

export function LazyStandalonePartyDMScreen(props: ComponentProps<typeof PartyScreen>) {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            props.embedded ? 'absolute inset-0' : 'fixed inset-0 z-[60]',
            'flex items-center justify-center bg-[#0f0f1a]',
          )}
        >
          <Loader2 className="w-7 h-7 text-amber-400 animate-spin" aria-label="Opening the table" />
        </div>
      }
    >
      <Lazy {...props} />
    </Suspense>
  );
}
