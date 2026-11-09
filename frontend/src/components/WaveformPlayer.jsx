import React, { useState, useEffect, useRef } from 'react';
import './WaveformPlayer.css';

export default function WaveformPlayer({
  audioSrc,
  isPlaying: externalPlaying,
  onTogglePlay,
  initialDuration = 18,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(audioSrc ? 0 : 12);
  const [duration, setDuration] = useState(initialDuration);
  const audioRef = useRef(null);

  const active = externalPlaying !== undefined ? externalPlaying : isPlaying;

  const handleToggle = () => {
    if (audioSrc && audioRef.current) {
      if (active) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
    if (onTogglePlay) {
      onTogglePlay();
    }
  };

  useEffect(() => {
    if (!audioSrc) {
      let timer;
      if (active) {
        timer = setInterval(() => {
          setProgress((prev) => (prev >= duration ? 0 : prev + 1));
        }, 1000);
      }
      return () => clearInterval(timer);
    }
  }, [active, duration, audioSrc]);

  useEffect(() => {
    if (!audioSrc || !audioRef.current) return;
    const audio = audioRef.current;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };
    const handleTimeUpdate = () => {
      setProgress(Math.round(audio.currentTime));
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioSrc]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  // 24 simulated waveform bar heights
  const bars = [
    25, 40, 60, 85, 45, 70, 95, 30, 65, 80, 50, 90, 75, 40, 60, 85, 30, 55, 70,
    45, 80, 60, 35, 20,
  ];

  return (
    <div className="waveform-player" data-testid="waveform-player">
      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="metadata" />}
      <button
        type="button"
        className="waveform-play-button"
        onClick={handleToggle}
        aria-label={active ? 'Pause audio' : 'Play audio'}
      >
        {active ? (
          <svg className="waveform-play-svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="waveform-play-svg play-arrow" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      <div className="waveform-bars-container">
        {bars.map((height, idx) => {
          const played = idx / bars.length <= (progress / (duration || 1));
          return (
            <span
              key={idx}
              className={`waveform-bar ${played ? 'played' : ''} ${active ? 'animated' : ''}`}
              style={{
                height: `${height}%`,
                animationDelay: `${(idx % 6) * 0.1}s`,
              }}
            />
          );
        })}
      </div>

      <div className="waveform-timestamp">
        {formatTime(progress)} / {formatTime(duration)}
      </div>

      <button type="button" className="waveform-speaker-button" aria-label="Mute/Unmute">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      </button>
    </div>
  );
}
