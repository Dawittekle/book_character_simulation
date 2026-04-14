import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './ChatInterface.css';
import CharacterInsights from './CharacterInsights';
import apiService from '../services/api';
import {
  countSavedConversations,
  getInitials,
  truncateText,
} from '../lib/formatters';
import {
  getConversationSnapshot,
  getWorkspaceBook,
  saveConversationSnapshot,
  upsertWorkspaceBook,
} from '../lib/workspaceStore';

function ChatInterface({ ownerKey, session, workspaceVersion, onWorkspaceChanged }) {
  const { textId, characterId } = useParams();
  const messagesEndRef = useRef(null);
  const [book, setBook] = useState(() => getWorkspaceBook(ownerKey, textId));
  const [character, setCharacter] = useState(() =>
    getWorkspaceBook(ownerKey, textId)?.characters.find(
      (candidate) => candidate.id === characterId,
    ),
  );
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [emotionState, setEmotionState] = useState(null);
  const [psiParameters, setPsiParameters] = useState(null);
  const [provider, setProvider] = useState('server_default');
  const [inputValue, setInputValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const nextBook = getWorkspaceBook(ownerKey, textId);
    const nextCharacter =
      nextBook?.characters.find((candidate) => candidate.id === characterId) || null;
    const snapshot = getConversationSnapshot(ownerKey, textId, characterId);

    setBook(nextBook);
    setCharacter(nextCharacter);
    setMessages(snapshot?.messages || []);
    setSessionId(snapshot?.sessionId || null);
    setEmotionState(snapshot?.emotionState || nextCharacter?.emotion_state || null);
    setPsiParameters(snapshot?.psiParameters || nextCharacter?.psi_parameters || null);
    setProvider(nextBook?.preferredProvider || 'server_default');
    setErrorMessage('');
  }, [ownerKey, textId, characterId, workspaceVersion]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, isSending]);

  const handleProviderChange = (nextProvider) => {
    setProvider(nextProvider);

    if (!book) {
      return;
    }

    upsertWorkspaceBook(ownerKey, {
      ...book,
      preferredProvider: nextProvider,
      activeCharacterId: characterId,
    });
    onWorkspaceChanged();
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || !character || !book || isSending) {
      return;
    }

    const optimisticMessage = {
      id: `local-${Date.now()}`,
      type: 'user',
      content: trimmedMessage,
    };

    const optimisticMessages = [...messages, optimisticMessage];

    setMessages(optimisticMessages);
    setInputValue('');
    setErrorMessage('');
    setIsSending(true);

    try {
      const response = await apiService.chatWithCharacter({
        characterId,
        message: trimmedMessage,
        textId,
        sessionId,
        llmProvider: provider === 'server_default' ? undefined : provider,
        accessToken: session.access_token,
      });

      const nextMessages = [
        ...optimisticMessages,
        {
          id: `assistant-${Date.now()}`,
          type: 'ai',
          content: response.reply,
        },
      ];

      setMessages(nextMessages);
      setSessionId(response.session_id);
      setEmotionState(response.emotion_state);
      setPsiParameters(response.updated_psi);

      upsertWorkspaceBook(ownerKey, {
        ...book,
        preferredProvider: provider,
        activeCharacterId: characterId,
      });
      saveConversationSnapshot(ownerKey, {
        textId,
        characterId,
        sessionId: response.session_id,
        messages: nextMessages,
        psiParameters: response.updated_psi,
        emotionState: response.emotion_state,
      });
      onWorkspaceChanged();
    } catch (error) {
      setMessages(messages);
      setInputValue(trimmedMessage);
      setErrorMessage(error.message || 'Sending the message failed.');
    } finally {
      setIsSending(false);
    }
  };

  if (!book || !character) {
    return (
      <div className="empty-state surface-card">
        <h2>This conversation is missing its saved book or character context.</h2>
        <p>Return to the character board and reopen the conversation from there.</p>
        <Link className="primary-button" to="/">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <section className="chat-layout">
        <article className="chat-thread surface-card">
          <header className="chat-thread-header">
            <div className="chat-thread-title">
              <span className="character-thread-avatar">{getInitials(character.name)}</span>
              <div>
                <h2>{character.name}</h2>
                <p>{truncateText(character.personality, 145)}</p>
              </div>
            </div>

            <div className="chat-thread-actions">
              <select
                aria-label="Select provider"
                value={provider}
                onChange={(event) => handleProviderChange(event.target.value)}
              >
                <option value="server_default">Server default</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
              <Link className="secondary-button" to={`/workspace/${textId}`}>
                Back to board
              </Link>
            </div>
          </header>

          {errorMessage ? <div className="alert-banner">{errorMessage}</div> : null}

          <div className="chat-messages">
            {messages.length ? (
              messages.map((message) => (
                <article
                  className={
                    message.type === 'user'
                      ? 'chat-bubble is-user'
                      : 'chat-bubble is-ai'
                  }
                  key={message.id || `${message.type}-${message.content}`}
                >
                  <span className="chat-bubble-role">
                    {message.type === 'user' ? 'You' : character.name}
                  </span>
                  <p>{message.content}</p>
                </article>
              ))
            ) : (
              <div className="chat-empty-state">
                <span className="section-eyebrow">Conversation starter</span>
                <h3>Open with a grounded question.</h3>
                <p>
                  Ask about a relationship, a recent event, or a motivation you
                  want the character to explain in their own voice.
                </p>
              </div>
            )}

            {isSending ? (
              <div className="chat-bubble is-ai is-typing">
                <span className="chat-bubble-role">{character.name}</span>
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <form className="chat-composer" onSubmit={handleSendMessage}>
            <textarea
              placeholder={`Ask ${character.name} something grounded in ${book.title}...`}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage(event);
                }
              }}
            />

            <div className="chat-composer-footer">
              <span className="field-hint">
                Press Enter to send, Shift + Enter for a new line.
              </span>
              <button
                className="primary-button"
                disabled={!inputValue.trim() || isSending}
                type="submit"
              >
                {isSending ? 'Sending...' : 'Send message'}
              </button>
            </div>
          </form>
        </article>

        <aside className="chat-sidebar">
          <section className="chat-sidebar-card surface-card">
            <span className="section-eyebrow">Session context</span>
            <h3>{book.title}</h3>
            <p>{truncateText(book.preview, 220)}</p>
            <div className="chat-session-meta">
              <span className="outline-pill">{countSavedConversations(book)} saved chats</span>
              <span className="outline-pill">
                {sessionId ? 'Session linked' : 'New session'}
              </span>
            </div>
          </section>

          <CharacterInsights emotionState={emotionState} psiParameters={psiParameters} />

          <section className="chat-sidebar-card surface-card">
            <span className="section-eyebrow">Key events</span>
            <ul className="chat-sidebar-list">
              {character.key_events.length ? (
                character.key_events.map((eventItem) => <li key={eventItem}>{eventItem}</li>)
              ) : (
                <li>No events were extracted yet.</li>
              )}
            </ul>
          </section>

          <section className="chat-sidebar-card surface-card">
            <span className="section-eyebrow">Relationships</span>
            <ul className="chat-sidebar-list">
              {character.relationships.length ? (
                character.relationships.map((relationship) => (
                  <li key={relationship}>{relationship}</li>
                ))
              ) : (
                <li>No relationships were extracted yet.</li>
              )}
            </ul>
          </section>
        </aside>
      </section>
    </div>
  );
}

export default ChatInterface;
