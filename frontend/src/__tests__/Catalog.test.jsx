import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BookCard from '../components/BookCard';
import MyLibrary from '../pages/MyLibrary';
import AddBookModal from '../components/AddBookModal';
import { lorelyApi } from '../services/lorelyApi';

const mockNavigate = vi.fn();
const mockOpenAddBookModal = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({
      accessToken: 'test-token',
      openAddBookModal: mockOpenAddBookModal,
    }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

describe('Catalog & Library Suite (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BookCard Component', () => {
    const sampleBook = {
      id: 'book-crime-and-punishment',
      title: 'Crime and Punishment',
      author: 'Fyodor Dostoevsky',
      character_count: 5,
      cover_url: '/covers/crime_and_punishment.svg',
      visibility: 'featured',
    };

    it('renders title, author, character count pill, and classic badge', () => {
      render(
        <BrowserRouter>
          <BookCard book={sampleBook} />
        </BrowserRouter>
      );

      expect(screen.getByText('Crime and Punishment')).toBeInTheDocument();
      expect(screen.getByText('Fyodor Dostoevsky')).toBeInTheDocument();
      expect(screen.getByText('5 characters')).toBeInTheDocument();
      expect(screen.getByText('Classic')).toBeInTheDocument();
      expect(screen.getByText('Open Book')).toBeInTheDocument();
      const img = screen.getByAltText('Cover of Crime and Punishment');
      expect(img).toBeInTheDocument();
    });

    it('navigates to book details on card click', () => {
      render(
        <BrowserRouter>
          <BookCard book={sampleBook} />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Explore characters from Crime and Punishment/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/books/book-crime-and-punishment');
    });

    it('invokes custom onClick handler if provided', () => {
      const customClick = vi.fn();
      render(
        <BrowserRouter>
          <BookCard book={sampleBook} onClick={customClick} />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Explore characters from Crime and Punishment/i }));
      expect(customClick).toHaveBeenCalledWith(sampleBook);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('triggers action on Enter keypress', () => {
      render(
        <BrowserRouter>
          <BookCard book={sampleBook} />
        </BrowserRouter>
      );

      const card = screen.getByRole('button', { name: /Explore characters from Crime and Punishment/i });
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalledWith('/books/book-crime-and-punishment');
    });
  });

  describe('MyLibrary Page', () => {
    it('renders page header, title, subtitle, and add book button', () => {
      render(
        <BrowserRouter>
          <MyLibrary />
        </BrowserRouter>
      );

      expect(screen.getByText(/My Literary/i)).toBeInTheDocument();
      expect(screen.getByText('Shelf')).toBeInTheDocument();
      expect(screen.getByText(/Explore your imported manuscripts/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Go back/i })).toBeInTheDocument();
      expect(screen.getByText('+ Add a Book')).toBeInTheDocument();
    });

    it('switches between filter tabs', () => {
      render(
        <BrowserRouter>
          <MyLibrary />
        </BrowserRouter>
      );

      const classicsTab = screen.getByText('Classics & Masterpieces');
      fireEvent.click(classicsTab);
      expect(classicsTab).toHaveClass('active');

      const myUploadsTab = screen.getByText('My Uploads');
      fireEvent.click(myUploadsTab);
      expect(myUploadsTab).toHaveClass('active');
    });

    it('triggers add book modal when add book button is clicked', () => {
      render(
        <BrowserRouter>
          <MyLibrary />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByText('+ Add a Book'));
      expect(mockOpenAddBookModal).toHaveBeenCalled();
    });
  });

  describe('AddBookModal Component', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(
        <AddBookModal isOpen={false} onClose={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders modal dialog when isOpen is true and toggles tabs', () => {
      render(
        <AddBookModal isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByText('Add a Book to Your Library')).toBeInTheDocument();
      expect(screen.getByText('📁 Upload Document')).toBeInTheDocument();
      expect(screen.getByText('✍️ Paste Text')).toBeInTheDocument();

      // Switch to Paste tab
      fireEvent.click(screen.getByText('✍️ Paste Text'));
      expect(screen.getByPlaceholderText(/Paste book chapters or story text here/i)).toBeInTheDocument();

      // Switch back to Upload tab
      fireEvent.click(screen.getByText('📁 Upload Document'));
      expect(screen.getByText(/Click or drop PDF, EPUB, or TXT file here/i)).toBeInTheDocument();
    });

    it('calls onClose when close button or Cancel is clicked', () => {
      const handleClose = vi.fn();
      render(
        <AddBookModal isOpen={true} onClose={handleClose} />
      );

      fireEvent.click(screen.getByText('Cancel'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('validates empty submission', () => {
      render(
        <AddBookModal isOpen={true} onClose={vi.fn()} />
      );

      const inspectBtn = screen.getByRole('button', { name: /Inspect & Classify/i });
      expect(inspectBtn).toBeDisabled();
    });
  });
});
