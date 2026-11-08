import React, { useState, useEffect } from 'react';
import './WaveformPlayer.css';

export default function WaveformPlayer({ isPlaying: externalPlaying, onTogglePlay }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(12); // seconds
  const totalDuration = 18; // seconds

  const active = externalPlaying !== undefined ? externalPlaying : isPlaying;

  const handleToggle = () => {
    if (onTogglePlay) {
      onTogglePlay();
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  useEffect(() => {
    let timer;
    if (active) {
      timer = setInterval(() => {
        setProgress((prev) => (prev >= totalDuration ? 0 : prev + 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [active, totalDuration]);

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
          const played = idx / bars.length <= progress / totalDuration;
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
        {formatTime(progress)} / {formatTime(totalDuration)}
      </div>

      <button type="button" className="waveform-speaker-button" aria-label="Mute/Unmute">
        <span className="waveform-speaker-icon">🔊</span>
      </button>
    </div>
  );
}
