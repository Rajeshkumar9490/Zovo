import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Message } from '../types.js';
import { MessageItem } from './MessageItem.js';
import { EmptyState } from './EmptyState.js';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onRegenerate: (id: string) => void;
  onEditAndResend: (id: string, content: string) => void;
}

export function MessageList({
  messages,
  isStreaming,
  onSendMessage,
  onRegenerate,
  onEditAndResend,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (isStreaming || messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages, isStreaming]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 200);
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <EmptyState onSelectPrompt={onSendMessage} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto relative divide-y divide-neutral-100/50 dark:divide-neutral-800/40"
    >
      <div className="py-4">
        {messages.map((message, index) => {
          const isLastAssistant =
            message.role === 'assistant' &&
            (index === messages.length - 1 ||
              (index === messages.length - 2 && messages[messages.length - 1].role === 'user'));

          return (
            <MessageItem
              key={message.id || index}
              message={message}
              onRegenerate={onRegenerate}
              onEditAndResend={onEditAndResend}
              isLastAssistantMessage={isLastAssistant}
              isStreaming={isStreaming && index === messages.length - 1}
            />
          );
        })}
        <div ref={bottomRef} className="h-6" />
      </div>

      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="fixed bottom-24 right-8 z-30 p-2 rounded-full bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 shadow-md border border-neutral-200 dark:border-neutral-700 hover:scale-105 transition-all"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
