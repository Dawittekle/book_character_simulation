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

  // Default literary relationships if not extracted or empty
  const relationships = character.relationships?.length
    ? character.relationships
    : [
        { name: 'Daniel Hayes', role: 'Companion', avatar: '/avatars/daniel_hayes.svg' },
        { name: 'Margaret Ellison', role: 'Mentor', avatar: '/avatars/margaret_ellison.svg' },
        { name: 'Victor Kane', role: 'Rival', avatar: '/avatars/victor_kane.svg' },
      ];

  // Default story facts
  const storyFacts = character.key_events?.length
    ? character.key_events
    : [
        'Believes in the power of second chances',
        'Wrote her first novel at age 17',
        'Has a mysterious past connected to the coast',
      ];

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
          <p className="character-book-title">{bookTitle || character.book_title || 'The Midnight Letters'}</p>
          <p className="character-bio">
            {character.personality ||
              'A thoughtful writer with a curious mind and a hopeful heart.'}
          </p>

          <div className="character-attributes-list">
            <div className="attribute-row">
              <span className="attr-icon">👤</span>
              <span className="attr-label">Role:</span>
              <span className="attr-value">{character.role || 'Protagonist'}</span>
            </div>
            <div className="attribute-row">
              <span className="attr-icon">💼</span>
              <span className="attr-label">Occupation:</span>
              <span className="attr-value">{character.occupation || 'Writer'}</span>
            </div>
            <div className="attribute-row">
              <span className="attr-icon">🏛</span>
              <span className="attr-label">Affiliation:</span>
              <span className="attr-value">{character.affiliation || 'The Literary Circle'}</span>
            </div>
          </div>
        </div>

        {/* Relationships */}
        <section className="drawer-section">
          <h3 className="section-title">
            <span className="section-title-icon">👥</span>
            Relationships
          </h3>
          <div className="relationships-grid">
            {relationships.map((rel, idx) => {
              const relName = typeof rel === 'string' ? rel.split('(')[0].trim() : rel.name;
              const relRole = typeof rel === 'string' ? (rel.match(/\((.*?)\)/)?.[1] || 'Associate') : rel.role;
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

        {/* Story Facts */}
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
