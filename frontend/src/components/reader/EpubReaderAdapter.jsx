import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { READER_THEMES, FONT_FAMILIES } from './ReaderThemes';

export default function EpubReaderAdapter({
  streamUrl,
  initialCfi,
  settings,
  onLocationChange,
  onTextSelected,
  onTocLoaded,
}) {
  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const currentTheme = READER_THEMES[settings.theme] || READER_THEMES.parchment;
  const currentFont = FONT_FAMILIES[settings.fontFamily] || FONT_FAMILIES.serif;

  // Apply theme styling dynamically to rendition iframe
  const applyRenditionStyles = useCallback((rendition) => {
    if (!rendition) return;
    rendition.themes.default({
      body: {
        background: `${currentTheme.bg} !important`,
        color: `${currentTheme.text} !important`,
        'font-family': `${currentFont.cssFamily} !important`,
        'font-size': `${settings.fontSize}px !important`,
        'line-height': `${settings.lineHeight} !important`,
        padding: '0 2rem !important',
      },
      p: {
        'font-family': `${currentFont.cssFamily} !important`,
        'font-size': `${settings.fontSize}px !important`,
        'line-height': `${settings.lineHeight} !important`,
        color: `${currentTheme.text} !important`,
      },
      'h1, h2, h3, h4, h5': {
        color: `${currentTheme.accent} !important`,
        'font-family': `${currentFont.cssFamily} !important`,
      },
      '::selection': {
        background: `${currentTheme.highlightBg} !important`,
      },
    });
  }, [currentTheme, currentFont, settings]);

  useEffect(() => {
    if (!streamUrl || !viewerRef.current) return;

    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    try {
      const book = ePub(streamUrl);
      bookRef.current = book;

      const rendition = book.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'auto',
        minSpreadWidth: 800,
      });
      renditionRef.current = rendition;

      applyRenditionStyles(rendition);

      rendition.display(initialCfi || undefined).then(() => {
        if (isMounted) setLoading(false);
      }).catch((err) => {
        if (isMounted) {
          console.warn('Initial CFI location failed, falling back to first section:', err);
          rendition.display();
          setLoading(false);
        }
      });

      // Extract TOC navigation
      book.loaded.navigation.then((nav) => {
        if (isMounted && onTocLoaded && nav.toc) {
          const chapters = nav.toc.map((item, idx) => ({
            id: item.id || `toc_${idx}`,
            chapter_order: idx,
            chapter_index: idx,
            title: item.label ? item.label.trim() : `Chapter ${idx + 1}`,
            href: item.href,
          }));
          onTocLoaded(chapters);
        }
      });

      // Track location and progress
      rendition.on('relocated', (location) => {
        if (isMounted && onLocationChange && location?.start) {
          onLocationChange({
            cfi: location.start.cfi,
            percentage: location.start.percentage ? location.start.percentage * 100 : 0,
            href: location.start.href,
          });
        }
      });

      // Track text selection
      rendition.on('selected', (cfiRange, contents) => {
        const selection = contents.window.getSelection();
        if (selection && !selection.isCollapsed && onTextSelected) {
          const text = selection.toString().trim();
          if (text.length >= 2) {
            onTextSelected({
              text,
              cfi: cfiRange,
            });
          }
        }
      });

    } catch (err) {
      if (isMounted) {
        console.error('Error initializing EPUB.js:', err);
        setLoadError('Failed to load EPUB document.');
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      if (renditionRef.current) {
        try {
          renditionRef.current.destroy();
        } catch (e) {
          console.debug('Error destroying rendition:', e);
        }
      }
      if (bookRef.current) {
        try {
          bookRef.current.destroy();
        } catch (e) {
          console.debug('Error destroying book:', e);
        }
      }
    };
  }, [streamUrl, initialCfi, onLocationChange, onTextSelected, onTocLoaded, applyRenditionStyles]);

  // Update styles when settings change
  useEffect(() => {
    if (renditionRef.current) {
      applyRenditionStyles(renditionRef.current);
    }
  }, [applyRenditionStyles]);

  const handlePrev = () => {
    if (renditionRef.current) renditionRef.current.prev();
  };

  const handleNext = () => {
    if (renditionRef.current) renditionRef.current.next();
  };

  return (
    <div
      className="relative w-full h-full flex flex-col justify-center items-center overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
    >
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-inherit">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-3" />
          <p className="text-sm font-serif opacity-75">Opening book pages...</p>
        </div>
      )}

      {loadError && (
        <div className="p-8 text-center max-w-md">
          <p className="text-red-500 font-medium mb-2">{loadError}</p>
          <p className="text-sm opacity-70">
            The book source file could not be parsed by the EPUB engine.
          </p>
        </div>
      )}

      {/* Main EPUB container */}
      <div
        ref={viewerRef}
        className="w-full h-full max-w-4xl mx-auto px-4 sm:px-8 py-6"
      />

      {/* Side page flip buttons */}
      <button
        onClick={handlePrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 opacity-40 hover:opacity-100 transition-all z-10"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={handleNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 opacity-40 hover:opacity-100 transition-all z-10"
        aria-label="Next page"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
}
