import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Trash2, Send, Loader2, Copy, Check, Wand2 } from 'lucide-react';
import { useDevAssistant } from '@/hooks/use-dev-assistant';
import { getCodebaseStats } from '@/lib/codebase-storage';

function parseMessageContent(content: string) {
  const segments: Array<{ type: 'text' | 'prompt'; value: string }> = [];
  const regex = /---LOVABLE_PROMPT_START---([\s\S]*?)---LOVABLE_PROMPT_END---/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'prompt', value: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return segments;
}

function renderTextWithCode(text: string) {
  // Handle triple backticks first, then single backticks
  const parts: React.ReactNode[] = [];
  const tripleRegex = /```([\s\S]*?)```/g;
  let lastIdx = 0;
  let match;
  let key = 0;

  while ((match = tripleRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(...renderInlineCode(text.slice(lastIdx, match.index), key));
      key += 100;
    }
    parts.push(
      <pre key={`cb-${key++}`} className="bg-zinc-900 p-3 rounded-lg overflow-x-auto text-sm font-mono text-zinc-300 my-2">
        {match[1].trim()}
      </pre>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(...renderInlineCode(text.slice(lastIdx), key));
  }
  return parts;
}

function renderInlineCode(text: string, startKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /`([^`]+)`/g;
  let lastIdx = 0;
  let match;
  let key = startKey;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<span key={`t-${key++}`} className="whitespace-pre-wrap">{text.slice(lastIdx, match.index)}</span>);
    }
    parts.push(
      <code key={`ic-${key++}`} className="font-mono bg-zinc-900 px-1 rounded text-rose-300 text-xs">{match[1]}</code>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(<span key={`t-${key++}`} className="whitespace-pre-wrap">{text.slice(lastIdx)}</span>);
  }
  return parts;
}

function LovablePromptBlock({ promptText }: { promptText: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = promptText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-2 border-amber-500/50 rounded-xl overflow-hidden my-3">
      <div className="bg-amber-500/15 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-amber-400">Lovable Prompt</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg hover:bg-amber-500/20 transition-colors"
          style={{ padding: '10px 16px', touchAction: 'manipulation', minHeight: 44 }}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-xs text-amber-300 font-medium">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="bg-zinc-950 p-4">
        <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300 leading-relaxed">{promptText}</pre>
      </div>
    </div>
  );
}

export function DevAssistantChat() {
  const { messages, isProcessing, currentPhase, sendMessage, clearChat } = useDevAssistant();
  const [input, setInput] = useState('');
  const [codebaseFileCount, setCodebaseFileCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCodebaseStats().then(s => setCodebaseFileCount(s?.fileCount ?? null));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, isProcessing, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/40">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-rose-400" />
          <span className="text-sm font-cinzel font-semibold text-rose-400">Dev Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${codebaseFileCount !== null ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
            {codebaseFileCount !== null ? `${codebaseFileCount} files indexed` : 'No codebase'}
          </span>
          <button
            onClick={clearChat}
            className="p-2 rounded-lg hover:bg-zinc-700/40 transition-colors"
            style={{ touchAction: 'manipulation', minHeight: 44, minWidth: 44 }}
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="h-[55vh] overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-zinc-500 text-center px-6 leading-relaxed">
              Ask me about bugs, features, or anything in the codebase. Upload your project ZIP above first.
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-xl px-3.5 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-500/20 border border-indigo-500/30 max-w-[85%]'
                  : 'bg-zinc-800/60 border border-zinc-700/40 max-w-[90%]'
              }`}>
                {msg.isLoading ? (
                  <div className="flex items-center gap-2 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400 shrink-0" />
                    <span className="text-xs text-zinc-400">{msg.content}</span>
                  </div>
                ) : msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-zinc-200">{msg.content}</p>
                ) : (
                  <div className="text-zinc-300 text-sm leading-relaxed">
                    {parseMessageContent(msg.content).map((seg, i) =>
                      seg.type === 'prompt' ? (
                        <LovablePromptBlock key={i} promptText={seg.value} />
                      ) : (
                        <div key={i}>{renderTextWithCode(seg.value)}</div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t border-zinc-700/40">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          placeholder="Describe your bug or question..."
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isProcessing || !input.trim()}
          className="bg-rose-500 hover:bg-rose-600 rounded-lg p-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ touchAction: 'manipulation', minHeight: 44, minWidth: 44 }}
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
