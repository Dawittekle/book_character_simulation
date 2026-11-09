import React from 'react';
import './BrandPrimitives.css';

export default function BrandLogo({
  size = 32,
  variant = 'orange',
  withText = false,
  text = 'Lorely',
  tagline = null,
  className = '',
  textClassName = '',
}) {
  const colorMap = {
    orange: 'var(--brand-orange, #ef4d23)',
    white: '#ffffff',
    dark: 'var(--brand-obsidian, #0b0f1a)',
    muted: 'var(--brand-text-muted, #6b7280)',
  };

  const fillColor = colorMap[variant] || variant;

  return (
    <div className={`brand-logo-container ${className}`.trim()}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill={fillColor}
        xmlns="http://www.w3.org/2000/svg"
        className="brand-logo-mark"
        aria-label="Lorely Flower Mark"
      >
        {/* Central Core */}
        <circle cx="16" cy="16" r="3.5" />
        {/* 8 Geometric Petals at Radius 10 around (16, 16) */}
        <circle cx="26" cy="16" r="3.5" />
        <circle cx="23.071" cy="23.071" r="3.5" />
        <circle cx="16" cy="26" r="3.5" />
        <circle cx="8.929" cy="23.071" r="3.5" />
        <circle cx="6" cy="16" r="3.5" />
        <circle cx="8.929" cy="8.929" r="3.5" />
        <circle cx="16" cy="6" r="3.5" />
        <circle cx="23.071" cy="8.929" r="3.5" />
      </svg>
      {withText && (
        <div className={`brand-logo-text-group ${textClassName}`.trim()}>
          <span className="brand-logo-title">{text}</span>
          {tagline && <span className="brand-logo-tagline">{tagline}</span>}
        </div>
      )}
    </div>
  );
}
