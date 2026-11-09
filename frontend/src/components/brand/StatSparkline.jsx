import React, { useId } from 'react';
import './BrandPrimitives.css';

export default function StatSparkline({
  data = [30, 45, 40, 65, 55, 80, 75, 95],
  width = 240,
  height = 80,
  strokeColor = '#0284c7', // Sky Blue primary
  fillGradient = true,
  strokeWidth = 2.5,
  showEndDot = true,
  className = '',
}) {
  const gradientId = useId();

  if (!data || data.length < 2) {
    return null;
  }

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;
  const paddingY = 8;
  const usableHeight = height - paddingY * 2;

  // Convert array of values to SVG coordinate points
  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * (width - 16) + 8;
    const y = height - paddingY - ((val - minVal) / range) * usableHeight;
    return { x, y, val };
  });

  // Build smooth cubic bezier path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx1 = p0.x + (p1.x - p0.x) / 2;
    const cpy1 = p0.y;
    const cpx2 = p0.x + (p1.x - p0.x) / 2;
    const cpy2 = p1.y;
    pathD += ` C ${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const lastPoint = points[points.length - 1];
  const areaD = `${pathD} L ${lastPoint.x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className={`brand-sparkline-container ${className}`.trim()}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="brand-sparkline-svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {fillGradient && (
          <path
            d={areaD}
            fill={`url(#${gradientId})`}
            className="brand-sparkline-area"
          />
        )}

        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="brand-sparkline-line"
        />

        {showEndDot && (
          <g className="brand-sparkline-endpoint">
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="4.5"
              fill="#ffffff"
              stroke={strokeColor}
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
