import React, { useMemo, useEffect, useRef } from 'react';
import { READER_THEMES, FONT_FAMILIES, getColumnWidthValue } from './ReaderThemes';

const PASTEL_HIGHLIGHT_BG = {
  yellow: 'rgba(254, 240, 138, 0.55)',
  amber: 'rgba(254, 215, 170, 0.55)',
  rose: 'rgba(254, 205, 211, 0.55)',
  sage: 'rgba(187, 247, 208, 0.55)',
};

export default function TextReaderAdapter({
  rawText = '',
  chapters = [],
  currentChapterIndex = 0,
  settings,
  activeSentenceIndex = null,
  annotations = [],
  onTextSelected,
  onScrollProgress,
}) {
  const containerRef = useRef(null);
  const sentenceRefs = useRef([]);
  const currentTheme = READER_THEMES[settings.theme] || READER_THEMES.parchment;
  const currentFont = FONT_FAMILIES[settings.fontFamily] || FONT_FAMILIES.serif;

  // Split chapter text or full text into paragraphs and sentences
  const { chapterTitle, paragraphs } = useMemo(() => {
    let textToRender = rawText;
    let title = '';

    if (chapters && chapters.length > 0) {
      const activeCh = chapters.find(
        (c) => (c.chapter_order ?? c.chapter_index) === currentChapterIndex
      ) || chapters[0];

      title = activeCh.title || `Chapter ${currentChapterIndex + 1}`;

      if (
        activeCh.start_char_offset !== undefined &&
        activeCh.end_char_offset !== undefined &&
        activeCh.end_char_offset > activeCh.start_char_offset
      ) {
        textToRender = rawText.slice(activeCh.start_char_offset, activeCh.end_char_offset);
      }
    }

    if (!textToRender) {
      textToRender = 'This book currently has no readable plain text loaded.';
    }

    // Split into paragraphs
    const rawParagraphs = textToRender
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    let globalSentenceCounter = 0;
    const structuredParagraphs = rawParagraphs.map((paraText, pIdx) => {
      // Split into sentences using punctuation boundaries
      const rawSentences = paraText.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [paraText];
      const sentences = rawSentences.map((sText) => {
        const sIndex = globalSentenceCounter++;
        return {
          index: sIndex,
          text: sText.trim(),
        };
      });
      return {
        id: `p-${pIdx}`,
        isFirst: pIdx === 0,
        sentences,
      };
    });

    return {
      chapterTitle: title,
      paragraphs: structuredParagraphs,
    };
  }, [rawText, chapters, currentChapterIndex]);

  // Handle auto-scrolling to active sentence during narration / follow along
  useEffect(() => {
    if (activeSentenceIndex === null || activeSentenceIndex === undefined) return;
    const el = sentenceRefs.current[activeSentenceIndex];
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSentenceIndex]);

  // Handle selection detection
  useEffect(() => {
    function handleMouseUp() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const text = selection.toString().trim();
      if (text.length < 2) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (onTextSelected) {
        onTextSelected({
          text,
          rect,
          chapterIndex: currentChapterIndex,
        });
      }
    }

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      if (container) {
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('touchend', handleMouseUp);
      }
    };
  }, [currentChapterIndex, onTextSelected]);

  // Handle scroll progress
  const handleScroll = (e) => {
    if (!onScrollProgress) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) return;
    const percent = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
    onScrollProgress(percent);
  };

  const maxWidth = getColumnWidthValue(settings.columnWidth);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="w-full h-full overflow-y-auto px-6 py-16 transition-colors duration-300 select-text"
      style={{
        backgroundColor: currentTheme.bg,
        color: currentTheme.text,
      }}
    >
      <div
        className="mx-auto transition-all duration-300"
        style={{
          maxWidth,
          fontFamily: currentFont.cssFamily,
          fontSize: `${settings.fontSize}px`,
          lineHeight: settings.lineHeight,
        }}
      >
        {/* Chapter Title Header */}
        {chapterTitle && (
          <header className="mb-12 pb-6 border-b text-center" style={{ borderColor: currentTheme.border }}>
            <span
              className="text-xs font-mono uppercase tracking-widest block mb-2 font-semibold"
              style={{ color: currentTheme.accent }}
            >
              Chapter {currentChapterIndex + 1}
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              {chapterTitle}
            </h1>
          </header>
        )}

        {/* Paragraphs */}
        <article className="space-y-6">
          {paragraphs.map((p) => (
            <p
              key={p.id}
              className={`leading-relaxed text-justify ${
                p.isFirst ? 'first-letter:text-4xl first-letter:font-bold first-letter:mr-2 first-letter:float-left' : 'indent-6 sm:indent-8'
              }`}
            >
              {p.sentences.map((sentence) => {
                const isActive = activeSentenceIndex === sentence.index;

                // Find matching user annotation
                const matchingAnn = annotations.find(
                  (a) =>
                    a.chapter_index === currentChapterIndex &&
                    (a.selected_text.includes(sentence.text) ||
                      sentence.text.includes(a.selected_text))
                );

                const highlightBg = matchingAnn
                  ? PASTEL_HIGHLIGHT_BG[matchingAnn.color] || PASTEL_HIGHLIGHT_BG.amber
                  : undefined;

                return (
                  <span
                    key={sentence.index}
                    ref={(el) => (sentenceRefs.current[sentence.index] = el)}
                    title={matchingAnn?.note ? `Note: ${matchingAnn.note}` : undefined}
                    className={`transition-all duration-200 rounded px-0.5 inline ${
                      isActive
                        ? 'font-medium shadow-sm'
                        : matchingAnn
                        ? 'border-b-2 border-amber-500/40'
                        : 'hover:bg-amber-500/10'
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: currentTheme.sentenceGlow,
                            boxShadow: `0 0 14px ${currentTheme.sentenceGlow}`,
                            color: currentTheme.accent,
                          }
                        : matchingAnn
                        ? {
                            backgroundColor: highlightBg,
                          }
                        : undefined
                    }
                  >
                    {sentence.text}{' '}
                  </span>
                );
              })}
            </p>
          ))}
        </article>

        {/* Chapter End Flourish */}
        <div className="my-16 flex items-center justify-center gap-3 opacity-40">
          <div className="h-px w-12 bg-current" />
          <span className="text-xs font-serif italic">❦</span>
          <div className="h-px w-12 bg-current" />
        </div>
      </div>
    </div>
  );
}
