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
  Volume2,
  VolumeX,
  Loader2,
  BookOpen,
  Headphones,
} from 'lucide-react';
import { getBookCoverUrl } from '../../lib/formatters';
import { lorelyApi } from '../../services/lorelyApi';
import SleepTimerModal from './SleepTimerModal';

const NARRATOR_VOICES = [
  { id: 'nova', name: 'Nova', desc: 'Warm & Clear (Female)' },
  { id: 'alloy', name: 'Alloy', desc: 'Balanced & Neutral' },
  { id: 'echo', name: 'Echo', desc: 'Calm & Deep (Male)' },
  { id: 'fable', name: 'Fable', desc: 'Theatrical & Expressive' },
  { id: 'onyx', name: 'Onyx', desc: 'Resonant Baritone' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Bright & Lyrical' },
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

  // Settings
  const [voiceId, setVoiceId] = useState('nova');
  const [speed, setSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);

  // Sleep timer
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0);
  const [sleepRemainingSeconds, setSleepRemainingSeconds] = useState(0);
  const sleepIntervalRef = useRef(null);

  // Segments & Active Sentence
  const [narrationData, setNarrationData] = useState(null);
  const [activeSentence, setActiveSentence] = useState(null);

  const bookId = bookData?.book_id || bookData?.id;
  const currentChapter = chapters.find(
    (c) => (c.chapter_order ?? c.chapter_index) === currentChapterIndex
  ) || chapters[0];

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

  // Synchronize time and active sentence
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curSec = audioRef.current.currentTime;
    setCurrentTime(curSec);

    if (narrationData?.segments && narrationData.segments.length > 0) {
      const curMs = curSec * 1000;
      const found = narrationData.segments.find(
        (seg) => seg.start_time_ms <= curMs && curMs < seg.end_time_ms
      );

      if (found && (!activeSentence || activeSentence.segment_index !== found.segment_index)) {
        setActiveSentence(found);
        if (onActiveSentenceChange) {
          onActiveSentenceChange(found.segment_index, found);
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || (narrationData?.duration_ms ? narrationData.duration_ms / 1000 : 0));
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
    if (hasNextChapter && onNextChapter) {
      onNextChapter();
    }
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
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
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

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between p-6 sm:p-10 select-none overflow-y-auto animate-fade-in"
      style={{
        backgroundColor: theme?.bg || '#fbf0d9',
        color: theme?.text || '#1c1917',
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Top Spacer / Mode Pill Indicator */}
      <div className="w-full max-w-lg flex items-center justify-between opacity-70 text-xs font-mono">
        <span className="flex items-center gap-1.5">
          <Headphones className="w-4 h-4 text-amber-500" />
          <span>Audiobook Mode</span>
        </span>
        <button
          onClick={() => onSwitchMode('follow_along')}
          className="hover:underline flex items-center gap-1 text-amber-600 dark:text-amber-400 font-sans font-medium"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Switch to Follow Along</span>
        </button>
      </div>

      {/* Center Artwork & Metadata */}
      <div className="my-auto flex flex-col items-center text-center max-w-md w-full">
        {/* Cover Art with Vinyl Elevation */}
        <div className="relative mb-6 group">
          <div
            className={`w-44 sm:w-56 aspect-[5/7] rounded-2xl shadow-2xl overflow-hidden border transition-all duration-700 ${
              isPlaying ? 'scale-105 shadow-amber-500/20' : 'scale-100'
            }`}
            style={{ borderColor: theme?.border || 'rgba(0,0,0,0.1)' }}
          >
            <img
              src={coverUrl}
              alt={`Cover of ${bookData?.title}`}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Subtle Vinyl Groove Indicator */}
          <div
            className={`absolute -right-4 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-black/40 bg-black/80 -z-10 shadow-xl transition-all duration-700 hidden sm:block ${
              isPlaying ? 'translate-x-6 rotate-180 animate-spin-slow' : 'translate-x-0'
            }`}
            style={{ animationDuration: '8s' }}
          >
            <div className="w-8 h-8 rounded-full bg-amber-500/80 m-auto mt-11" />
          </div>
        </div>

        {/* Title & Author */}
        <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight mb-1">
          {bookData?.title}
        </h2>
        <p className="text-sm font-serif italic opacity-75 mb-3">
          {bookData?.author || 'Literary Classic'}
        </p>

        {/* Chapter Title Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border mb-6"
          style={{
            borderColor: theme?.border || '#e5e7eb',
            backgroundColor: theme?.cardBg || 'rgba(255, 255, 255, 0.5)',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>
            {currentChapter?.title || `Chapter ${currentChapterIndex + 1}`}
          </span>
        </div>

        {/* Spoken Passage Quote Box */}
        {activeSentence && (
          <div
            className="w-full p-4 rounded-2xl border transition-all duration-300 shadow-sm"
            style={{
              backgroundColor: theme?.cardBg || 'rgba(255, 255, 255, 0.7)',
              borderColor: theme?.border || '#e5e7eb',
            }}
          >
            <p className="text-sm font-serif italic leading-relaxed line-clamp-3 opacity-90 text-justify">
              “{activeSentence.text}”
            </p>
          </div>
        )}
      </div>

      {/* Bottom Playback Controls Container */}
      <div className="w-full max-w-lg mt-auto flex flex-col gap-4">
        {/* Scrubber Slider */}
        <div className="flex flex-col gap-1.5 font-mono text-xs opacity-80">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            role="slider"
            aria-valuemin="0"
            aria-valuemax={Math.round(duration || 100)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            aria-label="Audiobook timeline scrubber"
          />
          <div className="flex items-center justify-between text-[11px]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Transport Bar */}
        <div className="flex items-center justify-between gap-4">
          {/* Previous Chapter */}
          <button
            onClick={onPrevChapter}
            disabled={!hasPrevChapter}
            className="p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-25 transition-all"
            title="Previous Chapter"
            aria-label="Previous chapter"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Rewind 15s */}
          <button
            onClick={() => handleSkip(-15)}
            disabled={loadingAudio || duration <= 0}
            className="p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-25 transition-all flex flex-col items-center"
            title="Rewind 15 seconds"
            aria-label="Rewind 15 seconds"
          >
            <RotateCcw className="w-6 h-6" />
            <span className="text-[10px] font-mono mt-0.5">15</span>
          </button>

          {/* Big Play / Pause Button */}
          <button
            onClick={togglePlay}
            disabled={loadingAudio}
            className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-2xl transition-transform active:scale-95 disabled:opacity-50"
            aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
          >
            {loadingAudio ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-white" />
            ) : (
              <Play className="w-8 h-8 fill-white ml-1" />
            )}
          </button>

          {/* Forward 15s */}
          <button
            onClick={() => handleSkip(15)}
            disabled={loadingAudio || duration <= 0}
            className="p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-25 transition-all flex flex-col items-center"
            title="Forward 15 seconds"
            aria-label="Forward 15 seconds"
          >
            <RotateCw className="w-6 h-6" />
            <span className="text-[10px] font-mono mt-0.5">15</span>
          </button>

          {/* Next Chapter */}
          <button
            onClick={onNextChapter}
            disabled={!hasNextChapter}
            className="p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-25 transition-all"
            title="Next Chapter"
            aria-label="Next chapter"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Secondary Auxiliary Controls Row (Speed, Voice, Sleep) */}
        <div className="flex items-center justify-center gap-3 pt-2 text-xs">
          {/* Speed Toggle */}
          <button
            onClick={handleSpeedCycle}
            className="px-3 py-1.5 rounded-xl border font-mono font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ borderColor: theme?.border || '#ccc' }}
            title="Playback Speed"
            aria-label={`Playback speed: ${speed}x`}
          >
            {speed}x
          </button>

          {/* Narrator Voice Popover */}
          <div className="relative">
            <button
              onClick={() => setIsVoicePickerOpen(!isVoicePickerOpen)}
              className="px-3 py-1.5 rounded-xl border hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 font-medium"
              style={{ borderColor: theme?.border || '#ccc' }}
              title="Narrator Voice"
              aria-label="Select voice"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="capitalize">{voiceId}</span>
            </button>

            {isVoicePickerOpen && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 rounded-2xl p-2 shadow-2xl border transition-all z-50 animate-scale-in"
                style={{
                  backgroundColor: theme?.cardBg || '#ffffff',
                  borderColor: theme?.border || '#eee',
                }}
              >
                <div className="px-2 py-1 text-[11px] font-serif font-bold opacity-60 uppercase tracking-wider">
                  Narrator Voice
                </div>
                <div className="space-y-1 mt-1">
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
                          : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                      }`}
                    >
                      <span>{v.name}</span>
                      <span className="text-[10px] opacity-75">{v.desc.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sleep Timer */}
          <button
            onClick={() => setIsSleepModalOpen(true)}
            className={`px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1.5 font-medium ${
              sleepTimerMinutes > 0
                ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400'
                : 'hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            style={{ borderColor: sleepTimerMinutes > 0 ? undefined : theme?.border || '#ccc' }}
            title="Sleep Timer"
            aria-label="Sleep timer"
          >
            <Moon className="w-3.5 h-3.5" />
            <span>
              {sleepRemainingSeconds > 0 ? `${Math.ceil(sleepRemainingSeconds / 60)}m` : 'Sleep'}
            </span>
          </button>
        </div>
      </div>

      {/* Sleep Timer Modal */}
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
