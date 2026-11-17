import React from 'react';
import './BrandPrimitives.css';

/**
 * BrandLogo Component (Lorely V2)
 *
 * Renders the official Spine & Dialogue mark in dark, light, transparent,
 * or custom variants with optional typography lockup.
 *
 * @param {Object} props
 * @param {number|string} [props.size=32] - Width/height of the mark in pixels
 * @param {string} [props.variant='orange'] - 'orange'|'default'|'white'|'light'|'dark'|'transparent'
 * @param {boolean} [props.withBadge=true] - Render inside rounded container
 * @param {boolean} [props.withText=false] - Render wordmark beside mark
 * @param {string} [props.text='Lorely'] - Wordmark text
 * @param {string} [props.tagline] - Optional sub-tagline text
 * @param {string} [props.className=''] - Container class name
 * @param {string} [props.textClassName=''] - Text group class name
 */
export default function BrandLogo({
  size = 32,
  variant = 'orange',
  withBadge = true,
  withText = false,
  text = 'Lorely',
  tagline = null,
  className = '',
  textClassName = '',
  showTagline, // legacy prop backward compatibility
  showText,    // legacy prop backward compatibility
}) {
  const effectiveWithText = withText || showText;
  const effectiveTagline = tagline || (showTagline ? tagline : null);

  // Normalize size if string preset or numeric
  let pixelSize = 32;
  if (typeof size === 'number') {
    pixelSize = size;
  } else if (size === 'sm') {
    pixelSize = 24;
  } else if (size === 'md') {
    pixelSize = 32;
  } else if (size === 'lg') {
    pixelSize = 48;
  } else if (size === 'xl') {
    pixelSize = 64;
  } else {
    pixelSize = parseInt(size, 10) || 32;
  }

  // Variant color mapping
  const isLight = variant === 'light';
  const isTransparent = variant === 'transparent';
  const isWhite = variant === 'white';
  const isDark = variant === 'dark';

  let badgeFill = '#18181B';
  let leftSpineFill = '#FAFAFA';
  let rightSpineFill = '#EA580C';

  if (isLight) {
    badgeFill = '#F4F4F5';
    leftSpineFill = '#18181B';
    rightSpineFill = '#EA580C';
  } else if (isWhite) {
    badgeFill = '#FFFFFF';
    leftSpineFill = '#FFFFFF';
    rightSpineFill = '#EA580C';
  } else if (isDark) {
    badgeFill = '#18181B';
    leftSpineFill = '#FAFAFA';
    rightSpineFill = '#EA580C';
  }

  const shouldRenderBadge = withBadge && !isTransparent;

  return (
    <div className={`brand-logo-container ${className}`.trim()}>
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="brand-logo-mark"
        aria-label="Lorely Spine & Dialogue Mark"
        data-testid="brand-logo-mark"
      >
        {shouldRenderBadge && (
          <rect
            width="64"
            height="64"
            rx="16"
            fill={badgeFill}
            data-testid="brand-logo-badge"
          />
        )}

        {/* Left Book Spine (Classical literature) */}
        <rect
          x="15"
          y="12"
          width="11"
          height="40"
          rx="5.5"
          fill={leftSpineFill}
          data-testid="brand-logo-left-spine"
        />

        {/* Right Dialogue Spine (Voice & cognitive dialogue) */}
        <path
          d="M32 17.5C32 14.4624 34.4624 12 37.5 12C40.5376 12 43 14.4624 43 17.5V40.5C43 46.8513 37.8513 52 31.5 52H31V41.5C31 38.4624 32 35.5 32 32V17.5Z"
          fill={rightSpineFill}
          data-testid="brand-logo-right-spine"
        />
      </svg>
      {effectiveWithText && (
        <div className={`brand-logo-text-group ${textClassName}`.trim()}>
          <span className="brand-logo-title">{text}</span>
          {effectiveTagline && <span className="brand-logo-tagline">{effectiveTagline}</span>}
        </div>
      )}
    </div>
  );
}
