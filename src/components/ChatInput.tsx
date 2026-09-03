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
  Gauge,
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
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
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
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pb-5 pt-1 relative z-20">
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
        className={`relative rounded-3xl bg-white border border-zinc-200 shadow-md dark:bg-black/90 dark:border-zinc-800/90 dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-200 backdrop-blur-md px-2.5 py-1.5 flex items-end gap-2.5 ${
          isDragging
            ? 'border-zinc-900 ring-2 ring-zinc-500/40 dark:border-white dark:ring-white/20'
            : 'hover:border-zinc-300 dark:hover:border-zinc-700 focus-within:border-zinc-400 dark:focus-within:border-zinc-600'
        }`}
      >
        {/* Left: Plus Attachment Button */}
        <button
          type="button"
          onClick={handleAttachmentButtonClick}
          disabled={isUploading}
          className="w-8.5 h-8.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer border border-transparent dark:border-zinc-800 mb-0.5"
          title="Add files, documents or images"
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
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.docx,.csv,.json"
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          onChange={handleFileInputChange}
          accept="image/*"
          className="hidden"
        />

        {/* Center: Auto-expanding Text Area */}
        <div className="flex-1 min-w-0 flex items-center py-1">
          <textarea
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
            className="w-full bg-transparent text-sm text-zinc-900 placeholder-zinc-400 dark:text-zinc-100 dark:placeholder-zinc-500 focus:outline-hidden font-sans px-1 py-0.5 resize-none max-h-36 overflow-y-auto leading-relaxed break-words whitespace-pre-wrap"
          />
        </div>

        {/* Right: Model badge, Mic, and Image/Action Button */}
        <div className="flex items-center gap-2 shrink-0 mb-0.5">
          {/* Zovo Model Selector Menu */}
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
              className="px-2.5 py-1 rounded-full text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:text-white dark:bg-zinc-900/80 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer border border-zinc-200/80 dark:border-zinc-800"
              title={`Active model: ${getModelDisplayName(activeModel)}. Click to choose.`}
            >
              <span>{getModelDisplayName(activeModel)}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
            </button>

            {/* Model Selection Floating Dropdown */}
            {isModelMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2.5 w-64 p-1.5 rounded-2xl bg-white border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 border-b border-zinc-100 dark:border-zinc-800/80 mb-1">
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Zovo Intelligence Models
                  </p>
                </div>
                <div className="space-y-1">
                  {ZOVO_MODELS.slice(0, 3).map((m) => {
                    const isSelected = activeModel === m.id;
                    const Icon =
                      m.id === 'gemini-3.7-flash'
                        ? Zap
                        : m.id === 'gemini-3.6-flash'
                        ? Gauge
                        : Brain;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onSelectModel(m.id);
                          setIsModelMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-100 text-zinc-900 border border-zinc-300 dark:bg-zinc-800 dark:text-white dark:border-zinc-700'
                            : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-900'
                        }`}
                      >
                        <div className="p-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 mt-0.5 shrink-0 text-zinc-700 dark:text-zinc-300">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-900 dark:text-white">{m.displayName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />}
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {m.tagline}
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
            className={`w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isRecording
                ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-black animate-pulse'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900'
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
              onClick={() => {
                if (input.trim() || pendingAttachments.length > 0) {
                  handleSubmit();
                } else {
                  imageInputRef.current?.click();
                }
              }}
              className="w-9 h-9 rounded-full bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 flex items-center justify-center shadow-md transition-all cursor-pointer shrink-0"
              title={
                input.trim() || pendingAttachments.length > 0
                  ? 'Send prompt'
                  : 'Attach image or photo'
              }
            >
              {input.trim() || pendingAttachments.length > 0 ? (
                <ArrowUp className="w-4.5 h-4.5 stroke-[2.5]" />
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
