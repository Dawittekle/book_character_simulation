import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Quote,
  MessageSquare,
  Bot,
  User,
  ChevronDown,
  Volume2,
} from 'lucide-react';
import { lorelyApi } from '../../services/lorelyApi';
import { READER_THEMES } from './ReaderThemes';

const SUGGESTED_PROMPTS = [
  'What were you thinking at this exact moment?',
  'Why did you react this way?',
  'Did you really mean what you said here?',
  'What was left unsaid between you two?',
];

export default function AskCharacterDrawer({
  isOpen,
  onClose,
  bookId,
  passageQuote = '',
  chapterIndex = 0,
  chapterTitle = '',
  characters = [],
  themeId = 'parchment',
  session,
}) {
  const drawerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const currentTheme = READER_THEMES[themeId] || READER_THEMES.parchment;

  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // Set default character on open or characters update
  useEffect(() => {
    if (characters && characters.length > 0 && (!selectedCharacterId || !characters.some((c) => c.id === selectedCharacterId))) {
      setSelectedCharacterId(characters[0].id);
    }
  }, [characters, selectedCharacterId]);

  // Reset conversation when a new passage is opened
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setSessionId(null);
      setError(null);
      setInputMessage('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, passageQuote, chapterIndex]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) || characters[0];

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading || !selectedCharacterId) return;

    setInputMessage('');
    setError(null);

    // Optimistically add user message
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = session?.access_token;
      const payload = {
        character_id: selectedCharacterId,
        passage_quote: passageQuote,
        user_message: text,
        chapter_index: chapterIndex + 1, // 1-based index for spoiler gate
        session_id: sessionId || undefined,
      };

      const result = await lorelyApi.sendReaderContextualChat(bookId, payload, token);

      if (result.session_id) {
        setSessionId(result.session_id);
      }

      const characterReply = {
        id: result.assistant_message_id || `asst-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        character: result.character || selectedCharacter,
        citations: result.citations || [],
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, characterReply]);
    } catch (err) {
      console.error('Failed contextual character turn:', err);
      setError(err.message || 'Character simulation encountered an error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (drawerRef.current && !drawerRef.current.contains(e.target)) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-character-drawer-title"
    >
      <div
        ref={drawerRef}
        className="w-full max-w-lg h-full shadow-2xl flex flex-col transition-transform duration-300 animate-slide-left border-l"
        style={{
          backgroundColor: currentTheme.bg,
          color: currentTheme.text,
          borderColor: currentTheme.border,
        }}
      >
        {/* Drawer Header */}
        <div
          className="p-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: currentTheme.border, backgroundColor: currentTheme.cardBg }}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-500 shrink-0">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div className="overflow-hidden">
              <h2 id="ask-character-drawer-title" className="text-base font-serif font-semibold truncate">
                Ask a Character
              </h2>
              <p className="text-xs opacity-70 truncate font-mono">
                Contextual Passage Discussion · No Spoilers Beyond Ch. {chapterIndex + 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Character Selector Strip */}
        <div
          className="px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: currentTheme.border }}
        >
          <label htmlFor="character-picker" className="text-xs font-medium opacity-80 shrink-0">
            Speaking with:
          </label>
          {characters && characters.length > 0 ? (
            <div className="relative flex-1 max-w-xs">
              <select
                id="character-picker"
                value={selectedCharacterId}
                onChange={(e) => {
                  setSelectedCharacterId(e.target.value);
                  setMessages([]);
                  setSessionId(null);
                }}
                className="w-full py-1.5 pl-3 pr-8 rounded-xl border text-xs font-serif font-medium bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer appearance-none truncate"
                style={{
                  borderColor: currentTheme.border,
                  backgroundColor: currentTheme.cardBg,
                  color: currentTheme.text,
                }}
              >
                {characters.map((char) => (
                  <option key={char.id} value={char.id} className="text-black dark:text-white bg-white dark:bg-stone-900">
                    {char.name} {char.role ? `(${char.role})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 opacity-50 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <span className="text-xs italic opacity-60">No characters identified in book yet</span>
          )}
        </div>

        {/* Pinned Passage Quote Card */}
        {passageQuote && (
          <div
            className="p-3.5 mx-4 mt-3 rounded-2xl border text-xs relative overflow-hidden shrink-0 shadow-sm"
            style={{
              backgroundColor: currentTheme.cardBg,
              borderColor: currentTheme.border,
            }}
          >
            <div className="flex items-center justify-between mb-1.5 opacity-70">
              <span className="font-mono text-[10px] uppercase tracking-wider flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-500">
                <Quote className="w-3 h-3" />
                <span>Selected Passage</span>
              </span>
              <span className="font-serif italic text-[11px]">
                {chapterTitle || `Chapter ${chapterIndex + 1}`}
              </span>
            </div>
            <p className="font-serif italic leading-relaxed text-sm opacity-90 line-clamp-4 select-text">
              “{passageQuote}”
            </p>
          </div>
        )}

        {/* Conversation Transcript */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner"
                style={{ backgroundColor: currentTheme.cardBg, borderColor: currentTheme.border }}
              >
                <Sparkles className="w-7 h-7 text-amber-500" />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="font-serif font-semibold text-sm">
                  {selectedCharacter ? `Ask ${selectedCharacter.name}` : 'Step into the Story'}
                </h3>
                <p className="text-xs opacity-70 leading-relaxed font-sans">
                  Summon the character into this exact moment in the story. They will speak in voice and knowledge strictly up to Chapter {chapterIndex + 1}.
                </p>
              </div>

              {/* Suggested Prompt Chips */}
              <div className="w-full space-y-2 pt-2">
                <span className="text-[11px] font-mono opacity-60 uppercase tracking-wider block text-left">
                  Suggested inquiries
                </span>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="text-left p-2.5 rounded-xl border text-xs transition-all hover:border-amber-500/50 hover:bg-amber-500/10 font-serif active:scale-[0.99]"
                      style={{
                        borderColor: currentTheme.border,
                        backgroundColor: currentTheme.cardBg,
                      }}
                    >
                      “{prompt}”
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-mono opacity-60 px-1">
                    {isUser ? (
                      <span>You</span>
                    ) : (
                      <>
                        <span className="font-semibold font-serif text-amber-600 dark:text-amber-500">
                          {selectedCharacter?.name || 'Character'}
                        </span>
                        {msg.citations && msg.citations.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[9px]">
                            Grounded in Ch. {msg.citations[0].chapter_order}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed select-text ${
                      isUser
                        ? 'bg-amber-500 text-white shadow-sm rounded-br-sm'
                        : 'border shadow-sm rounded-bl-sm font-serif'
                    }`}
                    style={
                      !isUser
                        ? {
                            backgroundColor: currentTheme.cardBg,
                            borderColor: currentTheme.border,
                            color: currentTheme.text,
                          }
                        : undefined
                    }
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex items-center gap-2 p-3 text-xs opacity-70 font-serif italic animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span>{selectedCharacter?.name || 'Character'} is considering the passage...</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleFormSubmit}
          className="p-3.5 border-t flex items-center gap-2 shrink-0"
          style={{
            borderColor: currentTheme.border,
            backgroundColor: currentTheme.cardBg,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              selectedCharacter
                ? `Ask ${selectedCharacter.name} about this quote...`
                : 'Ask a character about this passage...'
            }
            disabled={loading}
            className="flex-1 py-2.5 px-3.5 rounded-xl border text-xs sm:text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
            style={{
              borderColor: currentTheme.border,
              color: currentTheme.text,
            }}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || loading || !selectedCharacterId}
            className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-medium transition-all shadow-sm active:scale-95 shrink-0"
            title="Send inquiry"
            aria-label="Send message"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
