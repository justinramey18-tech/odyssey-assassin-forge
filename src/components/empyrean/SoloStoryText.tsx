// Solo Empyrean: draws one DM reply with room to breathe. Spoken lines sit on their own indented
// line with a bar down the side; a paragraph that asks for a check, one about the rider's dragon,
// and a scene break each get their own look. The words themselves are never changed (story-format.ts).

import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Dices } from 'lucide-react';
import { formatStory } from '@/lib/story-format';

const MARKDOWN_PARTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="text-purple-300 font-semibold">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="text-amber-300/90">{children}</em>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-purple-500/40 pl-3 italic text-muted-foreground my-2">{children}</blockquote>
  ),
};

function SoloStoryTextInner({ text, dragonName }: { text: string; dragonName?: string | null }) {
  const pieces = useMemo(() => formatStory(text, dragonName), [text, dragonName]);
  return (
    <div className="text-sm leading-relaxed prose prose-invert max-w-none break-words overflow-wrap-anywhere space-y-3">
      {pieces.map((piece, index) => {
        if (piece.kind === 'scene') {
          return (
            <div key={index} role="separator" className="flex items-center gap-3 py-1" aria-label="Scene change">
              <span className="h-px flex-1 bg-purple-400/25" />
              <span className="text-[10px] text-purple-300/60" aria-hidden>◆</span>
              <span className="h-px flex-1 bg-purple-400/25" />
            </div>
          );
        }
        const body = <ReactMarkdown rehypePlugins={[rehypeRaw]} components={MARKDOWN_PARTS}>{piece.text}</ReactMarkdown>;
        if (piece.kind === 'dialogue') {
          return <div key={index} className="ml-3 border-l-2 border-amber-400/60 pl-3 text-amber-50">{body}</div>;
        }
        if (piece.kind === 'check') {
          return (
            <div key={index} className="flex gap-2 rounded-md border border-purple-400/30 bg-purple-500/10 px-2.5 py-2">
              <Dices className="w-4 h-4 mt-0.5 shrink-0 text-purple-300" aria-hidden />
              <div className="min-w-0">{body}</div>
            </div>
          );
        }
        if (piece.kind === 'dragon') {
          return <div key={index} className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-amber-100">{body}</div>;
        }
        return <div key={index}>{body}</div>;
      })}
    </div>
  );
}

/** One DM reply, styled. Memoized so earlier replies are not redrawn while a new one streams in. */
export const SoloStoryText = memo(SoloStoryTextInner);
