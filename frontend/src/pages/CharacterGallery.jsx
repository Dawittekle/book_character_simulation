import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../services/lorelyApi';
import { getCharacterAvatarUrl } from '../lib/formatters';
import './CharacterGallery.css';

const DEFAULT_CHARACTERS = [
  {
    id: 'c-elena-marlowe',
    name: 'Elena Marlowe',
    book_title: 'The Midnight Letters',
    role: 'Protagonist',
    personality: 'A thoughtful writer with a curious mind and a hopeful heart.',
    avatar_asset_id: 'portrait-elena-01',
  },
  {
    id: 'c-daniel-hayes',
    name: 'Daniel Hayes',
    book_title: 'The Midnight Letters',
    role: 'Companion',
    personality: 'A loyal coastal cartographer who decodes historic navigational charts.',
    avatar_asset_id: 'portrait-daniel-01',
  },
  {
    id: 'c-margaret-ellison',
    name: 'Margaret Ellison',
    book_title: 'The Midnight Letters',
    role: 'Mentor',
    personality: 'An esteemed literary salon host who safeguards lost manuscripts.',
    avatar_asset_id: 'portrait-margaret-01',
  },
  {
    id: 'c-victor-kane',
    name: 'Victor Kane',
    book_title: 'The Midnight Letters',
    role: 'Rival',
    personality: 'A relentless antique collector vying for the coastal estate archives.',
    avatar_asset_id: 'portrait-victor-01',
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
