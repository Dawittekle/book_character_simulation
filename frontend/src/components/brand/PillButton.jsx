import React from 'react';
import './BrandPrimitives.css';

export default function PillButton({
  children,
  variant = 'orange', // 'orange' | 'dark' | 'white' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon = null,
  trailingChevron = false,
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`brand-pill-button variant-${variant} size-${size} ${
        trailingChevron ? 'has-trailing-chevron' : ''
      } ${className}`.trim()}
      {...props}
    >
      {icon && <span className="brand-pill-leading-icon">{icon}</span>}
      <span className="brand-pill-label">{children}</span>
      {trailingChevron && (
        <span className="brand-pill-chevron-container">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="brand-pill-chevron-icon"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      )}
    </button>
  );
}
