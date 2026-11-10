import React, { useEffect, useRef } from 'react';
import { X, Type, Check, Sun, Moon, BookOpen } from 'lucide-react';
import { READER_THEMES, FONT_FAMILIES } from './ReaderThemes';

export default function ReaderSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTheme = READER_THEMES[settings.theme] || READER_THEMES.parchment;

  const handleFontSizeChange = (delta) => {
    const next = Math.min(28, Math.max(14, settings.fontSize + delta));
    onUpdateSettings({ ...settings, fontSize: next });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-display-settings-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-2xl shadow-2xl p-6 transition-all border animate-scale-up"
        style={{
          backgroundColor: currentTheme.cardBg,
          color: currentTheme.text,
          borderColor: currentTheme.border,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: currentTheme.border }}>
          <div className="flex items-center gap-2">
            <Type className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            <h2 id="reader-display-settings-title" className="text-lg font-serif font-semibold">
              Reading Display
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Close display settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Themes Palette */}
        <div className="mt-5">
          <label className="text-xs uppercase tracking-wider font-semibold opacity-70 block mb-2.5">
            Lighting & Paper Tone
          </label>
          <div className="grid grid-cols-5 gap-2.5">
            {Object.values(READER_THEMES).map((theme) => {
              const isSelected = settings.theme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => onUpdateSettings({ ...settings, theme: theme.id })}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${
                    isSelected ? 'ring-2 ring-amber-500 ring-offset-2 scale-105 shadow-sm' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                  title={theme.name}
                  aria-pressed={isSelected}
                >
                  <span
                    className="w-6 h-6 rounded-full border shadow-inner flex items-center justify-center mb-1"
                    style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[3]" />}
                  </span>
                  <span className="text-[11px] font-medium truncate max-w-full">{theme.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Family */}
        <div className="mt-6">
          <label className="text-xs uppercase tracking-wider font-semibold opacity-70 block mb-2.5">
            Typeface
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(FONT_FAMILIES).map((font) => {
              const isSelected = settings.fontFamily === font.id;
              return (
                <button
                  key={font.id}
                  onClick={() => onUpdateSettings({ ...settings, fontFamily: font.id })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border text-center transition-all ${
                    isSelected ? 'border-amber-500 bg-amber-500/10 font-semibold' : 'opacity-75 hover:opacity-100'
                  }`}
                  style={{
                    fontFamily: font.cssFamily,
                    borderColor: isSelected ? undefined : currentTheme.border,
                  }}
                >
                  {font.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size & Stepper */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs uppercase tracking-wider font-semibold opacity-70">
              Text Size
            </label>
            <span className="text-xs font-mono opacity-80">{settings.fontSize}px</span>
          </div>
          <div
            className="flex items-center justify-between rounded-xl border p-1"
            style={{ borderColor: currentTheme.border }}
          >
            <button
              onClick={() => handleFontSizeChange(-2)}
              disabled={settings.fontSize <= 14}
              className="flex-1 py-1.5 flex items-center justify-center font-serif text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
              aria-label="Decrease font size"
            >
              A-
            </button>
            <div className="h-4 w-px bg-current opacity-20" />
            <span className="flex-1 text-center font-medium text-sm">
              {settings.fontSize}
            </span>
            <div className="h-4 w-px bg-current opacity-20" />
            <button
              onClick={() => handleFontSizeChange(2)}
              disabled={settings.fontSize >= 28}
              className="flex-1 py-1.5 flex items-center justify-center font-serif text-base font-semibold rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>
        </div>

        {/* Line Spacing */}
        <div className="mt-6">
          <label className="text-xs uppercase tracking-wider font-semibold opacity-70 block mb-2.5">
            Line Height
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Compact', value: 1.5 },
              { label: 'Standard', value: 1.75 },
              { label: 'Relaxed', value: 2.0 },
            ].map((lh) => {
              const isSelected = settings.lineHeight === lh.value;
              return (
                <button
                  key={lh.value}
                  onClick={() => onUpdateSettings({ ...settings, lineHeight: lh.value })}
                  className={`py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                    isSelected ? 'border-amber-500 bg-amber-500/10 font-semibold' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ borderColor: isSelected ? undefined : currentTheme.border }}
                >
                  {lh.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reading Width */}
        <div className="mt-6">
          <label className="text-xs uppercase tracking-wider font-semibold opacity-70 block mb-2.5">
            Page Width
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'compact', label: 'Narrow' },
              { id: 'standard', label: 'Comfort' },
              { id: 'wide', label: 'Spacious' },
            ].map((col) => {
              const isSelected = settings.columnWidth === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => onUpdateSettings({ ...settings, columnWidth: col.id })}
                  className={`py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                    isSelected ? 'border-amber-500 bg-amber-500/10 font-semibold' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ borderColor: isSelected ? undefined : currentTheme.border }}
                >
                  {col.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
