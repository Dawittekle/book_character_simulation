import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams, Link } from 'react-router-dom';
import BookCard from '../components/BookCard';
import PillButton from '../components/brand/PillButton';
import { Skeleton } from '../components/ui';
import { lorelyApi } from '../services/lorelyApi';
import './MyLibrary.css';

// Memory cache to prevent layout shift or flickering on page re-entry
let cachedLibraryBooks = null;

export default function MyLibrary() {
  const { openAddBookModal, accessToken } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [books, setBooks] = useState(cachedLibraryBooks || []);
  const [loading, setLoading] = useState(cachedLibraryBooks === null);
  const [filter, setFilter] = useState('all'); // 'all' | 'mine' | 'featured'
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function fetchBooks() {
      try {
        // Strictly fetch user's personal shelf (uploads + exported catalog books)
        const list = await lorelyApi.listBooks('mine', accessToken);
        if (mounted) {
          const validList = Array.isArray(list) ? list : [];
          cachedLibraryBooks = validList;
          setBooks(validList);
        }
      } catch (err) {
        // In offline/test environments, retain empty or cached state
      } finally {
        if (mounted) {
          setLoading(false);
        }
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
    if (filter === 'featured') return !b.is_owner || b.visibility === 'featured' || b.is_catalog_item;
    return true;
  });

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next);
  };

  return (
    <div className="lorely-library-page" data-testid="my-library-page">
      <header className="library-header">
        <div className="library-header-nav-row">
          <button
            type="button"
            className="page-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ← Back
          </button>

          <div className="library-header-actions">
            <button
              type="button"
              className="library-store-link-btn"
              onClick={() => navigate('/store')}
            >
              Explore Book Store →
            </button>
            <button
              type="button"
              className="library-add-book-btn"
              onClick={openAddBookModal}
            >
              + Add a Book
            </button>
          </div>
        </div>

        <div className="library-title-group">
          <h1 className="library-title">
            My Literary <span className="serif-italic">Shelf</span>
          </h1>
          <p className="library-subtitle">
            Explore your imported manuscripts, literary novels, and books exported from the Book Store.
          </p>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="library-filters-row">
        <div className="library-filter-tabs">
          <button
            type="button"
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Works ({loading && !books.length ? '...' : books.length})
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
          <div className="library-search-indicator-pill">
            <span className="library-search-indicator">
              Filtering by: “{query}”
            </span>
            <button
              type="button"
              className="clear-search-btn"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Book Grid or Empty State */}
      {loading && books.length === 0 ? (
        <div className="library-books-grid">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton.Card key={`book-skeleton-${n}`} />
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="library-empty-shelf-card">
          <div className="empty-shelf-icon-bubble">📚</div>
          <h3 className="empty-shelf-title">Your Bookshelf is empty</h3>
          <p className="empty-shelf-desc">
            {query
              ? `No literary works matched your search for "${query}".`
              : filter === 'mine'
              ? 'You have not uploaded any personal books yet. Ingest your own manuscript to interact with custom characters.'
              : filter === 'featured'
              ? 'You have not exported any catalog books yet. Browse the Book Store to import masterworks.'
              : 'Your Bookshelf holds books you upload or export from the Book Store. No unselected catalog books are mixed in.'}
          </p>
          <div className="empty-shelf-actions">
            {query && (
              <PillButton variant="white" size="sm" onClick={clearSearch}>
                Clear Filter
              </PillButton>
            )}
            <button
              type="button"
              className="library-store-cta-btn"
              onClick={() => navigate('/store')}
            >
              Browse Book Store →
            </button>
            <PillButton
              variant="orange"
              size="sm"
              onClick={openAddBookModal}
            >
              + Ingest Manuscript
            </PillButton>
          </div>
        </div>
      ) : (
        <div className="library-books-grid">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onClick={() => navigate(`/books/${book.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
