import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  Edit2,
  ExternalLink,
  User,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Message } from '../types.js';
import { CodeBlock } from './CodeBlock.js';
import { ZovoLogo } from './ZovoLogo.js';

interface MessageItemProps {
  message: Message;
  onRegenerate?: (id: string) => void;
  onEditAndResend?: (id: string, content: string) => void;
  isLastAssistantMessage?: boolean;
  isStreaming?: boolean;
}

export function MessageItem({
  message,
  onRegenerate,
  onEditAndResend,
  isLastAssistantMessage,
  isStreaming,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isUser = message.role === 'user';

  useEffect(() => {
    return () => {
      if (utteranceRef.current && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for cleaner TTS
    const cleanText = message.content.replace(/[*#`_~[\]()]/g, ' ').slice(0, 4000);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    setIsEditing(false);
    if (onEditAndResend) {
      onEditAndResend(message.id, editContent.trim());
    }
  };

  return (
    <div
      className={`group relative py-3 sm:py-3.5 px-3 sm:px-5 transition-colors ${
        isUser
          ? 'bg-transparent'
          : 'bg-zinc-100/70 border-y border-zinc-200/80 dark:bg-[#0D0D0D]/60 dark:border-zinc-800/40'
      }`}
    >
      <div className="max-w-4xl mx-auto flex gap-3 sm:gap-3.5">
        {/* Avatar */}
        <div className="shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-full bg-zinc-200 border border-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700/60 dark:text-zinc-300 flex items-center justify-center font-medium text-xs shadow-xs">
              <User className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-white border border-zinc-200 dark:bg-[#090D1A] dark:border-pink-500/25 flex items-center justify-center shadow-xs overflow-hidden">
              <ZovoLogo className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Header Label */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] font-semibold text-zinc-900 dark:text-zinc-200">
                {isUser ? 'You' : 'Zovo'}
              </span>
              <span className="text-[10.5px] text-zinc-500 dark:text-zinc-500">
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {/* User message edit button */}
            {isUser && !isEditing && onEditAndResend && (
              <button
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200 p-1 rounded transition-opacity cursor-pointer"
                title="Edit message"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Attachments preview */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {message.attachments.map((att, i) => {
                const isImg = att.mimeType.startsWith('image/');
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-1.5 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#161616] text-xs shadow-2xs max-w-xs overflow-hidden"
                  >
                    {isImg && att.dataUrl ? (
                      <img
                        src={att.dataUrl}
                        alt={att.filename}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-[#202020] flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="truncate">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {att.filename}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {(att.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Message Text / Markdown */}
          {isEditing ? (
            <div className="space-y-2 pt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-3 rounded-lg border border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-[#121212] dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-1 focus:ring-blue-500 min-h-[90px] resize-y"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white rounded font-medium shadow-xs cursor-pointer"
                >
                  Save & Resend
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed break-words prose dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline ? (
                      <CodeBlock
                        language={match ? match[1] : undefined}
                        value={String(children).replace(/\n$/, '')}
                      />
                    ) : (
                      <code
                        className="px-1.5 py-0.5 rounded bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-300/80 dark:border-zinc-700/60 font-mono text-xs"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>

              {/* Streaming Cursor */}
              {message.status === 'streaming' && (
                <span className="inline-block w-2 h-4 ml-1 bg-blue-500 dark:bg-zinc-100 animate-pulse" />
              )}
            </div>
          )}

          {/* Grounding / Search Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <span>Sources & Citations:</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {message.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-[#161616] dark:text-zinc-300 dark:hover:bg-[#202020] transition-colors border border-zinc-200 dark:border-zinc-800"
                  >
                    <span className="truncate max-w-[200px]">{src.title || src.uri}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {message.status === 'error' && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-red-900 dark:text-red-200">Response Interrupted</p>
                <p className="text-zinc-700 dark:text-zinc-300">{message.error || 'Failed to complete generation. Please try again.'}</p>
                {onRegenerate && (
                  <button
                    id="btn-retry-generation"
                    onClick={() => onRegenerate(message.id)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 border border-transparent dark:border-zinc-700 rounded-md font-medium text-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Request</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Assistant Action Bar */}
          {!isUser && message.status !== 'streaming' && (
            <div className="flex items-center gap-1 pt-2 text-zinc-400 dark:text-zinc-500">
              {/* Copy */}
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                title="Copy response"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Read aloud TTS */}
              <button
                onClick={handleSpeak}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  isSpeaking ? 'text-zinc-900 bg-zinc-200 dark:text-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200'
                }`}
                title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Regenerate */}
              {onRegenerate && isLastAssistantMessage && !isStreaming && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  className="p-1.5 rounded-md hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Regenerate response"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Thumbs Feedback */}
              <button
                onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  feedback === 'up' ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40' : 'hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200'
                }`}
                title="Helpful response"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  feedback === 'down' ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/40' : 'hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200'
                }`}
                title="Not helpful"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
