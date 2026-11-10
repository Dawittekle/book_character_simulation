import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReaderSettingsModal from '../components/reader/ReaderSettingsModal';
import TableOfContentsDrawer from '../components/reader/TableOfContentsDrawer';
import TextReaderAdapter from '../components/reader/TextReaderAdapter';
import SelectionActionPill from '../components/reader/SelectionActionPill';
import ReaderShell from '../components/reader/ReaderShell';
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
  },
}));

describe('Reader Display & Typography Settings', () => {
  it('renders all 5 curated themes and handles theme change', () => {
    const handleUpdate = vi.fn();
    const settings = {
      theme: 'parchment',
      fontFamily: 'serif',
      fontSize: 18,
      lineHeight: 1.75,
      columnWidth: 'standard',
    };

    render(
      <ReaderSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={settings}
        onUpdateSettings={handleUpdate}
      />
    );

    expect(screen.getByText(/Reading Display/i)).toBeInTheDocument();
    expect(screen.getByText(/Warm/i)).toBeInTheDocument();
    expect(screen.getByText(/Pure/i)).toBeInTheDocument();
    expect(screen.getByText(/Quiet/i)).toBeInTheDocument();
    expect(screen.getByText(/Dark/i)).toBeInTheDocument();
    expect(screen.getByText(/Obsidian/i)).toBeInTheDocument();

    // Click 'Pure White' theme
    const lightBtn = screen.getByTitle('Pure White');
    fireEvent.click(lightBtn);
    expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ theme: 'light' }));
  });

  it('adjusts font size using the A- and A+ steppers', () => {
    const handleUpdate = vi.fn();
    const settings = {
      theme: 'parchment',
      fontFamily: 'serif',
      fontSize: 18,
      lineHeight: 1.75,
      columnWidth: 'standard',
    };

    render(
      <ReaderSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={settings}
        onUpdateSettings={handleUpdate}
      />
    );

    const increaseBtn = screen.getByRole('button', { name: /Increase font size/i });
    fireEvent.click(increaseBtn);
    expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 20 }));

    const decreaseBtn = screen.getByRole('button', { name: /Decrease font size/i });
    fireEvent.click(decreaseBtn);
    expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 16 }));
  });
});

describe('Table of Contents Drawer', () => {
  it('renders chapter entries and invokes onSelectChapter', () => {
    const handleSelect = vi.fn();
    const chapters = [
      { id: '1', chapter_order: 0, title: 'Chapter 1: The Beginning' },
      { id: '2', chapter_order: 1, title: 'Chapter 2: The Journey' },
    ];

    render(
      <TableOfContentsDrawer
        isOpen={true}
        onClose={vi.fn()}
        chapters={chapters}
        currentChapterIndex={0}
        onSelectChapter={handleSelect}
        bookTitle="Pride and Prejudice"
      />
    );

    expect(screen.getByText(/Table of Contents/i)).toBeInTheDocument();
    expect(screen.getByText(/Chapter 1: The Beginning/i)).toBeInTheDocument();
    expect(screen.getByText(/Chapter 2: The Journey/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Chapter 2: The Journey/i));
    expect(handleSelect).toHaveBeenCalledWith(1);
  });
});

describe('Text Reader Adapter', () => {
  it('renders sentences cleanly and applies sentence glow to active index', () => {
    const rawText = "It is a truth universally acknowledged. A single man in possession of a good fortune must be in want of a wife.";
    const settings = {
      theme: 'parchment',
      fontFamily: 'serif',
      fontSize: 18,
      lineHeight: 1.75,
      columnWidth: 'standard',
    };

    render(
      <TextReaderAdapter
        rawText={rawText}
        chapters={[{ chapter_order: 0, title: 'Chapter 1' }]}
        currentChapterIndex={0}
        settings={settings}
        activeSentenceIndex={0}
      />
    );

    expect(screen.getByRole('heading', { name: /Chapter 1/i })).toBeInTheDocument();
    const firstSentence = screen.getByText(/It is a truth universally acknowledged\./i);
    expect(firstSentence).toBeInTheDocument();
    expect(firstSentence.className).toContain('font-medium');
  });
});

describe('Selection Action Pill', () => {
  it('renders floating options and invokes onAskCharacter', () => {
    const handleAsk = vi.fn();
    const handleCopy = vi.fn();

    const selection = {
      text: 'His character is thereby complete.',
      rect: { top: 200, left: 150, width: 220, height: 30 },
    };

    render(
      <SelectionActionPill
        selection={selection}
        onAskCharacter={handleAsk}
        onClear={vi.fn()}
      />
    );

    const askBtn = screen.getByRole('button', { name: /Ask Character/i });
    expect(askBtn).toBeInTheDocument();
    fireEvent.click(askBtn);
    expect(handleAsk).toHaveBeenCalledWith(selection);
  });
});

describe('Reader Shell Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('Chapter 1\nIt is a truth universally acknowledged.'),
    });
  });

  it('fetches access metadata and renders the reader canvas', async () => {
    lorelyApi.getReaderAccess.mockResolvedValueOnce({
      book_id: 'test-book-1',
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      format: 'txt',
      stream_url: 'http://localhost:5000/api/v1/reader/books/test-book-1/raw',
      current_progress: {
        current_chapter_index: 0,
        progress_percent: 15,
        last_read_mode: 'read',
      },
    });

    lorelyApi.getReaderChapters.mockResolvedValueOnce({
      chapters: [
        { id: 'c1', chapter_order: 0, title: 'Chapter 1' },
        { id: 'c2', chapter_order: 1, title: 'Chapter 2' },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/books/test-book-1/read']}>
        <Routes>
          <Route path="/books/:bookId/read" element={<ReaderShell session={{ access_token: 'fake-jwt' }} />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial loading state
    expect(screen.getByText(/Opening Reader\.\.\./i)).toBeInTheDocument();

    // Resolves and displays book title
    await waitFor(() => {
      expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    });

    // Check mode buttons
    expect(screen.getByRole('button', { name: /^Read$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Follow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Listen/i })).toBeInTheDocument();

    // Open settings modal
    const settingsBtn = screen.getByLabelText(/Display settings/i);
    fireEvent.click(settingsBtn);
    expect(screen.getByText(/Reading Display/i)).toBeInTheDocument();
  });
});
