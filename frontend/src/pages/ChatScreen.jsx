import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import CharacterDetailsDrawer from '../components/CharacterDetailsDrawer';
import WaveformPlayer from '../components/WaveformPlayer';
import { lorelyApi } from '../services/lorelyApi';
import { getCharacterAvatarUrl } from '../lib/formatters';
import './ChatScreen.css';

// Fallback template before live dossier loads
const INITIAL_EMPTY_CHARACTER = {
  id: '',
  name: 'Literary Character',
  book_title: 'Literary Work',
  role: 'Character',
  personality: '',
  occupation: '',
  affiliation: '',
  key_events: [],
  relationships: [],
  emotion_state: { hope: 0.5, curiosity: 0.5 },
};

export default function ChatScreen() {
  const { characterId, sessionId: paramSessionId } = useParams();
  const { accessToken } = useOutletContext();
  const navigate = useNavigate();

  const [character, setCharacter] = useState(INITIAL_EMPTY_CHARACTER);
  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [expandedCitationId, setExpandedCitationId] = useState(null);
  const [emotionState, setEmotionState] = useState(INITIAL_EMPTY_CHARACTER.emotion_state);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load character & conversation
  useEffect(() => {
    let mounted = true;
    async function initConversation() {
      if (!characterId) return;

      try {
        // Fetch character dossier
        const dossier = await lorelyApi.getCharacterDossier(characterId, accessToken);
        if (mounted && dossier) {
          setCharacter(dossier);
          const initialEmotions = dossier.current_user_emotion_state || dossier.canonical_emotion_state || dossier.emotion_state;
          if (initialEmotions) {
            setEmotionState(initialEmotions);
          }
        }

        // Only load messages if a specific sessionId is provided in the route param
        if (paramSessionId) {
          try {
            const fetchedMessages = await lorelyApi.getConversationMessages(paramSessionId, accessToken);
            if (mounted) {
              setSessionId(paramSessionId);
              setMessages(fetchedMessages || []);
            }
          } catch (fetchErr) {
            console.warn('Existing session inaccessible, starting fresh session:', fetchErr);
            if (mounted) {
              setSessionId(null);
              setMessages([]);
            }
          }
        } else {
          // Do NOT create conversation prematurely on mount - wait until user sends first message
          if (mounted) {
            setSessionId(null);
            setMessages([]);
          }
        }
      } catch (err) {
        console.error('Failed to initialize conversation session:', err);
      }
    }
    initConversation();
    return () => {
      mounted = false;
    };
  }, [characterId, paramSessionId, accessToken]);

  const handleToggleVoiceRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((r) => r[0].transcript)
            .join('');
          setInputText(transcript);
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
      } catch (err) {
        setIsRecording(true);
      }
    } else {
      // In environments without SpeechRecognition (or mock), toggle recording mode directly
      setIsRecording(true);
      if (!inputText) {
        setInputText("I loved the chapter where you spoke of second chances.");
      }
    }
  };

  const handleStopVoiceAndSend = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    const wasRecording = isRecording;
    setIsRecording(false);
    if (inputText.trim()) {
      handleSendMessage(undefined, wasRecording);
    }
  };

  const handleSendMessage = async (e, forceVoiceMode = false) => {
    e?.preventDefault();
    const clean = inputText.trim();
    if (!clean || sending) return;

    const useVoice = forceVoiceMode || isRecording;
    if (isRecording) {
      setIsRecording(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }

    setInputText('');
    setSending(true);

    const userMessageObj = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: clean,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessageObj]);

    try {
      let activeSessionId = sessionId;
      if (!activeSessionId && characterId) {
        const conv = await lorelyApi.createConversation(
          { characterId, title: `Dialogue with ${character.name}` },
          accessToken,
        );
        activeSessionId = conv.id;
        setSessionId(conv.id);
      }

      if (!activeSessionId) {
        throw new Error('Unable to establish conversation session.');
      }

      let responseData;
      try {
        if (useVoice) {
          responseData = await lorelyApi.sendVoiceTurn(
            activeSessionId,
            { speechText: clean },
            accessToken,
          );
        } else {
          responseData = await lorelyApi.sendConversationMessage(
            activeSessionId,
            { content: clean },
            accessToken,
          );
        }
      } catch (msgErr) {
        // If session was 403 (e.g. stale ownership) or 404, automatically recover by creating a new session for the current user
        const isAuthOrNotFoundError =
          msgErr?.status === 403 ||
          msgErr?.status === 404 ||
          String(msgErr?.message || '').includes('403') ||
          String(msgErr?.message || '').includes('Forbidden') ||
          String(msgErr?.message || '').includes('not found');

        if (isAuthOrNotFoundError && characterId) {
          console.warn('Session ownership conflict, establishing fresh session for user...');
          const freshConv = await lorelyApi.createConversation(
            { characterId, title: `Dialogue with ${character.name}` },
            accessToken,
          );
          activeSessionId = freshConv.id;
          setSessionId(freshConv.id);
          responseData = await lorelyApi.sendConversationMessage(
            activeSessionId,
            { content: clean },
            accessToken,
          );
        } else {
          throw msgErr;
        }
      }

      const audioSrc = responseData.audio?.base64_data
        ? `data:${responseData.audio.mime_type};base64,${responseData.audio.base64_data}`
        : lorelyApi.getMessageAudioUrl(activeSessionId, responseData.assistant_message_id);

      const assistantMessageObj = {
        id: responseData.assistant_message_id || `asst-${Date.now()}`,
        role: 'assistant',
        content: responseData.response,
        citations: responseData.citations || [],
        created_at: new Date().toISOString(),
        showAudio: true,
        audioSrc,
      };

      setMessages((prev) => [...prev, assistantMessageObj]);
      if (responseData.updated_state?.emotion_state) {
        setEmotionState(responseData.updated_state.emotion_state);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: err.message && !err.message.includes('403')
            ? `I could not respond due to an error: ${err.message}`
            : 'My apologies, I could not respond at this moment. Please check your connection or try again.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '10:24 AM';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const characterAvatar = getCharacterAvatarUrl(character.name, character.avatar_asset_id);

  return (
    <div className="lorely-chat-screen-layout" data-testid="chat-screen">
      {/* Center Column: Focused Reading & Conversation Room */}
      <div className="chat-conversation-column">
        {/* Top Header Bar */}
        <header className="chat-screen-header">
          <button
            type="button"
            className="chat-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Back to library"
          >
            ← Back
          </button>

          <div className="chat-header-character-info">
            <img
              src={characterAvatar}
              alt={character.name}
              className="chat-header-avatar"
            />
            <div className="chat-header-text">
              <h2 className="chat-header-name">{character.name}</h2>
              <div className="chat-header-subline">
                <span className="chat-header-book">{character.book_title || 'The Midnight Letters'}</span>
                <span className="chat-status-dot">●</span>
                <span className="chat-status-text">Online</span>
              </div>
            </div>
          </div>

          <div className="chat-header-actions">
            <button
              type="button"
              className={`drawer-toggle-btn ${isDrawerOpen ? 'active' : ''}`}
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              aria-label={isDrawerOpen ? 'Close dossier drawer' : 'Open dossier drawer'}
            >
              📖 Dossier
            </button>
            <button type="button" className="chat-options-btn" aria-label="Conversation options">
              ⋮
            </button>
          </div>
        </header>

        {/* Message Thread */}
        <div className="chat-message-stream" data-testid="chat-message-stream">
          {messages.length === 0 ? (
            <div className="chat-welcome-banner" data-testid="chat-welcome-banner">
              <div className="chat-welcome-avatar-wrap">
                <img src={characterAvatar} alt={character.name} className="chat-welcome-avatar" />
              </div>
              <h2 className="chat-welcome-name">{character.name}</h2>
              <p className="chat-welcome-book">{character.book_title || 'Fyodor Dostoevsky Collection'}</p>
              {character.personality && (
                <p className="chat-welcome-bio">{character.personality}</p>
              )}
              <div className="chat-welcome-prompt">
                <span>Begin your dialogue with {character.name}. Ask about their story in St. Petersburg, their convictions, or their memories.</span>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isCharacter = msg.role === 'assistant';

              return (
                <div
                  key={msg.id}
                  className={`chat-message-row ${isCharacter ? 'character-row' : 'user-row'}`}
                >
                  {isCharacter && (
                    <img
                      src={characterAvatar}
                      alt={character.name}
                      className="message-avatar"
                    />
                  )}

                  <div className="message-content-wrapper">
                    <div className={`message-bubble ${isCharacter ? 'character-bubble' : 'user-bubble'}`}>
                      <p className="message-text">{msg.content}</p>

                      <div className="message-meta-row">
                        <span className="message-timestamp">
                          {formatMessageTime(msg.created_at)}
                        </span>
                        {!isCharacter && <span className="message-checkmarks">✓✓</span>}
                      </div>
                    </div>

                    {/* Audio Waveform Embedded in Character speech */}
                    {isCharacter && msg.showAudio && (
                      <WaveformPlayer
                        audioSrc={
                          msg.audioSrc ||
                          (sessionId && msg.id && !msg.id.startsWith('seed')
                            ? lorelyApi.getMessageAudioUrl(sessionId, msg.id)
                            : undefined)
                        }
                      />
                    )}

                    {/* Citations Pill / Grounding Excerpt */}
                    {isCharacter && msg.citations && msg.citations.length > 0 && (
                      <div className="message-citations-block">
                        <button
                          type="button"
                          className="citation-toggle-pill"
                          onClick={() =>
                            setExpandedCitationId(
                              expandedCitationId === msg.id ? null : msg.id,
                            )
                          }
                        >
                          <span className="citation-pill-icon">✦</span>
                          <span>Source passage: {msg.citations[0].chapter_title}</span>
                          <span className="citation-pill-arrow">
                            {expandedCitationId === msg.id ? '▴' : '▾'}
                          </span>
                        </button>

                        {expandedCitationId === msg.id && (
                          <div className="citation-expanded-box">
                            <p className="citation-snippet">“{msg.citations[0].snippet}”</p>
                            <div className="citation-footer">
                              <span>Chapter {msg.citations[0].chapter_order}</span>
                              <span>Match: {Math.round(msg.citations[0].similarity * 100)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!isCharacter && (
                    <img
                      src="/avatars/user_avatar.svg"
                      alt="Reader"
                      className="message-avatar"
                    />
                  )}
                </div>
              );
            })
          )}

          {/* Real-time typing / thinking loading animation */}
          {sending && (
            <div className="chat-message-row character-row typing-row" data-testid="chat-loading-animation">
              <img
                src={characterAvatar}
                alt={character.name}
                className="message-avatar"
              />
              <div className="message-content-wrapper">
                <div className="message-bubble character-bubble typing-bubble">
                  <div className="typing-dots">
                    <span className="dot dot-1" />
                    <span className="dot dot-2" />
                    <span className="dot dot-3" />
                  </div>
                  <span className="typing-status-text">
                    {character.name} is composing...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer Bar */}
        <div className="chat-composer-section">
          {isRecording && (
            <div className="voice-recording-banner" data-testid="voice-recording-banner">
              <div className="voice-banner-left">
                <span className="recording-dot" />
                <span>Listening to your voice... Speak to {character.name.split(' ')[0]}</span>
              </div>
              <button
                type="button"
                className="stop-recording-btn"
                onClick={handleStopVoiceAndSend}
              >
                Send Voice
              </button>
            </div>
          )}

          <form className="chat-composer-box" onSubmit={handleSendMessage}>
            <button
              type="button"
              className={`composer-mic-btn ${isRecording ? 'recording' : ''}`}
              title={isRecording ? "Stop recording voice" : "Speak to character (Voice mode)"}
              aria-label={isRecording ? "Stop recording voice" : "Activate microphone"}
              onClick={handleToggleVoiceRecording}
            >
              🎙
            </button>

            <input
              type="text"
              className="composer-input"
              placeholder={`Talk to ${character.name.split(' ')[0]} or type a message...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={sending}
            />

            <button
              type="submit"
              className="composer-send-btn"
              disabled={!inputText.trim() || sending}
              aria-label="Send message"
            >
              ➤
            </button>
          </form>

          {/* Sub-action pills underneath */}
          <div className="composer-subactions-row">
            <button
              type="button"
              className={`subaction-pill ${isRecording ? 'active' : ''}`}
              onClick={handleToggleVoiceRecording}
            >
              <span className="subaction-icon">∿∿</span> Voice Mode
            </button>
            <span className="subaction-divider">|</span>
            <button
              type="button"
              className="subaction-pill"
              onClick={() => setIsDrawerOpen((prev) => !prev)}
            >
              <span className="subaction-icon">👤</span> Character Profile
            </button>
            <span className="subaction-divider">|</span>
            <button type="button" className="subaction-pill">
              <span className="subaction-icon">📖</span> Memory
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Character Details Dossier Drawer */}
      {isDrawerOpen && (
        <CharacterDetailsDrawer
          character={character}
          bookTitle={character.book_title}
          emotionState={emotionState}
          onClose={() => setIsDrawerOpen(false)}
        />
      )}
    </div>
  );
}
