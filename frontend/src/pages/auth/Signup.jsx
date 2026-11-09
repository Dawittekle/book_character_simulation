import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export default function Signup({ onBack }) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isSupabaseConfigured || supabase === null) {
      setErrorMessage('Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setNoticeMessage('Your account is ready. Opening your workspace now.');
        navigate('/');
      } else {
        setNoticeMessage(
          'Account created! Check your email to confirm your account before signing in.',
        );
      }
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuthSignIn = async (provider) => {
    if (!isSupabaseConfigured || supabase === null) {
      setErrorMessage(`Cannot sign up with ${provider}: Supabase is not configured.`);
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (err) {
      setErrorMessage(err.message || `Failed to sign up with ${provider}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout onBack={onBack} backUrl="/">
      <h1 className="auth-form-heading">Create Lorely account</h1>
      <p className="auth-form-subtext">
        Start your experience with Lorely by signing in or signing up.
      </p>

      {errorMessage && (
        <div className="auth-alert-banner" role="alert">
          {errorMessage}
        </div>
      )}

      {noticeMessage && (
        <div className="auth-success-banner" role="status">
          {noticeMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form-body">
        <div className="auth-field-group">
          <label className="auth-field-label" htmlFor="signup-name">
            Display name
          </label>
          <input
            id="signup-name"
            type="text"
            required
            autoComplete="name"
            className="auth-field-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Dawit Teklebrhan"
          />
        </div>

        <div className="auth-field-group">
          <label className="auth-field-label" htmlFor="signup-email">
            Email address
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            className="auth-field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dawit@lorely.example"
          />
        </div>

        <div className="auth-field-group">
          <label className="auth-field-label" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            required
            autoComplete="new-password"
            className="auth-field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          className="auth-primary-submit-btn"
          disabled={submitting}
        >
          {submitting ? 'Creating workspace...' : 'Sign up'}
        </button>

        <div className="auth-oauth-group">
          <button
            type="button"
            className="auth-oauth-btn"
            onClick={() => handleOAuthSignIn('google')}
            disabled={submitting}
          >
            {/* Google G SVG */}
            <svg className="auth-oauth-icon" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            className="auth-oauth-btn"
            onClick={() => handleOAuthSignIn('azure')}
            disabled={submitting}
          >
            {/* Microsoft 4-Color Grid SVG */}
            <svg className="auth-oauth-icon" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            <span>Continue with Microsoft</span>
          </button>
        </div>

        <p className="auth-disclaimer-text">
          By creating an account, you agree to our{' '}
          <span className="auth-disclaimer-link">Privacy Policy</span>
        </p>

        <div className="auth-switch-link-wrapper">
          <span>Already have an account?</span>
          <Link to="/login" className="auth-switch-action">
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
