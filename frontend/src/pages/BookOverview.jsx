import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  BookOpen,
  Headphones,
  Sparkles,
  ChevronRight,
  Clock,
  Layers,
  ArrowLeft,
  CheckCircle,
  MessageCircle,
  Loader2,
  Users,
} from 'lucide-react';
import { lorelyApi } from '../services/lorelyApi';
import { getCharacterAvatarUrl } from '../lib/formatters';
import PillButton from '../components/brand/PillButton';
import BadgePill from '../components/brand/BadgePill';
import './BookOverview.css';

export default function BookOverview() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const accessToken = outletContext.accessToken;

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'chapters' | 'characters'

  useEffect(() => {
    if (!bookId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    lorelyApi
      .getBookDetails(bookId, accessToken)
      .then((data) => {
        if (isMounted) {
          setBook(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load book overview:', err);
          setError(err.message || 'Unable to load book details.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [bookId, accessToken]);

  if (loading) {
    return (
      <div className="book-overview-loading">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-sm font-serif opacity-75">Loading literary dossier...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="book-overview-error">
        <h2 className="text-lg font-serif font-bold text-red-500 mb-2">Book Dossier Unavailable</h2>
        <p className="text-sm opacity-75 mb-6">{error || 'Book could not be found.'}</p>
        <button
          onClick={() => navigate('/library')}
          className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          Return to Library
        </button>
      </div>
    );
  }

  const progress = book.reading_progress;
  const progressPercent = Math.round(progress?.progress_percent || 0);
  const currentChapterIdx = progress?.current_chapter_index || 0;
  const isCompleted = progress?.completed || progressPercent >= 99;
  const hasStarted = progressPercent > 0 || currentChapterIdx > 0;

  // Determine Primary Button text
  let primaryBtnText = 'Read Book';
  if (isCompleted) {
    primaryBtnText = 'Read Again';
  } else if (hasStarted) {
    primaryBtnText = `Continue Reading (Ch. ${currentChapterIdx + 1} · ${progressPercent}%)`;
  }

  const chapters = book.chapters || [];
  const characters = book.characters || [];
  const currentChapter = chapters[currentChapterIdx] || chapters[0];

  return (
    <div className="book-overview-container">
      {/* Top Bar with Back Button */}
      <div className="book-overview-topbar">
        <button
          onClick={() => navigate(-1)}
          className="book-overview-back-btn"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Library</span>
        </button>
        <div className="flex items-center gap-2">
          <BadgePill variant="neutral">{book.format?.toUpperCase() || 'BOOK'}</BadgePill>
          <BadgePill variant="outline">{book.original_language?.toUpperCase() || 'EN'}</BadgePill>
        </div>
      </div>

      {/* Hero Showcase */}
      <div className="book-overview-hero">
        <div className="book-overview-cover-wrap">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="book-overview-cover-img"
            />
          ) : (
            <div className="book-overview-cover-fallback">
              <BookOpen className="w-12 h-12 text-amber-500/50 mb-2" />
              <span className="text-xs font-serif font-semibold text-center px-4 line-clamp-3">
                {book.title}
              </span>
            </div>
          )}
          <div className="book-overview-cover-spine" />
        </div>

        <div className="book-overview-meta">
          <h1 className="book-overview-title">{book.title}</h1>
          <p className="book-overview-author">By {book.author || 'Unknown Author'}</p>

          <div className="book-overview-stats-row">
            <span className="flex items-center gap-1.5 text-xs opacity-70">
              <Layers className="w-3.5 h-3.5" />
              <span>{book.total_chapters || chapters.length || 1} Chapters</span>
            </span>
            <span className="opacity-30">·</span>
            <span className="flex items-center gap-1.5 text-xs opacity-70">
              <Users className="w-3.5 h-3.5" />
              <span>{characters.length} Literary Characters</span>
            </span>
          </div>

          {/* Reading Progress Card */}
          <div className="book-overview-progress-card">
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span className="opacity-80">
                {isCompleted ? 'Finished Reading' : hasStarted ? 'Reading in Progress' : 'Not Started Yet'}
              </span>
              <span className="font-mono text-amber-500 font-bold">{progressPercent}%</span>
            </div>
            <div className="book-overview-progress-track">
              <div
                className="book-overview-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {hasStarted && !isCompleted && (
              <p className="text-[11px] opacity-60 mt-2 font-serif italic truncate">
                Last at: {currentChapter?.title || `Chapter ${currentChapterIdx + 1}`}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="book-overview-actions">
            <button
              onClick={() => navigate(`/books/${book.id}/read`)}
              className="book-overview-btn-primary"
            >
              <BookOpen className="w-4 h-4" />
              <span>{primaryBtnText}</span>
            </button>

            <button
              onClick={() => navigate(`/books/${book.id}/read?mode=listen`)}
              className="book-overview-btn-secondary"
              title="Listen in audiobook mode"
            >
              <Headphones className="w-4 h-4 text-amber-500" />
              <span>Listen</span>
            </button>

            <button
              onClick={() => setActiveTab('characters')}
              className="book-overview-btn-secondary"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Cast ({characters.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Section: Overview | Chapters | Characters */}
      <div className="book-overview-tabs-wrap">
        <div className="book-overview-tabs-nav">
          <button
            onClick={() => setActiveTab('overview')}
            className={`book-overview-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          >
            Synopsis & Details
          </button>
          <button
            onClick={() => setActiveTab('chapters')}
            className={`book-overview-tab-btn ${activeTab === 'chapters' ? 'active' : ''}`}
          >
            Chapters ({chapters.length})
          </button>
          <button
            onClick={() => setActiveTab('characters')}
            className={`book-overview-tab-btn ${activeTab === 'characters' ? 'active' : ''}`}
          >
            Characters ({characters.length})
          </button>
        </div>

        {/* Tab 1: Synopsis */}
        {activeTab === 'overview' && (
          <div className="book-overview-tab-content">
            <h3 className="text-base font-serif font-bold mb-3">About the Book</h3>
            <p className="text-sm leading-relaxed opacity-85 font-serif text-justify whitespace-pre-line">
              {book.summary || 'No summary available for this literary work.'}
            </p>
          </div>
        )}

        {/* Tab 2: Chapters Outline */}
        {activeTab === 'chapters' && (
          <div className="book-overview-tab-content space-y-2">
            {chapters.length === 0 ? (
              <p className="text-xs opacity-60 italic py-4">No separate chapters detected. Ready to read as a whole.</p>
            ) : (
              chapters.map((ch, idx) => (
                <div
                  key={ch.id || idx}
                  onClick={() => navigate(`/books/${book.id}/read`)}
                  className="book-overview-chapter-row"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono opacity-50 w-6 text-right">{idx + 1}</span>
                    <span className="text-sm font-serif font-medium">{ch.title || `Chapter ${idx + 1}`}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-40" />
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Characters Roster */}
        {activeTab === 'characters' && (
          <div className="book-overview-tab-content">
            {characters.length === 0 ? (
              <p className="text-xs opacity-60 italic py-4">No characters extracted for this volume yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map((char) => (
                  <div key={char.id} className="book-overview-char-card">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-amber-500/10 border border-amber-500/20">
                      <img
                        src={getCharacterAvatarUrl(char)}
                        alt={char.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(char.name)}&background=2c2117&color=e8a85b`;
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-serif font-bold truncate">{char.name}</h4>
                      <p className="text-xs opacity-70 truncate font-serif italic">{char.role || 'Character'}</p>
                      <button
                        onClick={() => navigate(`/chat/${char.id}`)}
                        className="mt-2 text-xs flex items-center gap-1 text-amber-500 hover:text-amber-400 font-medium"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Discuss with {char.name.split(' ')[0]}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
