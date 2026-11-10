import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, User as UserIcon } from 'lucide-react';
import { lorelyApi, resolveAvatarUrl } from '../../services/lorelyApi';
import SettingsSidebar, { SETTINGS_SECTIONS } from './SettingsSidebar';
import ProfileSection from './components/ProfileSection';
import SecuritySection from './components/SecuritySection';
import AppearanceSection from './components/AppearanceSection';
import ReadingAudioSection from './components/ReadingAudioSection';
import LanguageSection from './components/LanguageSection';
import NotificationsSection from './components/NotificationsSection';
import BillingSection from './components/BillingSection';
import PrivacySection from './components/PrivacySection';
import {
  initThemePreferences,
  applyAppTheme,
  applyAccentColor,
  applyHighContrast,
  applyReducedMotion,
} from '../../lib/themeManager';
import './SettingsHub.css';

export default function SettingsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const accessToken = outletContext.accessToken;
  const session = outletContext.session;
  const openPricingModal = outletContext.openPricingModal;
  const onSignOut = outletContext.onSignOut;
  const onProfileUpdated = outletContext.onProfileUpdated;

  const activeTab = searchParams.get('tab') || 'profile';
  const [mobileSubpageOpen, setMobileSubpageOpen] = useState(Boolean(searchParams.get('tab')));
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 860 : false));

  // User profile & preferences state
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  // Monitor window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 860;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileSubpageOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize local theme on mount
  useEffect(() => {
    initThemePreferences();
  }, []);

  // Fetch user profile and settings from backend
  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [meData, settingsData] = await Promise.all([
        lorelyApi.getMe(accessToken).catch(() => null),
        lorelyApi.getSettings(accessToken).catch(() => null),
      ]);
      setMe(meData);
      setSettings(settingsData);
      if (meData && onProfileUpdated) {
        onProfileUpdated(meData);
      }
      if (settingsData) {
        if (settingsData.app_theme) applyAppTheme(settingsData.app_theme);
        if (settingsData.accent_color) applyAccentColor(settingsData.accent_color);
        if (typeof settingsData.high_contrast === 'boolean') applyHighContrast(settingsData.high_contrast);
        if (typeof settingsData.reduced_motion === 'boolean') applyReducedMotion(settingsData.reduced_motion);
      }
    } catch (err) {
      console.warn('Failed to load user settings:', err);
      setError(err.message || 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [accessToken]);

  const handleSelectTab = (tabId) => {
    setSearchParams({ tab: tabId });
    if (isMobile) {
      setMobileSubpageOpen(true);
    }
  };

  const handleBackToMobileList = () => {
    setMobileSubpageOpen(false);
  };

  // Derive initials for avatar fallback
  const getInitials = () => {
    const name = me?.full_name || me?.display_name || me?.email || 'Reader';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Render the active section content
  const renderActiveSection = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <ProfileSection
            me={me}
            onUpdateProfile={async (updates) => {
              const res = await lorelyApi.updateMe(updates, accessToken);
              setMe(res);
              if (onProfileUpdated) onProfileUpdated(res);
              window.dispatchEvent(new CustomEvent('lorely:profile-updated', { detail: res }));
            }}
            onUploadAvatar={async (file) => {
              const res = await lorelyApi.uploadAvatar(file, accessToken);
              const updatedProfile = res.profile || res;
              setMe(updatedProfile);
              if (onProfileUpdated) onProfileUpdated(updatedProfile);
              window.dispatchEvent(new CustomEvent('lorely:profile-updated', { detail: updatedProfile }));
            }}
            onDeleteAvatar={async () => {
              const res = await lorelyApi.deleteAvatar(accessToken);
              const updatedProfile = res.profile || res;
              setMe(updatedProfile);
              if (onProfileUpdated) onProfileUpdated(updatedProfile);
              window.dispatchEvent(new CustomEvent('lorely:profile-updated', { detail: updatedProfile }));
            }}
            loading={loading}
          />
        );
      case 'security':
        return <SecuritySection session={session} me={me} />;
      case 'appearance':
        return (
          <AppearanceSection
            settings={settings}
            onUpdateSettings={async (updates) => {
              const res = await lorelyApi.updateSettings(updates, accessToken);
              setSettings(res);
            }}
          />
        );
      case 'reading-audio':
        return (
          <ReadingAudioSection
            settings={settings}
            onUpdateSettings={async (updates) => {
              const res = await lorelyApi.updateSettings(updates, accessToken);
              setSettings(res);
            }}
          />
        );
      case 'language':
        return (
          <LanguageSection
            settings={settings}
            me={me}
            onUpdateLanguage={async (lang) => {
              await Promise.all([
                lorelyApi.updateMe({ preferredLanguage: lang }, accessToken),
                lorelyApi.updateSettings({ preferred_ui_language: lang }, accessToken),
              ]);
              loadUserData();
            }}
            onUpdateSettings={async (updates) => {
              const res = await lorelyApi.updateSettings(updates, accessToken);
              setSettings(res);
            }}
          />
        );
      case 'notifications':
        return (
          <NotificationsSection
            settings={settings}
            onUpdateNotifications={async (notifPrefs) => {
              const res = await lorelyApi.updateSettings(
                { notification_preferences: notifPrefs },
                accessToken
              );
              setSettings(res);
            }}
          />
        );
      case 'billing':
        return <BillingSection onOpenPricingModal={openPricingModal} accessToken={accessToken} />;
      case 'privacy':
        return (
          <PrivacySection
            accessToken={accessToken}
            onSignOut={onSignOut}
            onDeleteAccount={async () => {
              await lorelyApi.deleteAccount(accessToken);
            }}
          />
        );
      default:
        return null;
    }
  };

  const displayName = me?.display_name || me?.full_name || 'Dawit Teklebrhan';
  const email = me?.email || (session?.user?.email || 'dawit@example.com');

  return (
    <div
      className={`lorely-settings-hub ${mobileSubpageOpen ? 'mobile-subpage-open' : ''}`}
      data-testid="settings-page"
    >
      <div className="settings-hub-container">
        {/* Main Hub Header */}
        <header className="settings-hub-header">
          <div className="settings-hub-nav-row mb-3">
            <button
              type="button"
              className="page-back-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 bg-white/80 dark:bg-stone-900/80 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-medium transition-colors cursor-pointer"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Back</span>
            </button>
          </div>
          <h1 className="settings-hub-title">Settings</h1>
          <p className="settings-hub-subtitle">
            Manage your account, personalize your reading experience and control your subscription.
          </p>
        </header>

        {/* User Identity Card / Banner (Matching Image 1) */}
        <div className="settings-identity-card" data-testid="settings-identity-card">
          <div className="settings-identity-left">
            <div className="settings-identity-avatar-wrap">
              {me?.avatar_url ? (
                <img
                  src={me.avatar_url}
                  alt={displayName}
                  className="settings-identity-avatar-img"
                />
              ) : (
                <span>{getInitials()}</span>
              )}
            </div>
            <div className="settings-identity-meta">
              <span className="settings-identity-name">{displayName}</span>
              <span className="settings-identity-email">{email}</span>
            </div>
          </div>
          <div className="settings-identity-badge">
            <span className="settings-identity-badge-dot" />
            <span>Active</span>
          </div>
        </div>

        {/* Responsive Two-Column Layout */}
        <div className="settings-hub-body">
          {/* Left Navigation Sidebar */}
          <SettingsSidebar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            isMobile={isMobile}
          />

          {/* Right Active Section Canvas */}
          <main
            className="settings-content-canvas"
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
          >
            {/* Mobile Header with Back Button */}
            <div className="settings-mobile-back-bar">
              <button
                type="button"
                className="settings-mobile-back-btn"
                onClick={handleBackToMobileList}
                aria-label="Back to settings categories"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>All Settings</span>
              </button>
            </div>

            {renderActiveSection()}
          </main>
        </div>
      </div>
    </div>
  );
}
