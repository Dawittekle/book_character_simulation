import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../services/lorelyApi';
import { getCharacterAvatarUrl, formatRelativeDate } from '../lib/formatters';
import './Conversations.css';

const DEFAULT_CONVERSATIONS = [
  {
    id: 's-white-nights-1',
    title: 'Dialogue on Solitude and Petersburg Nights',
    book_title: 'White Nights',
    character_id: 'c-nastenka',
    character_name: 'Nástyenka',
    character_avatar_asset_id: 'avatar-nastenka',
    spoiler_policy: 'cautious',
    message_count: 4,
    last_message_at: new Date(Date.now() - 3600000).toISOString(),
    latest_emotion_state: { hope: 0.85, melancholy: 0.25 },
  },
];

export default function Conversations() {
  const { accessToken } = useOutletContext();
  const [conversations, setConversations] = useState(DEFAULT_CONVERSATIONS);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function loadConversations() {
      try {
        const list = await lorelyApi.listConversations(accessToken);
        if (mounted && list && list.length > 0) {
          setConversations(list);
        }
      } catch (err) {
        // Fall back gracefully
      }
    }
    loadConversations();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const handleDelete = async (e, convId) => {
    e.stopPropagation();
    try {
      await lorelyApi.deleteConversation(convId, accessToken);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
    } catch (err) {
      // Handle deletion failure
    }
  };

  return (
    <div className="lorely-conversations-page" data-testid="conversations-page">
      <header className="conversations-header">
        <button
          type="button"
          className="page-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ← Back
        </button>
        <div className="conversations-title-group">
          <h1 className="conversations-title">Your Conversations</h1>
          <p className="conversations-subtitle">
            Review past exchanges, ongoing character bonds, and remembered facts.
          </p>
        </div>
      </header>

      {conversations.length === 0 ? (
        <div className="conversations-empty-state">
          <span className="empty-icon">📖</span>
          <h3>No Conversations Yet</h3>
          <p>Explore your library and begin talking with a character to build memories.</p>
          <button
            type="button"
            className="empty-cta-btn"
            onClick={() => navigate('/library')}
          >
            Explore Library →
          </button>
        </div>
      ) : (
        <div className="conversations-list">
          {conversations.map((conv) => {
            const avatarUrl = getCharacterAvatarUrl(
              conv.character_name,
              conv.character_avatar_asset_id,
            );

            return (
              <article
                key={conv.id}
                className="conversation-row-card"
                onClick={() => navigate(`/chat/${conv.character_id}/${conv.id}`)}
              >
                <img
                  src={avatarUrl}
                  alt={conv.character_name}
                  className="conv-avatar"
                />

                <div className="conv-main-info">
                  <div className="conv-title-line">
                    <h3 className="conv-char-name">{conv.character_name}</h3>
                    <span className="conv-book-title">({conv.book_title})</span>
                    <span className="conv-spoiler-pill">{conv.spoiler_policy}</span>
                  </div>
                  <p className="conv-topic">{conv.title}</p>
                </div>

                <div className="conv-meta-col">
                  <span className="conv-time">
                    {formatRelativeDate(conv.last_message_at)}
                  </span>
                  <span className="conv-msg-count">
                    {conv.message_count} {conv.message_count === 1 ? 'turn' : 'turns'}
                  </span>
                </div>

                <button
                  type="button"
                  className="conv-delete-btn"
                  onClick={(e) => handleDelete(e, conv.id)}
                  aria-label="Delete conversation"
                >
                  🗑
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
