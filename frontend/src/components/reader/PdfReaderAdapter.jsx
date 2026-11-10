import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { READER_THEMES } from './ReaderThemes';

// Configure pdfjs worker
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (e) {
    console.debug('Worker config notice:', e);
  }
}

export default function PdfReaderAdapter({
  streamUrl,
  initialPage = 1,
  settings,
  onPageChange,
  onTextSelected,
}) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentTheme = READER_THEMES[settings.theme] || READER_THEMES.parchment;

  // Load PDF document
  useEffect(() => {
    if (!streamUrl) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadingTask = pdfjsLib.getDocument({
      url: streamUrl,
      withCredentials: false,
    });

    loadingTask.promise
      .then((doc) => {
        if (!isMounted) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(Math.min(initialPage, doc.numPages));
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error loading PDF:', err);
        setError('Unable to load PDF document.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
      try {
        loadingTask.destroy();
      } catch (e) {
        // ignore
      }
    };
  }, [streamUrl, initialPage]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask = null;
    let isCancelled = false;

    pdfDoc.getPage(currentPage).then((page) => {
      if (isCancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      renderTask = page.render(renderContext);
      renderTask.promise.then(() => {
        if (onPageChange && !isCancelled) {
          onPageChange({
            page: currentPage,
            totalPages: pdfDoc.numPages,
            percentage: (currentPage / pdfDoc.numPages) * 100,
          });
        }
      }).catch((err) => {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
      });
    });

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, scale, onPageChange]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1);
  };

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
    >
      {/* Zoom and page info bar */}
      <div
        className="w-full flex items-center justify-between px-6 py-2 border-b text-xs font-mono select-none"
        style={{ borderColor: currentTheme.border }}
      >
        <div className="flex items-center gap-2">
          <span>Page {currentPage} of {totalPages || 1}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.max(0.75, s - 0.15))}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div className="flex-1 w-full overflow-auto flex items-center justify-center p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-2" />
            <p className="text-sm font-serif opacity-75">Rendering PDF page...</p>
          </div>
        )}

        {error ? (
          <div className="text-center p-6 max-w-sm">
            <p className="text-red-500 font-medium mb-2">{error}</p>
            <a
              href={streamUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-600 underline font-mono"
            >
              Open raw PDF in new tab
            </a>
          </div>
        ) : (
          <div className="relative shadow-xl rounded-lg overflow-hidden border" style={{ borderColor: currentTheme.border }}>
            <canvas ref={canvasRef} className="block max-w-full" />
            <div ref={textLayerRef} className="absolute inset-0" />
          </div>
        )}
      </div>

      {/* Bottom Paging bar */}
      <div
        className="w-full flex items-center justify-center gap-4 py-2 border-t select-none"
        style={{ borderColor: currentTheme.border }}
      >
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-mono">{currentPage} / {totalPages}</span>
        <button
          onClick={handleNextPage}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
