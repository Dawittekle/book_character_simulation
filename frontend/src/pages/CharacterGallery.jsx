import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../services/lorelyApi';
import { getCharacterAvatarUrl } from '../lib/formatters';
import './CharacterGallery.css';

const DEFAULT_CHARACTERS = [
  {
    id: 'char-the-dreamer',
    name: 'The Dreamer',
    book_title: 'White Nights',
    role: 'Protagonist',
    personality: 'A lonely, solitary, and deeply romantic young man wandering the luminous Petersburg canals.',
    avatar_asset_id: 'portrait-the-dreamer',
  },
  {
    id: 'char-nastenka',
    name: 'Nástyenka',
    book_title: 'White Nights',
    role: 'Companion',
    personality: 'Warm-hearted, candid, emotional, and spirited, yearning for true connection and freedom.',
    avatar_asset_id: 'portrait-nastenka',
  },
  {
    id: 'char-ridiculous-man',
    name: 'The Ridiculous Man',
    book_title: 'The Dream of a Ridiculous Man',
    role: 'Philosopher',
    personality: 'A Petersburg thinker whose cosmic dream revealed the living gospel of human love.',
    avatar_asset_id: 'portrait-the-ridiculous-man',
  },
  {
    id: 'char-astafy-ivanovich',
    name: 'Astafy Ivanovich',
    book_title: 'An Honest Thief',
    role: 'Narrator',
    personality: 'An austere retired soldier of strict integrity and tender Christian compassion.',
    avatar_asset_id: 'portrait-astafy',
  },
  {
    id: 'char-emelyan-ilyitch',
    name: 'Emelyan Ilyitch',
    book_title: 'An Honest Thief',
    role: 'Tragic Companion',
    personality: 'A gentle, childlike stray soul burdened by devastating guilt and repentance.',
    avatar_asset_id: 'portrait-emelyan',
  },
];

export default function CharacterGallery() {
  const { bookId } = useParams();
  const { accessToken } = useOutletContext();
  const [characters, setCharacters] = useState(DEFAULT_CHARACTERS);
  const [bookTitle, setBookTitle] = useState('All Literary Casts');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function loadCharacters() {
      try {
        if (bookId) {
          const bookDetails = await lorelyApi.getBookDetails(bookId, accessToken);
          if (mounted && bookDetails) {
            setBookTitle(bookDetails.title);
            if (bookDetails.characters?.length > 0) {
              setCharacters(bookDetails.characters);
            }
          }
        } else {
          const list = await lorelyApi.listCharacters(accessToken);
          if (mounted && list && list.length > 0) {
            setCharacters(list);
          }
        }
      } catch (err) {
        // Retain default character cast gracefully
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
        {characters.map((char) => {
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
        })}
      </div>
    </div>
  );
}
