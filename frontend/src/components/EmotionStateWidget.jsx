import React from 'react';
import { getEmotionInsight } from '../lib/formatters';
import './EmotionStateWidget.css';

export default function EmotionStateWidget({ emotionState = {}, onViewDetails }) {
  // Normalize values (default to Elena Marlowe's reference states if not present)
  const hopeVal = Math.round((emotionState.hope ?? emotionState.joy ?? 0.78) * 100);
  const anxietyVal = Math.round((emotionState.anxiety ?? emotionState.sadness ?? 0.12) * 100);
  const sadnessVal = Math.round((emotionState.sadness ?? emotionState.anger ?? 0.10) * 100);

  const primaryScore = hopeVal;
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
          <div className="legend-item">
            <span className="legend-dot hope-dot" />
            <span className="legend-label">Hope</span>
            <span className="legend-value">{hopeVal}%</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot anxiety-dot" />
            <span className="legend-label">Anxiety</span>
            <span className="legend-value">{anxietyVal}%</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot sadness-dot" />
            <span className="legend-label">Sadness</span>
            <span className="legend-value">{sadnessVal}%</span>
          </div>
        </div>
      </div>

      <div className="emotion-insight-pill">
        <span className="emotion-insight-icon">🍃</span>
        <span className="emotion-insight-text">{insightText}</span>
      </div>
    </div>
  );
}
