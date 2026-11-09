import React from 'react';
import './AuthLayout.css';

function OpenBookGraphic() {
  return (
    <div className="auth-book-artwork-wrap" data-testid="auth-book-graphic" aria-label="Open literary book artwork">
      <svg
        viewBox="0 0 640 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="auth-book-svg"
      >
        <defs>
          <linearGradient id="authBookCoverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="authBookPageGradLeft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f4ede2" />
            <stop offset="70%" stopColor="#fdfbf7" />
            <stop offset="100%" stopColor="#e2d6c3" />
          </linearGradient>
          <linearGradient id="authBookPageGradRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ded1be" />
            <stop offset="30%" stopColor="#fdfbf7" />
            <stop offset="100%" stopColor="#f5efe6" />
          </linearGradient>
          <linearGradient id="authGoldEdgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#c89d5c" />
          </linearGradient>
          <linearGradient id="authRibbonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ef4d23" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
          <filter id="authBookGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="24" floodColor="#0f172a" floodOpacity="0.25" />
          </filter>
        </defs>

        <g filter="url(#authBookGlow)">
          {/* Hardcover base spine & rim */}
          <path
            d="M 50 220 Q 320 260 590 220 L 590 232 Q 320 274 50 232 Z"
            fill="url(#authBookCoverGrad)"
          />
          {/* Page block thickness / gilded edges */}
          <path
            d="M 56 216 Q 320 252 584 216 L 584 224 Q 320 262 56 224 Z"
            fill="url(#authGoldEdgeGrad)"
            opacity="0.85"
          />

          {/* Left open pages (curved folio) */}
          <path
            d="M 320 228 C 240 224 120 205 60 180 C 60 130 60 80 60 70 C 130 92 240 108 320 114 Z"
            fill="url(#authBookPageGradLeft)"
          />
          {/* Subtle page lines left */}
          <path d="M 100 102 C 160 116 230 126 295 130" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 100 120 C 160 134 230 144 295 148" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 100 138 C 160 152 230 162 295 166" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 100 156 C 160 170 230 180 295 184" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M 100 174 C 160 188 230 198 295 202" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.4" />

          {/* Right open pages (curved folio) */}
          <path
            d="M 320 228 C 400 224 520 205 580 180 C 580 130 580 80 580 70 C 510 92 400 108 320 114 Z"
            fill="url(#authBookPageGradRight)"
          />
          {/* Subtle page lines right */}
          <path d="M 345 130 C 410 126 480 116 540 102" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 345 148 C 410 144 480 134 540 120" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 345 166 C 410 162 480 152 540 138" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 345 184 C 410 180 480 170 540 156" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M 345 202 C 410 198 480 188 540 174" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.4" />

          {/* Center spine gutter shadow */}
          <path
            d="M 317 114 C 319 150 319 190 317 228 L 323 228 C 321 190 321 150 323 114 Z"
            fill="#a3907c"
            opacity="0.4"
          />

          {/* Silk bookmark ribbon */}
          <path
            d="M 319 114 Q 322 170 316 230 Q 312 260 300 278 L 310 276 Q 322 256 324 230 Q 327 170 321 114 Z"
            fill="url(#authRibbonGrad)"
          />
        </g>
      </svg>
    </div>
  );
}

export default function AuthLayout({
  children,
  onBack,
  backUrl = '/',
  rightPanel = null,
}) {
  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
    } else {
      window.location.href = backUrl;
    }
  };

  return (
    <div className="auth-split-viewport">
      {/* Top-Left Circular Back Button */}
      <button
        type="button"
        className="auth-back-circle-btn"
        onClick={handleBack}
        aria-label="Go back to previous page"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      {/* Centered Split-Screen Card */}
      <div className="auth-split-card">
        {/* Left Side: Auth Form Column */}
        <div className="auth-form-column">
          {children}
        </div>

        {/* Right Side: Dreamy Blue Sky & Open Book Folio (Image 2) */}
        <div className="auth-visual-column">
          {rightPanel ? (
            rightPanel
          ) : (
            <>
              {/* Soft Atmospheric Floating Clouds */}
              <div className="auth-sky-cloud cloud-top-left" aria-hidden="true" />
              <div className="auth-sky-cloud cloud-top-right" aria-hidden="true" />
              <div className="auth-sky-cloud cloud-mid-left" aria-hidden="true" />

              {/* Centered Open Book Graphic */}
              <div className="auth-book-stage">
                <OpenBookGraphic />
              </div>

              {/* Editorial Headline & Description at Bottom */}
              <div className="auth-visual-editorial">
                <h3 className="auth-editorial-title">
                  Step into the stories.
                </h3>
                <p className="auth-editorial-text">
                  Unscripted dialogue and cognitive voice simulations across timeless literary classics.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
