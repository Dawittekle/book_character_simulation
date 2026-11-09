import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { lorelyApi } from '../../services/lorelyApi';
import { translateErrorMessage } from '../../lib/errorUtils';
import { BrandLogo } from '../../components/brand';
import AuthLayout from '../../components/auth/AuthLayout';
import './AdminLogin.css';

export default function AdminLogin({ onBack }) {
  const navigate = useNavigate();
  const defaultEmail = import.meta.env.VITE_DEFAULT_ADMIN_EMAIL || '';

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both administrative email and password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await lorelyApi.adminLogin({
        email: email.trim(),
        password,
      });

      if (res.token) {
        navigate('/admin');
      } else {
        setErrorMessage('Authentication succeeded but no authorization token was issued.');
      }
    } catch (err) {
      setErrorMessage(translateErrorMessage(err, 'Failed to authenticate administrative session. Check credentials.'));
    } finally {
      setSubmitting(false);
    }
  };

  const adminRightPanel = (
    <>
      <div className="auth-telemetry-stack">
        {/* Admin Metric Card 1: System Telemetry */}
        <div className="auth-metric-card-primary">
          <div className="auth-telemetry-header">
            <div className="auth-telemetry-subject">
              <span className="auth-telemetry-avatar" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
                SYS
              </span>
              <div>
                <span className="auth-telemetry-character">Neural & RAG Engine</span>
                <span className="auth-telemetry-work">Core Cluster &bull; v2.4</span>
              </div>
            </div>
            <div className="auth-telemetry-score-badge">
              <span className="auth-telemetry-score-val" style={{ color: '#10b981' }}>99.9%</span>
              <span className="auth-telemetry-score-lbl">Uptime</span>
            </div>
          </div>

          <div className="auth-telemetry-quote-box" style={{ borderLeftColor: '#10b981' }}>
            <p className="auth-telemetry-quote">
              142 Canonical Works Indexed &bull; 2.4M Embeddings &bull; Zero Hallucination Vector Filters
            </p>
          </div>

          <div className="auth-telemetry-tags">
            <span className="auth-pill-tag tag-active">
              ● RAG Pipeline Active
            </span>
            <span className="auth-pill-tag tag-spoiler">
              🛡 Spoiler Protocol Enforced
            </span>
          </div>
        </div>

        {/* Admin Metric Card 2: Security & Governance */}
        <div className="auth-metric-card-secondary">
          <div className="auth-telemetry-header">
            <div className="auth-telemetry-subject">
              <span className="auth-telemetry-avatar avatar-salon">ADM</span>
              <div>
                <span className="auth-telemetry-character">Curator Operations</span>
                <span className="auth-telemetry-work">Role-Based Access Control</span>
              </div>
            </div>
            <div className="auth-telemetry-stat-badge">
              <span className="stat-count">12</span>
              <span className="stat-sub">Pods</span>
            </div>
          </div>

          <div className="auth-telemetry-memory-snippet">
            <span className="memory-prefix">Audit Status:</span>
            <p className="memory-text">
              Multi-tenant isolation verified. Audit logging stream active.
            </p>
          </div>

          <div className="auth-telemetry-tags">
            <span className="auth-pill-tag tag-voice">
              🔐 Encrypted Session
            </span>
            <span className="auth-pill-tag tag-tension">
              Administrative Sphere
            </span>
          </div>
        </div>
      </div>

      <div className="auth-visual-editorial">
        <h3 className="auth-editorial-title">
          Administrative Core & Governance
        </h3>
        <p className="auth-editorial-text">
          Curator oversight for literary knowledge ingestion, persona calibration, RAG retrieval boundaries, and system-wide dialogue moderation.
        </p>
      </div>
    </>
  );

  return (
    <div data-testid="admin-login-page">
      <AuthLayout onBack={onBack} backUrl="/" rightPanel={adminRightPanel}>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', marginBottom: '0.75rem' }}>
            <BrandLogo size={36} variant="orange" />
          </div>
          <div className="admin-portal-tag" style={{ display: 'flex', width: 'fit-content', marginBottom: '0.75rem' }}>
            <span className="admin-portal-tag-dot" />
            <span>Restricted Access</span>
          </div>
          <h1 className="auth-form-heading">Administrative Console</h1>
          <p className="auth-form-subtext">
            Curator operations, user catalog governance, and system-wide RAG oversight.
          </p>
        </div>

        {errorMessage && (
          <div className="auth-alert-banner" role="alert" data-testid="admin-login-error">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form-body">
          <div className="auth-field-group">
            <label htmlFor="admin-email" className="auth-field-label">
              Administrator Email
            </label>
            <input
              id="admin-email"
              type="email"
              className="auth-field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@lorely.app"
              autoComplete="username"
              required
              disabled={submitting}
            />
          </div>

          <div className="auth-field-group">
            <label htmlFor="admin-password" className="auth-field-label">
              Security Password
            </label>
            <div className="auth-password-wrapper">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                disabled={submitting}
              />
              <button
                type="button"
                className="auth-password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-primary-submit-btn"
            disabled={submitting}
            data-testid="admin-login-btn"
            style={{ marginTop: '0.75rem' }}
          >
            {submitting ? 'Verifying Credentials...' : 'Authenticate Portal →'}
          </button>

          <div className="auth-switch-link-wrapper" style={{ marginTop: '1.5rem' }}>
            <Link to="/" className="auth-switch-action" style={{ color: 'var(--brand-text-muted, #6b7280)', fontWeight: 500 }}>
              ← Return to Home
            </Link>
          </div>
        </form>
      </AuthLayout>
    </div>
  );
}
