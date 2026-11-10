import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, CheckCircle2, AlertCircle, Sparkles, User, Shield } from 'lucide-react';

export default function ProfileSection({
  me,
  onUpdateProfile,
  onUploadAvatar,
  onDeleteAvatar,
  loading = false,
}) {
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);

  // Sync state from me prop
  useEffect(() => {
    if (me) {
      setFullName(me.full_name || '');
      setDisplayName(me.display_name || '');
    }
  }, [me]);

  // Compute if form has dirty (unsaved) changes
  const hasChanges =
    fullName.trim() !== (me?.full_name || '').trim() ||
    displayName.trim() !== (me?.display_name || '').trim();

  // Avatar initials fallback
  const getInitials = () => {
    const name = fullName || displayName || me?.email || 'Reader';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Avatar file validation and upload
  const handleFile = async (file) => {
    if (!file) return;

    setErrorMessage(null);

    // 1. Format check
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Please select a valid image (PNG, JPEG, or WebP).');
      return;
    }

    // 2. Size check (10MB limit matching reference)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Avatar image size must be less than 10MB.');
      return;
    }

    try {
      setUploadingAvatar(true);
      if (onUploadAvatar) {
        await onUploadAvatar(file);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Delete Avatar
  const handleDeleteAvatar = async () => {
    if (!onDeleteAvatar) return;
    try {
      setUploadingAvatar(true);
      setErrorMessage(null);
      await onDeleteAvatar();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Submit profile details
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasChanges || saving) return;

    setSaving(true);
    setErrorMessage(null);

    try {
      if (onUpdateProfile) {
        await onUpdateProfile({
          fullName: fullName.trim(),
          displayName: displayName.trim(),
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    if (me) {
      setFullName(me.full_name || '');
      setDisplayName(me.display_name || '');
      setErrorMessage(null);
    }
  };

  const memberSince = me?.created_at
    ? new Date(me.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recently';

  return (
    <div className="profile-section-view" data-testid="profile-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">Profile Details</h2>
        <p className="settings-section-subtitle">
          Manage your personal details, pen name, and reader avatar.
        </p>
      </div>

      {saveSuccess && (
        <div className="settings-alert-banner success" role="alert">
          <CheckCircle2 size={16} />
          <span>Your profile has been saved successfully.</span>
        </div>
      )}

      {errorMessage && (
        <div className="settings-alert-banner error" role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Avatar Card (Notion/Nicelydone style matching Image 2) */}
      <div className="settings-card avatar-upload-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">Profile Photo</h3>
        </div>

        <div
          className={`avatar-upload-body ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <div className="avatar-preview-wrap">
            {me?.avatar_url ? (
              <img
                src={me.avatar_url}
                alt={displayName || fullName || 'User Avatar'}
                className="avatar-preview-image"
              />
            ) : (
              <div className="avatar-initials-fallback">
                <span>{getInitials()}</span>
              </div>
            )}
          </div>

          <div className="avatar-controls-meta">
            <div className="avatar-action-buttons">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden-file-input"
                onChange={handleFileChange}
                aria-label="Upload profile avatar"
              />
              <button
                type="button"
                className="btn-settings-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || loading}
              >
                <Upload size={14} />
                <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
              </button>

              {me?.avatar_url && (
                <button
                  type="button"
                  className="btn-settings-secondary danger"
                  onClick={handleDeleteAvatar}
                  disabled={uploadingAvatar || loading}
                  aria-label="Remove avatar"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <p className="avatar-guidelines">
              Recommended size 1:1, up to 10MB. Formats: PNG, JPEG, or WebP. Drag & drop supported.
            </p>
          </div>
        </div>
      </div>

      {/* Identity Details Form */}
      <form onSubmit={handleSubmit} className="profile-details-form">
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Identity & Pen Name</h3>
          </div>

          <div className="settings-form-grid">
            <div className="settings-field-group">
              <label htmlFor="input-full-name" className="settings-label">
                Full Name
              </label>
              <input
                id="input-full-name"
                type="text"
                className="settings-input"
                placeholder="e.g. Jane Austen"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={255}
              />
              <span className="settings-field-hint">Your legal or administrative account name.</span>
            </div>

            <div className="settings-field-group">
              <label htmlFor="input-display-name" className="settings-label">
                Display / Pen Name
              </label>
              <input
                id="input-display-name"
                type="text"
                className="settings-input"
                placeholder="e.g. Jane A."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={255}
              />
              <span className="settings-field-hint">
                Visible to characters in simulation sessions and shown on personal margin notes.
              </span>
            </div>
          </div>
        </div>

        {/* Email & Authentication Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Email Address</h3>
          </div>

          <div className="settings-field-group">
            <input
              type="email"
              className="settings-input disabled"
              value={me?.email || ''}
              disabled
              aria-label="Account email address"
            />
            <span className="settings-field-hint">
              Managed securely via Supabase Authentication. To update your email or password, visit Security & Sign-in.
            </span>
          </div>
        </div>

        {/* Account Metadata & Roles */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Account Information</h3>
          </div>

          <div className="settings-meta-row">
            <div className="settings-meta-item">
              <span className="settings-meta-label">Account User</span>
              <div className="role-pill">
                <User size={14} className="text-stone-500" />
                <span>{me?.role === 'admin' ? 'Administrator' : 'Reader'}</span>
              </div>
            </div>

            <div className="settings-meta-item">
              <span className="settings-meta-label">Member Since</span>
              <span className="settings-meta-value">{memberSince}</span>
            </div>

            <div className="settings-meta-item">
              <span className="settings-meta-label">Books in Library</span>
              <span className="settings-meta-value">{me?.book_count ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="settings-form-actions">
          <button
            type="submit"
            className="btn-settings-primary save-btn"
            disabled={!hasChanges || saving || loading}
          >
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>

          {hasChanges && (
            <button
              type="button"
              className="btn-settings-secondary"
              onClick={handleDiscard}
              disabled={saving}
            >
              Discard
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
