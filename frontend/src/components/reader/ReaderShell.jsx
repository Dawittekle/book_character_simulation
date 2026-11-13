import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Headphones,
  Sliders,
  Menu,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { lorelyApi } from '../../services/lorelyApi';
import {
  READER_THEMES,
  DEFAULT_READER_SETTINGS,
} from './ReaderThemes';
import ReaderSettingsModal from './ReaderSettingsModal';
import TableOfContentsDrawer from './TableOfContentsDrawer';
import TextReaderAdapter from './TextReaderAdapter';
import EpubReaderAdapter from './EpubReaderAdapter';
import PdfReaderAdapter from './PdfReaderAdapter';
import SelectionActionPill from './SelectionActionPill';
import FollowAlongController from './FollowAlongController';
import ListenModeView from './ListenModeView';
import AskCharacterDrawer from './AskCharacterDrawer';
import AddNoteModal from './AddNoteModal';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import { Bookmark as BookmarkIcon, Keyboard } from 'lucide-react';

export default function ReaderShell({ session }) {
  const { bookId } = useParams();
  const navigate = useNavigate();

  // Reading settings
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('lorely_reader_settings');
      return saved ? { ...DEFAULT_READER_SETTINGS, ...JSON.parse(saved) } : DEFAULT_READER_SETTINGS;
    } catch {
      return DEFAULT_READER_SETTINGS;
    }
  });

  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') || 'read';
  const [mode, setMode] = useState(initialMode); // 'read' | 'follow_along' | 'listen'
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isAskDrawerOpen, setIsAskDrawerOpen] = useState(false);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Book data & state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookData, setBookData] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [rawText, setRawText] = useState('');

  // Contextual text selection & annotations
  const [selection, setSelection] = useState(null);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(null);
  const [activePassageForAsk, setActivePassageForAsk] = useState('');
  const [noteSelection, setNoteSelection] = useState(null);
  const [bookmarkToast, setBookmarkToast] = useState(null);

  useEffect(() => {
    setActiveSentenceIndex(null);
  }, [currentChapterIndex]);

  const hideTimeoutRef = useRef(null);
  const progressSyncTimeoutRef = useRef(null);
  const currentTheme = READER_THEMES[settings.theme] || READER_THEMES.parchment;

  // Cloud progress sync helper
  const syncProgressToCloud = useCallback(
    (chapterIdx, pct, currentMode) => {
      if (!bookId) return;
      if (progressSyncTimeoutRef.current) {
        clearTimeout(progressSyncTimeoutRef.current);
      }
      progressSyncTimeoutRef.current = setTimeout(async () => {
        try {
          const token = session?.access_token;
          await lorelyApi.updateReaderProgress(
            bookId,
            {
              current_chapter_index: chapterIdx,
              progress_percent: Math.min(100, Math.max(0, Number(pct) || 0)),
              last_read_mode: currentMode || 'read',
            },
            token
          );
        } catch (err) {
          console.debug('Failed to sync reader progress:', err);
        }
      }, 1200);
    },
    [bookId, session]
  );

  // Persist settings
  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('lorely_reader_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.debug('Failed saving reader settings to localStorage:', e);
    }
  };

  // Auto-hide navigation HUD on idle
  const resetHideTimer = useCallback(() => {
    setChromeVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      // Don't auto-hide if a drawer/modal is open
      if (!isSettingsOpen && !isTocOpen && !isAskDrawerOpen && !isAddNoteModalOpen && !isShortcutsOpen) {
        setChromeVisible(false);
      }
    }, 4500);
  }, [isSettingsOpen, isTocOpen, isAskDrawerOpen, isAddNoteModalOpen, isShortcutsOpen]);

  useEffect(() => {
    const handleActivity = () => resetHideTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    resetHideTimer();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [resetHideTimer]);

  // Load book metadata, access, chapters, characters, and annotations
  useEffect(() => {
    if (!bookId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const token = session?.access_token;

    Promise.all([
      lorelyApi.getReaderAccess(bookId, token),
      lorelyApi.getReaderChapters(bookId, token).catch(() => ({ chapters: [] })),
      (lorelyApi.listBookCharacters ? lorelyApi.listBookCharacters(bookId, token) : Promise.resolve([])).catch(() => []),
      (lorelyApi.getReaderBookmarks ? lorelyApi.getReaderBookmarks(bookId, token) : Promise.resolve([])).catch(() => []),
      (lorelyApi.getReaderAnnotations ? lorelyApi.getReaderAnnotations(bookId, token) : Promise.resolve([])).catch(() => []),
    ])
      .then(async ([accessData, chaptersData, charactersData, bookmarksData, annotationsData]) => {
        if (!isMounted) return;

        setBookData(accessData);
        setChapters(chaptersData.chapters || []);
        setCharacters(charactersData || []);
        setBookmarks(bookmarksData || []);
        setAnnotations(annotationsData || []);

        if (accessData.current_progress) {
          setCurrentChapterIndex(accessData.current_progress.current_chapter_index || 0);
          setProgressPercent(accessData.current_progress.progress_percent || 0);
          if (accessData.current_progress.last_read_mode) {
            setMode(accessData.current_progress.last_read_mode);
          }
        }

        // If text format, fetch plain text content
        if (accessData.format === 'txt') {
          try {
            const rawUrl = lorelyApi.getReaderRawSourceUrl(bookId);
            const res = await fetch(rawUrl, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
              const text = await res.text();
              if (isMounted) setRawText(text);
            }
          } catch (textErr) {
            console.warn('Failed to load raw text:', textErr);
          }
        }

        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Reader access error:', err);
        setError(err.message || 'Unable to open book.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [bookId, session]);

  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex((prev) => prev + 1);
    }
  };

  const handlePrevChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex((prev) => prev - 1);
    }
  };

  // Comprehensive Keyboard Navigation & Shortcuts (Phase 6)
  useEffect(() => {
    function handleKeyDown(e) {
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable);

      if (isInputActive) return;

      if (e.key === 'Escape') {
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
        } else if (isAskDrawerOpen) {
          setIsAskDrawerOpen(false);
        } else if (isAddNoteModalOpen) {
          setIsAddNoteModalOpen(false);
        } else if (isTocOpen) {
          setIsTocOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else {
          setChromeVisible((v) => !v);
        }
        return;
      }

      // Don't trigger navigation/mode shortcuts if any modal/drawer is open
      if (isAskDrawerOpen || isAddNoteModalOpen || isTocOpen || isSettingsOpen || isShortcutsOpen) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextChapter();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevChapter();
      } else if (e.key === 'r' || e.key === 'R') {
        setMode('read');
      } else if (e.key === 'f' || e.key === 'F') {
        setMode('follow_along');
      } else if (e.key === 'l' || e.key === 'L') {
        setMode('listen');
      } else if (e.key === 't' || e.key === 'T') {
        setIsTocOpen((v) => !v);
      } else if (e.key === 's' || e.key === 'S') {
        setIsSettingsOpen((v) => !v);
      } else if (e.key === '?' || (e.shiftKey && e.key === '?') || e.key === 'h' || e.key === 'H') {
        setIsShortcutsOpen((v) => !v);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentChapterIndex,
    chapters.length,
    isShortcutsOpen,
    isAskDrawerOpen,
    isAddNoteModalOpen,
    isTocOpen,
    isSettingsOpen,
  ]);

  // Contextual Selection & Annotation Handlers (Phase 5)
  const handleAskCharacter = (sel) => {
    setActivePassageForAsk(sel?.text || '');
    setIsAskDrawerOpen(true);
    setSelection(null);
  };

  const handleHighlight = async (sel, color) => {
    if (!sel || !sel.text) return;
    setSelection(null);
    try {
      const token = session?.access_token;
      const created = await lorelyApi.createReaderAnnotation(
        bookId,
        {
          chapter_index: currentChapterIndex,
          selected_text: sel.text,
          color: color || 'amber',
          locator_payload: sel.rect ? { rect: sel.rect } : {},
        },
        token
      );
      if (created) {
        setAnnotations((prev) => [...prev, created]);
      }
    } catch (err) {
      console.error('Failed to create highlight:', err);
    }
  };

  const handleAddNote = (sel) => {
    setNoteSelection(sel);
    setIsAddNoteModalOpen(true);
    setSelection(null);
  };

  const handleSaveNote = async ({ selectedText, chapterIndex, color, note, locatorPayload }) => {
    try {
      const token = session?.access_token;
      const created = await lorelyApi.createReaderAnnotation(
        bookId,
        {
          chapter_index: chapterIndex,
          selected_text: selectedText,
          color: color || 'amber',
          note: note,
          locator_payload: locatorPayload,
        },
        token
      );
      if (created) {
        setAnnotations((prev) => [...prev, created]);
      }
    } catch (err) {
      console.error('Failed saving note:', err);
    }
  };

  const handleBookmark = async (sel) => {
    setSelection(null);
    try {
      const token = session?.access_token;
      const created = await lorelyApi.createReaderBookmark(
        bookId,
        {
          chapter_index: currentChapterIndex,
          chapter_title: currentChapter?.title,
          progress_percent: progressPercent,
          snippet: sel?.text || `Chapter ${currentChapterIndex + 1}`,
          locator_payload: sel?.rect ? { rect: sel.rect } : {},
        },
        token
      );
      if (created) {
        setBookmarks((prev) => [...prev, created]);
        setBookmarkToast(`Bookmark pinned to Chapter ${currentChapterIndex + 1}`);
        setTimeout(() => setBookmarkToast(null), 3000);
      }
    } catch (err) {
      console.error('Failed creating bookmark:', err);
    }
  };

  const handleDeleteBookmark = async (bmId) => {
    try {
      const token = session?.access_token;
      await lorelyApi.deleteReaderBookmark(bookId, bmId, token);
      setBookmarks((prev) => prev.filter((b) => b.id !== bmId));
    } catch (err) {
      console.error('Failed deleting bookmark:', err);
    }
  };

  const handleDeleteAnnotation = async (annId) => {
    try {
      const token = session?.access_token;
      await lorelyApi.deleteReaderAnnotation(bookId, annId, token);
      setAnnotations((prev) => prev.filter((a) => a.id !== annId));
    } catch (err) {
      console.error('Failed deleting annotation:', err);
    }
  };

  // Sync reading progress to cloud whenever chapter, progress, or mode changes
  useEffect(() => {
    if (!loading && bookData) {
      syncProgressToCloud(currentChapterIndex, progressPercent, mode);
    }
    return () => {
      if (progressSyncTimeoutRef.current) {
        clearTimeout(progressSyncTimeoutRef.current);
      }
    };
  }, [currentChapterIndex, progressPercent, mode, loading, bookData, syncProgressToCloud]);

  if (loading) {
    return (
      <div
        className="w-screen h-screen flex flex-col items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: '#faf8f5' }}
      >
        {/* Subtle radial vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.04) 100%)',
          }}
        />

        {/* Lorely wordmark / logo */}
        <div className="flex flex-col items-center gap-6 relative z-10">
          {/* Book icon emblem */}
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: '#ef4d23' }}
          >
            <BookOpen className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>

          {/* Brand name */}
          <div className="text-center">
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#0b0f1a' }}
            >
              Lorely
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: '#6b6560', fontFamily: '"Inter", sans-serif' }}
            >
              Your reading experience is loading…
            </p>
          </div>

          {/* Spinner */}
          <Loader2
            className="w-6 h-6 animate-spin mt-2"
            style={{ color: '#ef4d23', opacity: 0.75 }}
          />
        </div>

        {/* Bottom gradient fade */}
        <div
          className="absolute bottom-0 inset-x-0 h-32 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(250,248,245,0.8), transparent)',
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-screen h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-300"
        style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      >
        <div className="max-w-md p-8 rounded-2xl border shadow-lg" style={{ backgroundColor: currentTheme.cardBg, borderColor: currentTheme.border }}>
          <h2 className="text-xl font-serif font-bold text-red-600 mb-2">Unable to Read Book</h2>
          <p className="text-sm opacity-80 mb-6">{error}</p>
          <button
            onClick={() => navigate('/library')}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-all shadow"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const currentChapter = chapters.find(
    (c) => (c.chapter_order ?? c.chapter_index) === currentChapterIndex
  ) || chapters[0];

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col transition-colors duration-300 font-sans"
      style={{
        backgroundColor: currentTheme.bg,
        color: currentTheme.text,
      }}
    >
      {/* Floating Top Navigation Chrome */}
      <header
        className={`absolute top-0 inset-x-0 z-40 transition-all duration-300 border-b backdrop-blur-md ${
          chromeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
        style={{
          backgroundColor: currentTheme.navBg,
          borderColor: currentTheme.border,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: Back & Table of Contents */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/books/${bookId}`)}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Back to Book Overview"
              aria-label="Back to overview"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsTocOpen(true)}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Table of Contents"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">Contents</span>
            </button>
          </div>

          {/* Center: Title & Chapter */}
          <div className="flex-1 text-center overflow-hidden px-2">
            <h1 className="text-sm font-serif font-semibold truncate">
              {bookData?.title}
            </h1>
            <p className="text-xs opacity-70 truncate font-serif italic">
              {currentChapter?.title || `Chapter ${currentChapterIndex + 1}`}
            </p>
          </div>

          {/* Right: Mode Switcher & Display Settings */}
          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div
              className="hidden md:flex items-center p-0.5 rounded-xl border text-xs font-medium"
              style={{ borderColor: currentTheme.border, backgroundColor: currentTheme.cardBg }}
            >
              <button
                onClick={() => setMode('read')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  mode === 'read' ? 'bg-amber-500 text-white shadow-sm' : 'opacity-70 hover:opacity-100'
                }`}
              >
                Read
              </button>
              <button
                onClick={() => setMode('follow_along')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  mode === 'follow_along' ? 'bg-amber-500 text-white shadow-sm' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Follow</span>
              </button>
              <button
                onClick={() => setMode('listen')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  mode === 'listen' ? 'bg-amber-500 text-white shadow-sm' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <Headphones className="w-3 h-3" />
                <span>Listen</span>
              </button>
            </div>

            {/* Display / Font Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1 text-sm font-serif font-bold"
              title="Display & Typography Settings"
              aria-label="Display settings"
            >
              <span className="text-base">Aa</span>
            </button>

            {/* Keyboard Shortcuts Button */}
            <button
              onClick={() => setIsShortcutsOpen(true)}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors hidden sm:flex items-center text-xs font-mono opacity-80 hover:opacity-100"
              title="Keyboard Shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mode View: Listen Mode (Audiobook) vs Read / Follow Along Canvas */}
      {mode === 'listen' ? (
        <main className="flex-1 w-full h-full relative overflow-hidden">
          <ListenModeView
            bookData={bookData}
            chapters={chapters}
            currentChapterIndex={currentChapterIndex}
            onNextChapter={handleNextChapter}
            onPrevChapter={handlePrevChapter}
            hasNextChapter={currentChapterIndex < chapters.length - 1}
            hasPrevChapter={currentChapterIndex > 0}
            onActiveSentenceChange={(idx) => setActiveSentenceIndex(idx)}
            theme={currentTheme}
            session={session}
            onSwitchMode={(newMode) => setMode(newMode)}
          />
        </main>
      ) : (
        <>
          {/* Main Reading Canvas */}
          <main className="flex-1 w-full h-full relative overflow-hidden pb-14">
            {bookData?.format === 'epub' && (
              <EpubReaderAdapter
                streamUrl={bookData.streamUrl || bookData.stream_url}
                settings={settings}
                onLocationChange={(loc) => {
                  if (loc.percentage) setProgressPercent(loc.percentage);
                }}
                onTextSelected={(sel) => setSelection(sel)}
                onTocLoaded={(toc) => {
                  if (chapters.length === 0) setChapters(toc);
                }}
              />
            )}

            {bookData?.format === 'pdf' && (
              <PdfReaderAdapter
                streamUrl={bookData.streamUrl || bookData.stream_url}
                settings={settings}
                onPageChange={(info) => {
                  if (info.percentage) setProgressPercent(info.percentage);
                }}
                onTextSelected={(sel) => setSelection(sel)}
              />
            )}

            {bookData?.format === 'txt' && (
              <TextReaderAdapter
                rawText={rawText}
                chapters={chapters}
                currentChapterIndex={currentChapterIndex}
                settings={settings}
                activeSentenceIndex={mode === 'follow_along' ? activeSentenceIndex : null}
                annotations={annotations}
                onTextSelected={(sel) => setSelection(sel)}
                onScrollProgress={(p) => setProgressPercent(p)}
              />
            )}
          </main>

          {/* Follow Along Mode: Synchronized Audio Player HUD */}
          {mode === 'follow_along' ? (
            <FollowAlongController
              bookId={bookId}
              currentChapterIndex={currentChapterIndex}
              onNextChapter={handleNextChapter}
              onPrevChapter={handlePrevChapter}
              hasNextChapter={currentChapterIndex < chapters.length - 1}
              hasPrevChapter={currentChapterIndex > 0}
              onActiveSentenceChange={(idx) => setActiveSentenceIndex(idx)}
              theme={currentTheme}
              mode={mode}
              session={session}
              isFloatingHudVisible={chromeVisible}
            />
          ) : (
            /* Read Mode: Minimal Floating Chapter Navigation Footer */
            <footer
              className={`absolute bottom-0 inset-x-0 z-40 transition-all duration-300 border-t backdrop-blur-md ${
                chromeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
              style={{
                backgroundColor: currentTheme.navBg,
                borderColor: currentTheme.border,
              }}
            >
              <div className="max-w-4xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4 text-xs">
                {/* Chapter Prev */}
                <button
                  onClick={handlePrevChapter}
                  disabled={currentChapterIndex <= 0}
                  className="flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-all"
                  aria-label="Previous chapter"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Prev Chapter</span>
                </button>

                {/* Progress Percent & Chapter Tracker */}
                <div className="flex items-center gap-3 font-mono opacity-80">
                  <span>Chapter {currentChapterIndex + 1} of {Math.max(chapters.length, 1)}</span>
                  <span className="opacity-40">·</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>

                {/* Chapter Next */}
                <button
                  onClick={handleNextChapter}
                  disabled={currentChapterIndex >= chapters.length - 1}
                  className="flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-all"
                  aria-label="Next chapter"
                >
                  <span className="hidden sm:inline">Next Chapter</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </footer>
          )}
        </>
      )}

      {/* Floating Selection Action Pill */}
      {selection && (
        <SelectionActionPill
          selection={selection}
          themeId={settings.theme}
          onHighlight={handleHighlight}
          onAddNote={handleAddNote}
          onBookmark={handleBookmark}
          onAskCharacter={handleAskCharacter}
          onClear={() => setSelection(null)}
        />
      )}

      {/* Table of Contents & Notes Drawer */}
      <TableOfContentsDrawer
        isOpen={isTocOpen}
        onClose={() => setIsTocOpen(false)}
        chapters={chapters}
        currentChapterIndex={currentChapterIndex}
        onSelectChapter={(idx) => setCurrentChapterIndex(idx)}
        bookmarks={bookmarks}
        annotations={annotations}
        onDeleteBookmark={handleDeleteBookmark}
        onDeleteAnnotation={handleDeleteAnnotation}
        themeId={settings.theme}
        bookTitle={bookData?.title}
      />

      {/* "Ask a Character" Contextual Discussion Drawer */}
      <AskCharacterDrawer
        isOpen={isAskDrawerOpen}
        onClose={() => setIsAskDrawerOpen(false)}
        bookId={bookId}
        passageQuote={activePassageForAsk}
        chapterIndex={currentChapterIndex}
        chapterTitle={currentChapter?.title}
        characters={characters}
        themeId={settings.theme}
        session={session}
      />

      {/* Add Reflection Note Modal */}
      <AddNoteModal
        isOpen={isAddNoteModalOpen}
        onClose={() => setIsAddNoteModalOpen(false)}
        selection={noteSelection}
        chapterIndex={currentChapterIndex}
        themeId={settings.theme}
        onSaveNote={handleSaveNote}
      />

      {/* Bookmark Saved Toast */}
      {bookmarkToast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-amber-500 text-white font-medium text-xs shadow-xl animate-fade-in flex items-center gap-2">
          <BookmarkIcon className="w-3.5 h-3.5 fill-current" />
          <span>{bookmarkToast}</span>
        </div>
      )}

      {/* Display & Typography Settings Modal */}
      <ReaderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        themeId={settings.theme}
      />
    </div>
  );
}
