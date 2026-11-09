import React from 'react';
import './AuthLayout.css';

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

        {/* Right Side: Ethereal Literary Telemetry Sky Panel */}
        <div className="auth-visual-column">
          {rightPanel ? (
            rightPanel
          ) : (
            <>
              <div className="auth-telemetry-stack">
                {/* Floating Metric Card 1: Rodion Raskolnikov Telemetry */}
                <div className="auth-metric-card-primary">
                  <div className="auth-telemetry-header">
                    <div className="auth-telemetry-subject">
                      <span className="auth-telemetry-avatar">RR</span>
                      <div>
                        <span className="auth-telemetry-character">Rodion Raskolnikov</span>
                        <span className="auth-telemetry-work">Crime and Punishment</span>
                      </div>
                    </div>
                    <div className="auth-telemetry-score-badge">
                      <span className="auth-telemetry-score-val">96.8%</span>
                      <span className="auth-telemetry-score-lbl">Resonance</span>
                    </div>
                  </div>

                  <div className="auth-telemetry-quote-box">
                    <p className="auth-telemetry-quote">
                      &ldquo;Could I step over the barrier? Was I a trembling creature, or had I the right?&rdquo;
                    </p>
                  </div>

                  <div className="auth-telemetry-tags">
                    <span className="auth-pill-tag tag-tension">
                      <span className="tag-dot tension-dot" /> Psychological Tension
                    </span>
                    <span className="auth-pill-tag tag-spoiler">
                      🛡 Ch. 12 Spoiler-Gated
                    </span>
                  </div>
                </div>

                {/* Floating Metric Card 2: Elizabeth Bennet Salon Bond */}
                <div className="auth-metric-card-secondary">
                  <div className="auth-telemetry-header">
                    <div className="auth-telemetry-subject">
                      <span className="auth-telemetry-avatar avatar-salon">EB</span>
                      <div>
                        <span className="auth-telemetry-character">Elizabeth Bennet</span>
                        <span className="auth-telemetry-work">Pride and Prejudice</span>
                      </div>
                    </div>
                    <div className="auth-telemetry-stat-badge">
                      <span className="stat-count">128</span>
                      <span className="stat-sub">Turns</span>
                    </div>
                  </div>

                  <div className="auth-telemetry-memory-snippet">
                    <span className="memory-prefix">Memory Recall:</span>
                    <p className="memory-text">
                      Critique of Mr. Darcy&apos;s proposal at Hunsford parsonage.
                    </p>
                  </div>

                  <div className="auth-telemetry-tags">
                    <span className="auth-pill-tag tag-voice">
                      🎙 HD Voice Simulation
                    </span>
                    <span className="auth-pill-tag tag-active">
                      Active Salon Bond
                    </span>
                  </div>
                </div>
              </div>

              {/* Editorial Headline & Description at Bottom */}
              <div className="auth-visual-editorial">
                <h3 className="auth-editorial-title">
                  Step Into the Minds of Literature
                </h3>
                <p className="auth-editorial-text">
                  Lorely empowers you to hold unscripted, psychologically faithful dialogues with timeless book characters—grounded in canonical text, protected by spoiler boundaries, and enriched by voice.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
