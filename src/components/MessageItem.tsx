import { useState, useRef, useEffect } from 'react';
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
  AlertCircle,
  FileText,
} from 'lucide-react';
import { getModelDisplayName } from '../lib/models.js';
import { Message } from '../types.js';
import { MessageMarkdown } from './MessageMarkdown.js';

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

  const actionClass = 'p-2 rounded-lg text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] transition-colors cursor-pointer';

  return (
    <article aria-label={isUser ? 'Your message' : 'Zovo response'} className={`group relative px-4 sm:px-6 ${isUser ? 'pt-6 pb-5' : 'pt-3 pb-8'}`}>
      <div className={`max-w-[800px] mx-auto min-w-0 ${isUser ? 'flex flex-col items-end' : ''}`}>
        {message.attachments && message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-2 mb-3 ${isUser ? 'justify-end' : ''}`}>
            {message.attachments.map(att => <div key={att.id} className="flex items-center gap-2 rounded-2xl border border-[var(--zovo-border)] bg-[var(--zovo-surface)] p-3 max-w-[260px] text-sm">
              {att.mimeType.startsWith('image/') && att.dataUrl ? <img src={att.dataUrl} alt={att.filename} className="w-12 h-12 object-cover rounded-lg" /> : <FileText className="w-6 h-6 shrink-0 text-[var(--zovo-muted)]" />}
              <div className="min-w-0"><p className="truncate text-[var(--zovo-text)]">{att.filename}</p><p className="text-xs text-[var(--zovo-muted)]">{(att.size / 1024).toFixed(0)} KB</p></div>
            </div>)}
          </div>
        )}

        {isEditing ? (
          <div className="w-full rounded-3xl bg-[var(--zovo-composer)] p-4">
            <textarea aria-label="Edit your message" value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full min-h-24 resize-y bg-transparent text-base text-[var(--zovo-text)] outline-none" />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-full text-sm hover:bg-[var(--zovo-hover)]">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-full bg-[var(--zovo-text)] text-[var(--zovo-bg)] text-sm font-medium">Send</button>
            </div>
          </div>
        ) : isUser ? (
          <div className="max-w-[88%] sm:max-w-[78%] rounded-[24px] bg-[var(--zovo-surface)] px-5 py-3 text-base leading-7 text-[var(--zovo-text)] whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</div>
        ) : (
          <div className="message-markdown text-[var(--zovo-text)]">
            <MessageMarkdown content={message.content} />
            {message.status === 'streaming' && <span aria-label="Generating response" className="inline-block w-2.5 h-2.5 rounded-full ml-1 bg-current animate-pulse" />}
          </div>
        )}

        {isUser && !isEditing && onEditAndResend && <div className="mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={handleCopy} className={actionClass} title="Copy message">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
          <button onClick={() => setIsEditing(true)} className={actionClass} title="Edit message"><Edit2 className="w-4 h-4" /></button>
        </div>}

        {message.sources && message.sources.length > 0 && <div className="mt-5 flex flex-wrap gap-2">
          {message.sources.map((source, index) => source.kind === 'document' ? <span key={index} title={source.snippet} className="px-3 py-1.5 rounded-full border border-[var(--zovo-border)] text-xs text-[var(--zovo-muted)]">{source.title}</span> : <a key={index} href={source.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--zovo-surface)] text-xs text-[var(--zovo-muted)] hover:text-[var(--zovo-text)]"><span className="truncate max-w-[220px]">{source.title || source.uri}</span><ExternalLink className="w-3 h-3" /></a>)}
        </div>}

        {message.notices && message.notices.length > 0 && <div role="status" className="mt-3 text-xs text-[var(--zovo-muted)] space-y-1">{[...new Set(message.notices)].map((notice, index) => <p key={index}>{notice}</p>)}</div>}

        {message.status === 'error' && <div role="alert" className="mt-3 p-4 rounded-2xl border border-red-400/30 bg-red-400/5 text-sm flex gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <div><p className="font-medium">Couldn’t complete this answer</p><p className="mt-1 text-[var(--zovo-muted)]">{message.error || 'Please try again.'}</p>
            {onRegenerate && <button onClick={() => onRegenerate(message.id)} className="inline-flex gap-2 items-center mt-3 rounded-full px-3 py-1.5 bg-[var(--zovo-hover)]"><RotateCcw className="w-3.5 h-3.5" />Retry</button>}
          </div>
        </div>}

        {!isUser && message.status !== 'streaming' && <div className="flex items-center gap-0.5 mt-3 -ml-2" title={message.actualModel ? `${getModelDisplayName(message.actualModel)} · ${message.actualModel}` : 'Zovo'}>
          <button onClick={handleCopy} className={actionClass} title="Copy response">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
          <button onClick={handleSpeak} className={actionClass} title={isSpeaking ? 'Stop speaking' : 'Read aloud'}>{isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
          {onRegenerate && isLastAssistantMessage && !isStreaming && <button onClick={() => onRegenerate(message.id)} className={actionClass} title="Regenerate response"><RotateCcw className="w-4 h-4" /></button>}
          <button onClick={() => setFeedback(feedback === 'up' ? null : 'up')} aria-pressed={feedback === 'up'} className={`${actionClass} ${feedback === 'up' ? 'bg-[var(--zovo-hover)]' : ''}`} title="Helpful response"><ThumbsUp className="w-4 h-4" /></button>
          <button onClick={() => setFeedback(feedback === 'down' ? null : 'down')} aria-pressed={feedback === 'down'} className={`${actionClass} ${feedback === 'down' ? 'bg-[var(--zovo-hover)]' : ''}`} title="Not helpful"><ThumbsDown className="w-4 h-4" /></button>
        </div>}
      </div>
    </article>
  );
}
