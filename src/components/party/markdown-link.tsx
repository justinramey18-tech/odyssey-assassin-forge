import { ExternalLink } from 'lucide-react';
import type { Components } from 'react-markdown';

const SAFE_PROTOCOLS = /^(https?:|mailto:|tel:)/i;

export const markdownLinkComponents: Components = {
  a: ({ href, children, ...rest }) => {
    const safeHref = href && SAFE_PROTOCOLS.test(href) ? href : undefined;
    if (!safeHref) {
      return <span className="underline text-muted-foreground">{children}</span>;
    }
    return (
      <a
        {...rest}
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 hover:text-primary transition-colors no-underline align-baseline max-w-full [overflow-wrap:anywhere]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate">{children}</span>
        <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
      </a>
    );
  },
};
