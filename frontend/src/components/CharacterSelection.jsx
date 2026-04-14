import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import './CharacterSelection.css';
import CharacterInsights from './CharacterInsights';
import {
  countSavedConversations,
  formatRelativeDate,
  getInitials,
  truncateText,
} from '../lib/formatters';
import {
  getConversationSnapshot,
  getWorkspaceBook,
  rememberSelectedCharacter,
} from '../lib/workspaceStore';

function CharacterSelection({ ownerKey, workspaceVersion, onWorkspaceChanged }) {
  const { textId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(() => getWorkspaceBook(ownerKey, textId));
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    book?.activeCharacterId || book?.characters[0]?.id || null,
  );

  useEffect(() => {
    const nextBook = getWorkspaceBook(ownerKey, textId);
    setBook(nextBook);
    setSelectedCharacterId(
      nextBook?.activeCharacterId || nextBook?.characters[0]?.id || null,
    );
  }, [ownerKey, textId, workspaceVersion]);

  if (!book) {
    return (
      <div className="empty-state surface-card">
        <h2>This workspace is not available in the browser library yet.</h2>
        <p>
          Return to the dashboard, upload the book again, and the character
          board will be rebuilt locally.
        </p>
        <Link className="primary-button" to="/">
          Back to library
        </Link>
      </div>
    );
  }

  const selectedCharacter =
    book.characters.find((character) => character.id === selectedCharacterId) ||
    book.characters[0] ||
    null;

  const selectedSnapshot = selectedCharacter
    ? getConversationSnapshot(ownerKey, textId, selectedCharacter.id)
    : null;

  const handleSelectCharacter = (characterId) => {
    setSelectedCharacterId(characterId);
    rememberSelectedCharacter(ownerKey, textId, characterId);
    onWorkspaceChanged();
  };

  const handleOpenChat = () => {
    if (!selectedCharacter) {
      return;
    }

    rememberSelectedCharacter(ownerKey, textId, selectedCharacter.id);
    onWorkspaceChanged();
    navigate(`/chat/${textId}/${selectedCharacter.id}`);
  };

  return (
    <div className="character-board-page">
      <section className="board-hero surface-card">
        <div className="board-hero-cover">
          <span>{getInitials(book.title)}</span>
        </div>

        <div className="board-hero-copy">
          <div className="board-hero-pills">
            <span className="status-pill">{book.characters.length} characters</span>
            <span className="outline-pill">
              {countSavedConversations(book)} saved chats
            </span>
            <span className="outline-pill">
              Updated {formatRelativeDate(book.updatedAt)}
            </span>
          </div>

          <h2>{book.title}</h2>
          <p>{truncateText(book.preview, 280)}</p>
          <small>{book.sourceLabel}</small>
        </div>
      </section>

      <section className="board-layout">
        <div className="character-grid">
          {book.characters.map((character) => {
            const snapshot = getConversationSnapshot(ownerKey, textId, character.id);

            return (
              <button
                className={
                  selectedCharacter?.id === character.id
                    ? 'character-card surface-card is-selected'
                    : 'character-card surface-card'
                }
                key={character.id}
                onClick={() => handleSelectCharacter(character.id)}
                type="button"
              >
                <div className="character-card-topline">
                  <span className="character-card-avatar">
                    {getInitials(character.name)}
                  </span>
                  <span className="outline-pill">
                    {snapshot ? 'Saved chat ready' : 'New conversation'}
                  </span>
                </div>
                <h3>{character.name}</h3>
                <p>{truncateText(character.personality, 160)}</p>
              </button>
            );
          })}
        </div>

        <aside className="dossier-panel">
          {selectedCharacter ? (
            <>
              <section className="dossier-summary surface-card">
                <span className="section-eyebrow">Selected character</span>
                <h3>{selectedCharacter.name}</h3>
                <p>{selectedCharacter.personality}</p>

                <div className="dossier-summary-actions">
                  <button className="primary-button" onClick={handleOpenChat} type="button">
                    {selectedSnapshot ? 'Resume chat' : `Chat with ${selectedCharacter.name}`}
                  </button>
                  <Link className="secondary-button" to="/">
                    Back to library
                  </Link>
                </div>
              </section>

              <CharacterInsights
                emotionState={
                  selectedSnapshot?.emotionState || selectedCharacter.emotion_state
                }
                psiParameters={
                  selectedSnapshot?.psiParameters || selectedCharacter.psi_parameters
                }
              />

              <section className="dossier-list surface-card">
                <span className="section-eyebrow">Relationships</span>
                <ul>
                  {selectedCharacter.relationships.length ? (
                    selectedCharacter.relationships.map((relationship) => (
                      <li key={relationship}>{relationship}</li>
                    ))
                  ) : (
                    <li>No relationships were extracted yet.</li>
                  )}
                </ul>
              </section>

              <section className="dossier-list surface-card">
                <span className="section-eyebrow">Key events</span>
                <ul>
                  {selectedCharacter.key_events.length ? (
                    selectedCharacter.key_events.map((event) => <li key={event}>{event}</li>)
                  ) : (
                    <li>No key events were extracted yet.</li>
                  )}
                </ul>
              </section>
            </>
          ) : (
            <div className="empty-state surface-card">
              <h3>No characters were extracted for this source.</h3>
              <p>Try a longer excerpt or a more complete PDF.</p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

export default CharacterSelection;
