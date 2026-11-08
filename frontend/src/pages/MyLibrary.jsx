import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import BookCard from '../components/BookCard';
import { lorelyApi } from '../services/lorelyApi';
import './MyLibrary.css';

const FALLBACK_BOOKS = [
  {
    id: 'book-dostoevsky-white-nights',
    title: 'White Nights',
    author: 'Fyodor Dostoevsky',
    character_count: 2,
    cover_url: '/covers/white_nights.svg',
    summary: 'A sentimental novel from the recollections of a dreamer across the luminous white nights of St. Petersburg.',
    visibility: 'featured',
  },
  {
    id: 'book-dostoevsky-ridiculous-man',
    title: 'The Dream of a Ridiculous Man',
    author: 'Fyodor Dostoevsky',
    character_count: 1,
    cover_url: '/covers/the_dream_of_a_ridiculous_man.svg',
    summary: 'A visionary philosophical revelation on an uncorrupted duplicate earth.',
    visibility: 'featured',
  },
  {
    id: 'book-dostoevsky-honest-thief',
    title: 'An Honest Thief',
    author: 'Fyodor Dostoevsky',
    character_count: 2,
    cover_url: '/covers/an_honest_thief.svg',
    summary: 'A touching narrative of conscience and forgiveness in St. Petersburg.',
    visibility: 'featured',
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
        <button
          type="button"
          className="page-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ← Back
        </button>
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
