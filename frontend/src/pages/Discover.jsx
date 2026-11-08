import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import BookCard from '../components/BookCard';
import { lorelyApi } from '../services/lorelyApi';
import './Discover.css';

// Default featured collection fallback books matching reference visual
const DEFAULT_FEATURED_BOOKS = [
  {
    id: 'b-midnight-letters',
    title: 'The Midnight Letters',
    author: 'Elena Marlowe',
    character_count: 2,
    cover_url: '/covers/the_midnight_letters.svg',
  },
  {
    id: 'b-hidden-garden',
    title: 'The Hidden Garden',
    author: 'Frances Hodgson',
    character_count: 3,
    cover_url: '/covers/the_hidden_garden.svg',
  },
  {
    id: 'b-echoes-tomorrow',
    title: 'Echoes of Tomorrow',
    author: 'Arthur Chandler',
    character_count: 4,
    cover_url: '/covers/echoes_of_tomorrow.svg',
  },
  {
    id: 'b-last-voyage',
    title: 'The Last Voyage',
    author: 'Capt. S. Hawthorne',
    character_count: 2,
    cover_url: '/covers/the_last_voyage.svg',
  },
];

export default function Discover() {
  const { openAddBookModal, accessToken } = useOutletContext();
  const [books, setBooks] = useState(DEFAULT_FEATURED_BOOKS);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function loadBooks() {
      try {
        const fetched = await lorelyApi.listBooks(accessToken);
        if (mounted && fetched && fetched.length > 0) {
          setBooks(fetched);
        }
      } catch (err) {
        // Fall back to default collection seamlessly
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadBooks();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  return (
    <div className="lorely-discover-page" data-testid="discover-page">
      {/* Top Banner Tagline */}
      <section className="discover-hero-banner">
        <div className="banner-editorial-header">
          <h1 className="banner-main-title">Lorely</h1>
          <div className="banner-divider" />
          <div className="banner-taglines">
            <h2 className="banner-headline">Step into the stories.</h2>
            <p className="banner-subtext">
              Explore books. Meet characters. Have meaningful conversations.
            </p>
          </div>
        </div>

        {/* Hero Card: Timeless Classics */}
        <div className="hero-feature-card">
          <div className="hero-feature-content">
            <span className="hero-feature-badge">Featured Collection</span>
            <h2 className="hero-feature-title">Timeless Classics</h2>
            <p className="hero-feature-desc">
              Explore legendary characters from literary masterpieces.
            </p>
            <button
              type="button"
              className="hero-feature-btn"
              onClick={() => navigate('/library')}
            >
              Explore Collection →
            </button>
          </div>
          <div className="hero-feature-art">
            <img
              src="/covers/the_midnight_letters.svg"
              alt="Vintage books"
              className="hero-feature-img"
            />
          </div>
        </div>
      </section>

      {/* Your Library Section */}
      <section className="discover-library-section">
        <div className="section-header-row">
          <h2 className="section-heading">Your Library</h2>
          <button
            type="button"
            className="view-all-link"
            onClick={() => navigate('/library')}
          >
            View all →
          </button>
        </div>

        {/* Books Carousel / Grid */}
        <div className="books-shelf-grid">
          {books.slice(0, 4).map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>

        {/* Lower Row: Add Book Card + Quote Card */}
        <div className="library-utility-row">
          <div
            className="add-book-cta-card"
            onClick={openAddBookModal}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') openAddBookModal();
            }}
          >
            <span className="add-book-plus">+</span>
            <span className="add-book-title">Add a Book</span>
            <span className="add-book-sub">Upload a PDF, TXT or paste text</span>
          </div>

          <div className="literary-quote-card">
            <span className="quote-quill-icon">🪶</span>
            <p className="quote-text">
              “Books are not just stories, but worlds waiting to be lived.”
            </p>
          </div>
        </div>
      </section>

      {/* Bottom Feature Strip */}
      <footer className="discover-feature-strip">
        <div className="feature-strip-item">
          <span className="strip-item-icon">📖</span>
          <div className="strip-item-text">
            <strong>Bring Any Book</strong>
            <span>PDF, TXT or more</span>
          </div>
        </div>

        <div className="strip-item-divider" />

        <div className="feature-strip-item">
          <span className="strip-item-icon">👥</span>
          <div className="strip-item-text">
            <strong>Discover Characters</strong>
            <span>Get to know their personalities</span>
          </div>
        </div>

        <div className="strip-item-divider" />

        <div className="feature-strip-item">
          <span className="strip-item-icon">💬</span>
          <div className="strip-item-text">
            <strong>Talk Naturally</strong>
            <span>Text or voice</span>
          </div>
        </div>

        <div className="strip-item-divider" />

        <div className="feature-strip-item">
          <span className="strip-item-icon">🧠</span>
          <div className="strip-item-text">
            <strong>Watch Them Evolve</strong>
            <span>With memory and emotion</span>
          </div>
        </div>

        <button
          type="button"
          className="start-exploring-btn"
          onClick={() => navigate('/library')}
        >
          Start Exploring →
        </button>
      </footer>
    </div>
  );
}
