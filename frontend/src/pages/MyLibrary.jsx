import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import BookCard from '../components/BookCard';
import { lorelyApi } from '../services/lorelyApi';
import './MyLibrary.css';

const FALLBACK_BOOKS = [
  {
    id: 'b-midnight-letters',
    title: 'The Midnight Letters',
    author: 'Elena Marlowe',
    character_count: 2,
    cover_url: '/covers/the_midnight_letters.svg',
    summary: 'A thoughtful correspondence exploring secrets of the coast and the power of second chances.',
  },
  {
    id: 'b-hidden-garden',
    title: 'The Hidden Garden',
    author: 'Frances Hodgson',
    character_count: 3,
    cover_url: '/covers/the_hidden_garden.svg',
    summary: 'An orphaned young girl discovers a locked, overgrown sanctuary on the Yorkshire moors.',
  },
  {
    id: 'b-echoes-tomorrow',
    title: 'Echoes of Tomorrow',
    author: 'Arthur Chandler',
    character_count: 4,
    cover_url: '/covers/echoes_of_tomorrow.svg',
    summary: 'A celestial mystery woven into the gears of an ancient clocktower.',
  },
  {
    id: 'b-last-voyage',
    title: 'The Last Voyage',
    author: 'Capt. S. Hawthorne',
    character_count: 2,
    cover_url: '/covers/the_last_voyage.svg',
    summary: 'A hazardous nautical expedition across uncharted southern seas.',
  },
];

export default function MyLibrary() {
  const { openAddBookModal, accessToken } = useOutletContext();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [books, setBooks] = useState(FALLBACK_BOOKS);
  const [filter, setFilter] = useState('all'); // 'all' | 'mine' | 'featured'
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function fetchBooks() {
      try {
        const list = await lorelyApi.listBooks(accessToken);
        if (mounted && list && list.length > 0) {
          setBooks(list);
        }
      } catch (err) {
        // Fall back to library smoothly
      }
    }
    fetchBooks();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const filteredBooks = books.filter((b) => {
    const matchesQuery =
      !query ||
      b.title.toLowerCase().includes(query.toLowerCase()) ||
      (b.author && b.author.toLowerCase().includes(query.toLowerCase()));

    if (!matchesQuery) return false;
    if (filter === 'mine') return b.is_owner;
    if (filter === 'featured') return b.visibility === 'featured';
    return true;
  });

  return (
    <div className="lorely-library-page" data-testid="my-library-page">
      <header className="library-header">
        <div className="library-title-group">
          <h1 className="library-title">My Literary Shelf</h1>
          <p className="library-subtitle">
            Explore your imported manuscripts, literary novels, and public classics.
          </p>
        </div>

        <button
          type="button"
          className="library-add-book-btn"
          onClick={openAddBookModal}
        >
          <span>+</span> Add a Book
        </button>
      </header>

      {/* Filter Tabs */}
      <div className="library-filters-row">
        <div className="library-filter-tabs">
          <button
            type="button"
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Works ({books.length})
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'featured' ? 'active' : ''}`}
            onClick={() => setFilter('featured')}
          >
            Classics & Masterpieces
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'mine' ? 'active' : ''}`}
            onClick={() => setFilter('mine')}
          >
            My Uploads
          </button>
        </div>

        {query && (
          <span className="library-search-indicator">
            Filtering by: “{query}”
          </span>
        )}
      </div>

      {/* Book Grid */}
      <div className="library-books-grid">
        {filteredBooks.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onClick={() => navigate(`/books/${book.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
