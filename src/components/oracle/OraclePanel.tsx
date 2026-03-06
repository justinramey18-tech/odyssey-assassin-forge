import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOracle } from '@/hooks/use-oracle';
import { getPersonalityConfig } from './personalities';
import { PersonalitySelector } from './PersonalitySelector';
import { ModeSelector } from './ModeSelector';
import { ContextChipBar } from './ContextChipBar';
import { MessageList } from './MessageList';
import { QuickPromptBar } from './QuickPromptBar';
import { CharacterContext } from './types';

interface OraclePanelProps {
  characterContext: CharacterContext;
  className?: string;
}

export function OraclePanel({ characterContext, className }: OraclePanelProps) {
  const [inputValue, setInputValue] = useState('');

  const {
    messages,
    isLoading,
    personality,
    mode,
    sendMessage,
    cancelRequest,
    clearMessages,
    switchPersonality,
    switchMode,
  } = useOracle({ characterContext });

  const config = getPersonalityConfig(personality);

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  }, [inputValue, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handlePromptClick = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-cinzel">
            <span className="text-2xl">{config.icon}</span>
            <span style={{ color: config.color }}>The Oracle</span>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearMessages}
              className="h-8 w-8 text-white/50 hover:text-white"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Personality Selector */}
      <PersonalitySelector
        selected={personality}
        onSelect={switchPersonality}
        disabled={isLoading}
      />

      {/* Mode Selector */}
      <ModeSelector
        selected={mode}
        onSelect={switchMode}
        disabled={isLoading}
      />

      {/* Context Chips */}
      <ContextChipBar
        context={characterContext}
        onChipClick={handlePromptClick}
        disabled={isLoading}
      />

      {/* Messages */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        currentPersonality={personality}
      />

      {/* Quick Prompts */}
      {messages.length === 0 && (
        <QuickPromptBar
          personality={personality}
          mode={mode}
          onPromptClick={handlePromptClick}
          disabled={isLoading}
        />
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              personality === 'deadpool'
                ? "Ask me anything. I triple-dog dare you."
                : personality === 'jarvis'
                ? "How may I assist you, Sir?"
                : "Pose your query..."
            }
            className="flex-1 bg-black/30 border-white/20 focus:border-primary"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button
              variant="outline"
              size="icon"
              onClick={cancelRequest}
              className="shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="shrink-0"
              style={{
                backgroundColor: inputValue.trim() ? config.color : undefined,
              }}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
