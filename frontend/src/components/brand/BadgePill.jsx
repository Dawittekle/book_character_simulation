import React from 'react';
import './BrandPrimitives.css';

export default function BadgePill({
  children,
  dotColor = 'var(--brand-orange, #ef4d23)',
  dotPulse = false,
  variant = 'white', // 'white' | 'translucent' | 'muted' | 'orange'
  className = '',
  icon = null,
  ...props
}) {
  return (
    <div
      className={`brand-badge-pill variant-${variant} ${className}`.trim()}
      {...props}
    >
      {icon ? (
        <span className="brand-badge-icon">{icon}</span>
      ) : dotColor ? (
        <span
          className={`brand-badge-dot ${dotPulse ? 'is-pulsing' : ''}`}
          style={{ backgroundColor: dotColor }}
        />
      ) : null}
      <span className="brand-badge-text">{children}</span>
    </div>
  );
}
