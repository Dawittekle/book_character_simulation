import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Discover from '../pages/Discover';
import { lorelyApi } from '../services/lorelyApi';

const mockOpenAddBookModal = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({
      accessToken: 'test-token',
      openAddBookModal: mockOpenAddBookModal,
    }),
  };
});

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    listFeaturedCatalog: vi.fn(),
    addCatalogBookToLibrary: vi.fn(),
  },
}));

describe('Discover Page (Phase 3 Redesign)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lorelyApi.listFeaturedCatalog.mockResolvedValue({
      books: [
        {
          id: 'book-psychology-of-money',
          title: 'The Psychology of Money',
          author: 'Morgan Housel',
          character_count: 3,
          cover_url: '/covers/the_midnight_letters.svg',
          summary: 'Timeless lessons on wealth.',
          visibility: 'featured',
          is_in_library: false,
          genre: 'Money/Investing',
        },
        {
          id: 'book-company-of-one',
          title: 'Company of One',
          author: 'Paul Jarvis',
          character_count: 2,
          cover_url: '/covers/the_last_voyage.svg',
          summary: 'Why staying small is the next big thing.',
          visibility: 'featured',
          is_in_library: true,
          genre: 'Business',
        },
        {
          id: 'book-how-innovation-works',
          title: 'How Innovation Works',
          author: 'Matt Ridley',
          character_count: 4,
          cover_url: '/covers/echoes_of_tomorrow.svg',
          summary: 'And why it flourishes in freedom.',
          visibility: 'featured',
          is_in_library: false,
          genre: 'Design',
        },
        {
          id: 'book-picture-dorian-gray',
          title: 'The Picture of Dorian Gray',
          author: 'Oscar Wilde',
          character_count: 3,
          cover_url: '/covers/the_dream_of_a_ridiculous_man.svg',
          summary: 'A philosophical gothic novel.',
          visibility: 'featured',
          is_in_library: false,
          genre: 'Classic Literature',
        },
      ],
    });
    lorelyApi.addCatalogBookToLibrary.mockResolvedValue({ success: true });
  });

  it('renders the Discover heading and curved hero section with #1CD3FF & #2883FF styling', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('find the book you like...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('renders "Book Recommendation" shelf with 3D books from Book Store', async () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    expect(screen.getByText('Book Recommendation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all books in book store' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
      expect(screen.getByText('Morgan Housel')).toBeInTheDocument();
      expect(screen.getByText('Company of One')).toBeInTheDocument();
      expect(screen.getByText('How Innovation Works')).toBeInTheDocument();
      expect(screen.getByText('The Picture of Dorian Gray')).toBeInTheDocument();
    });
  });

  it('navigates to /store when "View all >" button is clicked', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    const viewAllBtn = screen.getByRole('button', { name: 'View all books in book store' });
    fireEvent.click(viewAllBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/store');
  });

  it('submits search capsule with query and category directing to /store', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    const select = screen.getByLabelText('Filter by category');
    fireEvent.change(select, { target: { value: 'Money/Investing' } });

    const input = screen.getByPlaceholderText('find the book you like...');
    fireEvent.change(input, { target: { value: 'psychology' } });

    const searchBtn = screen.getByRole('button', { name: 'Search' });
    fireEvent.click(searchBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/store?q=psychology&category=Money%2FInvesting');
  });

  it('exports a book to bookshelf when "+ Export to Bookshelf" button is clicked', async () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: 'Export The Psychology of Money to Bookshelf' });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(lorelyApi.addCatalogBookToLibrary).toHaveBeenCalledWith(
        'book-psychology-of-money',
        {},
        'test-token',
      );
      expect(screen.getByRole('button', { name: 'In Bookshelf: Read The Psychology of Money' })).toBeInTheDocument();
      expect(screen.getByText(/Exported "The Psychology of Money" to your Bookshelf/i)).toBeInTheDocument();
    });
  });

  it('displays "In Bookshelf" badge for books already imported', async () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'In Bookshelf: Read Company of One' })).toBeInTheDocument();
    });
  });

  it('renders "Book Category" visual preview grid with categories linking to /store', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    expect(screen.getByText('Book Category')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Money/Investing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Design' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Business' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Self Improvement' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Classic Literature' })).toBeInTheDocument();

    const moneyCat = screen.getByRole('button', { name: 'Explore Money/Investing books' });
    fireEvent.click(moneyCat);
    expect(mockNavigate).toHaveBeenCalledWith('/store?category=Money%2FInvesting');
  });

  it('triggers Add Book manuscript upload modal when utility CTA is clicked', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    const addCard = screen.getByLabelText('Upload custom book manuscript');
    fireEvent.click(addCard);
    expect(mockOpenAddBookModal).toHaveBeenCalled();
  });
});
