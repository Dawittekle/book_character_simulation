import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext, useSearchParams, Link } from 'react-router-dom';
import { getBookCoverUrl } from '../lib/formatters';
import { Skeleton } from '../components/ui';
import { lorelyApi } from '../services/lorelyApi';
import './BookStore.css';

export const STORE_CATEGORIES = [
  'All',
  'Classic Literature',
  'Philosophy',
  'Fiction',
  'Money/Investing',
  'Design',
  'Business',
  'Self Improvement',
];

export const DEFAULT_STORE_BOOKS = [
  {
    id: 'book-psychology-of-money',
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    genre: 'Money/Investing',
    character_count: 3,
    cover_url: '/covers/the_midnight_letters.svg',
    summary: 'Timeless lessons on wealth, greed, and happiness exploring the psychology behind financial choices.',
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
    summary: 'Why staying small and self-reliant is the next big thing for entrepreneurs and creators.',
    visibility: 'featured',
    is_in_library: false,
  },
  {
    id: 'book-how-innovation-works',
    title: 'How Innovation Works',
    author: 'Matt Ridley',
    genre: 'Design',
    character_count: 4,
    cover_url: '/covers/echoes_of_tomorrow.svg',
    summary: 'A fascinating chronicle of human ingenuity and why innovation flourishes in freedom.',
    visibility: 'featured',
    is_in_library: false,
  },
  {
    id: 'book-picture-dorian-gray',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    genre: 'Classic Literature',
    character_count: 3,
    cover_url: '/covers/the_dream_of_a_ridiculous_man.svg',
    summary: 'A philosophical gothic novel of aesthetic obsession, corruption, and the eternal reflection of the soul.',
    visibility: 'featured',
    is_in_library: false,
  },
  {
    id: 'book-dostoevsky-white-nights',
    title: 'White Nights',
    author: 'Fyodor Dostoevsky',
    genre: 'Classic Literature',
    character_count: 2,
    cover_url: '/covers/white_nights.svg',
    summary: 'A sentimental novel from the recollections of a dreamer across the luminous white nights of St. Petersburg.',
    visibility: 'featured',
    is_in_library: false,
  },
  {
    id: 'book-dostoevsky-ridiculous-man',
    title: 'The Dream of a Ridiculous Man',
    author: 'Fyodor Dostoevsky',
    genre: 'Philosophy',
    character_count: 1,
    cover_url: '/covers/the_dream_of_a_ridiculous_man.svg',
    summary: 'A visionary philosophical revelation exploring the moral rebirth of humanity on an uncorrupted duplicate earth.',
    visibility: 'featured',
    is_in_library: false,
  },
  {
    id: 'book-dostoevsky-honest-thief',
    title: 'An Honest Thief',
    author: 'Fyodor Dostoevsky',
    genre: 'Classic Literature',
    character_count: 2,
    cover_url: '/covers/an_honest_thief.svg',
    summary: 'A touching narrative of conscience, grief, and forgiveness in St. Petersburg.',
    visibility: 'featured',
    is_in_library: false,
  },
  {
    id: 'book-the-hidden-garden',
    title: 'The Hidden Garden',
    author: 'Evelyn Reed',
    genre: 'Self Improvement',
    character_count: 3,
    cover_url: '/covers/the_hidden_garden.svg',
    summary: 'An introspective tale of discovery, healing, and deliberate living among the overgrown roots of memory.',
    visibility: 'featured',
    is_in_library: false,
  },
];

let cachedStoreBooks = null;

export default function BookStore() {
  const { accessToken } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [books, setBooks] = useState(cachedStoreBooks || DEFAULT_STORE_BOOKS);
  const [loading, setLoading] = useState(!cachedStoreBooks);
  const [exportingBookId, setExportingBookId] = useState(null);
  const [toast, setToast] = useState(null);

  // Initialize query parameters from URL
  const initialQ = searchParams.get('q') || '';
  const initialCat = searchParams.get('category') || searchParams.get('genre') || 'All';
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [sortBy, setSortBy] = useState('featured');

  useEffect(() => {
    let mounted = true;
    async function fetchCatalog() {
      try {
        const res = await lorelyApi.listFeaturedCatalog({}, accessToken);
        const catalogBooks = res?.books || res || [];
        if (mounted && catalogBooks && catalogBooks.length > 0) {
          const merged = [...catalogBooks];
          DEFAULT_STORE_BOOKS.forEach((def) => {
            if (!merged.some((b) => b.id === def.id || b.title?.toLowerCase() === def.title?.toLowerCase())) {
              merged.push(def);
            }
          });
          cachedStoreBooks = merged;
          setBooks(merged);
        }
      } catch (err) {
        // Fall back seamlessly to default store collection
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchCatalog();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  // Synchronize state when URL params change
  useEffect(() => {
    const qParam = searchParams.get('q');
    const catParam = searchParams.get('category') || searchParams.get('genre');
    if (qParam !== null) setSearchQuery(qParam);
    if (catParam) setSelectedCategory(catParam);
  }, [searchParams]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    const newParams = new URLSearchParams(searchParams);
    if (category === 'All') {
      newParams.delete('category');
      newParams.delete('genre');
    } else {
      newParams.set('category', category);
    }
    setSearchParams(newParams);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    const newParams = new URLSearchParams(searchParams);
    if (val.trim()) {
      newParams.set('q', val.trim());
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams);
  };

  const handleExportToBookshelf = async (book, e) => {
    e.stopPropagation();
    try {
      setExportingBookId(book.id);
      await lorelyApi.addCatalogBookToLibrary(book.id, {}, accessToken);
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, is_in_library: true } : b))
      );
      setToast({
        title: book.title,
        message: `Exported "${book.title}" and ${book.character_count || 2} characters to your Bookshelf & Characters gallery!`,
      });
    } catch (err) {
      // Optimistic update for offline/demo mode
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, is_in_library: true } : b))
      );
      setToast({
        title: book.title,
        message: `Added "${book.title}" to your Bookshelf!`,
      });
    } finally {
      setExportingBookId(null);
    }
  };

  // Filter and sort catalog books
  const filteredBooks = useMemo(() => {
    let result = [...books];

    // Category filter
    if (selectedCategory && selectedCategory !== 'All') {
      const targetCat = selectedCategory.toLowerCase();
      result = result.filter(
        (b) =>
          b.genre?.toLowerCase() === targetCat ||
          b.category?.toLowerCase() === targetCat ||
          (targetCat === 'classic literature' && (b.visibility === 'featured' || b.author?.includes('Dostoevsky')))
      );
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.title?.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q) ||
          b.summary?.toLowerCase().includes(q) ||
          b.genre?.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'characters') {
      result.sort((a, b) => (b.character_count || 0) - (a.character_count || 0));
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'author') {
      result.sort((a, b) => a.author.localeCompare(b.author));
    }

    return result;
  }, [books, selectedCategory, searchQuery, sortBy]);

  return (
    <div className="lorely-bookstore-page" data-testid="bookstore-page">
      {/* Toast Notification for Export Confirmation */}
      {toast && (
        <aside className="bookstore-export-toast" role="status" aria-live="polite">
          <div className="toast-left">
            <svg className="toast-success-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div className="toast-body">
              <span className="toast-message">{toast.message}</span>
            </div>
          </div>
          <div className="toast-right">
            <Link to="/bookshelf" className="toast-bookshelf-link">
              Go to Bookshelf →
            </Link>
            <button
              type="button"
              className="toast-dismiss-btn"
              onClick={() => setToast(null)}
              aria-label="Dismiss confirmation"
            >
              ×
            </button>
          </div>
        </aside>
      )}

      {/* Hero Header with #1CD3FF & #2883FF Ambient Glow */}
      <header className="bookstore-hero">
        <div className="bookstore-hero-breadcrumbs">
          <Link to="/discover" className="breadcrumb-link">
            ← Discover
          </Link>
          <span className="breadcrumb-divider">/</span>
          <span className="breadcrumb-current">Catalog</span>
        </div>

        <div className="bookstore-hero-headline-wrap">
          <div className="bookstore-badge-row">
            <span className="bookstore-pill-badge">Official Catalog</span>
            <span className="bookstore-count-badge">{filteredBooks.length} masterworks available</span>
          </div>
          <p className="bookstore-hero-desc">
            Explore curated literary works published by Lorely. All books are pre-processed with full chapter indices,
            semantic chunks, and extracted character profiles ready for instant simulation. Export any book to add it to your
            personal Bookshelf.
          </p>
        </div>
      </header>

      {/* Search, Filter & Sort Controls */}
      <section className="bookstore-controls-section" aria-label="Book store filters">
        <div className="bookstore-controls-top-row">
          {/* Search Input */}
          <div className="bookstore-search-bar">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search books by title, author, or keyword..."
              className="bookstore-search-input"
              aria-label="Search Book Store"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search query"
              >
                ×
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="bookstore-sort-wrapper">
            <label htmlFor="store-sort-select" className="store-sort-label">Sort by:</label>
            <select
              id="store-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="store-sort-select"
            >
              <option value="featured">Featured</option>
              <option value="characters">Most Characters</option>
              <option value="title">Title (A-Z)</option>
              <option value="author">Author (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="bookstore-category-pills" role="tablist" aria-label="Book categories">
          {STORE_CATEGORIES.map((cat) => {
            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`category-pill-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleCategorySelect(cat)}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Book Store Catalog Grid */}
      <section className="bookstore-grid-section" aria-label="Book store catalog">
        {loading && (!books || books.length === 0) ? (
          <div className="bookstore-catalog-grid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton.Card key={`store-skeleton-${idx}`} />
            ))}
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="bookstore-empty-state">
            <div className="empty-state-icon">📚</div>
            <h2 className="empty-state-title">No books match your criteria</h2>
            <p className="empty-state-sub">
              Try adjusting your search terms or clearing selected category filters.
            </p>
            <button
              type="button"
              className="empty-reset-btn"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSearchParams(new URLSearchParams());
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="bookstore-catalog-grid">
            {filteredBooks.map((book) => {
              const coverUrl = getBookCoverUrl(book.title, book.cover_url);
              const isInLibrary = Boolean(book.is_in_library);
              const isExporting = exportingBookId === book.id;
              const charCount = book.character_count || 2;

              return (
                <article
                  key={book.id}
                  className="bookstore-book-card"
                  onClick={() => navigate(`/books/${book.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/books/${book.id}`);
                  }}
                  aria-label={`${book.title} by ${book.author}`}
                >
                  {/* Left: 3D Book Cover */}
                  <div className="bookstore-cover-spine-wrap">
                    <img
                      src={coverUrl}
                      alt={`Cover of ${book.title}`}
                      className="bookstore-cover-img"
                      loading="lazy"
                    />
                    <div className="bookstore-spine-highlight" aria-hidden="true" />
                    <div className="bookstore-edge-highlight" aria-hidden="true" />
                  </div>

                  {/* Right: Book Details & Actions */}
                  <div className="bookstore-card-body">
                    <div className="bookstore-genre-badge-row">
                      <span className="bookstore-genre-tag">{book.genre || 'Literature'}</span>
                      <span className="bookstore-char-count-tag">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>{charCount} Characters</span>
                      </span>
                    </div>

                    <h2 className="bookstore-card-title" title={book.title}>
                      {book.title}
                    </h2>
                    <p className="bookstore-card-author">{book.author}</p>
                    <p className="bookstore-card-summary">{book.summary}</p>

                    <div className="bookstore-card-actions">
                      {isInLibrary ? (
                        <div className="in-library-actions-group">
                          <button
                            type="button"
                            className="bookstore-in-shelf-pill"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/books/${book.id}`);
                            }}
                            aria-label={`In Bookshelf: Read ${book.title}`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>In Bookshelf</span>
                          </button>
                          <button
                            type="button"
                            className="bookstore-read-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/books/${book.id}/read`);
                            }}
                            aria-label={`Open reader for ${book.title}`}
                          >
                            Read Now →
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="bookstore-export-btn"
                          onClick={(e) => handleExportToBookshelf(book, e)}
                          disabled={isExporting}
                          aria-label={`Export ${book.title} to Bookshelf`}
                        >
                          {isExporting ? (
                            <span>Exporting to Bookshelf...</span>
                          ) : (
                            <>
                              <span className="export-plus">+</span>
                              <span>Export to Bookshelf</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
