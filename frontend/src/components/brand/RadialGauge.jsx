import React from 'react';
import './BrandPrimitives.css';

export default function RadialGauge({
  value = 0,
  color = '#ef4d23',
  inactiveColor = '#d4d4d8',
  showLabels = false,
  min = 0,
  max = 100,
  minLabel = null,
  maxLabel = null,
  centerText = null,
  sublabel = null,
  className = '',
}) {
  const clampedValue = Math.max(min, Math.min(max, value));
  const normalizedPercent = max > min ? ((clampedValue - min) / (max - min)) * 100 : 0;
  const activeCount = Math.round((normalizedPercent / 100) * 40);

  const ticks = [];
  const centerX = 100;
  const centerY = 100;
  const outerR = 80;
  const innerR = 70; // (r - 10)

  for (let i = 0; i < 40; i++) {
    // Span 180 degrees from PI (left) to 2*PI (right) over top arc
    const angle = Math.PI + (i / 39) * Math.PI;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const x1 = centerX + innerR * cosA;
    const y1 = centerY + innerR * sinA;
    const x2 = centerX + outerR * cosA;
    const y2 = centerY + outerR * sinA;

    const isActive = i < activeCount;
    ticks.push({
      id: i,
      x1,
      y1,
      x2,
      y2,
      color: isActive ? color : inactiveColor,
    });
  }

  const displayText = centerText !== null ? centerText : `${Math.round(value)}%`;

  return (
    <div className={`brand-radial-gauge-container ${className}`.trim()}>
      <svg
        viewBox="0 0 200 120"
        className="brand-radial-gauge-svg"
        aria-label={`Gauge measuring ${displayText}`}
      >
        {ticks.map((tick) => (
          <line
            key={tick.id}
            x1={tick.x1.toFixed(2)}
            y1={tick.y1.toFixed(2)}
            x2={tick.x2.toFixed(2)}
            y2={tick.y2.toFixed(2)}
            stroke={tick.color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}
        <text
          x="100"
          y="105"
          textAnchor="middle"
          fontSize="22"
          fontWeight="600"
          className="brand-radial-gauge-center-text"
        >
          {displayText}
        </text>
      </svg>
      {showLabels && (
        <div className="brand-radial-gauge-labels">
          <span className="brand-radial-gauge-min">{minLabel || min}</span>
          {sublabel && <span className="brand-radial-gauge-sublabel">{sublabel}</span>}
          <span className="brand-radial-gauge-max">{maxLabel || max}</span>
        </div>
      )}
    </div>
  );
}
