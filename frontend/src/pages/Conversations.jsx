import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../services/lorelyApi';
import { getCharacterAvatarUrl, formatRelativeDate } from '../lib/formatters';
import PillButton from '../components/brand/PillButton';
import BadgePill from '../components/brand/BadgePill';
import './Conversations.css';

export default function Conversations() {
  const { accessToken } = useOutletContext();
  const [conversations, setConversations] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function loadConversations() {
      try {
        const list = await lorelyApi.listConversations(accessToken);
        if (mounted) {
          setConversations(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        if (mounted) {
          setConversations([]);
        }
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
          <div className="conversations-title-lockup">
            <h1 className="conversations-title">Your Conversations</h1>
            <BadgePill variant="orange" dotColor="#ef4d23" className="conversations-count-badge">
              {conversations.length} Active {conversations.length === 1 ? 'Bond' : 'Bonds'}
            </BadgePill>
          </div>
          <p className="conversations-subtitle">
            Review past exchanges, ongoing character bonds, and remembered facts.
          </p>
        </div>
      </header>

      {conversations.length === 0 ? (
        <div className="conversations-empty-state">
          <div className="empty-icon-bubble">💬</div>
          <h3>No Conversations Yet</h3>
          <p>Explore your library and begin talking with a character to build memories.</p>
          <PillButton
            variant="orange"
            size="md"
            hasChevron
            onClick={() => navigate('/library')}
            className="empty-cta-btn"
          >
            Explore Library →
          </PillButton>
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
                <div className="conv-avatar-wrap">
                  <img
                    src={avatarUrl}
                    alt={conv.character_name}
                    className="conv-avatar"
                  />
                  <span className="conv-online-dot" />
                </div>

                <div className="conv-main-info">
                  <div className="conv-title-line">
                    <h3 className="conv-char-name">{conv.character_name}</h3>
                    <span className="conv-book-title">({conv.book_title})</span>
                    {conv.spoiler_policy && (
                      <span className="conv-spoiler-pill">{conv.spoiler_policy}</span>
                    )}
                  </div>
                  <p className="conv-topic">{conv.title || 'Ongoing dialogue'}</p>
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
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
