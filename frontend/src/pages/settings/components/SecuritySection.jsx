import React, { useState, useEffect } from 'react';
import {
  Lock,
  Key,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogOut,
  Laptop,
  X,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

export default function SecuritySection({ session, me }) {
  const [identities, setIdentities] = useState([]);
  const [providers, setProviders] = useState([]);
  const [hasPassword, setHasPassword] = useState(true);
  const [hasGoogle, setHasGoogle] = useState(false);

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Feedback Banners
  const [bannerSuccess, setBannerSuccess] = useState(null);
  const [bannerError, setBannerError] = useState(null);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  // Inspect user identities from session or Supabase client
  useEffect(() => {
    let isMounted = true;

    async function inspectUserIdentities() {
      try {
        let user = session?.user;
        if (!user && isSupabaseConfigured && supabase) {
          const { data } = await supabase.auth.getUser();
          user = data?.user;
        }

        if (user && isMounted) {
          const userProviders = user.app_metadata?.providers || [user.app_metadata?.provider].filter(Boolean);
          const userIdentities = user.identities || [];

          setProviders(userProviders);
          setIdentities(userIdentities);

          const googleConnected =
            userProviders.includes('google') ||
            userIdentities.some((i) => i.provider === 'google');
          const emailConnected =
            userProviders.includes('email') ||
            userIdentities.some((i) => i.provider === 'email');

          setHasGoogle(googleConnected);

          // If user signed up via Google only and has never set a local email password
          if (googleConnected && !emailConnected) {
            setHasPassword(false);
          } else {
            setHasPassword(true);
          }
        }
      } catch (err) {
        console.warn('Could not inspect user identities:', err);
      }
    }

    inspectUserIdentities();
    return () => {
      isMounted = false;
    };
  }, [session]);

  // Open Set or Change Password modal
  const handleOpenPasswordModal = () => {
    setNewPassword('');
    setConfirmPassword('');
    setModalError(null);
    setIsPasswordModalOpen(true);
  };

  // Submit Password update/creation via Supabase updateUser
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setModalError(null);

    if (newPassword.length < 6) {
      setModalError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setModalError('Passwords do not match. Please verify.');
      return;
    }

    try {
      setModalLoading(true);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          throw error;
        }
      }

      setHasPassword(true);
      setIsPasswordModalOpen(false);
      setBannerSuccess(
        hasPassword
          ? 'Your password has been changed successfully.'
          : 'Your account password has been set. You can now sign in with either Google or email/password.'
      );
      setTimeout(() => setBannerSuccess(null), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to update password.');
    } finally {
      setModalLoading(false);
    }
  };

  // Sign out other sessions
  const handleSignOutOtherSessions = async () => {
    try {
      setSigningOutOthers(true);
      setBannerError(null);

      if (isSupabaseConfigured && supabase) {
        // Scope 'others' terminates all sessions other than current
        const { error } = await supabase.auth.signOut({ scope: 'others' });
        if (error) throw error;
      }

      setBannerSuccess('Signed out of all other devices and browser sessions successfully.');
      setTimeout(() => setBannerSuccess(null), 4000);
    } catch (err) {
      setBannerError(err.message || 'Could not sign out other sessions.');
    } finally {
      setSigningOutOthers(false);
    }
  };

  const userEmail = me?.email || session?.user?.email || 'reader@lorely.app';

  return (
    <div className="settings-section-container" data-testid="security-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">Security &amp; Sign-in</h2>
        <p className="settings-section-subtitle">
          Manage your password, Google account connection, and active reader sessions.
        </p>
      </div>

      <div className="settings-section-body space-y-6">
        {bannerSuccess && (
          <div className="settings-alert-banner success" role="alert">
            <CheckCircle2 size={16} />
            <span>{bannerSuccess}</span>
          </div>
        )}

      {bannerError && (
        <div className="settings-alert-banner error" role="alert">
          <AlertCircle size={16} />
          <span>{bannerError}</span>
        </div>
      )}

      {/* Password & Credentials Card (GitHub Style matching Image 3) */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">Authentication & Password</h3>
        </div>

        <div className="security-rows-list">
          {/* Email row */}
          <div className="security-row">
            <div className="security-row-left">
              <div className="security-icon-wrap">
                <Mail size={16} />
              </div>
              <div className="security-row-info">
                <span className="security-row-title">Email</span>
                <span className="security-row-desc">{userEmail} (Verified)</span>
              </div>
            </div>
            <div className="security-row-right">
              <span className="settings-badge-pill success">Verified</span>
            </div>
          </div>

          {/* Password row */}
          <div className="security-row">
            <div className="security-row-left">
              <div className="security-icon-wrap">
                <Key size={16} />
              </div>
              <div className="security-row-info">
                <span className="security-row-title">Password</span>
                <span className="security-row-desc">
                  {hasPassword
                    ? 'Password is configured for this account'
                    : 'No password set (Google single sign-on)'}
                </span>
              </div>
            </div>
            <div className="security-row-right">
              <button
                type="button"
                className="btn-settings-secondary"
                onClick={handleOpenPasswordModal}
                aria-label={hasPassword ? 'Change account password' : 'Set account password'}
              >
                {hasPassword ? 'Change password' : 'Set password'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Accounts Card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">Connected Accounts</h3>
        </div>

        <div className="security-rows-list">
          <div className="security-row">
            <div className="security-row-left">
              <div className="security-icon-wrap google">
                <svg width="16" height="16" viewBox="0 0 24 24">
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
              </div>
              <div className="security-row-info">
                <span className="security-row-title">Google</span>
                <span className="security-row-desc">
                  {hasGoogle
                    ? `1 account connected (${userEmail})`
                    : 'No Google account connected'}
                </span>
              </div>
            </div>
            <div className="security-row-right">
              {hasGoogle ? (
                <span className="settings-badge-pill success">Connected</span>
              ) : (
                <span className="settings-badge-pill">Not connected</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Sessions Card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">Active Sessions</h3>
        </div>

        <div className="security-rows-list">
          <div className="security-row">
            <div className="security-row-left">
              <div className="security-icon-wrap">
                <Laptop size={16} />
              </div>
              <div className="security-row-info">
                <span className="security-row-title">Current Browser Session</span>
                <span className="security-row-desc">
                  This device · Web Browser · Active now
                </span>
              </div>
            </div>
            <div className="security-row-right">
              <button
                type="button"
                className="btn-settings-secondary danger"
                onClick={handleSignOutOtherSessions}
                disabled={signingOutOthers}
                aria-label="Sign out of other sessions"
              >
                <LogOut size={14} />
                <span>{signingOutOthers ? 'Signing out...' : 'Sign out other sessions'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Set / Change Password Modal Dialog */}
      {isPasswordModalOpen && (
        <div
          className="settings-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-modal-title"
        >
          <div className="settings-modal-card">
            <div className="settings-modal-header">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-amber-600 dark:text-amber-500" />
                <h3 id="password-modal-title" className="settings-modal-title">
                  {hasPassword ? 'Change Password' : 'Set Account Password'}
                </h3>
              </div>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setIsPasswordModalOpen(false)}
                aria-label="Close password modal"
              >
                <X size={18} />
              </button>
            </div>

            <p className="settings-modal-desc">
              {hasPassword
                ? 'Choose a strong password with at least 6 characters.'
                : 'Create a password to enable email & password sign-in for your Google-authenticated account.'}
            </p>

            {modalError && (
              <div className="settings-alert-banner error" role="alert">
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="settings-field-group">
                <label htmlFor="new-password-input" className="settings-label">
                  New Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="new-password-input"
                    type={showPassword ? 'text' : 'password'}
                    className="settings-input"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="settings-field-group">
                <label htmlFor="confirm-password-input" className="settings-label">
                  Confirm Password
                </label>
                <input
                  id="confirm-password-input"
                  type={showPassword ? 'text' : 'password'}
                  className="settings-input"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="settings-modal-actions">
                <button
                  type="button"
                  className="btn-settings-secondary"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-settings-primary"
                  disabled={modalLoading}
                  aria-label={hasPassword ? 'Submit password update' : 'Submit set password'}
                >
                  {modalLoading
                    ? 'Saving...'
                    : hasPassword
                    ? 'Update Password'
                    : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
