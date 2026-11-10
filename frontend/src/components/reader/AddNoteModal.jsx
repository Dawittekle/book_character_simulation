import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquareQuote, Check } from 'lucide-react';
import { READER_THEMES } from './ReaderThemes';
import { PASTEL_HIGHLIGHT_COLORS } from './SelectionActionPill';

export default function AddNoteModal({
  isOpen,
  onClose,
  selection,
  chapterIndex = 0,
  themeId = 'parchment',
  onSaveNote,
}) {
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState('amber');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const currentTheme = READER_THEMES[themeId] || READER_THEMES.parchment;

  useEffect(() => {
    if (isOpen) {
      setNoteText('');
      setSelectedColor('amber');
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !selection) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selection?.text) return;

    setSubmitting(true);
    try {
      await onSaveNote({
        selectedText: selection.text,
        chapterIndex,
        color: selectedColor,
        note: noteText.trim() || undefined,
        locatorPayload: selection.rect ? { rect: selection.rect } : {},
      });
      onClose();
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-note-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 animate-scale-up"
        style={{
          backgroundColor: currentTheme.cardBg,
          borderColor: currentTheme.border,
          color: currentTheme.text,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: currentTheme.border }}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-500">
              <MessageSquareQuote className="w-4 h-4" />
            </div>
            <h3 id="add-note-title" className="text-sm font-serif font-semibold">
              Add Margin Note
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected text quote */}
        <div
          className="p-3 rounded-xl border text-xs italic font-serif leading-relaxed line-clamp-3 opacity-80"
          style={{ borderColor: currentTheme.border, backgroundColor: currentTheme.bg }}
        >
          “{selection.text}”
        </div>

        {/* Highlight Color Picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium opacity-70 block">Highlight Tint</label>
          <div className="flex items-center gap-2">
            {PASTEL_HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedColor(c.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs border transition-all ${
                  selectedColor === c.id
                    ? 'ring-2 ring-amber-500 border-transparent font-medium shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  borderColor: currentTheme.border,
                  backgroundColor: currentTheme.bg,
                }}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: c.dot, border: `1px solid ${c.border}` }}
                />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Note Textarea */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="note-input" className="text-xs font-medium opacity-70 block">
              Reflection
            </label>
            <textarea
              id="note-input"
              ref={textareaRef}
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Record your thoughts, reactions, or questions on this passage..."
              className="w-full p-3 rounded-xl border text-xs sm:text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
              style={{
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-medium text-xs transition-all shadow-sm active:scale-95"
            >
              {submitting ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
