import { useState, useEffect } from 'react';
import { X, Library, Plus, Star, Search, Trash2, Send, Check } from 'lucide-react';
import { PromptItem } from '../types.js';
import { api } from '../lib/api.js';

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsePrompt: (promptContent: string) => void;
}

export function PromptLibraryModal({ isOpen, onClose, onUsePrompt }: PromptLibraryModalProps) {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('Custom');

  useEffect(() => {
    if (isOpen) {
      loadPrompts();
    }
  }, [isOpen]);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const res = await api.getPrompts();
      setPrompts(res.prompts);
    } catch (err) {
      console.error('Failed to load prompts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newContent.trim()) return;

    try {
      const res = await api.createPrompt({
        name: newName.trim(),
        description: newDesc.trim(),
        content: newContent.trim(),
        category: newCategory,
      });
      setPrompts((prev) => [res.prompt, ...prev]);
      setIsCreating(false);
      setNewName('');
      setNewDesc('');
      setNewContent('');
    } catch (err: any) {
      alert(err?.message || 'Failed to create prompt');
    }
  };

  const handleToggleFavorite = async (p: PromptItem) => {
    try {
      const res = await api.updatePrompt(p.id, { isFavorite: !p.isFavorite });
      setPrompts((prev) => prev.map((item) => (item.id === p.id ? res.prompt : item)));
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    try {
      await api.deletePrompt(id);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete prompt:', err);
    }
  };

  if (!isOpen) return null;

  const categories = ['All', 'Coding', 'Analysis', 'Reasoning', 'Writing', 'Custom'];

  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-[var(--zovo-surface)] rounded-2xl border border-[var(--zovo-border)] shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[var(--zovo-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--zovo-surface)] border border-[var(--zovo-border)] flex items-center justify-center text-[var(--zovo-text)]">
              <Library className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--zovo-text)]">
                Prompt Library
              </h2>
              <p className="text-xs text-[var(--zovo-muted)]">
                Curated and custom prompts for your Zovo conversations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-3 py-1.5 rounded-lg bg-[var(--zovo-text)] text-[var(--zovo-bg)] text-xs font-semibold hover:bg-[var(--zovo-text)] flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'View Prompts' : 'New Prompt'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {isCreating ? (
            <form onSubmit={handleCreatePrompt} className="space-y-4 max-w-xl mx-auto py-2">
              <h3 className="text-sm font-semibold text-[var(--zovo-text)]">
                Create Custom Prompt
              </h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--zovo-text)]">
                  Prompt Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Code Refactor Specialist"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden focus:border-[var(--zovo-muted)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--zovo-text)]">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] focus:outline-hidden"
                >
                  <option value="Coding">Coding</option>
                  <option value="Analysis">Analysis</option>
                  <option value="Reasoning">Reasoning</option>
                  <option value="Writing">Writing</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--zovo-text)]">
                  Description
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description of what this prompt achieves"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--zovo-text)]">
                  Prompt Template Content
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Enter the full instruction template..."
                  required
                  rows={5}
                  className="w-full p-3 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden focus:border-[var(--zovo-muted)] resize-y font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[var(--zovo-text)] text-[var(--zovo-bg)] rounded-xl hover:bg-[var(--zovo-text)] transition-opacity shadow-xs"
                >
                  Save Prompt
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Category pills & search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat
                          ? 'bg-[var(--zovo-text)] text-[var(--zovo-bg)] font-semibold'
                          : 'bg-[var(--zovo-surface)] border border-[var(--zovo-border)] text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--zovo-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search prompts..."
                    className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-lg bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Prompt Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {filteredPrompts.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-[var(--zovo-border)] bg-[var(--zovo-bg)] flex flex-col justify-between space-y-3 hover:border-[var(--zovo-border)] transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--zovo-muted)]">
                          {p.category}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleFavorite(p)}
                            className={`p-1 rounded ${
                              p.isFavorite ? 'text-amber-400' : 'text-[var(--zovo-muted)] hover:text-amber-400'
                            }`}
                            title="Favorite"
                          >
                            <Star className={`w-3.5 h-3.5 ${p.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          {!p.isSystem && (
                            <button
                              onClick={() => handleDeletePrompt(p.id)}
                              className="p-1 text-[var(--zovo-muted)] hover:text-red-400 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <h4 className="text-xs font-semibold text-[var(--zovo-text)]">
                        {p.name}
                      </h4>
                      {p.description && (
                        <p className="text-[11px] text-[var(--zovo-muted)]">
                          {p.description}
                        </p>
                      )}
                      <p className="text-[11px] text-[var(--zovo-text)] line-clamp-3 bg-[var(--zovo-surface)] p-2.5 rounded-lg border border-[var(--zovo-border)] font-mono text-[10px]">
                        {p.content}
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          onUsePrompt(p.content);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--zovo-text)] text-[var(--zovo-bg)] text-xs font-semibold hover:bg-[var(--zovo-text)] flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>Use in Chat</span>
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--zovo-border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-[var(--zovo-text)] text-[var(--zovo-bg)] rounded-xl hover:bg-[var(--zovo-text)] transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
