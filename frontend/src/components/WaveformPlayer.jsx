import React, { useState, useEffect, useRef } from 'react';
import speechSynthesisService from '../services/speechSynthesisService';
import './WaveformPlayer.css';

export default function WaveformPlayer({
  audioSrc,
  speechText,
  characterName,
  voiceGender,
  language = 'en',
  autoPlay = false,
  isPlaying: externalPlaying,
  onTogglePlay,
  initialDuration = 18,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const calculatedDuration = speechText
    ? Math.max(initialDuration || 3, Math.round(speechText.trim().split(/\s+/).filter(Boolean).length / 2.5))
    : initialDuration;
  const [duration, setDuration] = useState(calculatedDuration);
  const [progress, setProgress] = useState(audioSrc || speechText ? 0 : 12);
  const audioRef = useRef(null);
  const hasAutoPlayedRef = useRef(false);

  const active = externalPlaying !== undefined ? externalPlaying : isPlaying;

  const handleToggle = () => {
    if (active) {
      if (audioSrc && audioRef.current) {
        audioRef.current.pause();
      }
      speechSynthesisService.stop();
      setIsPlaying(false);
    } else {
      if (speechText && speechSynthesisService.isSupported()) {
        if (audioSrc && audioRef.current) {
          audioRef.current.pause();
        }
        speechSynthesisService.speak(speechText, {
          characterName,
          gender: voiceGender,
          language,
          onStart: () => setIsPlaying(true),
          onEnd: () => {
            setIsPlaying(false);
            setProgress(0);
          },
          onError: () => {
            setIsPlaying(false);
          },
        });
        setIsPlaying(true);
      } else if (audioSrc && audioRef.current) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        setIsPlaying(true);
      }
    }
    if (onTogglePlay) {
      onTogglePlay();
    }
  };

  // Timer interval for updating simulated or synthesis progress
  useEffect(() => {
    let timer;
    if (active) {
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= duration) {
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [active, duration]);

  // Audio element event listeners
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

  // Handle optional Auto-Play
  useEffect(() => {
    if (autoPlay && !hasAutoPlayedRef.current && (speechText || audioSrc)) {
      hasAutoPlayedRef.current = true;
      const timer = setTimeout(() => {
        if (!active) {
          if (speechText && speechSynthesisService.isSupported()) {
            speechSynthesisService.speak(speechText, {
              characterName,
              gender: voiceGender,
              language,
              onStart: () => setIsPlaying(true),
              onEnd: () => {
                setIsPlaying(false);
                setProgress(0);
              },
              onError: () => {
                setIsPlaying(false);
              },
            });
            setIsPlaying(true);
          } else if (audioSrc && audioRef.current) {
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, speechText, audioSrc, characterName, voiceGender, language]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      speechSynthesisService.stop();
    };
  }, []);

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

      <button
        type="button"
        className="waveform-speaker-button"
        onClick={handleToggle}
        aria-label={active ? 'Stop voice reading' : 'Voice reading active'}
        title={active ? 'Click to stop voice reading' : 'Free voice reading available'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      </button>
    </div>
  );
}
