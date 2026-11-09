import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import { translateErrorMessage } from '../../lib/errorUtils';
import { BrandLogo } from '../../components/brand';
import './AdminLogin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const defaultEmail = import.meta.env.VITE_DEFAULT_ADMIN_EMAIL || 'admin@lorely.app';

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
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

  return (
    <div className="admin-login-viewport" data-testid="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-logo-mark-wrap">
            <BrandLogo size={42} variant="orange" />
          </div>
          <div className="admin-portal-tag">
            <span className="admin-portal-tag-dot" />
            <span>Restricted Access</span>
          </div>
          <h1 className="admin-login-title">Administrative Console</h1>
          <p className="admin-login-subtitle">
            Curator operations, user catalog governance, and system-wide RAG oversight.
          </p>
        </div>

        {errorMessage && (
          <div className="admin-login-error" role="alert" data-testid="admin-login-error">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="admin-error-icon"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="error-text">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-input-group">
            <label htmlFor="admin-email" className="admin-label">
              Administrator Email
            </label>
            <input
              id="admin-email"
              type="email"
              className="admin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@lorely.app"
              autoComplete="username"
              required
              disabled={submitting}
            />
          </div>

          <div className="admin-input-group">
            <label htmlFor="admin-password" className="admin-label">
              Security Password
            </label>
            <input
              id="admin-password"
              type="password"
              className="admin-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="admin-login-submit-btn"
            disabled={submitting}
            data-testid="admin-login-btn"
          >
            {submitting ? (
              <>
                <span className="admin-spinner" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <span>Authenticate Portal →</span>
            )}
          </button>

          <div className="admin-quickfill-container">
            <button
              type="button"
              className="admin-fill-credentials-btn"
              onClick={() => {
                setEmail('admin@lorely.app');
                setPassword('LorelyAdmin2026!Secure');
              }}
            >
              🔑 Quick Fill Administrator Credentials
            </button>
          </div>
        </form>

        <div className="admin-login-footer">
          <Link to="/" className="admin-back-link">
            ← Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
