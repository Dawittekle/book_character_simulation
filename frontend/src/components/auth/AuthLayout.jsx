import React from 'react';
import './AuthLayout.css';

export default function AuthLayout({
  children,
  onBack,
  backUrl = '/',
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

        {/* Right Side: Ethereal Sky Panel (from Image 1) */}
        <div className="auth-visual-column">
          {/* Floating Metric Card 1: Sparkline with Improvement Rate */}
          <div className="auth-metric-card-primary">
            <span className="auth-metric-label">Improvement rate</span>
            <div className="auth-metric-value">126.6%</div>

            {/* Sparkline with Apex Value Tag */}
            <div className="auth-sparkline-wrapper">
              <svg
                viewBox="0 0 200 60"
                className="auth-sparkline-svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M 5 45 Q 35 25, 65 38 T 125 18 T 185 8"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="125" cy="18" r="4.5" fill="#ffffff" stroke="#3b82f6" strokeWidth="2.5" />
                <circle cx="185" cy="8" r="4.5" fill="#ffffff" stroke="#3b82f6" strokeWidth="2.5" />
              </svg>
              <div className="auth-sparkline-apex-badge">126.6%</div>
            </div>
          </div>

          {/* Floating Metric Card 2: Time Series Coordinate Wave Chart */}
          <div className="auth-metric-card-secondary">
            <div className="auth-chart-grid">
              {/* Y Axis Markers */}
              <div className="auth-chart-y-axis">
                <span>30k</span>
                <span>25k</span>
                <span>20k</span>
                <span>15k</span>
                <span>10k</span>
              </div>

              {/* Chart Body with Timeline Pin and Wave */}
              <div className="auth-chart-plot-area">
                <svg
                  viewBox="0 0 240 70"
                  className="auth-chart-waves-svg"
                  preserveAspectRatio="none"
                >
                  {/* Subtle Grid Guidelines */}
                  <line x1="0" y1="14" x2="240" y2="14" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="0" y1="28" x2="240" y2="28" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="0" y1="42" x2="240" y2="42" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="0" y1="56" x2="240" y2="56" stroke="#e2e8f0" strokeDasharray="3 3" />

                  {/* Wave 2: Secondary Light Spline */}
                  <path
                    d="M 0 50 C 40 40, 80 58, 120 45 C 160 32, 200 48, 240 38"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.75"
                    strokeDasharray="4 4"
                  />

                  {/* Wave 1: Primary Smooth Spline */}
                  <path
                    d="M 0 42 C 40 32, 80 54, 120 38 C 145 28, 170 18, 200 24 C 220 28, 230 18, 240 14"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Timeline Intersection Marker at 2 June (x=120) */}
                  <line x1="120" y1="0" x2="120" y2="70" stroke="#cbd5e1" strokeWidth="1" />
                  <circle cx="120" cy="38" r="4.5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                </svg>

                {/* Timeline Pin Tooltip */}
                <div className="auth-chart-timeline-pin">2 June</div>
              </div>
            </div>

            {/* X Axis Month Labels */}
            <div className="auth-chart-x-axis">
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Aug</span>
              <span>Sept</span>
              <span>Oct</span>
            </div>
          </div>

          {/* Editorial Headline & Description at Bottom */}
          <div className="auth-visual-editorial">
            <h3 className="auth-editorial-title">
              A Unified Hub for Smarter Literary Cognition
            </h3>
            <p className="auth-editorial-text">
              Lorely empowers you with psychologically faithful literary agents—delivering
              deep persona depth and a 360° dialogue experience across timeless books.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
