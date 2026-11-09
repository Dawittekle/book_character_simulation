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
        aria-label="Lorely Literary Rosette Mark"
      >
        {/* 8 Geometric Petals at Radius 10 around (16, 16) */}
        <circle cx="26" cy="16" r="3" />
        <circle cx="23.071" cy="23.071" r="3" />
        <circle cx="16" cy="26" r="3" />
        <circle cx="8.929" cy="23.071" r="3" />
        <circle cx="6" cy="16" r="3" />
        <circle cx="8.929" cy="8.929" r="3" />
        <circle cx="16" cy="6" r="3" />
        <circle cx="23.071" cy="8.929" r="3" />

        {/* Center Core: Stylized Open Book Folio Pages */}
        <path
          d="M15.6 13.1 C14.25 12.7 12.75 12.8 11.75 13.4 C11.5 13.55 11.4 13.8 11.4 14.1 L11.4 17.9 C11.4 18.3 11.8 18.6 12.15 18.4 C13.1 17.9 14.4 17.8 15.6 18.25 Z"
        />
        <path
          d="M16.4 13.1 C17.75 12.7 19.25 12.8 20.25 13.4 C20.5 13.55 20.6 13.8 20.6 14.1 L20.6 17.9 C20.6 18.3 20.2 18.6 19.85 18.4 C18.9 17.9 17.6 17.8 16.4 18.25 Z"
        />
        {/* Central Spark / Nexus Node */}
        <circle cx="16" cy="15.6" r="0.75" />
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
