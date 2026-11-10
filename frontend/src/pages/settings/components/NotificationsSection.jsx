import React, { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, BookMarked, Sparkles, CheckCircle2 } from 'lucide-react';

const DEFAULT_NOTIFICATIONS = {
  email_digest: true,
  email_new_books: false,
  app_character_replies: true,
  app_reading_streaks: true,
  app_announcements: true,
};

export default function NotificationsSection({ settings, onUpdateNotifications }) {
  const [preferences, setPreferences] = useState(() => ({
    ...DEFAULT_NOTIFICATIONS,
    ...(settings?.notification_preferences || {}),
  }));
  const [savingStatus, setSavingStatus] = useState(null);

  useEffect(() => {
    if (settings?.notification_preferences) {
      setPreferences((prev) => ({
        ...prev,
        ...settings.notification_preferences,
      }));
    }
  }, [settings]);

  const handleToggle = async (key) => {
    const nextVal = !preferences[key];
    const updated = { ...preferences, [key]: nextVal };
    setPreferences(updated);
    setSavingStatus('saving');

    if (onUpdateNotifications) {
      try {
        await onUpdateNotifications(updated);
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 2000);
      } catch (err) {
        console.warn('Failed to update notification preferences:', err);
        setSavingStatus(null);
      }
    } else {
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus(null), 1500);
    }
  };

  return (
    <div className="settings-section-container" data-testid="notifications-section">
      <div className="settings-section-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="settings-section-title">Notifications &amp; Alerts</h2>
            <p className="settings-section-subtitle">
              Manage how Lorely communicates with you regarding reading milestones, new book releases, and character dialogues.
            </p>
          </div>
          {savingStatus === 'saved' && (
            <div className="settings-saved-pill" role="status">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section-body space-y-6">
        {/* Email Notifications */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">Email Communications</h3>
            </div>
          </div>

          <div className="security-rows-list">
            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">Weekly Reading Summary Digest</span>
                  <span className="security-row-desc">
                    Weekly recap of finished chapters, highlights, and reflections.
                  </span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.email_digest}
                  aria-label="Toggle weekly reading summary email"
                  className={`settings-toggle-switch ${preferences.email_digest ? 'checked' : ''}`}
                  onClick={() => handleToggle('email_digest')}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>

            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">New Book Arrivals &amp; Classics</span>
                  <span className="security-row-desc">
                    Notifications for newly added titles and classical literature.
                  </span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.email_new_books}
                  aria-label="Toggle new book arrivals email"
                  className={`settings-toggle-switch ${preferences.email_new_books ? 'checked' : ''}`}
                  onClick={() => handleToggle('email_new_books')}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* In-App Alerts */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">In-App Notifications</h3>
            </div>
          </div>

          <div className="security-rows-list">
            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">Character Whispers &amp; Dialogue Responses</span>
                  <span className="security-row-desc">
                    Alerts when book characters reflect on your reading margin notes.
                  </span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.app_character_replies}
                  aria-label="Toggle character whisper notifications"
                  className={`settings-toggle-switch ${preferences.app_character_replies ? 'checked' : ''}`}
                  onClick={() => handleToggle('app_character_replies')}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>

            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">Reading Habit Streaks &amp; Milestones</span>
                  <span className="security-row-desc">
                    Milestone celebrations for consecutive daily reading streaks.
                  </span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.app_reading_streaks}
                  aria-label="Toggle reading streak notifications"
                  className={`settings-toggle-switch ${preferences.app_reading_streaks ? 'checked' : ''}`}
                  onClick={() => handleToggle('app_reading_streaks')}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>

            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">Product Updates &amp; Enhancements</span>
                  <span className="security-row-desc">
                    Updates on new narration voices and reading studio features.
                  </span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.app_announcements}
                  aria-label="Toggle product updates notifications"
                  className={`settings-toggle-switch ${preferences.app_announcements ? 'checked' : ''}`}
                  onClick={() => handleToggle('app_announcements')}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
