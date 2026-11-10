import React, { useState } from 'react';
import { Highlighter, MessageSquareQuote, Bookmark, Copy, Sparkles, X } from 'lucide-react';
import { READER_THEMES } from './ReaderThemes';

export const PASTEL_HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Yellow', bg: 'bg-yellow-300', dot: '#fde047', border: '#eab308' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-400', dot: '#fbbf24', border: '#d97706' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-300', dot: '#f43f5e', border: '#e11d48' },
  { id: 'sage', label: 'Sage', bg: 'bg-emerald-300', dot: '#34d399', border: '#059669' },
];

export default function SelectionActionPill({
  selection,
  themeId = 'parchment',
  onHighlight,
  onAddNote,
  onBookmark,
  onAskCharacter,
  onClear,
}) {
  if (!selection || !selection.text) return null;

  const currentTheme = READER_THEMES[themeId] || READER_THEMES.parchment;
  const rect = selection.rect;

  // Compute fixed position above the selection
  const top = rect ? Math.max(12, rect.top - 54) : 80;
  const left = rect ? Math.max(12, Math.min(window.innerWidth - 380, rect.left + rect.width / 2 - 180)) : 100;

  const handleCopy = () => {
    navigator.clipboard.writeText(selection.text);
    if (onClear) onClear();
  };

  return (
    <div
      style={{
        top: `${top}px`,
        left: `${left}px`,
        backgroundColor: currentTheme.cardBg,
        borderColor: currentTheme.border,
        color: currentTheme.text,
      }}
      className="fixed z-50 flex items-center gap-1.5 p-1.5 rounded-2xl shadow-2xl border backdrop-blur-md animate-scale-up select-none"
    >
      {/* ✦ Ask a Character (Featured button) */}
      <button
        onClick={() => onAskCharacter && onAskCharacter(selection)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs shadow-sm transition-all active:scale-95"
        title="Discuss passage with book characters"
        aria-label="Ask Character"
      >
        <Sparkles className="w-3.5 h-3.5 fill-current" />
        <span>Ask Character</span>
      </button>

      <div className="h-4 w-px bg-current opacity-20 mx-0.5" />

      {/* Pastel Highlight Swatches */}
      <div className="flex items-center gap-1 px-1">
        {PASTEL_HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => onHighlight && onHighlight(selection, c.id)}
            className="w-4 h-4 rounded-full transition-transform hover:scale-125 active:scale-95 shadow-xs"
            style={{ backgroundColor: c.dot, border: `1.5px solid ${c.border}` }}
            title={`Highlight in ${c.label}`}
            aria-label={`Highlight in ${c.label}`}
          />
        ))}
      </div>

      <div className="h-4 w-px bg-current opacity-20 mx-0.5" />

      {/* Note button */}
      <button
        onClick={() => onAddNote && onAddNote(selection)}
        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        title="Add reflection note"
        aria-label="Add note"
      >
        <MessageSquareQuote className="w-4 h-4" />
      </button>

      {/* Bookmark */}
      <button
        onClick={() => onBookmark && onBookmark(selection)}
        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        title="Bookmark location"
        aria-label="Bookmark location"
      >
        <Bookmark className="w-4 h-4" />
      </button>

      {/* Copy */}
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        title="Copy text"
        aria-label="Copy text"
      >
        <Copy className="w-4 h-4" />
      </button>

      {/* Dismiss */}
      <button
        onClick={onClear}
        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-60 hover:opacity-100 transition-colors"
        title="Dismiss selection"
        aria-label="Dismiss selection"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
