import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { READER_THEMES } from './ReaderThemes';

const SHORTCUTS = [
  { key: '→ / PageDown', label: 'Next chapter' },
  { key: '← / PageUp', label: 'Previous chapter' },
  { key: 'R', label: 'Switch to Read mode' },
  { key: 'F', label: 'Switch to Follow Along mode' },
  { key: 'L', label: 'Switch to Listen mode' },
  { key: 'T', label: 'Table of Contents & Notes' },
  { key: 'S', label: 'Typography & Theme settings' },
  { key: 'Esc', label: 'Close drawers or toggle HUD chrome' },
  { key: '?', label: 'Open keyboard shortcuts' },
];

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  themeId = 'parchment',
}) {
  const currentTheme = READER_THEMES[themeId] || READER_THEMES.parchment;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-5 space-y-4 animate-scale-up"
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
              <Keyboard className="w-4 h-4" />
            </div>
            <h3 id="shortcuts-dialog-title" className="text-sm font-serif font-semibold">
              Keyboard Shortcuts
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

        {/* Shortcuts list */}
        <div className="space-y-2 text-xs">
          {SHORTCUTS.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-xl border"
              style={{
                borderColor: currentTheme.border,
                backgroundColor: currentTheme.bg,
              }}
            >
              <span className="opacity-80 font-serif">{s.label}</span>
              <kbd
                className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-black/5 dark:bg-white/10 shadow-xs"
                style={{ borderColor: currentTheme.border }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center text-[11px] opacity-60 font-serif italic">
          Press <kbd className="font-mono px-1 rounded bg-black/5 dark:bg-white/10">Esc</kbd> at any time to return to reading
        </div>
      </div>
    </div>
  );
}
