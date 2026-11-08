import React from 'react';
import EmotionStateWidget from './EmotionStateWidget';
import { getCharacterAvatarUrl } from '../lib/formatters';
import './CharacterDetailsDrawer.css';

export default function CharacterDetailsDrawer({
  character,
  bookTitle,
  emotionState,
  onClose,
}) {
  if (!character) {
    return null;
  }

  const avatarUrl = getCharacterAvatarUrl(character.name, character.avatar_asset_id);

  const relationships = Array.isArray(character.relationships) ? character.relationships : [];
  const storyFacts = Array.isArray(character.key_events) ? character.key_events : [];

  return (
    <aside
      className="character-details-drawer"
      data-testid="character-details-drawer"
      aria-label={`Details for ${character.name}`}
    >
      <div className="drawer-header">
        <div className="drawer-title-group">
          <span className="drawer-icon">📖</span>
          <h2 className="drawer-heading">Character Details</h2>
        </div>
        {onClose && (
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close character details"
          >
            ✕
          </button>
        )}
      </div>

      <div className="drawer-content-scroll">
        {/* Character Portrait Card */}
        <div className="portrait-hero-card">
          <img
            src={avatarUrl}
            alt={character.name}
            className="portrait-hero-img"
          />
        </div>

        {/* Name and Identity */}
        <div className="character-identity">
          <h1 className="character-name">{character.name}</h1>
          <p className="character-book-title">{bookTitle || character.book_title || 'Literary Work'}</p>
          {character.personality && (
            <p className="character-bio">
              {character.personality}
            </p>
          )}

          <div className="character-attributes-list">
            <div className="attribute-row">
              <span className="attr-icon">👤</span>
              <span className="attr-label">Role:</span>
              <span className="attr-value">{character.role || 'Literary Character'}</span>
            </div>
            {character.occupation && (
              <div className="attribute-row">
                <span className="attr-icon">💼</span>
                <span className="attr-label">Occupation:</span>
                <span className="attr-value">{character.occupation}</span>
              </div>
            )}
            <div className="attribute-row">
              <span className="attr-icon">🏛</span>
              <span className="attr-label">Affiliation:</span>
              <span className="attr-value">{character.affiliation || bookTitle || character.book_title || 'Fyodor Dostoevsky Classics'}</span>
            </div>
          </div>
        </div>

        {/* Relationships */}
        {relationships.length > 0 && (
          <section className="drawer-section">
            <h3 className="section-title">
              <span className="section-title-icon">👥</span>
              Relationships
            </h3>
            <div className="relationships-grid">
              {relationships.map((rel, idx) => {
                const relName = typeof rel === 'string' ? rel.split('(')[0].trim() : rel.name;
                const relRole = typeof rel === 'string' ? (rel.match(/\((.*?)\)/)?.[1] || 'Companion') : rel.role;
                const relAvatar = typeof rel === 'object' && rel.avatar ? rel.avatar : getCharacterAvatarUrl(relName);

                return (
                  <div key={idx} className="relationship-card">
                    <img
                      src={relAvatar}
                      alt={relName}
                      className="relationship-avatar"
                    />
                    <div className="relationship-info">
                      <span className="relationship-name">{relName}</span>
                      <span className="relationship-role">({relRole})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Story Facts */}
        {storyFacts.length > 0 && (
          <section className="drawer-section">
            <h3 className="section-title">
              <span className="section-title-icon">✦</span>
              Story Facts
            </h3>
            <ul className="story-facts-list">
              {storyFacts.map((fact, idx) => (
                <li key={idx} className="story-fact-item">
                  <span className="story-fact-bullet">✦</span>
                  <span className="story-fact-text">{fact}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Emotion State Radial Gauge */}
        <section className="drawer-section">
          <EmotionStateWidget
            emotionState={emotionState || character.emotion_state}
          />
        </section>
      </div>
    </aside>
  );
}
