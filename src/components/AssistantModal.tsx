import { useState, useEffect } from 'react';
import { X, Bot, Plus, Trash2, ArrowRight, Sparkles, MessageSquare, AlertCircle } from 'lucide-react';
import { AssistantItem, GeminiModelId } from '../types.js';
import { DEFAULT_MODEL_ID, ZOVO_MODELS, getModelDisplayName } from '../lib/models.js';
import { api } from '../lib/api.js';

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAssistant: (assistant: AssistantItem) => void;
}

export function AssistantModal({ isOpen, onClose, onSelectAssistant }: AssistantModalProps) {
  const [assistants, setAssistants] = useState<AssistantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [model, setModel] = useState<GeminiModelId>(DEFAULT_MODEL_ID);
  const [starterPrompts, setStarterPrompts] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadAssistants();
    }
  }, [isOpen]);

  const loadAssistants = async () => {
    setLoading(true);
    try {
      const res = await api.getAssistants();
      setAssistants(res.assistants || []);
    } catch (err) {
      console.error('Failed to load assistants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instructions.trim()) return;

    try {
      const parsedPrompts = starterPrompts
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const res = await api.createAssistant({
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        model,
        suggestedPrompts: parsedPrompts,
      });

      setAssistants((prev) => [res.assistant, ...prev]);
      setIsCreating(false);
      setName('');
      setDescription('');
      setInstructions('');
      setStarterPrompts('');
    } catch (err: any) {
      alert(err?.message || 'Failed to create assistant');
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteAssistant(id);
      setAssistants((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete assistant:', err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all assistants?')) return;
    setIsClearing(true);
    try {
      await api.clearAllAssistants();
      setAssistants([]);
    } catch (err) {
      console.error('Failed to clear assistants:', err);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-[var(--zovo-surface)] rounded-2xl border border-[var(--zovo-border)] shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[var(--zovo-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--zovo-surface)] border border-[var(--zovo-border)] flex items-center justify-center text-[var(--zovo-text)]">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--zovo-text)]">
                Assistants Studio
              </h2>
              <p className="text-xs text-[var(--zovo-muted)]">
                Specialized AI personas configured with custom system logic and behaviors
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {assistants.length > 0 && !isCreating && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearing}
                className="px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-950/40 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Clear all assistants"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-3 py-1.5 rounded-lg bg-[var(--zovo-text)] text-[var(--zovo-bg)] text-xs font-semibold hover:bg-[var(--zovo-text)] flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'View Assistants' : 'Create Assistant'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {isCreating ? (
            <form onSubmit={handleCreate} className="space-y-4 max-w-xl mx-auto py-2">
              <h3 className="text-sm font-semibold text-[var(--zovo-text)]">
                Configure New Assistant Persona
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--zovo-text)]">
                  Assistant Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Senior Security Auditor"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden focus:border-[var(--zovo-muted)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--zovo-text)]">
                  Model Engine
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as GeminiModelId)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] focus:outline-hidden"
                >
                  {ZOVO_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.tagline})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--zovo-text)]">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of capabilities"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--zovo-text)]">
                  System Instructions & Persona Behavior
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Define role, tone, knowledge focus, constraints, and rules..."
                  required
                  rows={5}
                  className="w-full p-3 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden focus:border-[var(--zovo-muted)] resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--zovo-text)]">
                  Starter Suggestions (One per line)
                </label>
                <textarea
                  value={starterPrompts}
                  onChange={(e) => setStarterPrompts(e.target.value)}
                  placeholder="Audit this smart contract for reentrancy vulnerabilities&#10;Explain zero-knowledge proofs mathematically"
                  rows={3}
                  className="w-full p-3 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden focus:border-[var(--zovo-muted)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[var(--zovo-text)] text-[var(--zovo-bg)] rounded-xl hover:bg-[var(--zovo-text)] transition-opacity shadow-xs cursor-pointer"
                >
                  Create Assistant
                </button>
              </div>
            </form>
          ) : assistants.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--zovo-surface)] border border-[var(--zovo-border)] flex items-center justify-center text-[var(--zovo-muted)] mx-auto">
                <Bot className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[var(--zovo-text)]">
                  No Custom Assistants
                </h4>
                <p className="text-xs text-[var(--zovo-muted)] max-w-sm mx-auto">
                  Assistants have been cleared. You can create specialized AI personas with custom system prompts whenever you need.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2 rounded-xl bg-[var(--zovo-text)] text-[var(--zovo-bg)] text-xs font-semibold hover:bg-[var(--zovo-text)] shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Custom Assistant</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {assistants.map((a) => (
                <div
                  key={a.id}
                  className="p-4 rounded-xl border border-[var(--zovo-border)] bg-[var(--zovo-bg)] flex flex-col justify-between space-y-4 hover:border-[var(--zovo-border)] transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-[var(--zovo-surface)] border border-[var(--zovo-border)] flex items-center justify-center text-[var(--zovo-text)]">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--zovo-surface)] border border-[var(--zovo-border)] font-medium text-[var(--zovo-text)]">
                          {getModelDisplayName(a.model)}
                        </span>
                        <button
                          onClick={(e) => handleDelete(a.id, e)}
                          className="p-1 text-[var(--zovo-muted)] hover:text-red-400 hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                          title="Delete Assistant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--zovo-text)]">
                        {a.name}
                      </h4>
                      <p className="text-[11px] text-[var(--zovo-muted)]">
                        {a.description || 'Specialized AI Assistant'}
                      </p>
                    </div>
                    <p className="text-[11px] text-[var(--zovo-text)] line-clamp-2 italic bg-[var(--zovo-surface)] p-2.5 rounded-md border border-[var(--zovo-border)]">
                      "{a.instructions}"
                    </p>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => {
                        onSelectAssistant(a);
                        onClose();
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-[var(--zovo-text)] text-[var(--zovo-bg)] text-xs font-semibold hover:bg-[var(--zovo-text)] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Start Chat with Assistant</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--zovo-border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-[var(--zovo-text)] text-[var(--zovo-bg)] rounded-xl hover:bg-[var(--zovo-text)] transition-opacity cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
