import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Moon,
  Loader2,
  BookOpen,
  Headphones,
} from 'lucide-react';
import { getBookCoverUrl } from '../../lib/formatters';
import { lorelyApi } from '../../services/lorelyApi';
import SleepTimerModal from './SleepTimerModal';

const NARRATOR_VOICES = [
  { id: 'nova', name: 'Nova', desc: 'Warm & Clear' },
  { id: 'alloy', name: 'Alloy', desc: 'Balanced' },
  { id: 'echo', name: 'Echo', desc: 'Deep & Calm' },
  { id: 'fable', name: 'Fable', desc: 'Expressive' },
  { id: 'onyx', name: 'Onyx', desc: 'Baritone' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Lyrical' },
];

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function ListenModeView({
  bookData,
  chapters = [],
  currentChapterIndex = 0,
  onNextChapter,
  onPrevChapter,
  hasNextChapter,
  hasPrevChapter,
  onActiveSentenceChange,
  theme,
  session,
  onSwitchMode,
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(null);

  const [voiceId, setVoiceId] = useState('nova');
  const [speed, setSpeed] = useState(1.0);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);

  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0);
  const [sleepRemainingSeconds, setSleepRemainingSeconds] = useState(0);
  const sleepIntervalRef = useRef(null);

  const [narrationData, setNarrationData] = useState(null);
  const [activeSentence, setActiveSentence] = useState(null);

  const bookId = bookData?.book_id || bookData?.id;
  const currentChapter =
    chapters.find((c) => (c.chapter_order ?? c.chapter_index) === currentChapterIndex) ||
    chapters[0];

  // Fetch chapter narration
  useEffect(() => {
    if (!bookId) return;
    let isMounted = true;
    setLoadingAudio(true);
    setAudioError(null);

    const token = session?.access_token;
    lorelyApi
      .getChapterNarration(bookId, currentChapterIndex, { voiceId, speed }, token)
      .then((data) => {
        if (!isMounted) return;
        setNarrationData(data);
        if (audioRef.current && data.audio_url) {
          audioRef.current.src = data.audio_url;
          audioRef.current.playbackRate = speed;
          audioRef.current.load();
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Narration fetch error:', err);
        setAudioError(err.message || 'Narration unavailable for this chapter.');
      })
      .finally(() => {
        if (isMounted) setLoadingAudio(false);
      });

    return () => {
      isMounted = false;
    };
  }, [bookId, currentChapterIndex, voiceId, speed, session]);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curSec = audioRef.current.currentTime;
    setCurrentTime(curSec);
    if (narrationData?.segments?.length > 0) {
      const curMs = curSec * 1000;
      const found = narrationData.segments.find(
        (seg) => seg.start_time_ms <= curMs && curMs < seg.end_time_ms
      );
      if (found && (!activeSentence || activeSentence.segment_index !== found.segment_index)) {
        setActiveSentence(found);
        if (onActiveSentenceChange) onActiveSentenceChange(found.segment_index, found);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(
        audioRef.current.duration ||
          (narrationData?.duration_ms ? narrationData.duration_ms / 1000 : 0)
      );
      audioRef.current.playbackRate = speed;
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    if (sleepTimerMinutes === -1) {
      setSleepTimerMinutes(0);
      setSleepRemainingSeconds(0);
      return;
    }
    if (hasNextChapter && onNextChapter) onNextChapter();
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback error:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleSeek = (e) => {
    const target = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleSkip = (seconds) => {
    if (!audioRef.current) return;
    const next = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = next;
    setCurrentTime(next);
  };

  const handleSpeedCycle = () => {
    const curIdx = SPEED_OPTIONS.indexOf(speed);
    const nextSpeed = SPEED_OPTIONS[(curIdx + 1) % SPEED_OPTIONS.length];
    setSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  // Sleep timer countdown
  useEffect(() => {
    if (sleepTimerMinutes > 0) {
      setSleepRemainingSeconds(sleepTimerMinutes * 60);
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
      sleepIntervalRef.current = setInterval(() => {
        setSleepRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(sleepIntervalRef.current);
            if (audioRef.current) audioRef.current.pause();
            setIsPlaying(false);
            setSleepTimerMinutes(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (sleepTimerMinutes === 0) {
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
      setSleepRemainingSeconds(0);
    }
    return () => {
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, [sleepTimerMinutes]);

  const coverUrl = getBookCoverUrl(bookData?.title, bookData?.cover_url);

  // ── Error state ────────────────────────────────────────────────────────────
  if (audioError) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-6 p-8 select-none animate-fade-in"
        style={{ backgroundColor: theme?.bg || '#faf8f5', color: theme?.text || '#1c1917' }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-md"
          style={{
            backgroundColor: theme?.cardBg || '#f3efe6',
            border: `1px solid ${theme?.border || '#e8e1d3'}`,
          }}
        >
          <Headphones className="w-9 h-9 opacity-40" />
        </div>
        <div className="text-center max-w-xs">
          <h3 className="text-lg font-serif font-semibold mb-2">Audio Unavailable</h3>
          <p className="text-sm opacity-60 leading-relaxed">{audioError}</p>
        </div>
        <button
          onClick={() => onSwitchMode('read')}
          className="px-5 py-2.5 rounded-xl font-medium text-sm text-white shadow transition-transform active:scale-95"
          style={{ backgroundColor: '#ef4d23' }}
        >
          Switch to Reading Mode
        </button>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div
      className="w-full h-full flex flex-col select-none overflow-hidden animate-fade-in"
      style={{ backgroundColor: theme?.bg || '#fbf0d9', color: theme?.text || '#1c1917' }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Top pill row */}
      <div className="flex-shrink-0 px-6 pt-5 pb-2 w-full max-w-lg mx-auto flex items-center justify-between opacity-70 text-xs font-mono">
        <span className="flex items-center gap-1.5">
          <Headphones className="w-4 h-4 text-amber-500" />
          <span>Audiobook Mode</span>
        </span>
        <button
          onClick={() => onSwitchMode('follow_along')}
          className="hover:underline flex items-center gap-1 text-amber-600 font-sans font-medium"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Follow Along</span>
        </button>
      </div>

      {/* Center: cover + metadata — flex-1 so it fills available space without overflow */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0 overflow-hidden">
        <div className="flex flex-col items-center text-center w-full max-w-xs">
          {/* Book cover — compact, never cut off */}
          <div
            className={`relative mb-5 flex-shrink-0 transition-all duration-500 ${
              isPlaying ? 'drop-shadow-2xl scale-[1.03]' : 'drop-shadow-lg scale-100'
            }`}
          >
            <div
              className="w-36 sm:w-44 rounded-2xl overflow-hidden shadow-xl border"
              style={{
                aspectRatio: '5/7',
                borderColor: theme?.border || 'rgba(0,0,0,0.08)',
              }}
            >
              <img
                src={coverUrl}
                alt={`Cover of ${bookData?.title}`}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Subtle playing pulse */}
            {isPlaying && (
              <div
                className="absolute inset-0 rounded-2xl border-2 border-amber-500/40 animate-ping pointer-events-none"
                style={{ animationDuration: '2s' }}
              />
            )}
          </div>

          {/* Title & Author */}
          <h2 className="text-lg sm:text-xl font-serif font-bold tracking-tight mb-0.5 leading-snug">
            {bookData?.title}
          </h2>
          <p className="text-xs font-serif italic opacity-60 mb-3">
            {bookData?.author || 'Literary Classic'}
          </p>

          {/* Chapter badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border"
            style={{
              borderColor: theme?.border || '#e5e7eb',
              backgroundColor: theme?.cardBg || 'rgba(255,255,255,0.5)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="truncate max-w-[180px]">
              {currentChapter?.title || `Chapter ${currentChapterIndex + 1}`}
            </span>
          </div>

          {/* Active sentence quote */}
          {activeSentence && (
            <div
              className="w-full mt-4 px-4 py-3 rounded-xl border text-left"
              style={{
                backgroundColor: theme?.cardBg || 'rgba(255,255,255,0.7)',
                borderColor: theme?.border || '#e5e7eb',
              }}
            >
              <p className="text-xs font-serif italic leading-relaxed line-clamp-2 opacity-80">
                "{activeSentence.text}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls — flex-shrink-0 so always visible */}
      <div
        className="flex-shrink-0 w-full max-w-lg mx-auto px-6 pb-6 pt-4 flex flex-col gap-3"
        style={{ borderTop: `1px solid ${theme?.border || 'rgba(0,0,0,0.06)'}` }}
      >
        {/* Scrubber */}
        <div className="flex flex-col gap-1 font-mono text-[11px] opacity-70">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500"
            aria-label="Audiobook timeline"
          />
          <div className="flex justify-between">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Transport bar */}
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={onPrevChapter}
            disabled={!hasPrevChapter}
            className="p-2 rounded-full hover:bg-black/5 disabled:opacity-25 transition-all"
            aria-label="Previous chapter"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => handleSkip(-15)}
            disabled={loadingAudio || duration <= 0}
            className="p-2 rounded-full hover:bg-black/5 disabled:opacity-25 transition-all flex flex-col items-center gap-0.5"
            aria-label="Rewind 15s"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-[9px] font-mono">15</span>
          </button>

          {/* Primary play button */}
          <button
            onClick={togglePlay}
            disabled={loadingAudio}
            className="w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl transition-transform active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: '#ef4d23' }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {loadingAudio ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-7 h-7 fill-white" />
            ) : (
              <Play className="w-7 h-7 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={() => handleSkip(15)}
            disabled={loadingAudio || duration <= 0}
            className="p-2 rounded-full hover:bg-black/5 disabled:opacity-25 transition-all flex flex-col items-center gap-0.5"
            aria-label="Forward 15s"
          >
            <RotateCw className="w-5 h-5" />
            <span className="text-[9px] font-mono">15</span>
          </button>

          <button
            onClick={onNextChapter}
            disabled={!hasNextChapter}
            className="p-2 rounded-full hover:bg-black/5 disabled:opacity-25 transition-all"
            aria-label="Next chapter"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Secondary: speed · voice · sleep */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            onClick={handleSpeedCycle}
            className="px-3 py-1.5 rounded-lg border font-mono font-semibold hover:bg-black/5 transition-colors"
            style={{ borderColor: theme?.border || '#ccc' }}
            aria-label={`Speed ${speed}x`}
          >
            {speed}x
          </button>

          <div className="relative">
            <button
              onClick={() => setIsVoicePickerOpen(!isVoicePickerOpen)}
              className="px-3 py-1.5 rounded-lg border hover:bg-black/5 transition-colors flex items-center gap-1.5 font-medium"
              style={{ borderColor: theme?.border || '#ccc' }}
              aria-label="Voice picker"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="capitalize">{voiceId}</span>
            </button>

            {isVoicePickerOpen && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 rounded-2xl p-2 shadow-2xl border z-50"
                style={{
                  backgroundColor: theme?.cardBg || '#ffffff',
                  borderColor: theme?.border || '#eee',
                }}
              >
                <div className="px-2 py-1 text-[10px] font-serif font-bold opacity-50 uppercase tracking-wider">
                  Narrator Voice
                </div>
                <div className="space-y-0.5 mt-1">
                  {NARRATOR_VOICES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setVoiceId(v.id);
                        setIsVoicePickerOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        voiceId === v.id
                          ? 'bg-amber-500 text-white font-medium'
                          : 'hover:bg-black/5 opacity-80'
                      }`}
                    >
                      <span>{v.name}</span>
                      <span className="text-[10px] opacity-70">{v.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsSleepModalOpen(true)}
            className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 font-medium ${
              sleepTimerMinutes > 0
                ? 'bg-amber-500/15 border-amber-500 text-amber-600'
                : 'hover:bg-black/5'
            }`}
            style={{ borderColor: sleepTimerMinutes > 0 ? undefined : theme?.border || '#ccc' }}
            aria-label="Sleep timer"
          >
            <Moon className="w-3 h-3" />
            <span>
              {sleepRemainingSeconds > 0 ? `${Math.ceil(sleepRemainingSeconds / 60)}m` : 'Sleep'}
            </span>
          </button>
        </div>
      </div>

      <SleepTimerModal
        isOpen={isSleepModalOpen}
        onClose={() => setIsSleepModalOpen(false)}
        activeMinutes={sleepTimerMinutes}
        onSelectTimer={(mins) => setSleepTimerMinutes(mins)}
        theme={theme}
      />
    </div>
  );
}
