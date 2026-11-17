import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getBookCoverUrl } from '../lib/formatters';
import { Skeleton } from '../components/ui';
import { lorelyApi } from '../services/lorelyApi';
import './Discover.css';

// Featured recommendation books matching the mockup & literary classics
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

// Book Category visual cards matching mockup & platform
export const DISCOVER_CATEGORIES = [
  {
    id: 'cat-money',
    title: 'Money/Investing',
    genreKey: 'Money/Investing',
    coverImg: '/covers/the_midnight_letters.svg',
    bookTitle: 'The Psychology of Money',
  },
  {
    id: 'cat-design',
    title: 'Design',
    genreKey: 'Design',
    coverImg: '/covers/echoes_of_tomorrow.svg',
    bookTitle: 'How Innovation Works',
  },
  {
    id: 'cat-business',
    title: 'Business',
    genreKey: 'Business',
    coverImg: '/covers/the_last_voyage.svg',
    bookTitle: 'Company of One',
  },
  {
    id: 'cat-self-improvement',
    title: 'Self Improvement',
    genreKey: 'Self Improvement',
    coverImg: '/covers/the_hidden_garden.svg',
    bookTitle: 'Habits & Growth',
  },
  {
    id: 'cat-classics',
    title: 'Classic Literature',
    genreKey: 'Classic Literature',
    coverImg: '/covers/white_nights.svg',
    bookTitle: 'Dostoevsky & Wilde',
  },
  {
    id: 'cat-philosophy',
    title: 'Philosophy',
    genreKey: 'Philosophy',
    coverImg: '/covers/the_dream_of_a_ridiculous_man.svg',
    bookTitle: 'Existential Insights',
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
  const [toastMessage, setToastMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function loadBooks() {
      try {
        const catalogRes = await lorelyApi.listFeaturedCatalog({}, accessToken);
        const catalogBooks = catalogRes?.books || catalogRes || [];
        if (mounted && catalogBooks && catalogBooks.length > 0) {
          // Prepend backend catalog books to defaults
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
    e.stopPropagation();
    try {
      setExportingBookId(book.id);
      await lorelyApi.addCatalogBookToLibrary(book.id, {}, accessToken);
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, is_in_library: true } : b))
      );
      setToastMessage(`Exported "${book.title}" to your Bookshelf & Characters gallery!`);
    } catch (err) {
      // Optimistic update for offline/demo modes
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, is_in_library: true } : b))
      );
      setToastMessage(`Added "${book.title}" to your Bookshelf!`);
    } finally {
      setExportingBookId(null);
    }
  };

  const displayedBooks = books.slice(0, 4);

  return (
    <div className="lorely-discover-page" data-testid="discover-page">
      {/* Toast Notification for Export Actions */}
      {toastMessage && (
        <div className="discover-export-toast" role="status" aria-live="polite">
          <svg className="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="toast-text">{toastMessage}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss toast"
          >
            ×
          </button>
        </div>
      )}

      {/* TOP SECTION: Fluid Curved Hero Banner with #1CD3FF & #2883FF gradients */}
      <section className="discover-curved-hero">
        <div className="discover-hero-content">
          <h1 className="discover-page-title">Discover</h1>

          {/* Integrated Search Capsule matching mockup */}
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
      </section>

      {/* MIDDLE SECTION: "Book Recommendation" Shelf with 3D Elevated Books */}
      <section className="discover-section discover-recommendations-section">
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

        {/* 3D Elevated Book Shelf */}
        <div className="discover-shelf-grid">
          {loading && (!books || books.length === 0) ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton.Card key={`shelf-skeleton-${idx}`} />
            ))
          ) : (
            displayedBooks.map((book) => {
              const coverUrl = getBookCoverUrl(book.title, book.cover_url);
              const isInLibrary = Boolean(book.is_in_library);
              const isExporting = exportingBookId === book.id;

              return (
                <article
                  key={book.id}
                  className="discover-3d-book-card"
                  onClick={() => navigate(isInLibrary ? `/books/${book.id}` : `/books/${book.id}`)}
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
                  </div>

                  {/* Book Metadata */}
                  <div className="discover-3d-book-info">
                    <h3 className="discover-3d-book-title" title={book.title}>
                      {book.title}
                    </h3>
                    <p className="discover-3d-book-author" title={book.author}>
                      {book.author}
                    </p>

                    {/* Action: Export to Bookshelf vs In Bookshelf */}
                    <div className="discover-3d-book-action">
                      {isInLibrary ? (
                        <button
                          type="button"
                          className="discover-in-shelf-btn"
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
                      ) : (
                        <button
                          type="button"
                          className="discover-export-btn"
                          onClick={(e) => handleExportToBookshelf(book, e)}
                          disabled={isExporting}
                          aria-label={`Export ${book.title} to Bookshelf`}
                        >
                          {isExporting ? (
                            <span>Exporting...</span>
                          ) : (
                            <>
                              <span className="export-plus-icon">+</span>
                              <span>Export to Bookshelf</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* LOWER SECTION: "Book Category" Visual Grid */}
      <section className="discover-section discover-categories-section">
        <div className="discover-section-header">
          <h2 className="discover-section-title">Book Category</h2>
          <button
            type="button"
            className="discover-category-layout-btn"
            onClick={() => navigate('/store')}
            aria-label="Browse categories in Book Store"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </button>
        </div>

        <div className="discover-category-grid">
          {DISCOVER_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="discover-category-card"
              onClick={() => navigate(`/store?category=${encodeURIComponent(cat.genreKey)}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/store?category=${encodeURIComponent(cat.genreKey)}`);
              }}
              aria-label={`Explore ${cat.title} books`}
            >
              <div className="discover-category-preview-wrap">
                <img
                  src={cat.coverImg}
                  alt={`${cat.title} sample cover`}
                  className="discover-category-preview-img"
                  loading="lazy"
                />
              </div>
              <h3 className="discover-category-name">{cat.title}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* UTILITY ROW: Quick Ingestion / Custom Upload CTA */}
      <section className="discover-utility-row">
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
