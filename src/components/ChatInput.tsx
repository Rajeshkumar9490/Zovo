import { useState, useRef, useEffect, ChangeEvent, KeyboardEvent, DragEvent, ClipboardEvent } from 'react';
import {
  ArrowUp,
  Square,
  Paperclip,
  Mic,
  MicOff,
  Globe,
  X,
  FileText,
  Loader2,
  Sparkles,
  ChevronDown,
  Check,
  Zap,
  Brain,
} from 'lucide-react';
import { GeminiModelId, MessageAttachment } from '../types.js';
import { ZOVO_MODELS, getModelDisplayName } from '../lib/models.js';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

interface ChatInputProps {
  onSendMessage: (content: string, attachments?: MessageAttachment[]) => void;
  isStreaming: boolean;
  onStopGeneration: () => void;
  activeModel: GeminiModelId;
  onSelectModel: (model: GeminiModelId) => void;
  searchEnabled: boolean;
  onToggleSearch: (enabled: boolean) => void;
  pendingAttachments: MessageAttachment[];
  onAddAttachment: (att: MessageAttachment) => void;
  onRemoveAttachment: (id: string) => void;
}

export function ChatInput({
  onSendMessage,
  isStreaming,
  onStopGeneration,
  activeModel,
  onSelectModel,
  searchEnabled,
  onToggleSearch,
  pendingAttachments,
  onAddAttachment,
  onRemoveAttachment,
}: ChatInputProps) {
  const {
    isGuest,
    guestQuestionsUsed,
    guestUploadsUsed,
    maxGuestQuestions,
    maxGuestUploads,
    canAskQuestion,
    canUploadFile,
    recordQuestion,
    recordUpload,
    openAuthModal,
  } = useAuth();

  const [input, setInput] = useState('');
  const [configuredModels, setConfiguredModels] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/models', {signal: controller.signal}).then(r => r.json()).then(data => {
      setConfiguredModels(Object.fromEntries(data.models.map((m: {id: string; configured: boolean}) => [m.id, m.configured])));
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const remainingQuestions = Math.max(0, maxGuestQuestions - guestQuestionsUsed);
  const remainingUploads = Math.max(0, maxGuestUploads - guestUploadsUsed);

  // Close model menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isModelMenuOpen) return;
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setIsModelMenuOpen(false); modelButtonRef.current?.focus(); }
    };
    document.addEventListener('keydown', close);
    modelMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    return () => document.removeEventListener('keydown', close);
  }, [isModelMenuOpen]);

  // Auto resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Initialize Web Speech API for voice recognition if available
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  const handleToggleVoice = async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus('Voice input is not supported in this browser. Please type your message.');
      setTimeout(() => setVoiceStatus(null), 4000);
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsRecording(false);
      setVoiceStatus(null);
      return;
    }

    // Try requesting mic permission first
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (permErr) {
      console.warn('Microphone permission warning:', permErr);
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      let baseInput = input.trim();

      recognition.onstart = () => {
        setIsRecording(true);
        setVoiceStatus('Listening... Speak now');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(baseInput ? `${baseInput} ${transcript}` : transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setVoiceStatus('Microphone permission blocked. Please allow microphone access.');
        } else if (event.error === 'no-speech') {
          setVoiceStatus('No speech detected.');
        } else {
          setVoiceStatus(`Voice error: ${event.error}`);
        }
        setTimeout(() => setVoiceStatus(null), 4000);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setVoiceStatus(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setVoiceStatus('Could not access microphone.');
      setTimeout(() => setVoiceStatus(null), 3000);
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|heic|svg|bmp|tiff?)$/i.test(file.name)) {
      setUploadError('Zovo Fast and Zovo Flex support PDF, Word and text documents. Images are not supported.');
      return;
    }
    if (file.size > 3 * 1024 * 1024 || pendingAttachments.reduce((sum, a) => sum + a.size, file.size) > 3 * 1024 * 1024) {
      alert('Keep attachments in one message under 3 MB.'); return;
    }
    if (isGuest && !canUploadFile(1)) {
      openAuthModal(
        'register',
        `You have used all ${maxGuestUploads} free guest uploads. Please create an account or sign in to upload more files.`
      );
      return;
    }

    setIsUploading(true);
    try {
      const res = await api.uploadAttachment(file);
      onAddAttachment(res.attachment);
      recordUpload(1);
    } catch (err: any) {
      alert(err?.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (isStreaming) {
      onStopGeneration();
      return;
    }

    if (!input.trim() && pendingAttachments.length === 0) return;

    // Check guest question quota
    if (isGuest && !canAskQuestion()) {
      openAuthModal(
        'register',
        `You have reached the free guest limit of ${maxGuestQuestions} questions. Please sign in or create an account to continue chatting without limits.`
      );
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    recordQuestion();
    onSendMessage(input.trim(), pendingAttachments);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        e.preventDefault();
        handleFileUpload(file);
      }
    }
  };

  const handleAttachmentButtonClick = () => {
    if (isGuest && !canUploadFile(1)) {
      openAuthModal(
        'register',
        `You have reached the free guest limit of ${maxGuestUploads} uploads. Please sign in or create an account to upload files.`
      );
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="zovo-composer-wrap w-full max-w-[848px] mx-auto px-4 sm:px-6 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 relative z-20 shrink-0">
      {uploadError && <div role="alert" className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
        <span>{uploadError}</span>
        <button type="button" aria-label="Dismiss upload notice" onClick={() => setUploadError(null)}><X className="w-4 h-4" /></button>
      </div>}
      {/* Voice / Notification status chip */}
      {voiceStatus && (
        <div className="flex justify-center mb-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 text-white text-xs shadow-lg border border-zinc-700">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span>{voiceStatus}</span>
          </div>
        </div>
      )}

      {/* Attachment Chips Tray (if files attached) */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-2">
          {pendingAttachments.map((att) => {
            const isImg = att.mimeType.startsWith('image/');
            return (
              <div
                key={att.id}
                className="relative group flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 shadow-sm"
              >
                {isImg && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.filename}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 object-cover rounded-full"
                  />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                )}
                <span className="max-w-[140px] truncate font-medium">{att.filename}</span>
                <button
                  onClick={() => onRemoveAttachment(att.id)}
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-0.5 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Floating Capsule Input - Clean Black in dark mode */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`zovo-composer relative rounded-[28px] bg-[var(--zovo-composer)] text-[var(--zovo-text)] px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-end gap-x-2 gap-y-1 ${isDragging ? 'ring-2 ring-[var(--zovo-muted)]' : ''}`}
      >
        {/* Left: Plus Attachment Button */}
        <button
          type="button"
          onClick={handleAttachmentButtonClick}
          disabled={isUploading}
          className="order-2 sm:order-none w-10 h-10 rounded-full text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          title="Add PDF, Word or text documents"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500 dark:text-zinc-400" />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
        <input
          aria-label="Upload a file"
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          accept=".pdf,.txt,.md,.docx,.csv,.json"
          className="hidden"
        />


        {/* Center: Auto-expanding Text Area */}
        <div className="order-1 sm:order-none basis-full sm:basis-auto sm:flex-1 min-w-0 flex items-center py-2 px-2 sm:px-0">
          <textarea
            aria-label="Message Zovo"
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            onPaste={handlePaste}
            placeholder="Ask Zovo anything..."
            className="w-full bg-transparent text-base text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden font-sans px-1 py-0.5 resize-none max-h-40 overflow-y-auto leading-6 break-words whitespace-pre-wrap"
          />
        </div>

        {/* Right: Model badge, Mic, and Image/Action Button */}
        <div className="order-3 sm:order-none ml-auto flex items-center gap-1 shrink-0">
          {/* Zovo Model Selector Menu */}
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
              className="h-10 px-2.5 rounded-full text-sm text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] transition-colors flex items-center gap-1.5 cursor-pointer"
              ref={modelButtonRef}
              aria-haspopup="menu"
              aria-expanded={isModelMenuOpen}
              aria-controls="zovo-model-menu"
              title={`Active model: ${getModelDisplayName(activeModel)}. Click to choose.`}
            >
              <span>{getModelDisplayName(activeModel)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--zovo-muted)]" />
            </button>

            {/* Model Selection Floating Dropdown */}
            {isModelMenuOpen && (
              <div id="zovo-model-menu" role="menu" aria-label="Choose an AI mode" onKeyDown={e => {
                if (!['ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
                e.preventDefault();
                const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)'));
                const index = items.indexOf(document.activeElement as HTMLButtonElement);
                const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length-1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
              }} className="absolute bottom-full right-0 mb-3 w-[280px] max-w-[calc(100vw-32px)] p-2 rounded-2xl bg-[var(--zovo-sidebar)] border border-[var(--zovo-border)] shadow-xl z-50">
                <div className="px-3 py-2 border-b border-[var(--zovo-border)] mb-1">
                  <p className="text-xs font-medium text-[var(--zovo-muted)]">
                    Zovo Intelligence Models
                  </p>
                </div>
                <div className="space-y-1">
                  {ZOVO_MODELS.map((m) => {
                    const isSelected = activeModel === m.id;
                    const unavailable = configuredModels[m.id] === false;
                    const Icon =
                      m.id === 'groq/openai/gpt-oss-20b'
                        ? Zap
                        : Brain;

                    return (
                      <button
                        key={m.id}
                        role="menuitemradio"
                        aria-checked={isSelected}
                        disabled={unavailable}
                        type="button"
                        onClick={() => {
                          onSelectModel(m.id);
                          setIsModelMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-colors flex items-start gap-3 cursor-pointer disabled:opacity-50 ${
                          isSelected
                            ? 'bg-[var(--zovo-hover)] text-[var(--zovo-text)]'
                            : 'text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)]'
                        }`}
                      >
                        <div className="p-1 rounded-lg mt-0.5 shrink-0 text-[var(--zovo-text)]">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[var(--zovo-text)]">{m.displayName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[var(--zovo-text)]" />}
                          </div>
                          <p className="text-xs text-[var(--zovo-muted)] mt-1 leading-4">
                            {unavailable ? 'Setup required' : m.tagline}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Microphone Icon with blue ring when active */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isRecording
                ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-black animate-pulse'
                : 'text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)]'
            }`}
            title={isRecording ? 'Stop voice recording' : 'Voice input (click and speak)'}
          >
            {isRecording ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
          </button>

          {/* Clean Right Image / Action Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer shrink-0"
              title="Stop generating"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() && pendingAttachments.length === 0}
              className="w-10 h-10 rounded-full bg-[var(--zovo-text)] text-[var(--zovo-bg)] disabled:opacity-40 flex items-center justify-center transition-opacity shrink-0 disabled:cursor-default cursor-pointer"
              title="Send prompt"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
