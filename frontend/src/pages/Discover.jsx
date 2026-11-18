import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import { getBookCoverUrl } from '../lib/formatters';
import { Skeleton } from '../components/ui';
import { lorelyApi } from '../services/lorelyApi';
import './Discover.css';

// Featured recommendation books matching Dribbble reference & classics
export const DEFAULT_FEATURED_BOOKS = [
  {
    id: 'book-psychology-of-money',
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    character_count: 3,
    cover_url: '/covers/the_midnight_letters.svg',
    summary: 'Timeless lessons on wealth, greed, and happiness.',
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
    summary: 'Why staying small is the next big thing for business.',
    visibility: 'featured',
    is_in_library: false,
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
    summary: 'A philosophical gothic novel of aesthetic obsession, corruption, and the soul.',
    visibility: 'featured',
    is_in_library: false,
    genre: 'Classic Literature',
  },
  {
    id: 'book-dostoevsky-white-nights',
    title: 'White Nights',
    author: 'Fyodor Dostoevsky',
    character_count: 2,
    cover_url: '/covers/white_nights.svg',
    summary: 'A sentimental novel from the recollections of a dreamer across the luminous white nights of St. Petersburg.',
    visibility: 'featured',
    is_in_library: false,
    genre: 'Classic Literature',
  },
  {
    id: 'book-dostoevsky-ridiculous-man',
    title: 'The Dream of a Ridiculous Man',
    author: 'Fyodor Dostoevsky',
    character_count: 1,
    cover_url: '/covers/the_dream_of_a_ridiculous_man.svg',
    summary: 'A visionary philosophical revelation on an uncorrupted duplicate earth.',
    visibility: 'featured',
    is_in_library: false,
    genre: 'Philosophy',
  },
  {
    id: 'book-dostoevsky-honest-thief',
    title: 'An Honest Thief',
    author: 'Fyodor Dostoevsky',
    character_count: 2,
    cover_url: '/covers/an_honest_thief.svg',
    summary: 'A touching narrative of conscience and forgiveness in St. Petersburg.',
    visibility: 'featured',
    is_in_library: false,
    genre: 'Classic Literature',
  },
];

let cachedDiscoverBooks = null;

export default function Discover() {
  const { openAddBookModal, accessToken } = useOutletContext() || {};
  const [books, setBooks] = useState(cachedDiscoverBooks || DEFAULT_FEATURED_BOOKS);
  const [loading, setLoading] = useState(!cachedDiscoverBooks);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [exportingBookId, setExportingBookId] = useState(null);
  const [activeMenuBookId, setActiveMenuBookId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function loadBooks() {
      try {
        const catalogRes = await lorelyApi.listFeaturedCatalog({}, accessToken);
        const catalogBooks = catalogRes?.books || catalogRes || [];
        if (mounted && catalogBooks && catalogBooks.length > 0) {
          const merged = [...catalogBooks];
          DEFAULT_FEATURED_BOOKS.forEach((def) => {
            if (!merged.some((b) => b.id === def.id || b.title?.toLowerCase() === def.title?.toLowerCase())) {
              merged.push(def);
            }
          });
          cachedDiscoverBooks = merged;
          setBooks(merged);
        }
      } catch (err) {
        // Fall back gracefully to DEFAULT_FEATURED_BOOKS
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadBooks();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  // Outside click dismisses 3-dot BookFusion popover
  useEffect(() => {
    if (!activeMenuBookId) return;
    function handleOutsideClick(e) {
      if (!e.target.closest('.discover-book-fusion-popover') && !e.target.closest('.discover-book-menu-trigger')) {
        setActiveMenuBookId(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeMenuBookId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    if (selectedCategory) params.append('category', selectedCategory);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    navigate(`/store${queryString}`);
  };

  const handleExportToBookshelf = async (book, e) => {
    if (e) e.stopPropagation();
    try {
      setExportingBookId(book.id);
      await lorelyApi.addCatalogBookToLibrary(book.id, {}, accessToken);
      // Mark as exported — will immediately filter out of recommendations
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, is_in_library: true } : b))
      );
      setToastMessage(`Exported "${book.title}" to your Bookshelf!`);
    } catch (err) {
      // Optimistic update for offline/demo modes
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, is_in_library: true } : b))
      );
      setToastMessage(`Added "${book.title}" to your Bookshelf!`);
    } finally {
      setExportingBookId(null);
      setActiveMenuBookId(null);
    }
  };

  // Recommendations ONLY include unexported books! Exported books are automatically removed
  const unexportedBooks = books.filter((b) => !b.is_in_library);
  const displayedBooks = unexportedBooks.slice(0, 4);

  return (
    <div className="lorely-discover-page" data-testid="discover-page">
      {/* Toast Notification */}
      {toastMessage && (
        <aside className="discover-export-toast" role="status" aria-live="polite">
          <div className="toast-left">
            <svg className="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="toast-text">{toastMessage}</span>
          </div>
          <div className="toast-right">
            <Link to="/bookshelf" className="toast-bookshelf-link">
              Go to Bookshelf →
            </Link>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setToastMessage(null)}
              aria-label="Dismiss toast"
            >
              ×
            </button>
          </div>
        </aside>
      )}

      {/* CONTINUOUS CURVED SHADED BACKDROP (Dribbble Layout: wraps Title, Search, and Recommendations) */}
      <section className="discover-shaded-canvas">
        {/* Top Header & Search Area */}
        <div className="discover-header-block">
          <h1 className="discover-page-title">Discover</h1>

          {/* Integrated Search Capsule matching Dribbble reference */}
          <form className="discover-search-capsule" onSubmit={handleSearchSubmit} role="search">
            <div className="search-category-select-wrap">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="search-category-select"
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                <option value="Classic Literature">Classic Literature</option>
                <option value="Philosophy">Philosophy & Essays</option>
                <option value="Fiction">Fiction & Drama</option>
                <option value="Money/Investing">Money/Investing</option>
                <option value="Design">Design</option>
                <option value="Business">Business</option>
                <option value="Self Improvement">Self Improvement</option>
              </select>
              <span className="search-category-chevron" aria-hidden="true">▾</span>
            </div>

            <div className="search-capsule-divider" aria-hidden="true" />

            <div className="search-input-field-wrap">
              <svg className="search-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="find the book you like..."
                className="search-capsule-input"
                aria-label="Search books, characters, or themes"
              />
            </div>

            <button
              type="submit"
              className="search-capsule-btn"
              aria-label="Search"
            >
              Search
            </button>
          </form>
        </div>

        {/* Book Recommendation Shelf (Inside the shaded backdrop, clean physical 3D books) */}
        <div className="discover-recommendations-block">
          <div className="discover-section-header">
            <h2 className="discover-section-title">Book Recommendation</h2>
            <button
              type="button"
              className="discover-view-all-btn"
              onClick={() => navigate('/store')}
              aria-label="View all books in book store"
            >
              <span>View all</span>
              <span className="view-all-arrow" aria-hidden="true">&gt;</span>
            </button>
          </div>

          {/* 3D Elevated Books Shelf */}
          <div className="discover-shelf-grid">
            {loading && (!books || books.length === 0) ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton.Card key={`shelf-skeleton-${idx}`} />
              ))
            ) : displayedBooks.length === 0 ? (
              <div className="discover-all-exported-empty">
                <div className="empty-bubble">✨</div>
                <h3 className="empty-title">All recommendations exported!</h3>
                <p className="empty-sub">
                  You have added all currently recommended works to your Bookshelf. Browse the full Book Store for more literature.
                </p>
                <button
                  type="button"
                  className="discover-browse-store-btn"
                  onClick={() => navigate('/store')}
                >
                  Browse Full Book Store →
                </button>
              </div>
            ) : (
              displayedBooks.map((book) => {
                const coverUrl = getBookCoverUrl(book.title, book.cover_url);
                const isMenuOpen = activeMenuBookId === book.id;

                return (
                  <article
                    key={book.id}
                    className="discover-3d-book-card"
                    onClick={() => navigate(`/books/${book.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/books/${book.id}`);
                    }}
                    aria-label={`${book.title} by ${book.author}`}
                  >
                    {/* 3D Book Cover with Spine and Elevation */}
                    <div className="discover-3d-book-spine-wrapper">
                      <img
                        src={coverUrl}
                        alt={`Cover of ${book.title}`}
                        className="discover-3d-book-cover-img"
                        loading="lazy"
                      />
                      <div className="discover-3d-book-spine-highlight" aria-hidden="true" />
                      <div className="discover-3d-book-edge-highlight" aria-hidden="true" />

                      {/* Three-Dot Button — Visible on Hover Only (BookFusion Style) */}
                      <button
                        type="button"
                        className={`discover-book-menu-trigger ${isMenuOpen ? 'open' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuBookId((prev) => (prev === book.id ? null : book.id));
                        }}
                        aria-label={`Options for ${book.title}`}
                        aria-haspopup="true"
                        aria-expanded={isMenuOpen}
                      >
                        <span className="three-dots-dots">•••</span>
                      </button>

                      {/* BookFusion-Style Popover Menu */}
                      {isMenuOpen && (
                        <div
                          className="discover-book-fusion-popover"
                          onClick={(e) => e.stopPropagation()}
                          role="menu"
                        >
                          <button
                            type="button"
                            className="fusion-menu-item export-action"
                            onClick={(e) => handleExportToBookshelf(book, e)}
                            role="menuitem"
                            disabled={exportingBookId === book.id}
                          >
                            <svg className="fusion-menu-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                              <path d="M12 6v6" />
                              <path d="M9 9h6" />
                            </svg>
                            <span>Export to Bookshelf</span>
                          </button>

                          <button
                            type="button"
                            className="fusion-menu-item"
                            onClick={() => {
                              setActiveMenuBookId(null);
                              navigate(`/books/${book.id}`);
                            }}
                            role="menuitem"
                          >
                            <svg className="fusion-menu-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <span>Inspect Book Details</span>
                          </button>

                          <button
                            type="button"
                            className="fusion-menu-item"
                            onClick={() => {
                              setActiveMenuBookId(null);
                              navigate(`/books/${book.id}/characters`);
                            }}
                            role="menuitem"
                          >
                            <svg className="fusion-menu-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <span>Character Cast ({book.character_count || 2})</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Book Metadata below the 3D book */}
                    <div className="discover-3d-book-info">
                      <h3 className="discover-3d-book-title" title={book.title}>
                        {book.title}
                      </h3>
                      <p className="discover-3d-book-author" title={book.author}>
                        {book.author}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* LOWER UTILITY SECTION: Ingestion CTA */}
      <section className="discover-lower-section">
        <div
          className="discover-add-book-cta"
          onClick={openAddBookModal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && openAddBookModal) openAddBookModal();
          }}
          aria-label="Upload custom book manuscript"
        >
          <div className="add-book-bubble">
            <span className="add-book-plus">+</span>
          </div>
          <div className="add-book-info">
            <span className="add-book-title">Add a Book</span>
            <span className="add-book-sub">Upload PDF, TXT or paste manuscript directly into your Bookshelf</span>
          </div>
          <span className="add-book-arrow-pill">Upload manuscript →</span>
        </div>
      </section>
    </div>
  );
}
