import { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Upload, Trash2, FileText, Search, Loader2, CheckCircle2 } from 'lucide-react';
import { KnowledgeDocument } from '../types.js';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

interface KnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KnowledgeModal({ isOpen, onClose }: KnowledgeModalProps) {
  const { isGuest, canUploadFile, recordUpload, maxGuestUploads, openAuthModal } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.getDocuments();
      setDocuments(res.documents);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) { alert('Upload documents smaller than 3 MB.'); return; }
    if (isGuest && !canUploadFile(1)) {
      onClose();
      openAuthModal(
        'register',
        `You have used all ${maxGuestUploads} free guest uploads. Please create an account or sign in to index more documents in the Knowledge Base.`
      );
      return;
    }

    setUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.uploadDocument(file);
      setDocuments((prev) => [res.document, ...prev]);
      recordUpload(1);
      setSuccessMessage(`"${file.name}" indexed successfully into ${res.document.chunkCount} knowledge chunks!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to upload and index document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete document');
    }
  };

  if (!isOpen) return null;

  const filteredDocs = documents.filter((d) =>
    d.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-[var(--zovo-surface)] rounded-2xl border border-[var(--zovo-border)] shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[var(--zovo-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--zovo-surface)] border border-[var(--zovo-border)] flex items-center justify-center text-[var(--zovo-text)]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--zovo-text)]">
                Knowledge Base (RAG)
              </h2>
              <p className="text-xs text-[var(--zovo-muted)]">
                Documents indexed here are automatically retrieved and referenced during Zovo chats
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Upload Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--zovo-border)] hover:border-[var(--zovo-border)] rounded-xl p-6 text-center cursor-pointer transition-colors bg-[var(--zovo-bg)] space-y-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                  e.target.value = '';
                }
              }}
              accept=".txt,.md,.pdf,.docx,.csv,.json"
              className="hidden"
            />
            <div className="w-10 h-10 rounded-full bg-[var(--zovo-surface)] border border-[var(--zovo-border)] flex items-center justify-center mx-auto text-[var(--zovo-text)]">
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--zovo-text)]">
                {uploading ? 'Processing & Indexing Chunks...' : 'Click or drop files to upload'}
              </p>
              <p className="text-[11px] text-[var(--zovo-muted)]">
                Supports PDF, Markdown (.md), Plain Text (.txt), Word (.docx), CSV & JSON (up to 15MB)
              </p>
            </div>
          </div>

          {/* Alerts */}
          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-300">
              {errorMessage}
            </div>
          )}

          {/* Document Search & List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--zovo-muted)]">
                Indexed Documents ({documents.length})
              </h3>
              {documents.length > 0 && (
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--zovo-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search docs..."
                    className="w-full pl-8 pr-2.5 py-1 text-xs rounded-md bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            {loading ? (
              <div className="py-8 text-center text-[var(--zovo-muted)] text-xs">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                <span>Loading indexed documents...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-8 text-center border border-[var(--zovo-border)] rounded-xl p-4 bg-[var(--zovo-bg)]">
                <FileText className="w-8 h-8 mx-auto text-[var(--zovo-muted)] mb-2" />
                <p className="text-xs text-[var(--zovo-muted)]">
                  {search ? 'No matching documents found' : 'No documents in knowledge base yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[var(--zovo-border)] bg-[var(--zovo-bg)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[var(--zovo-surface)] border border-[var(--zovo-border)] flex items-center justify-center text-[var(--zovo-muted)] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--zovo-text)] truncate">
                          {doc.filename}
                        </p>
                        <p className="text-[11px] text-[var(--zovo-muted)]">
                          {(doc.size / 1024).toFixed(0)} KB &bull; {doc.chunkCount} chunks &bull;{' '}
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-[var(--zovo-muted)] hover:text-red-400 rounded-lg hover:bg-[var(--zovo-hover)] transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--zovo-border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-[var(--zovo-text)] text-[var(--zovo-bg)] rounded-xl hover:bg-[var(--zovo-text)] transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
