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
      </div>

      <div className="lorely-book-info">
        <h3 className="lorely-book-title">{book.title}</h3>
        <p className="lorely-book-author">{book.author || 'Classic Masterpiece'}</p>
        <div className="lorely-book-meta-pill">
          <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
        </div>
      </div>
    </article>
  );
}
