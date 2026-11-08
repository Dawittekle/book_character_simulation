import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../services/lorelyApi';
import { getCharacterAvatarUrl } from '../lib/formatters';
import './CharacterGallery.css';

// Client-side cache to instantly render previously loaded book casts without jumping/flickering
const bookCharactersCache = new Map();

export default function CharacterGallery() {
  const { bookId } = useParams();
  const { accessToken } = useOutletContext();
  
  // Initialize with cached data if available, otherwise empty list
  const cachedData = bookId ? bookCharactersCache.get(bookId) : null;
  const [characters, setCharacters] = useState(cachedData?.characters || []);
  const [bookTitle, setBookTitle] = useState(cachedData?.title || (bookId ? 'Literary Work' : 'All Literary Casts'));
  const [loading, setLoading] = useState(!cachedData);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function loadCharacters() {
      // If we don't have cached data, ensure loading is true
      if (!bookCharactersCache.has(bookId || '__all__')) {
        setLoading(true);
      }

      try {
        if (bookId) {
          const bookDetails = await lorelyApi.getBookDetails(bookId, accessToken);
          if (mounted && bookDetails) {
            const chars = Array.isArray(bookDetails.characters) ? bookDetails.characters : [];
            setBookTitle(bookDetails.title);
            setCharacters(chars);
            bookCharactersCache.set(bookId, {
              title: bookDetails.title,
              characters: chars,
            });
          }
        } else {
          const list = await lorelyApi.listCharacters(accessToken);
          if (mounted) {
            const chars = Array.isArray(list) ? list : [];
            setCharacters(chars);
            bookCharactersCache.set('__all__', {
              title: 'All Literary Casts',
              characters: chars,
            });
          }
        }
      } catch (err) {
        console.warn('Error loading character cast:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCharacters();
    return () => {
      mounted = false;
    };
  }, [bookId, accessToken]);

  return (
    <div className="lorely-gallery-page" data-testid="character-gallery-page">
      <header className="gallery-header">
        <button
          type="button"
          className="page-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ← Back
        </button>
        <div className="gallery-title-group">
          <h1 className="gallery-title">Meet the Characters</h1>
          <p className="gallery-subtitle">
            {bookId ? `Cast of ${bookTitle}` : 'Legendary personalities across the Lorely library.'}
          </p>
        </div>
      </header>

      <div className="characters-card-grid">
        {loading && characters.length === 0 ? (
          // Elegant animated skeleton loaders while reading from database
          [1, 2, 3, 4].map((n) => (
            <article key={`skeleton-${n}`} className="character-portrait-card skeleton" aria-hidden="true">
              <div className="skeleton-avatar" />
              <div className="card-info-body">
                <div className="skeleton-line medium" />
                <div className="skeleton-line short" />
                <div className="skeleton-line long" style={{ marginTop: '8px' }} />
                <div className="skeleton-line btn" />
              </div>
            </article>
          ))
        ) : characters.length === 0 ? (
          <div className="gallery-empty-state">
            <span className="gallery-empty-icon">📖</span>
            <h3 className="gallery-empty-title">No Characters Available</h3>
            <p className="gallery-empty-sub">
              {bookId ? 'No characters have been extracted for this literary work yet.' : 'Explore your library to discover character dialogues.'}
            </p>
            <button
              type="button"
              className="card-chat-btn"
              onClick={() => navigate('/library')}
            >
              Browse Library →
            </button>
          </div>
        ) : (
          characters.map((char) => {
            const avatarUrl = getCharacterAvatarUrl(char.name, char.avatar_asset_id);

            return (
              <article key={char.id} className="character-portrait-card">
                <div className="card-avatar-wrapper">
                  <img
                    src={avatarUrl}
                    alt={char.name}
                    className="card-portrait-img"
                  />
                  <span className="card-role-badge">{char.role || 'Protagonist'}</span>
                </div>

                <div className="card-info-body">
                  <h3 className="card-character-name">{char.name}</h3>
                  <span className="card-book-sub">{char.book_title || bookTitle}</span>
                  <p className="card-character-bio">
                    {char.personality || 'A thoughtful individual shaped by memory and destiny.'}
                  </p>

                  <button
                    type="button"
                    className="card-chat-btn"
                    onClick={() => navigate(`/chat/${char.id}`)}
                  >
                    <span>💬</span> Talk to {char.name.split(' ')[0]} →
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
