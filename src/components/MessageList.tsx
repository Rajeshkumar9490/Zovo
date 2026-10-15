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
  const followResponseRef = useRef(true);
  const previousLengthRef = useRef(0);

  const scrollToBottom = (smooth = true) => {
    followResponseRef.current = true;
    const container = containerRef.current;
    container?.scrollTo({top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto'});
  };

  useEffect(() => {
    if (messages.length !== previousLengthRef.current && messages.at(-1)?.role === 'user') followResponseRef.current = true;
    if (followResponseRef.current) scrollToBottom(false);
    previousLengthRef.current = messages.length;
  }, [messages, isStreaming]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    followResponseRef.current = distanceToBottom < 100;
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
      role="log"
      aria-label="Conversation"
      tabIndex={0}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto relative scroll-smooth [scrollbar-gutter:stable]"
    >
      <div className="pt-4 pb-6">
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
          className="sticky bottom-4 left-1/2 -translate-x-1/2 z-30 p-2.5 rounded-full bg-[var(--zovo-bg)] text-[var(--zovo-text)] border border-[var(--zovo-border)] hover:bg-[var(--zovo-hover)] transition-colors"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
