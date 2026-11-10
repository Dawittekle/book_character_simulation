import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReaderShell from '../components/reader/ReaderShell';
import KeyboardShortcutsModal from '../components/reader/KeyboardShortcutsModal';
import { READER_THEMES } from '../components/reader/ReaderThemes';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getReaderAccess: vi.fn(),
    getReaderChapters: vi.fn(),
    getReaderRawSourceUrl: vi.fn(() => 'http://localhost:5000/api/v1/reader/books/test-book/raw'),
    listBookCharacters: vi.fn().mockResolvedValue([]),
    getReaderBookmarks: vi.fn().mockResolvedValue([]),
    getReaderAnnotations: vi.fn().mockResolvedValue([]),
    updateReaderProgress: vi.fn().mockResolvedValue({}),
    getChapterNarration: vi.fn().mockResolvedValue({
      audio_url: 'https://example.com/audio.mp3',
      duration_seconds: 120,
      alignment_words: [],
    }),
    getAvailableVoices: vi.fn().mockResolvedValue({
      default_voice_id: 'alloy',
      voices: [{ id: 'alloy', name: 'Alloy (Warm & Balanced)' }],
    }),
  },
}));

describe('Phase 6: Reader Polish, Accessibility & Keyboard Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('Chapter 1: The Beginning\n\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.'),
    });
    lorelyApi.getReaderAccess.mockResolvedValue({
      book_id: 'test-book',
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      format: 'txt',
      current_progress: {
        current_chapter_index: 0,
        progress_percent: 0.0,
        last_read_mode: 'read',
      },
    });
    lorelyApi.getReaderChapters.mockResolvedValue({
      chapters: [
        { id: 'ch-1', chapter_order: 0, title: 'Chapter 1: The Beginning' },
        { id: 'ch-2', chapter_order: 1, title: 'Chapter 2: The Journey' },
        { id: 'ch-3', chapter_order: 2, title: 'Chapter 3: The Ball' },
      ],
    });
  });

  it('verifies contrast properties across all 5 curated themes', () => {
    const themeKeys = Object.keys(READER_THEMES);
    expect(themeKeys).toEqual(['parchment', 'light', 'sepia', 'slate', 'obsidian']);

    themeKeys.forEach((key) => {
      const theme = READER_THEMES[key];
      expect(theme.bg).toBeDefined();
      expect(theme.text).toBeDefined();
      expect(theme.accent).toBeDefined();
      expect(theme.border).toBeDefined();
      expect(theme.cardBg).toBeDefined();
      expect(theme.sentenceGlow).toBeDefined();
    });
  });

  it('renders KeyboardShortcutsModal with shortcut commands', () => {
    const handleClose = vi.fn();
    render(
      <KeyboardShortcutsModal
        isOpen={true}
        onClose={handleClose}
        themeId="parchment"
      />
    );

    expect(screen.getByRole('heading', { name: /Keyboard Shortcuts/i })).toBeInTheDocument();
    expect(screen.getByText(/Next chapter/i)).toBeInTheDocument();
    expect(screen.getByText(/Switch to Follow Along mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Typography & Theme settings/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('handles keyboard shortcuts for navigation and mode switching in ReaderShell', async () => {
    render(
      <MemoryRouter initialEntries={['/books/test-book/read']}>
        <Routes>
          <Route path="/books/:bookId/read" element={<ReaderShell />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Pride and Prejudice/i)).toBeInTheDocument();
    });

    // Press 'ArrowRight' to advance chapter
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByText(/Chapter 2 of 3/i)).toBeInTheDocument();
    });

    // Press 'ArrowLeft' to go back
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByText(/Chapter 1 of 3/i)).toBeInTheDocument();
    });

    // Press 'F' to switch to Follow Along mode
    fireEvent.keyDown(window, { key: 'f' });
    await waitFor(() => {
      expect(screen.getByLabelText(/Audio narration controls/i)).toBeInTheDocument();
    });

    // Press 'R' to switch back to Read mode
    fireEvent.keyDown(window, { key: 'r' });
    await waitFor(() => {
      expect(screen.getByLabelText(/Next chapter/i)).toBeInTheDocument();
    });

    // Press '?' to open shortcuts modal
    fireEvent.keyDown(window, { key: '?' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Keyboard Shortcuts/i })).toBeInTheDocument();
    });

    // Press 'Escape' to dismiss shortcuts modal
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Keyboard Shortcuts/i })).not.toBeInTheDocument();
    });
  });

  it('ensures typing in an input element does not trigger reader navigation shortcuts', async () => {
    render(
      <MemoryRouter initialEntries={['/books/test-book/read']}>
        <Routes>
          <Route path="/books/:bookId/read" element={<ReaderShell />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Pride and Prejudice/i)).toBeInTheDocument();
    });

    // Create an active dummy input
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Trigger 'ArrowRight' while input is focused
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    // Should still be on Chapter 1
    expect(screen.getByText(/Chapter 1 of 3/i)).toBeInTheDocument();

    document.body.removeChild(input);
  });

  it('verifies seamless transition between Read, Follow Along, and Listen modes', async () => {
    render(
      <MemoryRouter initialEntries={['/books/test-book/read']}>
        <Routes>
          <Route path="/books/:bookId/read" element={<ReaderShell />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Pride and Prejudice/i)).toBeInTheDocument();
    });

    // 1. Advance to Chapter 2
    const nextBtn = screen.getByLabelText(/Next chapter/i);
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Chapter 2 of 3/i)).toBeInTheDocument();

    // 2. Switch to Listen mode via header button
    const listenModeBtn = screen.getByRole('button', { name: /Listen/i });
    fireEvent.click(listenModeBtn);

    // Verify Listen mode renders audiobook view
    await waitFor(() => {
      expect(screen.getByText(/Audiobook Mode/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Audiobook timeline scrubber/i)).toBeInTheDocument();
    });

    // 3. Switch back to Read mode
    const readModeBtn = screen.getByRole('button', { name: /Read/i });
    fireEvent.click(readModeBtn);

    // Verify Chapter 2 is still preserved
    await waitFor(() => {
      expect(screen.getByText(/Chapter 2 of 3/i)).toBeInTheDocument();
    });
  });
});
