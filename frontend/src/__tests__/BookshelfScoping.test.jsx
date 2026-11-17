import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MyLibrary from '../pages/MyLibrary';
import CharacterGallery from '../pages/CharacterGallery';
import { lorelyApi } from '../services/lorelyApi';

const mockNavigate = vi.fn();
const mockOpenAddBookModal = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    useOutletContext: () => ({
      accessToken: 'test-token',
      openAddBookModal: mockOpenAddBookModal,
    }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    listBooks: vi.fn(),
    listCharacters: vi.fn(),
    getBookDetails: vi.fn(),
  },
}));

describe('Bookshelf & Character Scoping Suite (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MyLibrary (Bookshelf Scoping)', () => {
    it('calls lorelyApi.listBooks with scope="mine" to isolate bookshelf from unselected catalog books', async () => {
      lorelyApi.listBooks.mockResolvedValue([
        {
          id: 'book-user-upload-1',
          title: 'My Custom Manuscript',
          author: 'Me',
          is_owner: true,
          visibility: 'private',
        },
        {
          id: 'book-exported-from-store',
          title: 'The Psychology of Money',
          author: 'Morgan Housel',
          is_owner: false,
          is_catalog_item: true,
          visibility: 'featured',
        },
      ]);

      render(
        <MemoryRouter initialEntries={['/bookshelf']}>
          <MyLibrary />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(lorelyApi.listBooks).toHaveBeenCalledWith('mine', 'test-token');
        expect(screen.getByText('My Custom Manuscript')).toBeInTheDocument();
        expect(screen.getByText('The Psychology of Money')).toBeInTheDocument();
      });
    });

    it('renders empty bookshelf state with Book Store CTA when user has no books', async () => {
      lorelyApi.listBooks.mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/bookshelf']}>
          <MyLibrary />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Your Bookshelf is empty')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Browse Book Store →' })).toBeInTheDocument();
        expect(screen.getByText('+ Ingest Manuscript')).toBeInTheDocument();
      });

      const storeCta = screen.getByRole('button', { name: 'Browse Book Store →' });
      fireEvent.click(storeCta);
      expect(mockNavigate).toHaveBeenCalledWith('/store');
    });

    it('navigates to /store when "Explore Book Store →" in header is clicked', async () => {
      lorelyApi.listBooks.mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/bookshelf']}>
          <MyLibrary />
        </MemoryRouter>,
      );

      const headerStoreBtn = screen.getByText('Explore Book Store →');
      fireEvent.click(headerStoreBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/store');
    });
  });

  describe('CharacterGallery (Character Isolation)', () => {
    it('renders empty character state directing user to Book Store when no characters exist', async () => {
      lorelyApi.listCharacters.mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/characters']}>
          <CharacterGallery />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('No Characters Available')).toBeInTheDocument();
        expect(screen.getByText(/Your character gallery reflects books currently on your Bookshelf/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Browse Book Store →' })).toBeInTheDocument();
      });

      const storeBtn = screen.getByRole('button', { name: 'Browse Book Store →' });
      fireEvent.click(storeBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/store');
    });
  });
});
