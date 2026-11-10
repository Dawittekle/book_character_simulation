import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Sparkles,
  Moon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Gauge,
  Sliders,
} from 'lucide-react';
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

export default function FollowAlongController({
  bookId,
  currentChapterIndex,
  onNextChapter,
  onPrevChapter,
  hasNextChapter,
  hasPrevChapter,
  onActiveSentenceChange,
  theme,
  mode, // 'read' | 'follow_along' | 'listen'
  session,
  isFloatingHudVisible = true,
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(null);

  // Audio settings
  const [voiceId, setVoiceId] = useState('nova');
  const [speed, setSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);

  // Sleep timer state
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0);
  const [sleepRemainingSeconds, setSleepRemainingSeconds] = useState(0);
  const sleepIntervalRef = useRef(null);

  // Manifest & Segments
  const [narrationData, setNarrationData] = useState(null);
  const [activeSentence, setActiveSentence] = useState(null);

  // 1. Fetch chapter narration & timestamp manifest
  const loadChapterNarration = useCallback(async () => {
    if (!bookId || currentChapterIndex === undefined) return;
    setLoadingAudio(true);
    setAudioError(null);

    try {
      const token = session?.access_token;
      const data = await lorelyApi.getChapterNarration(
        bookId,
        currentChapterIndex,
        { voiceId, speed },
        token
      );
      setNarrationData(data);

      if (audioRef.current && data.audio_url) {
        audioRef.current.src = data.audio_url;
        audioRef.current.playbackRate = speed;
        audioRef.current.load();
      }
    } catch (err) {
      console.warn('Failed to load narration:', err);
      setAudioError(err.message || 'Narration unavailable for this chapter.');
    } finally {
      setLoadingAudio(false);
    }
  }, [bookId, currentChapterIndex, voiceId, speed, session]);

  useEffect(() => {
    loadChapterNarration();
  }, [loadChapterNarration]);

  // 2. Synchronize active sentence based on audio currentTime
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

  // 3. Audio ended -> advance to next chapter if available
  const handleAudioEnded = () => {
    setIsPlaying(false);
    if (sleepTimerMinutes === -1) {
      // Sleep timer was "End of Chapter"
      setSleepTimerMinutes(0);
      setSleepRemainingSeconds(0);
      return;
    }
    if (hasNextChapter && onNextChapter) {
      onNextChapter();
    }
  };

  // 4. Playback controls
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
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

  const handleSpeedChange = () => {
    const curIdx = SPEED_OPTIONS.indexOf(speed);
    const nextSpeed = SPEED_OPTIONS[(curIdx + 1) % SPEED_OPTIONS.length];
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // 5. Sleep timer countdown logic
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

  // If in 'read' mode, don't show the full audio player bar unless user activates it
  const isMinimal = mode === 'read';

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Floating Bottom Audio Bar (Follow Along & Minimal Read Bar) */}
      {mode !== 'listen' && (
        <aside
          className={`absolute bottom-0 inset-x-0 z-40 transition-all duration-300 border-t backdrop-blur-xl ${
            isFloatingHudVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
          style={{
            backgroundColor: theme?.navBg || 'rgba(255, 255, 255, 0.92)',
            borderColor: theme?.border || '#e5e7eb',
            color: theme?.text || '#1c1917',
          }}
          aria-label="Audio narration controls"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col gap-2">
            {/* Scrubber row with active sentence preview in Follow Along */}
            {mode === 'follow_along' && activeSentence && (
              <div className="text-center overflow-hidden">
                <p className="text-xs font-serif italic truncate opacity-75">
                  “{activeSentence.text}”
                </p>
              </div>
            )}

            {/* Scrubber track */}
            <div className="flex items-center gap-3 text-xs font-mono opacity-80">
              <span>{formatTime(currentTime)}</span>
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
                className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                aria-label="Audio narration scrubber"
              />
              <span>{formatTime(duration)}</span>
            </div>

            {/* Playback Controls Row */}
            <div className="flex items-center justify-between gap-2 text-xs">
              {/* Left: Previous Chapter & Skip 15s */}
              <div className="flex items-center gap-1">
                <button
                  onClick={onPrevChapter}
                  disabled={!hasPrevChapter}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-all"
                  title="Previous Chapter"
                  aria-label="Previous chapter"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSkip(-15)}
                  disabled={loadingAudio || duration <= 0}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-all flex items-center gap-0.5"
                  title="Rewind 15 seconds"
                  aria-label="Rewind 15 seconds"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-[10px] font-mono hidden sm:inline">15s</span>
                </button>
              </div>

              {/* Center: Big Play / Pause Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  disabled={loadingAudio}
                  className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                  aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
                >
                  {loadingAudio ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  )}
                </button>
              </div>

              {/* Right: Skip +15s, Next Chapter, Speed, Voice, Sleep Timer */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSkip(15)}
                  disabled={loadingAudio || duration <= 0}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-all flex items-center gap-0.5"
                  title="Forward 15 seconds"
                  aria-label="Forward 15 seconds"
                >
                  <span className="text-[10px] font-mono hidden sm:inline">15s</span>
                  <RotateCw className="w-4 h-4" />
                </button>

                <button
                  onClick={onNextChapter}
                  disabled={!hasNextChapter}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-all"
                  title="Next Chapter"
                  aria-label="Next chapter"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1 hidden sm:block" />

                {/* Speed Toggle */}
                <button
                  onClick={handleSpeedChange}
                  className="px-2 py-1 rounded-lg border font-mono text-[11px] font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  style={{ borderColor: theme?.border || '#ccc' }}
                  title="Playback Speed"
                  aria-label={`Playback speed: ${speed}x`}
                >
                  {speed}x
                </button>

                {/* Voice Selector Toggle */}
                <div className="relative">
                  <button
                    onClick={() => setIsVoicePickerOpen(!isVoicePickerOpen)}
                    className="p-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
                    style={{ borderColor: theme?.border || '#ccc' }}
                    title="Select Narrator Voice"
                    aria-label="Select voice"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[11px] font-medium hidden md:inline capitalize">{voiceId}</span>
                  </button>

                  {/* Voice Selector Popover */}
                  {isVoicePickerOpen && (
                    <div
                      className="absolute bottom-full right-0 mb-2 w-52 rounded-2xl p-2 shadow-2xl border transition-all z-50 animate-scale-in"
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
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                              voiceId === v.id ? 'bg-amber-500 text-white font-medium' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
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
                  className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                    sleepTimerMinutes > 0 ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400' : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  style={{ borderColor: sleepTimerMinutes > 0 ? undefined : theme?.border || '#ccc' }}
                  title="Sleep Timer"
                  aria-label="Sleep timer"
                >
                  <Moon className="w-3.5 h-3.5" />
                  {sleepRemainingSeconds > 0 && (
                    <span className="text-[10px] font-mono hidden sm:inline">
                      {Math.ceil(sleepRemainingSeconds / 60)}m
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Sleep Timer Modal */}
      <SleepTimerModal
        isOpen={isSleepModalOpen}
        onClose={() => setIsSleepModalOpen(false)}
        activeMinutes={sleepTimerMinutes}
        onSelectTimer={(mins) => setSleepTimerMinutes(mins)}
        theme={theme}
      />
    </>
  );
}
