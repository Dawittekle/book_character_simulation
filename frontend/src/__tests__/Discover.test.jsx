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

describe('Discover Page (Refined Dribbble Layout & BookFusion 3-Dots)', () => {
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
          is_in_library: true, // Already in bookshelf! Should be filtered out from recommendations
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
        {
          id: 'book-white-nights',
          title: 'White Nights',
          author: 'Fyodor Dostoevsky',
          character_count: 2,
          cover_url: '/covers/white_nights.svg',
          summary: 'A sentimental novel from St. Petersburg.',
          visibility: 'featured',
          is_in_library: false,
          genre: 'Classic Literature',
        },
      ],
    });
    lorelyApi.addCatalogBookToLibrary.mockResolvedValue({ success: true });
  });

  it('renders the Discover heading, search capsule, and does NOT render "Book Category"', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('find the book you like...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();

    // "Book Category" section must be removed
    expect(screen.queryByText('Book Category')).not.toBeInTheDocument();
  });

  it('renders "Book Recommendation" shelf with unexported 3D books only', async () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    expect(screen.getByText('Book Recommendation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all books in book store' })).toBeInTheDocument();

    await waitFor(() => {
      // Unexported books are visible
      expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
      expect(screen.getByText('Morgan Housel')).toBeInTheDocument();
      expect(screen.getByText('How Innovation Works')).toBeInTheDocument();
      expect(screen.getByText('The Picture of Dorian Gray')).toBeInTheDocument();

      // Already exported book ('Company of One') is excluded from recommendations
      expect(screen.queryByText('Company of One')).not.toBeInTheDocument();
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

  it('opens BookFusion-style three-dot menu and exports book to bookshelf, removing it from recommendations', async () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
    });

    const menuTrigger = screen.getByRole('button', { name: 'Options for The Psychology of Money' });
    expect(menuTrigger).toBeInTheDocument();

    // Click 3 dots to open BookFusion menu
    fireEvent.click(menuTrigger);

    const exportMenuItem = screen.getByRole('menuitem', { name: /Export to Bookshelf/i });
    expect(exportMenuItem).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Inspect Book Details/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Character Cast/i })).toBeInTheDocument();

    // Click "Export to Bookshelf"
    fireEvent.click(exportMenuItem);

    await waitFor(() => {
      expect(lorelyApi.addCatalogBookToLibrary).toHaveBeenCalledWith(
        'book-psychology-of-money',
        {},
        'test-token',
      );
      // Once exported, it is removed from the recommendations section
      expect(screen.queryByText('The Psychology of Money')).not.toBeInTheDocument();
      // Toast notification is shown
      expect(screen.getByText(/Exported "The Psychology of Money" to your Bookshelf/i)).toBeInTheDocument();
      expect(screen.getByText('Go to Bookshelf →')).toBeInTheDocument();
    });
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
