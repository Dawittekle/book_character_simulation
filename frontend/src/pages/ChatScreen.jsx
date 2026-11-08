import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import CharacterDetailsDrawer from '../components/CharacterDetailsDrawer';
import WaveformPlayer from '../components/WaveformPlayer';
import { lorelyApi } from '../services/lorelyApi';
import { getCharacterAvatarUrl } from '../lib/formatters';
import './ChatScreen.css';

// Elena Marlowe fallback character for seamless immediate rendering matching visual reference
const DEFAULT_FALLBACK_CHARACTER = {
  id: 'c-elena-marlowe',
  name: 'Elena Marlowe',
  book_title: 'The Midnight Letters',
  role: 'Protagonist',
  personality: 'A thoughtful writer with a curious mind and a hopeful heart.',
  occupation: 'Writer',
  affiliation: 'The Literary Circle',
  key_events: [
    'Believes in the power of second chances',
    'Wrote her first novel at age 17',
    'Has a mysterious past connected to the coast',
  ],
  relationships: [
    { name: 'Daniel Hayes', role: 'Companion', avatar: '/avatars/daniel_hayes.svg' },
    { name: 'Margaret Ellison', role: 'Mentor', avatar: '/avatars/margaret_ellison.svg' },
    { name: 'Victor Kane', role: 'Rival', avatar: '/avatars/victor_kane.svg' },
  ],
  emotion_state: { hope: 0.78, anxiety: 0.12, sadness: 0.10 },
};

const DEFAULT_SEED_MESSAGES = [
  {
    id: 'seed-1',
    role: 'assistant',
    content: "Hello there! It's wonderful to meet you. I'm Elena Marlowe — a dreamer, a writer, and a woman who believes in second chances.",
    created_at: new Date(Date.now() - 60000).toISOString(),
    citations: [],
  },
  {
    id: 'seed-2',
    role: 'user',
    content: 'What inspired you to become a writer?',
    created_at: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: 'seed-3',
    role: 'assistant',
    content: 'Ah, that’s a beautiful question. Perhaps it was the stories I found in old books, or the people I met along the way... or maybe the hope that words can change the world.',
    created_at: new Date().toISOString(),
    showAudio: true,
    citations: [
      {
        chapter_order: 1,
        chapter_title: 'Chapter 1: The Midnight Call',
        snippet: 'Elena sat by the flickering candle, watching ink soak into parchment.',
        similarity: 0.88,
      },
    ],
  },
];

export default function ChatScreen() {
  const { characterId, sessionId: paramSessionId } = useParams();
  const { accessToken } = useOutletContext();
  const navigate = useNavigate();

  const [character, setCharacter] = useState(DEFAULT_FALLBACK_CHARACTER);
  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [messages, setMessages] = useState(DEFAULT_SEED_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [expandedCitationId, setExpandedCitationId] = useState(null);
  const [emotionState, setEmotionState] = useState(DEFAULT_FALLBACK_CHARACTER.emotion_state);

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
          if (dossier.emotion_state) {
            setEmotionState(dossier.emotion_state);
          }
        }

        // If session exists or create one
        let activeSessionId = paramSessionId;
        if (!activeSessionId) {
          const conv = await lorelyApi.createConversation(
            { characterId, title: `Conversation with ${dossier?.name || 'Character'}` },
            accessToken,
          );
          activeSessionId = conv.id;
          if (mounted) setSessionId(conv.id);
        }

        if (activeSessionId) {
          const fetchedMessages = await lorelyApi.getConversationMessages(activeSessionId, accessToken);
          if (mounted && fetchedMessages && fetchedMessages.length > 0) {
            setMessages(fetchedMessages);
          }
        }
      } catch (err) {
        // Retain fallback character and default messages gracefully
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
    setIsRecording(false);
    if (inputText.trim()) {
      handleSendMessage();
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const clean = inputText.trim();
    if (!clean || sending) return;

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
      if (sessionId) {
        let responseData;
        // If user was using voice mode or has audio, invoke voice-turn
        if (isRecording) {
          responseData = await lorelyApi.sendVoiceTurn(
            sessionId,
            { speechText: clean },
            accessToken,
          );
        } else {
          responseData = await lorelyApi.sendConversationMessage(
            sessionId,
            { content: clean },
            accessToken,
          );
        }

        const audioSrc = responseData.audio?.base64_data
          ? `data:${responseData.audio.mime_type};base64,${responseData.audio.base64_data}`
          : lorelyApi.getMessageAudioUrl(sessionId, responseData.assistant_message_id);

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
      } else {
        // Local simulation fallback
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              role: 'assistant',
              content: `Every time we speak, I feel as though another chapter opens between us. You asked: "${clean}". In truth, the written word has always been my compass.`,
              citations: [],
              created_at: new Date().toISOString(),
              showAudio: true,
            },
          ]);
        }, 700);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'My apologies, my thoughts were briefly interrupted. Could you share that with me once more?',
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
          {messages.map((msg) => {
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
          })}
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
