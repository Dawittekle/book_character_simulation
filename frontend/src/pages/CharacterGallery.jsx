import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../services/lorelyApi';
import { getCharacterAvatarUrl } from '../lib/formatters';
import PillButton from '../components/brand/PillButton';
import BadgePill from '../components/brand/BadgePill';
import BrandLogo from '../components/brand/BrandLogo';
import './CharacterGallery.css';

// Storage helpers to instantly render previously loaded casts without jumping
const getStoredCasts = (key) => {
  try {
    const raw = sessionStorage.getItem(`lorely_cast_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setStoredCasts = (key, data) => {
  try {
    sessionStorage.setItem(`lorely_cast_${key}`, JSON.stringify(data));
  } catch {}
};

export default function CharacterGallery() {
  const { bookId } = useParams();
  const { accessToken } = useOutletContext();
  
  const cacheKey = bookId || '__all__';
  const cachedData = getStoredCasts(cacheKey);

  const [characters, setCharacters] = useState(cachedData?.characters || []);
  const [bookTitle, setBookTitle] = useState(cachedData?.title || (bookId ? 'Literary Work' : 'All Literary Casts'));
  const [loading, setLoading] = useState(!cachedData);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function loadCharacters() {
      if (!cachedData) {
        setLoading(true);
      }

      try {
        if (bookId) {
          const bookDetails = await lorelyApi.getBookDetails(bookId, accessToken);
          if (mounted && bookDetails) {
            const chars = Array.isArray(bookDetails.characters) ? bookDetails.characters : [];
            setBookTitle(bookDetails.title);
            setCharacters(chars);
            setStoredCasts(bookId, {
              title: bookDetails.title,
              characters: chars,
            });
          }
        } else {
          const list = await lorelyApi.listCharacters(accessToken);
          if (mounted) {
            const chars = Array.isArray(list) ? list : [];
            setCharacters(chars);
            setStoredCasts('__all__', {
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
        <div className="gallery-header-nav-row">
          <button
            type="button"
            className="page-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ← Back
          </button>
          {bookId && (
            <button
              type="button"
              className="gallery-view-all-pill"
              onClick={() => navigate('/characters')}
            >
              📚 View All Characters
            </button>
          )}
        </div>

        <div className="gallery-title-group">
          <div className="gallery-title-lockup">
            <h1 className="gallery-title">Meet the Characters</h1>
            <BadgePill variant="orange" dotColor="#ef4d23" className="gallery-count-badge">
              {characters.length} Active {characters.length === 1 ? 'Persona' : 'Personas'}
            </BadgePill>
          </div>
          <p className="gallery-subtitle">
            {bookId
              ? `Cast of ${bookTitle} (${characters.length} character${characters.length === 1 ? '' : 's'})`
              : 'Legendary personalities across the Lorely library.'}
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
            <div className="gallery-empty-bubble">📖</div>
            <h3 className="gallery-empty-title">No Characters Available</h3>
            <p className="gallery-empty-sub">
              {bookId
                ? 'No characters have been extracted for this literary work yet.'
                : 'Explore your library to discover character dialogues.'}
            </p>
            <PillButton
              variant="orange"
              size="md"
              hasChevron
              onClick={() => navigate('/library')}
              className="gallery-browse-btn"
            >
              Browse Library →
            </PillButton>
          </div>
        ) : (
          characters.map((char) => {
            const avatarUrl = getCharacterAvatarUrl(char.name, char.avatar_asset_id);
            const role = char.role || 'Protagonist';

            return (
              <article key={char.id} className="character-portrait-card">
                <div className="card-avatar-wrapper">
                  <img
                    src={avatarUrl}
                    alt={char.name}
                    className="card-portrait-img"
                    loading="lazy"
                  />
                  <div className="card-avatar-sheen" />
                  <span className="card-role-badge">
                    {role}
                  </span>
                </div>

                <div className="card-info-body">
                  <div className="card-character-header">
                    <h3 className="card-character-name">{char.name}</h3>
                    <span className="card-book-sub">{char.book_title || bookTitle}</span>
                  </div>

                  <p className="card-character-bio">
                    {char.personality || 'A thoughtful individual shaped by memory and destiny.'}
                  </p>

                  <div className="card-chat-action">
                    <button
                      type="button"
                      className="card-chat-btn"
                      onClick={() => navigate(`/chat/${char.id}`)}
                    >
                      <span>💬</span> Talk to {char.name.split(' ')[0]} →
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
