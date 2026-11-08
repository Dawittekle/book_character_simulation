import React from 'react';
import { getEmotionInsight } from '../lib/formatters';
import './EmotionStateWidget.css';

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
  // Radius = 38, Circumference = 2 * PI * 38 = ~238.76
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (primaryScore / 100) * circumference;

  return (
    <div className="emotion-state-widget" data-testid="emotion-state-widget">
      <div className="emotion-header-row">
        <div className="emotion-title-group">
          <span className="emotion-heading">Emotion State</span>
          <span className="emotion-info-icon" title="Psychological simulation derived from conversation context">ⓘ</span>
        </div>
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

      <div className="emotion-gauge-row">
        <div className="emotion-circular-gauge">
          <svg className="emotion-svg" viewBox="0 0 100 100">
            {/* Background track */}
            <circle
              className="gauge-bg"
              cx="50"
              cy="50"
              r={radius}
              strokeWidth="9"
            />
            {/* Hope / Joy track */}
            <circle
              className="gauge-progress-hope"
              cx="50"
              cy="50"
              r={radius}
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="gauge-center-text">
            <span className="gauge-percent">{primaryScore}%</span>
          </div>
        </div>

        <div className="emotion-legend">
          {topThree.map(([name, val], idx) => {
            const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
            const dotClasses = ['hope-dot', 'anxiety-dot', 'sadness-dot'];
            return (
              <div key={name} className="legend-item">
                <span className={`legend-dot ${dotClasses[idx % 3]}`} />
                <span className="legend-label">{capitalized}</span>
                <span className="legend-value">{Math.round(val * 100)}%</span>
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
