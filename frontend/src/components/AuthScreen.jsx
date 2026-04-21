import { useState } from 'react';
import './AuthScreen.css';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

function AuthScreen({ setupMode = false }) {
  const [intent, setIntent] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (supabase === null || !isSupabaseConfigured) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      if (intent === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          setNoticeMessage('Your account is ready. Opening your workspace now.');
        } else {
          setNoticeMessage(
            'Account created. Check your inbox if your Supabase project requires email confirmation.',
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setNoticeMessage('Signed in. Redirecting to your studio.');
      }
    } catch (error) {
      setErrorMessage(error.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <section className="auth-preview">
        <div className="auth-preview-topline">Private reading workspace</div>
        <h1>Character Studio keeps every book, character, and conversation together.</h1>
        <p>
          Upload a manuscript once, extract the cast, and return to each
          conversation with the emotional and psychological state preserved.
        </p>

        <div className="auth-preview-canvas">
          <div className="preview-rail">
            <span className="preview-brand-mark">L</span>
            <span className="preview-dot" />
            <span className="preview-dot" />
          </div>

          <div className="preview-sidebar">
            <div className="preview-team">Reading Studio</div>
            <div className="preview-nav">
              <span className="preview-nav-item is-active">Library</span>
              <span className="preview-nav-item">Characters</span>
              <span className="preview-nav-item">Conversations</span>
            </div>

            <div className="preview-project-list">
              <div className="preview-project-card">
                <strong>The Cinderella Play</strong>
                <span>3 characters · 1 conversation</span>
              </div>
              <div className="preview-project-card is-muted">
                <strong>Hamlet</strong>
                <span>Preparing extraction</span>
              </div>
            </div>
          </div>

          <div className="preview-workspace">
            <div className="preview-toolbar" />
            <div className="preview-hero">
              <span className="outline-pill">Live character board</span>
              <strong>Build an organized studio for every book you upload.</strong>
              <span>
                Store character dossiers, emotional drift, and session history in
                one calm workspace.
              </span>
            </div>
            <div className="preview-card-grid">
              <article className="preview-book-card">
                <div className="preview-book-illustration" />
                <strong>Cinderella</strong>
                <span>Joy 72% · Pride 51%</span>
              </article>
              <article className="preview-book-card is-placeholder">
                <div className="preview-book-add">+</div>
                <span>New book</span>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="section-eyebrow">
          {setupMode ? 'Environment setup' : 'Sign in to continue'}
        </div>
        <h2 className="card-title">
          {setupMode ? 'Finish the client configuration first.' : 'Welcome back to your workspace.'}
        </h2>
        <p className="card-copy">
          {setupMode
            ? 'The frontend needs your Supabase project URL and publishable key before the logged-in experience can load.'
            : 'Use the same Supabase account your backend is connected to so your books and chats stay attached to your profile.'}
        </p>

        {setupMode ? (
          <div className="auth-setup-list">
            <div className="auth-setup-row">
              <span className="outline-pill">1</span>
              <div>
                <strong>Add the frontend env file.</strong>
                <p>
                  Create `frontend/.env` and copy the values from
                  `frontend/.env.example`.
                </p>
              </div>
            </div>
            <div className="auth-setup-row">
              <span className="outline-pill">2</span>
              <div>
                <strong>Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.</strong>
                <p>
                  The frontend uses the publishable key, not the service-role key.
                </p>
              </div>
            </div>
            <div className="auth-setup-row">
              <span className="outline-pill">3</span>
              <div>
                <strong>Set `VITE_API_URL` to your Flask API.</strong>
                <p>
                  Local default: `http://127.0.0.1:5000/api`
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="auth-intent-toggle">
              <button
                type="button"
                className={intent === 'signin' ? 'auth-intent is-active' : 'auth-intent'}
                onClick={() => setIntent('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={intent === 'signup' ? 'auth-intent is-active' : 'auth-intent'}
                onClick={() => setIntent('signup')}
              >
                Create account
              </button>
            </div>

            {errorMessage ? <div className="alert-banner">{errorMessage}</div> : null}
            {noticeMessage ? <div className="success-banner">{noticeMessage}</div> : null}

            <form className="auth-form" onSubmit={handleSubmit}>
              {intent === 'signup' ? (
                <label>
                  <span className="field-label">Display name</span>
                  <input
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Dawit Teklebrhan"
                  />
                </label>
              ) : null}

              <label>
                <span className="field-label">Email</span>
                <input
                  required
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teklebrahandawit309@gmail.com"
                />
              </label>

              <label>
                <span className="field-label">Password</span>
                <input
                  required
                  autoComplete={intent === 'signup' ? 'new-password' : 'current-password'}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder=".........."
                />
              </label>

              <button className="primary-button" disabled={isSubmitting} type="submit">
                {isSubmitting
                  ? 'Working...'
                  : intent === 'signup'
                    ? 'Create your workspace'
                    : 'Open the studio'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default AuthScreen;
