import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Message, Personality } from './types';
import { getPersonalityConfig } from './personalities';
import { User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  currentPersonality: Personality;
}

export function MessageList({ messages, isLoading, currentPersonality }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const config = getPersonalityConfig(currentPersonality);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <span className="text-4xl mb-3">{config.icon}</span>
        <h3 className="text-lg font-cinzel mb-2" style={{ color: config.color }}>
          {config.name}
        </h3>
        <p className="text-sm text-white/50 max-w-[250px]">
          {currentPersonality === 'thunderhead' && 
            "I observe all possible futures. Ask, and I shall calculate the optimal path."
          }
          {currentPersonality === 'jarvis' && 
            "At your service, Sir. How may I assist you today?"
          }
          {currentPersonality === 'deadpool' && 
            "Oh hey! You actually clicked on me! This is gonna be FUN. Ask me anything. Literally anything. I dare you."
          }
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      <AnimatePresence initial={false}>
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const messageConfig = message.personality 
            ? getPersonalityConfig(message.personality)
            : config;

          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                'flex gap-2',
                isUser ? 'justify-end' : 'justify-start'
              )}
            >
              {/* Avatar for assistant */}
              {!isUser && (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${messageConfig.color}30` }}
                >
                  <span className="text-sm">{messageConfig.icon}</span>
                </div>
              )}

              {/* Message bubble */}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2',
                  isUser
                    ? 'bg-white/10 text-white rounded-br-sm'
                    : cn(
                        'rounded-bl-sm',
                        message.personality === 'deadpool' && 'bg-red-950/60 border border-red-500/30',
                        message.personality === 'jarvis' && 'bg-cyan-950/60 border border-cyan-500/30',
                        message.personality === 'thunderhead' && 'bg-blue-950/60 border border-blue-500/30',
                        !message.personality && `bg-gradient-to-br ${messageConfig.bgGradient} border ${messageConfig.borderColor}`
                      )
                )}
              >
                {isUser ? (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="text-sm prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => (
                          <strong style={{ color: messageConfig.color }}>{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="text-white/70">{children}</em>
                        ),
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        code: ({ children }) => (
                          <code className="bg-black/30 px-1 rounded text-xs">{children}</code>
                        ),
                      }}
                    >
                      {message.content || '...'}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Avatar for user */}
              {isUser && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-white/70" />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Loading indicator */}
      {isLoading && messages[messages.length - 1]?.role === 'user' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-2 items-center"
        >
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${config.color}30` }}
          >
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: config.color }} />
          </div>
          <div className="text-sm text-white/50">
            {currentPersonality === 'thunderhead' && 'Calculating futures...'}
            {currentPersonality === 'jarvis' && 'Processing, Sir...'}
            {currentPersonality === 'deadpool' && 'Hold on, brain cells loading...'}
          </div>
        </motion.div>
      )}
    </div>
  );
}
