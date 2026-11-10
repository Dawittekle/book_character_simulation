import React, { useState } from 'react';
import { AlertTriangle, Trash2, LogOut, X } from 'lucide-react';
import { lorelyApi } from '../../../services/lorelyApi';
import { supabase } from '../../../lib/supabase';

export default function PrivacySection({ onSignOut, onDeleteAccount, accessToken }) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleSignOutClick = async () => {
    try {
      setSigningOut(true);
      setSignOutError(null);
      if (onSignOut) {
        await onSignOut();
      } else {
        await supabase.auth.signOut();
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (err) {
      console.warn('Failed to sign out:', err);
      setSignOutError(err.message || 'Failed to sign out.');
      setSigningOut(false);
    }
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Please type "DELETE" exactly to confirm.');
      return;
    }

    try {
      setDeleting(true);
      setDeleteError(null);

      if (onDeleteAccount) {
        await onDeleteAccount();
      } else {
        await lorelyApi.deleteAccount(accessToken);
      }

      // Purge session and sign out
      if (onSignOut) {
        await onSignOut();
      } else {
        await supabase.auth.signOut();
      }

      setShowDeleteModal(false);
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (err) {
      console.warn('Failed to delete account:', err);
      setDeleteError(err.message || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  return (
    <div className="settings-section-container" data-testid="privacy-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">Privacy &amp; Data</h2>
      </div>

      {signOutError && (
        <div className="settings-alert-banner error mb-4" role="alert">
          <AlertTriangle size={16} />
          <span>{signOutError}</span>
        </div>
      )}

      <div className="settings-section-body space-y-6">
        {/* Sign Out Action Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <LogOut size={16} className="text-stone-700 dark:text-stone-300" />
              <h3 className="settings-card-title">Sign Out</h3>
            </div>
            <p className="settings-card-description">
              Sign out of your Lorely account on this device.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              className="btn-settings-secondary"
              onClick={handleSignOutClick}
              disabled={signingOut}
              aria-label="Sign out of account"
            >
              <LogOut size={14} />
              <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* Delete Account Danger Card */}
        <div className="settings-card danger-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600" />
              <h3 className="settings-card-title text-rose-600">Delete Account</h3>
            </div>
          </div>

          <div className="security-rows-list">
            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">Delete Account &amp; All Data</span>
                  <span className="security-row-desc">
                    Permanently delete your profile, books, highlights, and character memories.
                  </span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  className="btn-settings-secondary danger"
                  onClick={() => {
                    setDeleteConfirmText('');
                    setDeleteError(null);
                    setShowDeleteModal(true);
                  }}
                  aria-label="Delete my account permanently"
                >
                  <Trash2 size={14} />
                  <span>Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="settings-modal-overlay" role="dialog" aria-modal="true">
          <div className="settings-modal-content">
            <div className="settings-modal-header">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-rose-600" />
                <h3 className="settings-modal-title text-rose-600">Delete Account</h3>
              </div>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close deletion modal"
              >
                <X size={18} />
              </button>
            </div>

            <p className="settings-modal-subtitle">
              This action cannot be undone. All your uploaded books, character relationships, reading annotations, and profile information will be permanently erased immediately.
            </p>

            {deleteError && (
              <div className="settings-alert-banner error mb-4" role="alert">
                <AlertTriangle size={16} />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div className="settings-field-group">
                <label htmlFor="delete-confirm-input" className="settings-label">
                  To confirm deletion, please type <span className="font-mono font-bold text-rose-600">DELETE</span> below:
                </label>
                <input
                  id="delete-confirm-input"
                  type="text"
                  className="settings-input"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  required
                />
              </div>

              <div className="settings-modal-actions">
                <button
                  type="button"
                  className="btn-settings-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-settings-primary danger"
                  disabled={deleteConfirmText.trim() !== 'DELETE' || deleting}
                  aria-label="Submit account deletion"
                >
                  {deleting ? 'Deleting Account...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
