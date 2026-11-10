import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookOverview from '../pages/BookOverview';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getBookDetails: vi.fn(),
    getReaderChapters: vi.fn(),
    getReaderProgress: vi.fn(),
    listCharacters: vi.fn(),
  },
}));

describe('BookOverview Page (Phase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders book overview with Continue Reading button when progress is in progress', async () => {
    lorelyApi.getBookDetails.mockResolvedValueOnce({
      id: 'book-pride',
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      visibility: 'featured',
      summary: 'A classic story of manners and marriage in Regency England.',
      format: 'txt',
      reading_status: 'in_progress',
      reading_progress: {
        current_chapter_index: 4,
        progress_percent: 38.5,
      },
      chapters: [
        { id: 'c1', chapter_order: 0, title: 'Chapter 1' },
        { id: 'c2', chapter_order: 1, title: 'Chapter 2' },
        { id: 'c3', chapter_order: 2, title: 'Chapter 3' },
        { id: 'c4', chapter_order: 3, title: 'Chapter 4' },
        { id: 'c5', chapter_order: 4, title: 'Chapter 5: Netherfield Ball' },
      ],
      total_chapters: 5,
    });

    lorelyApi.getReaderChapters.mockResolvedValueOnce({
      chapters: [
        { id: 'c1', chapter_order: 0, title: 'Chapter 1' },
        { id: 'c2', chapter_order: 1, title: 'Chapter 2' },
        { id: 'c3', chapter_order: 2, title: 'Chapter 3' },
        { id: 'c4', chapter_order: 3, title: 'Chapter 4' },
        { id: 'c5', chapter_order: 4, title: 'Chapter 5: Netherfield Ball' },
      ],
    });

    lorelyApi.getReaderProgress.mockResolvedValueOnce({
      progress: {
        current_chapter_index: 4,
        progress_percent: 38.5,
      },
    });

    lorelyApi.listCharacters.mockResolvedValueOnce({
      characters: [
        { id: 'char-1', name: 'Elizabeth Bennet', role: 'Protagonist' },
        { id: 'char-2', name: 'Mr. Darcy', role: 'Love Interest' },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/books/book-pride']}>
        <Routes>
          <Route path="/books/:bookId" element={<BookOverview />} />
        </Routes>
      </MemoryRouter>
    );

    // Shows loading first
    expect(screen.getByText(/Loading literary dossier/i)).toBeInTheDocument();

    // Resolves and displays title and author
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pride and Prejudice' })).toBeInTheDocument();
      expect(screen.getByText(/Jane Austen/i)).toBeInTheDocument();
    });

    // Reading progress card and badge
    expect(screen.getByText(/Reading in Progress/i)).toBeInTheDocument();
    expect(screen.getAllByText(/39%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Last at: Chapter 5: Netherfield Ball/i)).toBeInTheDocument();

    // Primary CTA is "Continue Reading"
    expect(screen.getByRole('button', { name: /Continue Reading \(Ch\. 5 · 39%\)/i })).toBeInTheDocument();

    // Action buttons
    expect(screen.getByRole('button', { name: /Listen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cast/i })).toBeInTheDocument();

    // Switch to chapters tab and verify outline
    const chaptersTab = screen.getByRole('button', { name: /Chapters \(5\)/i });
    fireEvent.click(chaptersTab);
    expect(screen.getAllByText(/Chapter 5: Netherfield Ball/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Read Book" for a new unread book', async () => {
    lorelyApi.getBookDetails.mockResolvedValueOnce({
      id: 'book-new',
      title: 'Sense and Sensibility',
      author: 'Jane Austen',
      visibility: 'featured',
      summary: 'Story of the Dashwood sisters.',
      format: 'epub',
      reading_status: 'not_started',
      reading_progress: null,
      chapters: [],
      total_chapters: 0,
    });

    lorelyApi.getReaderChapters.mockResolvedValueOnce({ chapters: [] });
    lorelyApi.getReaderProgress.mockResolvedValueOnce({ progress: null });
    lorelyApi.listCharacters.mockResolvedValueOnce({ characters: [] });

    render(
      <MemoryRouter initialEntries={['/books/book-new']}>
        <Routes>
          <Route path="/books/:bookId" element={<BookOverview />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sense and Sensibility' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Read Book/i })).toBeInTheDocument();
  });
});
