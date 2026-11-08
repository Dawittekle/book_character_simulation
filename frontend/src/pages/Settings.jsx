import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../services/lorelyApi';
import './Settings.css';

export default function Settings() {
  const { accessToken } = useOutletContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [readingTheme, setReadingTheme] = useState('parchment');
  const [spoilerPolicy, setSpoilerPolicy] = useState('cautious');
  const [enterToSend, setEnterToSend] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [meData, settingsData] = await Promise.all([
          lorelyApi.getMe(accessToken),
          lorelyApi.getSettings(accessToken),
        ]);
        if (mounted) {
          if (meData) {
            setProfile(meData);
            setDisplayName(meData.display_name || '');
          }
          if (settingsData) {
            setReadingTheme(settingsData.reading_theme || 'parchment');
            setSpoilerPolicy(settingsData.spoiler_policy || 'cautious');
            setEnterToSend(settingsData.enter_to_send ?? true);
          }
        }
      } catch (err) {
        // Fall back gracefully
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);

    try {
      await Promise.all([
        lorelyApi.updateMe({ displayName }, accessToken),
        lorelyApi.updateSettings(
          {
            reading_theme: readingTheme,
            spoiler_policy: spoilerPolicy,
            enter_to_send: enterToSend,
          },
          accessToken,
        ),
      ]);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lorely-settings-page" data-testid="settings-page">
      <header className="settings-header">
        <button
          type="button"
          className="page-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ← Back
        </button>
        <h1 className="settings-title">Reader Preferences & Profile</h1>
        <p className="settings-subtitle">
          Configure your personal reading environment, spoiler boundaries, and display identity.
        </p>
      </header>

      {savedNotice && (
        <div className="settings-saved-banner">
          ✓ Your preferences have been saved successfully.
        </div>
      )}

      <form className="settings-form" onSubmit={handleSave}>
        {/* Profile Section */}
        <section className="settings-section">
          <h2 className="section-title">Identity</h2>

          <div className="settings-field">
            <label className="field-label">Display Name</label>
            <input
              type="text"
              className="field-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name or Pen Name"
            />
          </div>

          <div className="settings-field">
            <label className="field-label">Email Address</label>
            <input
              type="email"
              className="field-input"
              value={profile?.email || 'reader@lorely.app'}
              disabled
            />
            <span className="field-hint">Managed via Supabase Authentication</span>
          </div>

          <div className="settings-field">
            <label className="field-label">Platform Role</label>
            <div className="role-pill">
              <span>{profile?.role === 'admin' ? '🛡️ Administrator' : '📖 Reader'}</span>
            </div>
          </div>
        </section>

        {/* Reading Atmosphere */}
        <section className="settings-section">
          <h2 className="section-title">Reading Environment</h2>

          <div className="settings-field">
            <label className="field-label">Theme</label>
            <div className="theme-options-grid">
              <label className={`theme-card ${readingTheme === 'parchment' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  value="parchment"
                  checked={readingTheme === 'parchment'}
                  onChange={() => setReadingTheme('parchment')}
                />
                <span className="theme-card-preview parchment-preview" />
                <span className="theme-card-label">Classic Parchment</span>
              </label>

              <label className={`theme-card ${readingTheme === 'midnight' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  value="midnight"
                  checked={readingTheme === 'midnight'}
                  onChange={() => setReadingTheme('midnight')}
                />
                <span className="theme-card-preview midnight-preview" />
                <span className="theme-card-label">Midnight Library</span>
              </label>
            </div>
          </div>
        </section>

        {/* Spoiler Boundaries */}
        <section className="settings-section">
          <h2 className="section-title">Spoiler Protection</h2>
          <p className="section-desc">
            Controls how characters reveal key plot points, late-chapter twists, and character betrayals.
          </p>

          <div className="spoiler-options-list">
            <label className="spoiler-radio-row">
              <input
                type="radio"
                name="spoiler"
                value="cautious"
                checked={spoilerPolicy === 'cautious'}
                onChange={() => setSpoilerPolicy('cautious')}
              />
              <div className="spoiler-radio-text">
                <strong>Cautious (Recommended)</strong>
                <span>Characters will only discuss events from early chapters until you ask directly.</span>
              </div>
            </label>

            <label className="spoiler-radio-row">
              <input
                type="radio"
                name="spoiler"
                value="no_spoilers"
                checked={spoilerPolicy === 'no_spoilers'}
                onChange={() => setSpoilerPolicy('no_spoilers')}
              />
              <div className="spoiler-radio-text">
                <strong>Strict (No Spoilers)</strong>
                <span>Characters strictly restrict knowledge to Chapter 1 context.</span>
              </div>
            </label>

            <label className="spoiler-radio-row">
              <input
                type="radio"
                name="spoiler"
                value="unrestricted"
                checked={spoilerPolicy === 'unrestricted'}
                onChange={() => setSpoilerPolicy('unrestricted')}
              />
              <div className="spoiler-radio-text">
                <strong>Unrestricted</strong>
                <span>Characters can freely discuss any event or revelation across the entire book.</span>
              </div>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="section-title">Chat Controls</h2>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={enterToSend}
              onChange={(e) => setEnterToSend(e.target.checked)}
            />
            <span>Press Enter to send messages (Shift+Enter for new line)</span>
          </label>
        </section>

        <div className="settings-actions">
          <button type="submit" className="settings-save-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}
