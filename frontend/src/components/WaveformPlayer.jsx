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
          <span className="waveform-icon">⏸</span>
        ) : (
          <span className="waveform-icon">▶</span>
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
        <span className="waveform-speaker-icon">🔊</span>
      </button>
    </div>
  );
}
