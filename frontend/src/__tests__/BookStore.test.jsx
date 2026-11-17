import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BookStore from '../pages/BookStore';
import { lorelyApi } from '../services/lorelyApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({
      accessToken: 'test-token',
    }),
  };
});

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    listFeaturedCatalog: vi.fn(),
    addCatalogBookToLibrary: vi.fn(),
  },
}));

describe('BookStore Page (Phase 4 Dedicated Store)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/store');
    lorelyApi.listFeaturedCatalog.mockResolvedValue({
      books: [
        {
          id: 'book-psychology-of-money',
          title: 'The Psychology of Money',
          author: 'Morgan Housel',
          genre: 'Money/Investing',
          character_count: 3,
          cover_url: '/covers/the_midnight_letters.svg',
          summary: 'Timeless lessons on wealth and greed.',
          visibility: 'featured',
          is_in_library: false,
        },
        {
          id: 'book-company-of-one',
          title: 'Company of One',
          author: 'Paul Jarvis',
          genre: 'Business',
          character_count: 2,
          cover_url: '/covers/the_last_voyage.svg',
          summary: 'Why staying small is the next big thing.',
          visibility: 'featured',
          is_in_library: true,
        },
        {
          id: 'book-how-innovation-works',
          title: 'How Innovation Works',
          author: 'Matt Ridley',
          genre: 'Design',
          character_count: 5,
          cover_url: '/covers/echoes_of_tomorrow.svg',
          summary: 'A fascinating chronicle of innovation.',
          visibility: 'featured',
          is_in_library: false,
        },
        {
          id: 'book-picture-dorian-gray',
          title: 'The Picture of Dorian Gray',
          author: 'Oscar Wilde',
          genre: 'Classic Literature',
          character_count: 4,
          cover_url: '/covers/the_dream_of_a_ridiculous_man.svg',
          summary: 'A gothic novel of corruption and the soul.',
          visibility: 'featured',
          is_in_library: false,
        },
      ],
    });
    lorelyApi.addCatalogBookToLibrary.mockResolvedValue({ success: true });
  });

  it('renders the Book Store hero banner, breadcrumbs, and stats badge', async () => {
    render(
      <MemoryRouter initialEntries={['/store']}>
        <BookStore />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Book Store' })).toBeInTheDocument();
    expect(screen.getByText('Official Catalog')).toBeInTheDocument();
    expect(screen.getByText('← Discover')).toBeInTheDocument();
  });

  it('renders catalog books with 3D cover, genre badge, and character count', async () => {
    render(
      <MemoryRouter initialEntries={['/store']}>
        <BookStore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
      expect(screen.getByText('Morgan Housel')).toBeInTheDocument();
      expect(screen.getAllByText('3 Characters').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Company of One')).toBeInTheDocument();
      expect(screen.getByText('How Innovation Works')).toBeInTheDocument();
      expect(screen.getByText('The Picture of Dorian Gray')).toBeInTheDocument();
    });
  });

  it('filters books when category pill is selected', async () => {
    render(
      <MemoryRouter initialEntries={['/store']}>
        <BookStore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
    });

    const businessTab = screen.getByRole('tab', { name: 'Business' });
    fireEvent.click(businessTab);

    expect(screen.getByText('Company of One')).toBeInTheDocument();
    expect(screen.queryByText('The Psychology of Money')).not.toBeInTheDocument();
    expect(screen.queryByText('How Innovation Works')).not.toBeInTheDocument();
  });

  it('filters books in real time when typing in search bar', async () => {
    render(
      <MemoryRouter initialEntries={['/store']}>
        <BookStore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search books by title, author, or keyword...');
    fireEvent.change(searchInput, { target: { value: 'innovation' } });

    expect(screen.getByText('How Innovation Works')).toBeInTheDocument();
    expect(screen.queryByText('The Psychology of Money')).not.toBeInTheDocument();
    expect(screen.queryByText('Company of One')).not.toBeInTheDocument();
  });

  it('sorts books by character count when sort option changes', async () => {
    render(
      <MemoryRouter initialEntries={['/store']}>
        <BookStore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('How Innovation Works')).toBeInTheDocument();
    });

    const sortSelect = screen.getByLabelText('Sort by:');
    fireEvent.change(sortSelect, { target: { value: 'characters' } });

    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    // 'How Innovation Works' has 5 characters, should appear before 'The Psychology of Money' (3)
    const innovationIndex = titles.indexOf('How Innovation Works');
    const psychologyIndex = titles.indexOf('The Psychology of Money');
    expect(innovationIndex).toBeLessThan(psychologyIndex);
  });

  it('exports a book to bookshelf when "+ Export to Bookshelf" is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/store']}>
        <BookStore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: 'Export The Psychology of Money to Bookshelf' });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(lorelyApi.addCatalogBookToLibrary).toHaveBeenCalledWith(
        'book-psychology-of-money',
        {},
        'test-token',
      );
      expect(screen.getByRole('button', { name: 'In Bookshelf: Read The Psychology of Money' })).toBeInTheDocument();
      expect(screen.getByText(/Exported "The Psychology of Money" and 3 characters to your Bookshelf/i)).toBeInTheDocument();
      expect(screen.getByText('Go to Bookshelf →')).toBeInTheDocument();
    });
  });

  it('displays "In Bookshelf" and "Read Now →" for already imported books', async () => {
    render(
      <MemoryRouter initialEntries={['/store']}>
        <BookStore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'In Bookshelf: Read Company of One' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open reader for Company of One' })).toBeInTheDocument();
    });

    const readBtn = screen.getByRole('button', { name: 'Open reader for Company of One' });
    fireEvent.click(readBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/books/book-company-of-one/read');
  });

  it('renders clean empty state with Reset Filters button when no books match', async () => {
    render(
      <MemoryRouter initialEntries={['/store']}>
        <BookStore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search books by title, author, or keyword...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-book-xyz-123' } });

    expect(screen.getByText('No books match your criteria')).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: 'Reset Filters' });
    fireEvent.click(resetBtn);

    expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
  });
});
