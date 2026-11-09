import React from 'react';
import { getEmotionInsight } from '../lib/formatters';
import BadgePill from './brand/BadgePill';
import './EmotionStateWidget.css';

const EMOTION_COLOR_MAP = {
  hope: '#10b981', // emerald
  trust: '#06b6d4', // cyan
  joy: '#f59e0b', // amber
  curiosity: '#8b5cf6', // violet
  anxiety: '#ef4444', // red
  fear: '#dc2626', // deep red
  sadness: '#6366f1', // indigo
  anger: '#ea580c', // orange-red
  calm: '#14b8a6', // teal
};

export default function EmotionStateWidget({ emotionState = {}, onViewDetails }) {
  const entries = Object.entries(emotionState || {}).filter(
    ([_, v]) => typeof v === 'number' && !isNaN(v)
  );

  let topThree = [];
  if (entries.length >= 1) {
    topThree = entries.sort((a, b) => b[1] - a[1]).slice(0, 3);
  } else {
    topThree = [
      ['hope', 0.5],
      ['calm', 0.5],
      ['curiosity', 0.5],
    ];
  }

  const primaryScore = Math.round((topThree[0]?.[1] ?? 0.5) * 100);
  const insightText = getEmotionInsight(emotionState);

  // SVG circular arc calculation
  // Radius = 34, Circumference = 2 * PI * 34 = ~213.63
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (primaryScore / 100) * circumference;

  return (
    <div className="emotion-state-widget" data-testid="emotion-state-widget">
      <div className="emotion-header-row">
        <div className="emotion-title-group">
          <span className="emotion-heading">Emotion State</span>
          <span className="emotion-info-icon" title="Psychological simulation derived from conversation context">ⓘ</span>
        </div>
        <div className="emotion-header-actions">
          <BadgePill variant="orange" dotColor="#ef4d23" dotPulse size="sm" className="emotion-live-badge">
            Dynamic Drift
          </BadgePill>
          {onViewDetails && (
            <button
              type="button"
              className="emotion-view-details-btn"
              onClick={onViewDetails}
            >
              View details →
            </button>
          )}
        </div>
      </div>

      <div className="emotion-gauge-row">
        <div className="emotion-circular-gauge">
          <svg className="emotion-svg" viewBox="0 0 88 88">
            {/* Background track */}
            <circle
              className="gauge-bg"
              cx="44"
              cy="44"
              r={radius}
              strokeWidth="7"
            />
            {/* Active primary emotion progress */}
            <circle
              className="gauge-progress-hope"
              cx="44"
              cy="44"
              r={radius}
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 44 44)"
            />
          </svg>
          <div className="gauge-center-text">
            <span className="gauge-percent">{primaryScore}%</span>
            <span className="gauge-center-label">Resonance</span>
          </div>
        </div>

        <div className="emotion-legend">
          {topThree.map(([name, val], idx) => {
            const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
            const dotClasses = ['hope-dot', 'anxiety-dot', 'sadness-dot'];
            const percentVal = Math.round(val * 100);
            const color = EMOTION_COLOR_MAP[name.toLowerCase()] || 'var(--brand-orange, #ef4d23)';

            return (
              <div key={name} className="legend-item">
                <div className="legend-item-header">
                  <span className={`legend-dot ${dotClasses[idx % 3]}`} style={{ backgroundColor: color }} />
                  <span className="legend-label">{capitalized}</span>
                  <span className="legend-value">{percentVal}%</span>
                </div>
                <div className="legend-progress-bar-bg">
                  <div
                    className="legend-progress-bar-fill"
                    style={{ width: `${percentVal}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="emotion-insight-pill">
        <span className="emotion-insight-icon">🍃</span>
        <span className="emotion-insight-text">{insightText}</span>
      </div>
    </div>
  );
}
