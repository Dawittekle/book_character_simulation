import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookCoverUrl } from '../lib/formatters';
import './BookCard.css';

export default function BookCard({ book, onClick }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(book);
    } else {
      navigate(`/books/${book.id}`);
    }
  };

  const coverUrl = getBookCoverUrl(book.title, book.cover_url);
  const charCount = book.character_count ?? book.characters?.length ?? 2;
  const isClassic = book.visibility === 'featured' || !book.is_owner;

  return (
    <article
      className="lorely-book-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Explore characters from ${book.title}`}
    >
      <div className="lorely-book-cover-container">
        <img
          src={coverUrl}
          alt={`Cover of ${book.title}`}
          className="lorely-book-cover-img"
          loading="lazy"
        />
        <div className="lorely-book-cover-shine" />
        <div className="lorely-book-hover-overlay" aria-hidden="true">
          <span className="lorely-book-hover-cta">
            Open Book
            <svg
              className="lorely-book-arrow-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </div>
      </div>

      <div className="lorely-book-info">
        <h3 className="lorely-book-title">{book.title}</h3>
        <p className="lorely-book-author">{book.author || 'Classic Masterpiece'}</p>
        <div className="lorely-book-footer-row">
          <div className="lorely-book-meta-pill">
            <span className="lorely-book-meta-dot" />
            <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
          </div>
          {isClassic && (
            <span className="lorely-book-genre-pill">Classic</span>
          )}
        </div>
      </div>
    </article>
  );
}
