import React from 'react';
import './LorelyLoader.css';

/**
 * LorelyLoader Component (V2 Brand Animated Loader)
 *
 * Implements the Lorely Spine & Dialogue brand mark in an alternating,
 * conversational rhythm with pure CSS keyframes and accessibility support.
 *
 * @param {Object} props
 * @param {number} [props.size=56] - Width/height of the SVG loader mark
 * @param {boolean} [props.transparent=false] - When true, omits the #18181B background badge
 * @param {boolean} [props.fullScreen=false] - Centers loader in fixed dark frosted backdrop
 * @param {string} [props.text] - Optional status text displayed below the loader
 * @param {string} [props.className] - Additional wrapper class names
 */
export default function LorelyLoader({
  size = 56,
  transparent = false,
  fullScreen = false,
  text = null,
  className = '',
  ...rest
}) {
  const content = (
    <div
      className={`lorely-loader-root ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={text || 'Loading'}
      {...rest}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="lorely-loader-svg"
        data-testid="lorely-loader-svg"
      >
        {/* Optional Obsidian Rounded Badge */}
        {!transparent && (
          <rect
            width="64"
            height="64"
            rx="16"
            fill="#18181B"
            data-testid="lorely-loader-badge"
          />
        )}

        {/* Left Book Spine (White literary pillar) */}
        <rect
          x="15"
          y="12"
          width="11"
          height="40"
          rx="5.5"
          fill="#FAFAFA"
          className="lorely-spine-left"
          data-testid="lorely-spine-left"
        />

        {/* Right Dialogue Spine (Literary Orange conversational curve) */}
        <path
          d="M32 17.5C32 14.4624 34.4624 12 37.5 12C40.5376 12 43 14.4624 43 17.5V40.5C43 46.8513 37.8513 52 31.5 52H31V41.5C31 38.4624 32 35.5 32 32V17.5Z"
          fill="#EA580C"
          className="lorely-spine-right"
          data-testid="lorely-spine-right"
        />
      </svg>

      {text && <div className="lorely-loader-text">{text}</div>}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="lorely-loader-fullscreen"
        data-testid="lorely-loader-fullscreen"
      >
        {content}
      </div>
    );
  }

  return content;
}
