import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Bookmark,
  Highlighter,
  Trash2,
  Quote,
} from 'lucide-react';
import { READER_THEMES } from './ReaderThemes';
import { PASTEL_HIGHLIGHT_COLORS } from './SelectionActionPill';

export default function TableOfContentsDrawer({
  isOpen,
  onClose,
  chapters = [],
  currentChapterIndex = 0,
  onSelectChapter,
  bookmarks = [],
  annotations = [],
  onDeleteBookmark,
  onDeleteAnnotation,
  themeId = 'parchment',
  bookTitle = 'Book Contents',
}) {
  const [activeTab, setActiveTab] = useState('chapters'); // 'chapters' | 'bookmarks' | 'annotations'
  const drawerRef = useRef(null);
  const currentTheme = READER_THEMES[themeId] || READER_THEMES.parchment;

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

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (drawerRef.current && !drawerRef.current.contains(e.target)) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-toc-title"
    >
      <div
        ref={drawerRef}
        className="w-full max-w-sm h-full shadow-2xl flex flex-col transition-transform duration-300 animate-slide-right border-r"
        style={{
          backgroundColor: currentTheme.bg,
          color: currentTheme.text,
          borderColor: currentTheme.border,
        }}
      >
        {/* Header */}
        <div
          className="p-5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: currentTheme.border }}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
            <div className="overflow-hidden">
              <h2 id="reader-toc-title" className="text-base font-serif font-semibold truncate">
                Table of Contents
              </h2>
              <p className="text-xs truncate opacity-70" title={bookTitle}>
                {bookTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Close contents"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className="flex items-center border-b p-1.5 gap-1 shrink-0 text-xs font-medium"
          style={{ borderColor: currentTheme.border, backgroundColor: currentTheme.cardBg }}
        >
          <button
            onClick={() => setActiveTab('chapters')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'chapters'
                ? 'bg-amber-500 text-white font-semibold shadow-xs'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Chapters ({chapters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'bookmarks'
                ? 'bg-amber-500 text-white font-semibold shadow-xs'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Bookmarks ({bookmarks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('annotations')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'annotations'
                ? 'bg-amber-500 text-white font-semibold shadow-xs'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>Notes ({annotations.length})</span>
          </button>
        </div>

        {/* Body Content by Tab */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* TAB 1: CHAPTERS */}
          {activeTab === 'chapters' && (
            <>
              {chapters.length === 0 ? (
                <div className="p-8 text-center opacity-60 text-sm italic">
                  No individual chapters found. Entire volume rendered as a single section.
                </div>
              ) : (
                chapters.map((ch, idx) => {
                  const chapterNum = ch.chapter_order ?? ch.chapter_index ?? idx;
                  const isActive = chapterNum === currentChapterIndex;
                  return (
                    <button
                      key={ch.id || idx}
                      onClick={() => {
                        onSelectChapter(chapterNum);
                        onClose();
                      }}
                      className={`w-full text-left p-3 rounded-xl flex items-center justify-between gap-3 transition-all ${
                        isActive
                          ? 'bg-amber-500/15 border border-amber-500/30 font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
                      }`}
                      style={{
                        color: isActive ? currentTheme.accent : currentTheme.text,
                      }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                            isActive
                              ? 'bg-amber-500 text-white font-bold'
                              : 'bg-black/5 dark:bg-white/10 opacity-70'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-sm font-serif truncate">
                          {ch.title || `Chapter ${idx + 1}`}
                        </span>
                      </div>
                      {isActive ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </>
          )}

          {/* TAB 2: BOOKMARKS */}
          {activeTab === 'bookmarks' && (
            <>
              {bookmarks.length === 0 ? (
                <div className="p-8 text-center opacity-60 text-sm italic space-y-2">
                  <Bookmark className="w-8 h-8 mx-auto opacity-30 text-amber-500" />
                  <p>No bookmarks yet.</p>
                  <p className="text-xs">
                    Select text or tap the bookmark icon while reading to pin important locations.
                  </p>
                </div>
              ) : (
                bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="p-3 rounded-xl border flex items-start justify-between gap-2.5 transition-all hover:border-amber-500/30"
                    style={{
                      borderColor: currentTheme.border,
                      backgroundColor: currentTheme.cardBg,
                    }}
                  >
                    <button
                      onClick={() => {
                        onSelectChapter(bm.chapter_index);
                        onClose();
                      }}
                      className="flex-1 text-left space-y-1 overflow-hidden"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                          Ch. {bm.chapter_index + 1}
                        </span>
                        <span className="text-xs font-serif font-medium truncate">
                          {bm.chapter_title || `Chapter ${bm.chapter_index + 1}`}
                        </span>
                        <span className="text-[10px] opacity-50 font-mono">
                          {Math.round(bm.progress_percent)}%
                        </span>
                      </div>
                      {bm.snippet && (
                        <p className="text-xs font-serif italic opacity-75 line-clamp-2">
                          “{bm.snippet}”
                        </p>
                      )}
                    </button>

                    {onDeleteBookmark && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBookmark(bm.id);
                        }}
                        className="p-1.5 rounded-lg opacity-40 hover:opacity-100 hover:text-red-600 transition-colors"
                        title="Remove bookmark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* TAB 3: ANNOTATIONS & HIGHLIGHTS */}
          {activeTab === 'annotations' && (
            <>
              {annotations.length === 0 ? (
                <div className="p-8 text-center opacity-60 text-sm italic space-y-2">
                  <Highlighter className="w-8 h-8 mx-auto opacity-30 text-amber-500" />
                  <p>No highlights or notes yet.</p>
                  <p className="text-xs">
                    Select any passage in the reading canvas to highlight in pastel tones or record margin notes.
                  </p>
                </div>
              ) : (
                annotations.map((ann) => {
                  const colorConfig = PASTEL_HIGHLIGHT_COLORS.find((c) => c.id === ann.color) || PASTEL_HIGHLIGHT_COLORS[1];
                  return (
                    <div
                      key={ann.id}
                      className="p-3 rounded-xl border flex items-start justify-between gap-2.5 transition-all hover:border-amber-500/30"
                      style={{
                        borderColor: currentTheme.border,
                        backgroundColor: currentTheme.cardBg,
                      }}
                    >
                      <button
                        onClick={() => {
                          onSelectChapter(ann.chapter_index);
                          onClose();
                        }}
                        className="flex-1 text-left space-y-1.5 overflow-hidden"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: colorConfig.dot }}
                          />
                          <span className="text-[10px] font-mono uppercase opacity-70">
                            Chapter {ann.chapter_index + 1}
                          </span>
                        </div>

                        {/* Passage Quote */}
                        <p className="text-xs font-serif italic line-clamp-3 leading-relaxed opacity-90 pl-2 border-l-2" style={{ borderColor: colorConfig.dot }}>
                          “{ann.selected_text}”
                        </p>

                        {/* Personal reflection note */}
                        {ann.note && (
                          <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-[11px] font-sans opacity-85">
                            {ann.note}
                          </div>
                        )}
                      </button>

                      {onDeleteAnnotation && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAnnotation(ann.id);
                          }}
                          className="p-1.5 rounded-lg opacity-40 hover:opacity-100 hover:text-red-600 transition-colors"
                          title="Delete annotation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t text-xs opacity-60 text-center shrink-0"
          style={{ borderColor: currentTheme.border }}
        >
          {chapters.length} chapters · {bookmarks.length} bookmarks · {annotations.length} highlights
        </div>
      </div>
    </div>
  );
}
